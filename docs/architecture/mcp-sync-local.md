# Serveur MCP Local : Synchronisation Fichiers ↔ API MarkD

## Concept

Un **serveur MCP local** qui tourne sur la machine de développement, synchronise automatiquement :
- **Fichiers locaux** (Markdown sur disque) ↔ **API MarkD** (base de données)
- **Push** : Fichiers locaux → DB MarkD
- **Pull** : DB MarkD → Fichiers locaux
- **Pas de Git** : Pas de versioning, juste sync bidirectionnelle

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Machine de Dev                                          │
│                                                          │
│  /projet/docs/              ┌──────────────────────┐   │
│  ├── folder1/                │  Serveur MCP Local  │   │
│  │   ├── doc1.md  ──────────▶│  (watchdog)         │   │
│  │   └── doc2.md             │                      │   │
│  └── root.md                 │  - Watch fichiers   │   │
│                              │  - Push vers API    │   │
│                              │  - Pull depuis API  │   │
│                              └──────────┬───────────┘   │
│                                         │                │
└─────────────────────────────────────────┼────────────────┘
                                           │ HTTP/WebSocket
                                           ▼
┌─────────────────────────────────────────────────────────┐
│  Serveur MarkD (Production)                             │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  API MarkD   │◀────────│  Base MySQL  │            │
│  │  (FastAPI)   │         │  (documents) │            │
│  └──────────────┘         └──────────────┘            │
│                                                          │
│  - Métadonnées (id, name, parent_id, tags)             │
│  - Hiérarchie (arbre)                                    │
│  - Permissions                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Avantages

✅ **Dev local** : Travaille avec son éditeur favori (VS Code, Vim, etc.)  
✅ **Pas de Git** : Pas besoin de commit/push manuel  
✅ **Sync automatique** : Changements détectés automatiquement  
✅ **Hiérarchie en DB** : La structure reste gérée par MarkD  
✅ **Collaboration** : Plusieurs devs peuvent sync avec la même DB  
✅ **Backup** : Les fichiers locaux servent de backup

---

## Implémentation

### 1. Structure des fichiers locaux

```
/projet/docs/
  ├── .markd-sync.json          # Config de sync
  ├── folder1/
  │   ├── doc1.md
  │   └── doc2.md
  └── root.md
```

**Format `.markd-sync.json`** :
```json
{
  "workspace_id": "workspace-1",
  "api_url": "http://localhost:8000",
  "api_token": "jwt-token-here",
  "sync_mode": "bidirectional",  // "push-only" | "pull-only" | "bidirectional"
  "watch_enabled": true,
  "auto_push": true,
  "auto_pull": false
}
```

### 2. Mapping Fichiers ↔ Documents

**Option A : Mapping par ID (recommandé)**
```markdown
<!-- doc1.md -->
---
markd_id: doc-uuid-123
markd_name: doc1
markd_parent: folder-uuid-456
---

# Contenu du document
```

**Option B : Mapping par chemin (plus simple)**
```python
# .markd-sync.json
{
  "mappings": {
    "folder1/doc1.md": "doc-uuid-123",
    "folder1/doc2.md": "doc-uuid-456",
    "root.md": "doc-uuid-789"
  }
}
```

### 3. Serveur MCP Local (Python)

