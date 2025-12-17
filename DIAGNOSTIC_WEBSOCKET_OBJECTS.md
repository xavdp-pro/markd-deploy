# Diagnostic : Objets qui disparaissent et WebSockets trop sollicités

## Problèmes identifiés

### 1. **Objets qui disparaissent après clic** ❌

**Cause racine** : Quand un événement WebSocket `tree_changed` est reçu, tous les modules appellent `refreshTree()` ou `api.getTree()` qui remplace complètement l'arbre sans préserver la sélection actuelle.

**Modules affectés** :
- ✅ `DocumentsApp.tsx` : Gère correctement la préservation de sélection (ligne 1018-1091)
- ❌ `TasksApp.tsx` : `refreshTree()` ne préserve PAS la sélection (ligne 167-169, appelée ligne 592)
- ❌ `VaultPage.tsx` : `tree_changed` recharge l'arbre sans préserver la sélection (ligne 577-625)
- ❌ `FilesApp.tsx` : `tree_changed` recharge l'arbre sans préserver la sélection (ligne 832-870)
- ❌ `SchemaApp.tsx` : `tree_changed` recharge l'arbre sans préserver la sélection (ligne 943-980)

### 2. **WebSockets trop sollicités** ⚠️

**Causes** :

1. **Heartbeat toutes les 60 secondes** pour chaque objet verrouillé
   - Documents, Tasks, Passwords, Files, Schemas : tous envoient un heartbeat toutes les 60s
   - Si 10 objets sont ouverts en même temps = 10 requêtes/minute

2. **Événements WebSocket déclenchés trop souvent** :
   - Chaque `tree_changed` déclenche un rechargement complet de l'arbre
   - Les événements `lock_updated`, `content_updated` peuvent être redondants

3. **Pas de debouncing/throttling** :
   - Les événements WebSocket peuvent s'accumuler rapidement

## Corrections à appliquer

### Correction 1 : Préserver la sélection lors du refresh

**Pour chaque module** (`TasksApp`, `VaultPage`, `FilesApp`, `SchemaApp`) :

1. Sauvegarder les IDs sélectionnés avant `refreshTree()`
2. Après le refresh, re-sélectionner les objets trouvés dans le nouvel arbre
3. Gérer les cas où l'objet a été supprimé

### Correction 2 : Optimiser les heartbeats

1. **Réduire la fréquence** : De 60s à 120s (2 minutes)
2. **Désactiver les heartbeats** si l'objet n'est plus visible/actif
3. **Regrouper les heartbeats** si plusieurs objets sont verrouillés par le même utilisateur

### Correction 3 : Débouncer les événements tree_changed

1. Ajouter un debounce de 300-500ms sur `tree_changed`
2. Éviter de recharger l'arbre si un refresh est déjà en cours






