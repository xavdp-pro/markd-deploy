# Gestion du Déplacement et Renommage avec Stockage Disque

## Problème

Quand on passe d'un stockage **DB uniquement** à un stockage **hybride (DB + disque)**, il faut gérer :
1. **Déplacement** : Changement de `parent_id` → faut-il déplacer le fichier sur disque ?
2. **Renommage** : Changement de `name` → faut-il renommer le fichier sur disque ?

---

## Solution 1 : Fichiers Plats (Recommandée) ✅

### Principe
- **Nom de fichier = `{document_id}.md`** (l'ID ne change jamais)
- **Structure plate** : Tous les fichiers dans `/docs-storage/{workspace_id}/`
- **Hiérarchie en DB uniquement** : Le `parent_id` reste en base, pas besoin de dossiers sur disque

### Avantages
✅ **Pas de déplacement** : Le fichier reste au même endroit  
✅ **Pas de renommage** : Le nom de fichier ne change jamais  
✅ **Simple** : Pas de gestion de dossiers sur disque  
✅ **Performance** : Pas d'opérations I/O lors du move/rename

### Structure
```
/docs-storage/
  ├── workspace-1/
  │   ├── doc-uuid-1.md
  │   ├── doc-uuid-2.md
  │   └── doc-uuid-3.md
  └── workspace-2/
      └── ...
```

### Implémentation

```python
# backend/document_storage.py
from pathlib import Path
from typing import Optional

class DocumentStorage:
    def __init__(self, root: Path):
        self.root = root
    
    def get_file_path(self, document_id: str, workspace_id: str) -> Path:
        """Get file path for a document (ID-based, never changes)"""
        workspace_dir = self.root / workspace_id
        workspace_dir.mkdir(parents=True, exist_ok=True)
        return workspace_dir / f"{document_id}.md"
    
    def read_content(self, document_id: str, workspace_id: str) -> Optional[str]:
        """Read markdown content from disk"""
        path = self.get_file_path(document_id, workspace_id)
        if path.exists():
            return path.read_text(encoding='utf-8')
        return None
    
    def write_content(self, document_id: str, workspace_id: str, content: str):
        """Write markdown content to disk"""
        path = self.get_file_path(document_id, workspace_id)
        path.write_text(content, encoding='utf-8')
    
    def delete_content(self, document_id: str, workspace_id: str):
        """Delete markdown file"""
        path = self.get_file_path(document_id, workspace_id)
        if path.exists():
            path.unlink()
    
    # ✅ Pas besoin de méthodes move/rename : le fichier reste au même endroit !
```

### Modification de l'API

```python
# backend/main.py

@app.put("/api/documents/{document_id}")
async def update_document(document_id: str, document: DocumentUpdate, ...):
    """Update document (name, content, or parent_id)"""
    # ... vérification permissions ...
    
    # 1. Mise à jour en DB (name, parent_id, etc.)
    updates = []
    params = []
    
    if document.name is not None:
        updates.append("name = %s")
        params.append(document.name)
        # ✅ Pas besoin de renommer le fichier : il garde {doc_id}.md
    
    if document.parent_id is not None:
        updates.append("parent_id = %s")
        params.append(document.parent_id)
        # ✅ Pas besoin de déplacer le fichier : il reste au même endroit
    
    if document.content is not None:
        # 2. Écrire le contenu sur disque
        storage = DocumentStorage(DOCS_ROOT)
        storage.write_content(document_id, workspace_id, document.content)
        # ✅ Le fichier est toujours au même endroit, juste le contenu change
    
    # 3. Mise à jour DB
    if updates:
        params.append(document_id)
        query = f"UPDATE documents SET {', '.join(updates)} WHERE id = %s"
        db.execute_update(query, tuple(params))
    
    await broadcast_tree_update()
    return {"success": True}

@app.post("/api/documents/{document_id}/move")
async def move_document(document_id: str, move: DocumentMove, ...):
    """Move document to new parent"""
    # ... vérification permissions ...
    
    # 1. Mise à jour parent_id en DB
    query = "UPDATE documents SET parent_id = %s WHERE id = %s"
    db.execute_update(query, (move.parent_id, document_id))
    
    # ✅ Pas besoin de déplacer le fichier sur disque !
    # Le fichier reste à /docs-storage/{workspace_id}/{doc_id}.md
    # La hiérarchie est gérée uniquement en DB via parent_id
    
    await broadcast_tree_update()
    return {"success": True, "message": "Document moved"}
```

---

## Solution 2 : Structure Hiérarchique (Avancée)

### Principe
- **Structure miroir** : Les dossiers sur disque reflètent la hiérarchie DB
- **Nom de fichier = `{name}.md`** (peut changer lors du rename)
- **Déplacement réel** : Quand `parent_id` change, on déplace le fichier

### Avantages
✅ **Structure lisible** : On peut naviguer dans les dossiers  
✅ **Backup simple** : Copie de dossier = copie de la structure

### Inconvénients
⚠️ **Complexité** : Gérer les déplacements/renommages de fichiers  
⚠️ **Performance** : Opérations I/O lors du move/rename  
⚠️ **Conflits** : Gérer les noms de fichiers dupliqués

### Structure
```
/docs-storage/
  ├── workspace-1/
  │   ├── folder1/
  │   │   ├── doc1.md
  │   │   └── doc2.md
  │   └── root-doc.md
  └── workspace-2/
      └── ...
```

### Implémentation

```python
# backend/document_storage_hierarchical.py
from pathlib import Path
from typing import Optional, List
import shutil

class HierarchicalDocumentStorage:
    def __init__(self, root: Path):
        self.root = root
    
    def build_path(self, document_id: str, workspace_id: str, db_connection) -> Path:
        """Build file path based on document hierarchy in DB"""
        # 1. Récupérer le chemin complet depuis la DB
        path_parts = []
        current_id = document_id
        
        while current_id:
            query = "SELECT name, parent_id, type FROM documents WHERE id = %s"
            result = db_connection.execute_query(query, (current_id,))
            if not result:
                break
            
            doc = result[0]
            if doc['type'] == 'file':
                path_parts.insert(0, f"{doc['name']}.md")
            else:
                path_parts.insert(0, doc['name'])
            
            current_id = doc['parent_id']
        
        # 2. Construire le chemin complet
        workspace_dir = self.root / workspace_id
        full_path = workspace_dir
        for part in path_parts:
            full_path = full_path / part
        
        return full_path
    
    def read_content(self, document_id: str, workspace_id: str, db_connection) -> Optional[str]:
        """Read markdown content from disk"""
        path = self.build_path(document_id, workspace_id, db_connection)
        if path.exists():
            return path.read_text(encoding='utf-8')
        return None
    
    def write_content(self, document_id: str, workspace_id: str, content: str, db_connection):
        """Write markdown content to disk"""
        path = self.build_path(document_id, workspace_id, db_connection)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
    
    def move_file(self, document_id: str, new_parent_id: str, workspace_id: str, db_connection):
        """Move file to new parent folder"""
        old_path = self.build_path(document_id, workspace_id, db_connection)
        new_path = self.build_path(document_id, workspace_id, db_connection)  # Rebuild after DB update
        
        if old_path.exists() and old_path != new_path:
            new_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_path), str(new_path))
    
    def rename_file(self, document_id: str, new_name: str, workspace_id: str, db_connection):
        """Rename file"""
        old_path = self.build_path(document_id, workspace_id, db_connection)
        
        # Rebuild path with new name
        query = "SELECT parent_id FROM documents WHERE id = %s"
        result = db_connection.execute_query(query, (document_id,))
        if result:
            parent_id = result[0]['parent_id']
            # ... rebuild path with new_name ...
            new_path = self.build_path(document_id, workspace_id, db_connection)
            
            if old_path.exists() and old_path != new_path:
                old_path.rename(new_path)
```

### Modification de l'API (Solution 2)

```python
# backend/main.py (avec structure hiérarchique)

@app.put("/api/documents/{document_id}")
async def update_document(document_id: str, document: DocumentUpdate, ...):
    """Update document (name, content, or parent_id)"""
    # ... vérification permissions ...
    
    storage = HierarchicalDocumentStorage(DOCS_ROOT)
    
    # 1. Si renommage
    if document.name is not None:
        # Renommer le fichier sur disque
        storage.rename_file(document_id, document.name, workspace_id, db)
        # Mettre à jour DB
        query = "UPDATE documents SET name = %s WHERE id = %s"
        db.execute_update(query, (document.name, document_id))
    
    # 2. Si déplacement
    if document.parent_id is not None:
        # Déplacer le fichier sur disque
        storage.move_file(document_id, document.parent_id, workspace_id, db)
        # Mettre à jour DB
        query = "UPDATE documents SET parent_id = %s WHERE id = %s"
        db.execute_update(query, (document.parent_id, document_id))
    
    # 3. Si contenu
    if document.content is not None:
        storage.write_content(document_id, workspace_id, document.content, db)
    
    await broadcast_tree_update()
    return {"success": True}

@app.post("/api/documents/{document_id}/move")
async def move_document(document_id: str, move: DocumentMove, ...):
    """Move document to new parent"""
    # ... vérification permissions ...
    
    storage = HierarchicalDocumentStorage(DOCS_ROOT)
    
    # 1. Mettre à jour DB
    query = "UPDATE documents SET parent_id = %s WHERE id = %s"
    db.execute_update(query, (move.parent_id, document_id))
    
    # 2. Déplacer le fichier sur disque
    storage.move_file(document_id, move.parent_id, workspace_id, db)
    
    await broadcast_tree_update()
    return {"success": True, "message": "Document moved"}
```

---

## Comparaison

| Critère | Solution 1 (Plat) | Solution 2 (Hiérarchique) |
|---------|-------------------|---------------------------|
| **Complexité** | ✅ Simple | ⚠️ Complexe |
| **Performance** | ✅ Rapide (pas de move) | ⚠️ Plus lent (I/O) |
| **Déplacement** | ✅ Aucun (DB seulement) | ⚠️ Déplacement fichier |
| **Renommage** | ✅ Aucun (ID-based) | ⚠️ Renommage fichier |
| **Lisibilité** | ⚠️ Fichiers par ID | ✅ Structure lisible |
| **Backup** | ✅ Simple (copie dossier) | ✅ Simple (copie dossier) |
| **Conflits noms** | ✅ Aucun (ID unique) | ⚠️ Gérer doublons |

---

## Recommandation : **Solution 1 (Fichiers Plats)**

### Pourquoi ?
1. **Simplicité** : Pas de gestion de déplacement/renommage
2. **Performance** : Pas d'opérations I/O lors du move/rename
3. **Fiabilité** : Pas de risque de conflit de noms
4. **Hiérarchie en DB** : La structure reste gérée en base (comme actuellement)

### Structure finale recommandée

```
/docs-storage/
  ├── workspace-1/
  │   ├── doc-uuid-1.md    # Contenu du document
  │   ├── doc-uuid-2.md
  │   └── doc-uuid-3.md
  └── workspace-2/
      └── ...
```

**La hiérarchie est dans la DB** :
```sql
SELECT id, name, parent_id FROM documents;
-- parent_id fait le lien hiérarchique
-- Le frontend reconstruit l'arbre depuis la DB
-- Les fichiers sur disque sont juste du contenu, pas de structure
```

---

## Migration depuis DB

```python
# Script de migration : DB → Disque (Solution 1)
def migrate_documents_to_disk():
    """Migrate all documents from DB to disk storage"""
    storage = DocumentStorage(DOCS_ROOT)
    
    query = """
        SELECT id, workspace_id, content 
        FROM documents 
        WHERE type = 'file' AND content IS NOT NULL
    """
    docs = db.execute_query(query)
    
    for doc in docs:
        if doc['content']:
            storage.write_content(
                doc['id'], 
                doc['workspace_id'], 
                doc['content']
            )
            print(f"Migrated {doc['id']} to disk")
    
    print(f"Migration complete: {len(docs)} documents")
```

---

## Conclusion

**Avec la Solution 1 (fichiers plats)** :
- ✅ **Déplacement** : Aucun changement sur disque, juste `parent_id` en DB
- ✅ **Renommage** : Aucun changement sur disque, juste `name` en DB
- ✅ **Simple** : Le fichier reste toujours à `{doc_id}.md`
- ✅ **Performance** : Pas d'opérations I/O lors des opérations de structure

La hiérarchie est **gérée en DB** (comme actuellement), les fichiers sur disque sont juste du **contenu brut**.