```python
# mcp_sync_local.py
import asyncio
import aiohttp
import json
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time

class MarkDSyncHandler(FileSystemEventHandler):
    def __init__(self, sync_client):
        self.sync_client = sync_client
        self.debounce_time = 2.0  # Attendre 2s avant push
        self.pending_changes = {}
    
    def on_modified(self, event):
        if event.is_directory:
            return
        
        if event.src_path.endswith('.md'):
            # Debounce : attendre que l'utilisateur finisse d'écrire
            file_path = Path(event.src_path)
            self.pending_changes[str(file_path)] = time.time()
            
            # Programmer un push après le debounce
            asyncio.create_task(self.debounced_push(file_path))
    
    async def debounced_push(self, file_path: Path):
        await asyncio.sleep(self.debounce_time)
        
        # Vérifier si le fichier a encore changé
        if str(file_path) in self.pending_changes:
            last_change = self.pending_changes[str(file_path)]
            if time.time() - last_change >= self.debounce_time:
                await self.sync_client.push_file(file_path)
                del self.pending_changes[str(file_path)]

class MarkDSyncClient:
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config = self.load_config()
        self.docs_root = config_path.parent
        self.session = None
    
    def load_config(self):
        with open(self.config_path) as f:
            return json.load(f)
    
    async def start(self):
        """Start sync client"""
        self.session = aiohttp.ClientSession(
            headers={"Authorization": f"Bearer {self.config['api_token']}"}
        )
        
        # Initial pull
        if self.config.get('auto_pull'):
            await self.pull_all()
        
        # Watch files
        if self.config.get('watch_enabled'):
            event_handler = MarkDSyncHandler(self)
            observer = Observer()
            observer.schedule(event_handler, str(self.docs_root), recursive=True)
            observer.start()
            
            print(f"✅ Watching {self.docs_root} for changes...")
            
            try:
                while True:
                    await asyncio.sleep(1)
            except KeyboardInterrupt:
                observer.stop()
                await self.session.close()
    
    async def push_file(self, file_path: Path):
        """Push a single file to MarkD API"""
        try:
            # 1. Lire le fichier
            content = file_path.read_text(encoding='utf-8')
            
            # 2. Extraire métadonnées depuis frontmatter
            metadata = self.extract_metadata(content)
            doc_id = metadata.get('markd_id')
            doc_name = metadata.get('markd_name') or file_path.stem
            
            # 3. Si pas d'ID, créer un nouveau document
            if not doc_id:
                doc_id = await self.create_document(doc_name, content, metadata)
                # Ajouter l'ID au fichier
                self.add_metadata_to_file(file_path, doc_id, doc_name)
            else:
                # 4. Mettre à jour le document existant
                await self.update_document(doc_id, content, doc_name)
            
            print(f"✅ Pushed {file_path.name} → {doc_id}")
            
        except Exception as e:
            print(f"❌ Error pushing {file_path}: {e}")
    
    async def create_document(self, name: str, content: str, metadata: dict) -> str:
        """Create new document via API"""
        url = f"{self.config['api_url']}/api/documents"
        data = {
            "name": name,
            "type": "file",
            "content": content,
            "parent_id": metadata.get('markd_parent'),
            "workspace_id": self.config['workspace_id']
        }
        
        async with self.session.post(url, json=data) as resp:
            result = await resp.json()
            return result['document']['id']
    
    async def update_document(self, doc_id: str, content: str, name: str):
        """Update document via API"""
        url = f"{self.config['api_url']}/api/documents/{doc_id}"
        data = {
            "content": content,
            "name": name
        }
        
        async with self.session.put(url, json=data) as resp:
            return await resp.json()
    
    async def pull_all(self):
        """Pull all documents from MarkD API"""
        url = f"{self.config['api_url']}/api/documents/tree"
        params = {"workspace_id": self.config['workspace_id']}
        
        async with self.session.get(url, params=params) as resp:
            tree = await resp.json()
            await self.sync_tree_to_files(tree['tree'])
    
    async def sync_tree_to_files(self, tree, parent_path: Path = None):
        """Sync tree structure to local files"""
        if parent_path is None:
            parent_path = self.docs_root
        
        for item in tree:
            if item['type'] == 'file':
                # Créer/ mettre à jour le fichier
                file_path = parent_path / f"{item['name']}.md"
                
                # Récupérer le contenu depuis l'API
                content = await self.get_document_content(item['id'])
                
                # Ajouter métadonnées au frontmatter
                content_with_meta = self.add_metadata_to_content(
                    content,
                    item['id'],
                    item['name'],
                    item.get('parent_id')
                )
                
                file_path.write_text(content_with_meta, encoding='utf-8')
                print(f"✅ Pulled {file_path.name}")
            
            elif item['type'] == 'folder':
                # Créer le dossier
                folder_path = parent_path / item['name']
                folder_path.mkdir(exist_ok=True)
                
                # Récursif pour les enfants
                if item.get('children'):
                    await self.sync_tree_to_files(item['children'], folder_path)
    
    async def get_document_content(self, doc_id: str) -> str:
        """Get document content from API"""
        url = f"{self.config['api_url']}/api/documents/{doc_id}"
        async with self.session.get(url) as resp:
            result = await resp.json()
            return result['document'].get('content', '')
    
    def extract_metadata(self, content: str) -> dict:
        """Extract metadata from frontmatter"""
        import re
        metadata = {}
        
        # Chercher frontmatter YAML
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
        if match:
            frontmatter = match.group(1)
            for line in frontmatter.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    metadata[key.strip()] = value.strip().strip('"\'')
        
        return metadata
    
    def add_metadata_to_content(self, content: str, doc_id: str, name: str, parent_id: str = None) -> str:
        """Add metadata to content frontmatter"""
        frontmatter = f"""---
markd_id: {doc_id}
markd_name: {name}
"""
        if parent_id:
            frontmatter += f"markd_parent: {parent_id}\n"
        
        frontmatter += "---\n\n"
        
        # Si le contenu a déjà un frontmatter, le remplacer
        import re
        if re.match(r'^---\s*\n', content):
            content = re.sub(r'^---\s*\n.*?\n---\s*\n', '', content, flags=re.DOTALL)
        
        return frontmatter + content
    
    def add_metadata_to_file(self, file_path: Path, doc_id: str, name: str, parent_id: str = None):
        """Add metadata to existing file"""
        content = file_path.read_text(encoding='utf-8')
        new_content = self.add_metadata_to_content(content, doc_id, name, parent_id)
        file_path.write_text(new_content, encoding='utf-8')

# CLI
async def main():
    import sys
    
    config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.markd-sync.json')
    
    if not config_path.exists():
        print(f"❌ Config file not found: {config_path}")
        print("Create .markd-sync.json with workspace_id, api_url, api_token")
        return
    
    client = MarkDSyncClient(config_path)
    await client.start()

if __name__ == '__main__':
    asyncio.run(main())
```

