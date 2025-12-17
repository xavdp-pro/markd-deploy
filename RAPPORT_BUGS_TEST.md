# 🐛 Rapport de Bugs et Tests - MarkD v2

**Date:** 2025-01-31  
**Environnement:** markd-v2 (port 8200 backend, 5273 frontend)  
**Identifiants test:** admin / admin

## ✅ Tests Effectués via API

### 1. Authentification
- ✅ **Login:** `/api/auth/login` - Fonctionne correctement
- ✅ **Token JWT:** Cookie `markd_auth` créé correctement

### 2. Modules Testés via API

#### Documents
- ✅ `/api/documents/tree?workspace_id=default` - Fonctionne (retourne arbre vide)
- ✅ Endpoint disponible et répond correctement

#### Tasks
- ✅ `/api/tasks/tree?workspace_id=default` - Fonctionne
- ✅ Retourne 2 éléments de test (folder "rere" et task "zaza")

#### Passwords (Vault)
- ✅ `/api/vault/tree?workspace_id=default` - Fonctionne (retourne arbre vide)
- ✅ `/api/vault/passwords?workspace_id=default` - Fonctionne (retourne liste vide)
- ✅ Endpoints disponibles et corrects

#### Files
- ✅ `/api/files/tree?workspace_id=default` - Fonctionne (retourne arbre vide)

#### Schemas
- ✅ `/api/schemas/tree?workspace_id=default` - Fonctionne (retourne arbre vide)

---

## 🐛 Bugs Identifiés

### 1. Checklist API - Endpoints 404 (DÉJÀ DOCUMENTÉ)

**Problème:**  
Les endpoints checklist pour les tasks retournent 404 car non implémentés côté backend.

**Endpoints concernés:**
- `GET /api/tasks/{id}/checklist` → 404
- `POST /api/tasks/{id}/checklist` → 404
- `PATCH /api/tasks/{id}/checklist/{itemId}` → 404
- `DELETE /api/tasks/{id}/checklist/{itemId}` → 404

**Impact:**  
- La checklist des tasks ne fonctionne pas
- Console polluée par erreurs 404 (gérées silencieusement dans le code actuel)

**Fichiers concernés:**
- `frontend/src/components/TaskChecklist.tsx` - Gestion silencieuse des 404
- `frontend/src/TasksApp.tsx` - Appels API désactivés temporairement
- `backend/tasks_simple.py` - Endpoints non implémentés

**Solution actuelle:**  
Le frontend gère silencieusement les 404 et n'affiche pas d'erreur à l'utilisateur.

**Recommandation:**  
Implémenter les endpoints checklist dans `backend/tasks_simple.py` pour activer cette fonctionnalité.

---

### 2. Incohérence des Endpoints Passwords

**Problème:**  
Dans le frontend, il y a une incohérence dans les endpoints utilisés pour les locks de passwords.

**Fichier:** `frontend/src/services/api.ts`

**Ligne 393-416:** Utilisation de `/api/passwords/{id}/lock`  
**Ligne 346-347:** Utilisation de `/api/vault/passwords/{id}` pour récupérer

**Backend disponible:**
- ✅ `/api/vault/passwords/{password_id}/lock` (dans `vault.py` ligne 582)
- ✅ `/api/passwords/{password_id}/lock` (dans `vault.py` ligne 582 aussi)

**Impact:**  
Possible confusion dans le code, mais les deux endpoints existent côté backend.

**Recommandation:**  
Standardiser sur `/api/vault/passwords/{id}/lock` pour être cohérent avec les autres endpoints du vault.

---

### 3. Debug Print Statements dans le Backend

**Problème:**  
Plusieurs `print()` de debug dans le backend polluent les logs.

**Fichiers concernés:**
- `backend/main.py` - Lignes 998, 1000, 1002, 1013
- `backend/main.py` - Lignes 769, 1460

**Exemples:**
```python
print(f"DEBUG: Checking permission for user {user.get('id')} on workspace {workspace_id}")
print(f"DEBUG: Permission OK, building tree")
print(f"Error uploading image: {str(e)}")
```

**Impact:**  
Logs verbeux en production, peut ralentir les performances.

**Solution:**  
Remplacer les `print()` par un système de logging approprié (Python `logging`).

---

### 4. TODO Commenté dans WebSocket Disconnect

**Problème:**  
Un TODO non résolu dans le handler de déconnexion WebSocket.

**Fichier:** `backend/main.py`  
**Ligne 1513:**
```python
@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    # print(f"Client disconnected: {sid}") # Commented out
    # TODO: Release any locks held by this client
```

**Impact:**  
Les locks ne sont pas libérés automatiquement lors de la déconnexion d'un client.

**Recommandation:**  
Implémenter la libération automatique des locks à la déconnexion pour éviter les locks "orphelins".

