# Solutions pour Externaliser la Documentation Markdown

## Contexte

Actuellement, les documents Markdown sont stockés en base de données MySQL (`documents.content LONGTEXT`). L'objectif est de :
- **Externaliser** les fichiers `.md` sur le disque
- **Garder la compatibilité** avec le système actuel (permissions, verrous, tags, WebSocket)
- **Permettre aux agents IA** de modifier les docs via MCP
- **Synchroniser** automatiquement entre disque et base

---

## Solution 1 : **Hybrid Storage (Recommandée)**

### Principe
- **Métadonnées en base** : `id`, `name`, `type`, `parent_id`, `workspace_id`, `tags`, `locks`, `permissions`
- **Contenu sur disque** : Fichiers `.md` dans `/docs/{workspace_id}/...`

### Structure
```
/docs/
  ├── workspace-1/
  │   ├── folder1/
  │   │   ├── doc1.md
  │   │   └── doc2.md
  │   └── root-doc.md
  └── workspace-2/
      └── ...
```

### Avantages
✅ **Performance** : Pas de `LONGTEXT` en base  
✅ **Versioning Git** : Les fichiers peuvent être versionnés  
✅ **Backup simple** : Copie de dossier  
✅ **Agent IA** : Accès direct aux fichiers  
✅ **Compatibilité** : L'API reste identique (abstraction)

### Inconvénients
⚠️ **Synchronisation** : Gérer les conflits disque ↔ base  
⚠️ **Permissions** : Vérifier les droits fichiers système

### Implémentation

#### 1. Configuration
```python
# backend/settings.py
DOCS_ROOT = Path("/apps/markd-v2/app/markd-package/docs-storage")
DOCS_ROOT.mkdir(parents=True, exist_ok=True)

def get_doc_path(document_id: str, workspace_id: str) -> Path:
    """Get file path for a document"""
    return DOCS_ROOT / workspace_id / f"{document_id}.md"
```

#### 2. Service de synchronisation
```python
# backend/document_storage.py
from pathlib import Path
from typing import Optional
import os

class DocumentStorage:
    def __init__(self, root: Path):
        self.root = root
    
    def read_content(self, document_id: str, workspace_id: str) -> Optional[str]:
        """Read markdown content from disk"""
        path = self.root / workspace_id / f"{document_id}.md"
        if path.exists():
            return path.read_text(encoding='utf-8')
        return None
    
    def write_content(self, document_id: str, workspace_id: str, content: str):
        """Write markdown content to disk"""
        workspace_dir = self.root / workspace_id
        workspace_dir.mkdir(parents=True, exist_ok=True)
        path = workspace_dir / f"{document_id}.md"
        path.write_text(content, encoding='utf-8')
    
    def delete_content(self, document_id: str, workspace_id: str):
        """Delete markdown file"""
        path = self.root / workspace_id / f"{document_id}.md"
        if path.exists():
            path.unlink()
    
    def sync_from_db(self, document_id: str, workspace_id: str):
        """Sync from DB to disk (migration)"""
        query = "SELECT content FROM documents WHERE id = %s"
        result = db.execute_query(query, (document_id,))
        if result and result[0]['content']:
            self.write_content(document_id, workspace_id, result[0]['content'])
    
    def sync_to_db(self, document_id: str, workspace_id: str):
        """Sync from disk to DB (backup/restore)"""
        content = self.read_content(document_id, workspace_id)
        if content:
            query = "UPDATE documents SET content = %s WHERE id = %s"
            db.execute_update(query, (content, document_id))
```

#### 3. Modification de l'API
```python
# backend/main.py (modification de get_document)
@app.get("/api/documents/{document_id}")
async def get_document(document_id: str):
    # ... vérification permissions ...
    
    # Lire métadonnées depuis DB
    query = "SELECT * FROM documents WHERE id = %s"
    doc = db.execute_query(query, (document_id,))[0]
    
    # Lire contenu depuis disque
    storage = DocumentStorage(DOCS_ROOT)
    content = storage.read_content(document_id, doc['workspace_id'])
    
    # Fallback : si pas sur disque, lire depuis DB (migration)
    if not content:
        content = doc.get('content', '')
        if content:
            storage.write_content(document_id, doc['workspace_id'], content)
    
    return {
        "success": True,
        "document": {
            **doc,
            "content": content
        }
    }

@app.put("/api/documents/{document_id}")
async def update_document(document_id: str, document: DocumentUpdate):
    # ... vérification permissions ...
    
    if document.content is not None:
        # Écrire sur disque
        storage = DocumentStorage(DOCS_ROOT)
        storage.write_content(document_id, workspace_id, document.content)
        
        # Optionnel : garder un backup en DB (pour migration)
        # query = "UPDATE documents SET content = %s WHERE id = %s"
        # db.execute_update(query, (document.content, document_id))
    
    # ... reste identique (tags, locks, etc.) ...
```