### 4. Commandes CLI

```bash
# Installation
pip install aiohttp watchdog

# Démarrer le sync (watch mode)
python mcp_sync_local.py /projet/docs/.markd-sync.json

# Push manuel
python mcp_sync_local.py --push /projet/docs/folder1/doc1.md

# Pull manuel
python mcp_sync_local.py --pull
```

---

## Workflow

### Scénario 1 : Dev modifie un fichier local

1. Dev ouvre `doc1.md` dans VS Code
2. Dev modifie le contenu
3. Dev sauvegarde (Ctrl+S)
4. **Watchdog détecte** le changement (après 2s de debounce)
5. **MCP client push** vers API MarkD
6. **API met à jour** la DB
7. **WebSocket broadcast** → Frontend MarkD se met à jour
8. ✅ **Sync complète**

### Scénario 2 : Dev crée un nouveau fichier

1. Dev crée `new-doc.md` localement
2. Watchdog détecte
3. MCP client **crée** le document via API
4. API retourne un `doc_id`
5. MCP client **ajoute** `markd_id` au frontmatter du fichier
6. ✅ **Fichier lié à la DB**

### Scénario 3 : Pull depuis MarkD

1. Un autre dev modifie via le frontend MarkD
2. Dev local fait `python mcp_sync_local.py --pull`
3. MCP client **récupère** l'arbre depuis l'API
4. MCP client **met à jour** les fichiers locaux
5. ✅ **Fichiers locaux synchronisés**

---

## Avantages vs Inconvénients

### ✅ Avantages

1. **Dev local** : Travaille avec son éditeur favori
2. **Pas de Git** : Pas besoin de commit/push manuel
3. **Sync automatique** : Changements détectés automatiquement
4. **Hiérarchie en DB** : La structure reste gérée par MarkD
5. **Collaboration** : Plusieurs devs peuvent sync avec la même DB
6. **Backup** : Les fichiers locaux servent de backup

### ⚠️ Inconvénients

1. **Conflits** : Si 2 devs modifient en même temps (dernier gagne)
2. **Pas de versioning** : Pas d'historique Git
3. **Dépendance réseau** : Besoin d'accès à l'API MarkD
4. **Complexité** : Gérer les conflits, les mappings, etc.