---

### 5. Gestion d'Erreur dans VaultPage

**Problème:**  
Dans `VaultPage.tsx`, la fonction `fetchPasswords` utilise `/api/vault/passwords` qui retourne une liste plate, pas un arbre.

**Fichier:** `frontend/src/pages/VaultPage.tsx`  
**Ligne 102:** Appel à `/api/vault/passwords`  
**Mais:** Le composant utilise `getPasswordTree()` qui appelle `/api/vault/tree`

**Impact:**  
Possible incohérence entre l'utilisation de l'arbre et de la liste plate.

**Vérification nécessaire:**  
S'assurer que le frontend utilise bien `/api/vault/tree` pour la structure hiérarchique et non `/api/vault/passwords`.

---

## 🔍 Problèmes Potentiels à Vérifier

### 1. WebSocket Connection

**À tester:**  
- Connexion WebSocket fonctionne-t-elle correctement ?
- Les notifications temps réel sont-elles reçues ?
- Les locks sont-ils synchronisés entre clients ?

**Endpoints WebSocket:**
- `ws://localhost:8200/socket.io`

### 2. Upload de Fichiers

**À tester:**  
- Upload de fichiers dans Tasks
- Upload de fichiers dans Files
- Upload d'images dans Documents
- Taille maximale des fichiers

### 3. Drag & Drop

**À tester:**  
- Drag & drop dans Documents
- Drag & drop dans Tasks (Kanban)
- Drag & drop dans Checklist
- Drag & drop dans Password Tree
- Drag & drop dans Files Tree

### 4. Permissions Workspace

**À tester:**  
- Vérification des permissions read/write/admin
- Changement de workspace
- Accès refusé (403) affiché correctement

### 5. Mode Sombre

**À tester:**  
- Tous les composants sont-ils adaptés au dark mode ?
- Les couleurs sont-elles cohérentes ?
- Les contrastes sont-ils suffisants ?

---

## 📋 Tests Manuels Nécessaires

### Module Documents
- [ ] Créer un document
- [ ] Créer un dossier
- [ ] Éditer un document
- [ ] Supprimer un document
- [ ] Déplacer un document (drag & drop)
- [ ] Verrouiller un document
- [ ] Ajouter des tags
- [ ] Upload d'images

### Module Tasks
- [ ] Créer une task
- [ ] Créer un dossier de tasks
- [ ] Changer le statut d'une task
- [ ] Assigner une task
- [ ] Ajouter une date d'échéance
- [ ] Vue Kanban fonctionne
- [ ] Timeline s'affiche
- [ ] Commentaires fonctionnent
- [ ] **Checklist ne fonctionne pas (bug connu)**
- [ ] Upload de fichiers dans tasks

### Module Passwords
- [ ] Créer un mot de passe
- [ ] Créer un dossier
- [ ] Afficher/masquer le mot de passe
- [ ] Copier le mot de passe
- [ ] Éditer un mot de passe
- [ ] Supprimer un mot de passe
- [ ] Verrouiller un mot de passe
- [ ] Ajouter des tags

### Module Files
- [ ] Upload un fichier
- [ ] Créer un dossier
- [ ] Télécharger un fichier
- [ ] Supprimer un fichier
- [ ] Aperçu de fichiers (images)

### Module Schemas
- [ ] Créer un schéma
- [ ] Ajouter des devices
- [ ] Créer des connections
- [ ] Drag & drop des devices
- [ ] Templates de devices

### Pages Admin
- [ ] Gestion des utilisateurs
- [ ] Gestion des groupes
- [ ] Gestion des workspaces
- [ ] Permissions par workspace

---

## 🎯 Priorités de Correction

### 🔴 Haute Priorité
1. **Checklist API** - Implémenter les endpoints backend pour activer la fonctionnalité
2. **Locks orphelins** - Libérer automatiquement les locks à la déconnexion WebSocket

### 🟡 Moyenne Priorité
3. **Debug print statements** - Remplacer par un système de logging
4. **Standardisation endpoints passwords** - Utiliser `/api/vault/` partout

### 🟢 Basse Priorité
5. **Documentation** - Compléter la documentation des endpoints
6. **Tests automatisés** - Ajouter des tests unitaires et d'intégration

---

## 📝 Notes

- Les endpoints API répondent correctement dans l'ensemble
- La structure de l'application est solide
- Les principaux bugs sont déjà documentés
- Le système de gestion d'erreurs frontend est bien géré (404 silencieux)
- Les WebSockets sont configurés correctement (logger désactivé)

---

**Prochaines étapes recommandées:**
1. Tester manuellement chaque module avec le navigateur
2. Implémenter les endpoints checklist backend
3. Nettoyer les print statements de debug
4. Implémenter la libération automatique des locks