---

## Solution 2 : **SSHFS/NFS Mount**

### Principe
- **Montage réseau** d'un dossier distant contenant les `.md`
- Le serveur MarkD lit/écrit directement sur le montage

### Avantages
✅ **Centralisé** : Un seul serveur de fichiers  
✅ **Multi-instances** : Plusieurs serveurs MarkD partagent les docs  
✅ **Backup centralisé** : Sur le serveur de fichiers

### Inconvénients
⚠️ **Latence réseau** : Plus lent que disque local  
⚠️ **Dépendance réseau** : Si le montage tombe, MarkD ne fonctionne plus  
⚠️ **Permissions** : Gérer les droits NFS/SSHFS

### Implémentation

#### 1. Montage SSHFS
```bash
# Sur le serveur MarkD
mkdir -p /mnt/docs-remote
sshfs user@docs-server:/path/to/docs /mnt/docs-remote -o allow_other,uid=1000,gid=1000
```

#### 2. Configuration
```python
# backend/settings.py
DOCS_ROOT = Path("/mnt/docs-remote/markd-docs")  # Montage SSHFS/NFS
```

#### 3. Code identique à Solution 1
(Utiliser `DocumentStorage` avec le chemin monté)

---

## Solution 3 : **MCP Server avec API Git**

### Principe
- **Agent IA** modifie les fichiers via un serveur MCP dédié
- Le serveur MCP **commit/push** vers un repo Git
- **Webhook Git** notifie MarkD pour synchroniser

### Avantages
✅ **Versioning natif** : Git gère l'historique  
✅ **Collaboration** : Plusieurs agents peuvent travailler  
✅ **Audit trail** : Historique Git complet

### Inconvénients
⚠️ **Complexité** : Git + Webhooks + Sync  
⚠️ **Latence** : Commit/push peut être lent

### Implémentation

#### 1. Serveur MCP Git
```python
# backend/mcp_git_server.py
from git import Repo
from pathlib import Path

class MCPGitServer:
    def __init__(self, repo_path: Path, remote_url: str):
        self.repo = Repo(repo_path)
        self.remote_url = remote_url
    
    def update_document(self, workspace_id: str, doc_id: str, content: str):
        """Update document and commit"""
        file_path = self.repo.working_dir / workspace_id / f"{doc_id}.md"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        
        # Git commit
        self.repo.index.add([str(file_path)])
        self.repo.index.commit(f"Update {doc_id} via MCP")
        
        # Push (optionnel)
        # self.repo.remote('origin').push()
    
    def sync_to_markd(self):
        """Pull latest changes and notify MarkD"""
        self.repo.remote('origin').pull()
        # Notifier MarkD via WebSocket ou API
```

#### 2. Webhook Git → MarkD
```python
# backend/webhook_git.py
@app.post("/webhook/git")
async def git_webhook(request: Request):
    """Receive Git webhook and sync documents"""
    payload = await request.json()
    
    if payload.get('ref') == 'refs/heads/main':
        # Pull latest
        repo = Repo(DOCS_ROOT)
        repo.remote('origin').pull()
        
        # Notify frontend via WebSocket
        await broadcast_document_tree_update()
```

---

## Solution 4 : **Sync Bidirectionnel (DB ↔ Disque)**

### Principe
- **Double écriture** : Chaque modification écrit en DB ET sur disque
- **Sync automatique** : Cron job qui réconcilie les différences

### Avantages
✅ **Redondance** : Backup automatique  
✅ **Migration progressive** : Peut basculer progressivement

### Inconvénients
⚠️ **Complexité** : Gérer les conflits  
⚠️ **Performance** : Double écriture

### Implémentation

