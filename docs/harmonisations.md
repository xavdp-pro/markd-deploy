# Guide d'Harmonisation des Modules MarkD

Ce document définit les standards stricts à respecter pour tout nouveau module (et pour la maintenance des modules existants : Documents, Tasks, Passwords).

## 1. Architecture WebSocket

### Règle d'Or : Backend-First Broadcast
Le frontend ne doit JAMAIS émettre de notification "notify" pour une action qu'il vient de faire si le backend peut le faire.
*   **Incorrect** : Le client appelle l'API `createTask` PUIS appelle `socket.emit('task_created')`.
*   **Correct** : Le client appelle l'API `createTask`. Le backend traite la requête ET broadcast l'événement à tous les clients.

### Naming Convention (Backend `websocket_broadcasts.py`)
Toutes les fonctions de broadcast doivent être centralisées dans `backend/websocket_broadcasts.py`.

Format : `broadcast_{module}_{scope}_{action}`

| Scope | Description | Exemple |
|-------|-------------|---------|
| `tree` | Recharge l'arbre complet | `broadcast_task_tree_update` |
| `item` | Met à jour un item spécifique | `broadcast_vault_item_updated` |
| `activity` | Notifie d'une activité (log, commentaire) | `broadcast_task_activity_update` |
| `lock` | Met à jour le statut de verrouillage | `broadcast_document_lock_update` |

### Naming Convention (Frontend `websocket.ts`)
Le service WebSocket doit exposer des méthodes typées.

| Type | Format | Exemple |
|------|--------|---------|
| Listener | `on{Module}{Event}` | `onTaskTreeChanged` |
| Emitter | `notify{Module}{Action}` | `notifyTaskActivity` (seulement si action purement frontend) |

## 2. Structure des Composants "Tree"

Tout composant d'arbre (`{Module}Tree.tsx`) doit respecter cette interface minimale :

```typescript
interface TreeProps {
  tree: ItemType[];
  expanded: Record<string, boolean>;
  selected: ItemType[];
  onToggleExpand: (id: string) => void;
  onSelect: (item: ItemType, event?: React.MouseEvent) => void;
  
  // Actions CRUD standards
  onCreate?: (parentId: string, name: string) => void;
  onCreateFolder?: (parentId: string, name: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  
  // UX
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  width?: number;
  searchQuery?: string;
}
```

### Menu Contextuel (ContextMenu)
Doit toujours proposer dans cet ordre :
1.  **Création** (Si dossier) : `Nouveau {Item}`, `Nouveau dossier` + Séparateur
2.  **Édition** : `Renommer`, `Dupliquer/Copier`
3.  **Actions spécifiques** : `Télécharger`, `Verrouiller`
4.  **Danger** : `Supprimer` (en rouge/danger)

## 3. Local Storage & Session Storage

Les clés de stockage doivent être préfixées par `markd_{module}_`.

| Usage | Clé recommandée | Exemple |
|-------|-----------------|---------|
| Largeur Arbre | `markd_{module}_tree_width` | `markd_tasks_tree_width` |
| Session | `markd_{module}_session` | `markd_documents_session` |
| Préférences | `markd_{module}_prefs` | `markd_vault_prefs` |

*Note : Les modules existants peuvent avoir des clés historiques (ex: `vaultSidebarWidth`), mais les nouveaux doivent suivre la norme.*

## 4. Gestion des Erreurs et Notifications

### Toast (react-hot-toast)
*   **Succès** : Afficher un toast vert pour confirmation explicite (ex: "Sauvegardé").
*   **Erreur** : Afficher un toast rouge avec un message utilisateur clair (pas de stacktrace).
*   **Info/Socket** : Pour les notifications temps réel venant d'autres utilisateurs, utiliser un toast personnalisé avec barre de progression (25s) et bouton "Voir".

### Modales
*   Ne JAMAIS utiliser `alert()`, `confirm()` ou `prompt()`.
*   Utiliser `ConfirmModal` pour les confirmations (suppression).
*   Utiliser `InputModal` pour les saisies simples (renommage, création).

## 5. Sécurité

### Vérification des Permissions
Chaque action sensible (Write/Delete) doit vérifier les permissions à deux niveaux :
1.  **Frontend** : Masquer/Désactiver les boutons si `userPermission !== 'write' && userPermission !== 'admin'`.
2.  **Backend** : Vérifier systématiquement les droits dans l'endpoint API.

### Anti-Écho (Futur)
Pour l'instant, le backend broadcast à tous (`sio.emit`).
Cible future : Utiliser `skip_sid` pour ne pas notifier l'émetteur d'une action qu'il vient de faire, afin d'éviter les "sauts" d'interface ou les doubles notifications.

---
*Document créé le 26 novembre 2025 - Référence pour tout développement futur.*
