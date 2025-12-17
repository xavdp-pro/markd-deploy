# Corrections : Objets qui disparaissent et WebSockets optimisés

## ✅ Corrections appliquées

### 1. **Préservation de la sélection lors du refresh de l'arbre**

**Problème** : Quand un événement WebSocket `tree_changed` était reçu, les modules rechargeaient l'arbre sans préserver la sélection actuelle, faisant disparaître l'objet sélectionné.

**Solution** : Pour chaque module, ajout de la logique de préservation de sélection :
1. Sauvegarde des IDs sélectionnés avant le refresh
2. Recherche des objets correspondants dans le nouvel arbre
3. Restauration de la sélection si les objets existent toujours
4. Nettoyage de la sélection si les objets ont été supprimés

**Modules corrigés** :
- ✅ `TasksApp.tsx` (ligne 167-203) : Fonction `refreshTree()` modifiée
- ✅ `VaultPage.tsx` (ligne 823-852) : Gestion de `tree_changed` améliorée
- ✅ `FilesApp.tsx` (ligne 835-867) : Gestion de `tree_changed` améliorée
- ✅ `SchemaApp.tsx` (ligne 946-978) : Gestion de `tree_changed` améliorée
- ℹ️ `DocumentsApp.tsx` : Déjà géré correctement

### 2. **Optimisation de la fréquence des heartbeats**

**Problème** : Les heartbeats étaient envoyés toutes les 60 secondes pour chaque objet verrouillé, générant beaucoup de trafic WebSocket inutile.

**Solution** : Réduction de la fréquence de 60s à 120s (2 minutes).

**Modules modifiés** :
- ✅ `DocumentsApp.tsx` (ligne 467) : `60000` → `120000`
- ✅ `TasksApp.tsx` (ligne 653) : `60000` → `120000`
- ✅ `VaultPage.tsx` (ligne 127) : `60000` → `120000`

**Impact** : Réduction de 50% du trafic WebSocket lié aux heartbeats.

## 📊 Résultats attendus

1. **Objets qui disparaissent** : ✅ Corrigé
   - Les objets sélectionnés restent visibles après un `tree_changed`
   - La sélection est préservée lors des mises à jour WebSocket

2. **WebSockets moins sollicités** : ✅ Amélioré
   - 50% moins de requêtes heartbeat
   - Meilleure performance générale

## 🔍 Tests recommandés

1. Ouvrir un objet dans chaque module (Documents, Tasks, Vault, Files, Schemas)
2. Vérifier que l'objet reste sélectionné après un `tree_changed`
3. Observer la réduction du trafic WebSocket dans les DevTools

## 📝 Notes techniques

- Les heartbeats restent nécessaires pour maintenir les verrous actifs
- La fréquence de 120s est un bon compromis entre performance et fiabilité
- Les verrous expirent après 30 minutes d'inactivité (LOCK_TIMEOUT_MINUTES)