```python
# backend/sync_service.py
import asyncio
from datetime import datetime

class SyncService:
    async def sync_all(self):
        """Sync all documents between DB and disk"""
        # 1. DB → Disk (si DB plus récent)
        query = """
            SELECT id, workspace_id, content, updated_at 
            FROM documents 
            WHERE type = 'file' AND content IS NOT NULL
        """
        docs = db.execute_query(query)
        
        for doc in docs:
            disk_path = get_doc_path(doc['id'], doc['workspace_id'])
            disk_mtime = disk_path.stat().st_mtime if disk_path.exists() else 0
            db_mtime = doc['updated_at'].timestamp()
            
            if db_mtime > disk_mtime:
                # DB plus récent → écrire sur disque
                storage.write_content(doc['id'], doc['workspace_id'], doc['content'])
            elif disk_mtime > db_mtime:
                # Disk plus récent → mettre à jour DB
                content = storage.read_content(doc['id'], doc['workspace_id'])
                query = "UPDATE documents SET content = %s WHERE id = %s"
                db.execute_update(query, (content, doc['id']))

# Cron job (via asyncio ou systemd)
async def sync_loop():
    while True:
        await SyncService().sync_all()
        await asyncio.sleep(300)  # Toutes les 5 minutes
```

---

## Recommandation : **Solution 1 (Hybrid Storage)**

### Pourquoi ?
1. **Simple** : Pas de dépendance réseau/externe
2. **Performant** : Fichiers locaux
3. **Flexible** : Peut migrer progressivement
4. **Compatible** : L'API reste identique

### Plan de migration

#### Phase 1 : Ajout du service (sans breaking change)
- Créer `DocumentStorage`
- Modifier `get_document` pour lire depuis disque (fallback DB)
- Modifier `update_document` pour écrire sur disque (garder DB temporairement)

#### Phase 2 : Migration des données
```python
# Script de migration
def migrate_all_docs():
    query = "SELECT id, workspace_id, content FROM documents WHERE type = 'file'"
    docs = db.execute_query(query)
    storage = DocumentStorage(DOCS_ROOT)
    
    for doc in docs:
        if doc['content']:
            storage.write_content(doc['id'], doc['workspace_id'], doc['content'])
```

#### Phase 3 : Nettoyage
- Supprimer la colonne `content` de la table `documents` (ou la garder vide)
- Supprimer le fallback DB dans `get_document`

---

## Intégration MCP Agent IA

### Modification du serveur MCP existant
```python
# backend/mcp_server.py (modification)
@app.post("/mcp/documents")
async def mcp_create_document(request: MCPDocumentRequest):
    # ... création en DB (métadonnées) ...
    
    # Écrire sur disque
    storage = DocumentStorage(DOCS_ROOT)
    storage.write_content(doc_id, workspace_id, full_content)
    
    return {"success": True, "document_id": doc_id}

@app.post("/mcp/documents/{document_id}/append")
async def mcp_append_content(document_id: str, request: MCPAppendRequest):
    # Lire depuis disque
    storage = DocumentStorage(DOCS_ROOT)
    current_content = storage.read_content(document_id, workspace_id) or ""
    
    # Ajouter contenu
    new_content = current_content + "\n\n" + request.content
    storage.write_content(document_id, workspace_id, new_content)
    
    # Mettre à jour timestamp en DB
    query = "UPDATE documents SET updated_at = NOW() WHERE id = %s"
    db.execute_update(query, (document_id,))
    
    # Notifier frontend
    await broadcast_document_content_updated(document_id)
```

---

## Structure finale recommandée

```
/apps/markd-v2/app/markd-package/
  ├── docs/                    # Documentation du projet
  │   ├── fonctionnalites/
  │   ├── diagnostics/
  │   └── architecture/
  ├── docs-storage/            # Documents utilisateurs (nouveau)
  │   ├── workspace-1/
  │   │   ├── folder1/
  │   │   │   └── doc1.md
  │   │   └── root.md
  │   └── workspace-2/
  └── backend/
      ├── document_storage.py  # Service de stockage (nouveau)
      └── main.py              # API modifiée
```

---

## Prochaines étapes

1. ✅ Créer `DocumentStorage` service
2. ✅ Modifier `get_document` / `update_document` pour utiliser le disque
3. ✅ Script de migration DB → Disque
4. ✅ Tester avec agent MCP
5. ✅ Nettoyer la colonne `content` en DB (optionnel)