---

## Gestion des conflits

### Stratégie 1 : Dernier gagne (simple)

```python
async def push_file(self, file_path: Path):
    # Récupérer timestamp du fichier local
    local_mtime = file_path.stat().st_mtime
    
    # Récupérer timestamp depuis l'API
    doc = await self.get_document(doc_id)
    remote_mtime = doc['updated_at']
    
    if local_mtime > remote_mtime:
        # Local plus récent → push
        await self.update_document(doc_id, content)
    else:
        # Remote plus récent → pull d'abord, puis merge manuel
        print("⚠️  Remote is newer, pulling first...")
        await self.pull_file(doc_id)
```

### Stratégie 2 : Merge automatique (avancé)

```python
async def merge_conflict(self, local_content: str, remote_content: str) -> str:
    """Merge local and remote content"""
    # Utiliser un merge tool (ex: diff3)
    # Ou simplement ajouter un marqueur de conflit
    return f"""# ⚠️ CONFLICT DETECTED

## Local version:
{local_content}

---

## Remote version:
{remote_content}

---

## Please resolve manually
"""
```

---

## Intégration avec le serveur MCP existant

Le serveur MCP **local** peut aussi exposer des endpoints pour les agents IA :

```python
# mcp_sync_local.py (extension)

@mcp_app.post("/mcp/local/create")
async def mcp_local_create(request: MCPDocumentRequest):
    """Create document locally and push to API"""
    # 1. Créer fichier local
    file_path = docs_root / f"{request.title}.md"
    file_path.write_text(request.content)
    
    # 2. Push vers API
    await sync_client.push_file(file_path)
    
    return {"success": True, "file_path": str(file_path)}

@mcp_app.post("/mcp/local/search")
async def mcp_local_search(query: str):
    """Search in local files"""
    # Recherche dans les fichiers locaux (grep, ripgrep, etc.)
    results = []
    for md_file in docs_root.rglob("*.md"):
        if query.lower() in md_file.read_text().lower():
            results.append(str(md_file))
    return {"results": results}
```

---

## Recommandation

### ✅ Cette approche est excellente si :

1. **Plusieurs devs** travaillent sur la même doc
2. **Pas besoin de Git** pour la doc (pas de versioning)
3. **Sync automatique** souhaitée
4. **Hiérarchie centralisée** en DB MarkD

### ⚠️ Considérations :

1. **Gestion des conflits** : Implémenter une stratégie claire
2. **Mapping fiable** : Garder le mapping fichier ↔ doc_id
3. **Performance** : Debounce pour éviter trop de push
4. **Sécurité** : Token API sécurisé

---

## Prochaines étapes

1. ✅ Créer le serveur MCP local (`mcp_sync_local.py`)
2. ✅ Implémenter watch + push automatique
3. ✅ Implémenter pull manuel/automatique
4. ✅ Gestion des conflits
5. ✅ CLI pour commandes manuelles
6. ✅ Documentation utilisateur

---

## Exemple d'utilisation

```bash
# 1. Initialiser le projet
cd /projet/docs
python mcp_sync_local.py --init

# 2. Configurer .markd-sync.json
{
  "workspace_id": "workspace-1",
  "api_url": "http://localhost:8000",
  "api_token": "eyJ...",
  "sync_mode": "bidirectional",
  "watch_enabled": true
}

# 3. Démarrer le sync
python mcp_sync_local.py

# 4. Travailler normalement
# - Modifier doc1.md dans VS Code
# - Sauvegarder → Push automatique vers MarkD
# - Les autres devs voient les changements en temps réel
```

---

## Conclusion

Cette approche combine le **meilleur des deux mondes** :
- ✅ **Fichiers locaux** pour le dev (éditeur favori)
- ✅ **DB centralisée** pour la hiérarchie et collaboration
- ✅ **Sync automatique** sans Git
- ✅ **Flexibilité** : Push/Pull manuel ou automatique

C'est une **excellente solution** pour un workflow de documentation collaborative sans versioning Git.

