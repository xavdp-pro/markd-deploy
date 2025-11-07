# 🔍 DEBUG - Tâches MarkD

## Problèmes identifiés et corrections

### ✅ Corrections appliquées

1. **Layout TasksPage** : Ajouté flex-col et overflow-hidden pour affichage correct
2. **Endpoint users manquant** : Ajouté `/api/workspaces/{workspace_id}/users` pour UserMultiSelect
3. **Header dans App.tsx** : TasksPage maintenant avec Header comme les autres pages

### 🧪 Tests à faire maintenant

#### 1. Ouvrir l'interface
```
http://localhost:5273/tasks
```

#### 2. Console navigateur (F12)
Ouvrez la console pour voir les erreurs éventuelles

#### 3. Vérifier le chargement
- Workspace selector doit apparaître en haut
- Arbre des tâches à gauche (vide au début)
- Zone vide à droite avec message "Sélectionnez une tâche"

#### 4. Créer une tâche
- Clic droit dans la zone de gauche
- Devrait voir menu avec : Epic, Story, Task, Subtask
- Choisir "Task"
- Entrer un titre
- Valider

#### 5. Sélectionner la tâche
- Cliquer sur la tâche créée
- Le panel de droite doit s'afficher avec 4 onglets

## 🐛 Si ça ne marche toujours pas

### Vérifier la console navigateur (F12)

Chercher des erreurs comme :
- `Cannot find module` → Import manquant
- `undefined is not a function` → Fonction API manquante
- `401 Unauthorized` → Problème d'authentification
- `Failed to fetch` → Backend pas accessible

### Vérifier les logs backend

```bash
cd /apps/markd-v2/app/markd-package
tail -f logs/backend.log | grep ERROR
```

### Tester les endpoints directement

```bash
# Se connecter d'abord pour avoir le cookie
curl -X POST http://localhost:8200/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt

# Tester task-types
curl -b /tmp/cookies.txt http://localhost:8200/api/task-types?workspace_id=default

# Tester workflows
curl -b /tmp/cookies.txt http://localhost:8200/api/workflows?workspace_id=default

# Tester tasks tree
curl -b /tmp/cookies.txt http://localhost:8200/api/tasks/tree?workspace_id=default
```

### Redémarrer proprement

```bash
cd /apps/markd-v2/app/markd-package
./stop.sh
sleep 3
./start.sh --auto --db-name markd-v2 --db-user markd-v2 \
  --db-password 'iUfEjw1P1OSCuJlUVMlO' \
  --backend-port 8200 --frontend-port 5273 \
  --skip-db-import --skip-deps
```

## 📋 Checklist debug

- [ ] Backend répond sur http://localhost:8200
- [ ] Frontend répond sur http://localhost:5273
- [ ] Cookie markd_auth présent après login (F12 → Application → Cookies)
- [ ] Pas d'erreurs dans console navigateur
- [ ] Pas d'erreurs dans logs/backend.log
- [ ] Tables tasks* existent dans MySQL
- [ ] Données seed présentes (4 types, 2 workflows)

## 🔧 Commandes utiles

### Vérifier BDD
```bash
mysql -u markd-v2 -p'iUfEjw1P1OSCuJlUVMlO' markd-v2 -e "
  SELECT COUNT(*) FROM task_types;
  SELECT COUNT(*) FROM workflows;
  SELECT COUNT(*) FROM tasks;
"
```

### Voir les logs en temps réel
```bash
# Terminal 1
tail -f /apps/markd-v2/app/markd-package/logs/backend.log

# Terminal 2
tail -f /apps/markd-v2/app/markd-package/logs/frontend.log
```

### Tester l'API directement
```bash
# Ouvrir Swagger UI
xdg-open http://localhost:8200/docs 2>/dev/null || open http://localhost:8200/docs
```

## 💡 Solutions possibles

### Si l'arbre ne s'affiche pas
- Vérifier que `/api/tasks/tree?workspace_id=default` retourne bien un tableau
- Console F12 → Network → Voir la requête
- Backend logs → Voir si erreur SQL

### Si le panel de droite ne s'affiche pas
- Vérifier que vous avez cliqué sur une tâche
- Console F12 → Voir si erreur lors du loadTask()
- Vérifier que `/api/tasks/{id}` fonctionne

### Si les boutons/options manquent
- Vérifier les permissions (admin, write, read)
- Console F12 → Voir userPermission dans les props
- Vérifier la requête `/api/workspaces`

## 📸 Ce que vous devriez voir

```
┌────────────────────────────────────────────────────────────┐
│ MarkD  Documents  [Tasks]  Passwords         👤 Admin      │
├──────────────┬─────────────────────────────────────────────┤
│ Workspace: ▼ │                                             │
│  default     │  Sélectionnez une tâche pour voir          │
│              │  les détails                                │
│ + Nouvelle   │                                             │
│              │           📋                                │
│ (vide)       │                                             │
│              │                                             │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

Après création d'une tâche :
```
┌────────────────────────────────────────────────────────────┐
│ MarkD  Documents  [Tasks]  Passwords         👤 Admin      │
├──────────────┬─────────────────────────────────────────────┤
│ Workspace: ▼ │ 📋 Ma tâche                                 │
│  default     │ ┌───────────────────────────────────────┐   │
│              │ │ Détails│Timeline│Commentaires│Fichiers│   │
│ + Nouvelle   │ └───────────────────────────────────────┘   │
│              │                                             │
│ ✓ Ma tâche   │ Titre: Ma tâche                            │
│   [À faire]  │                                             │
│   ⚠️ Moyenne  │ Description: ...                           │
│              │                                             │
│              │ [Modifier]                                 │
└──────────────┴─────────────────────────────────────────────┘
```

---

**Services actifs** : ✅ Backend (8200) + Frontend (5273)
**Base de données** : ✅ 7 tables créées avec seed data
**Accès** : http://localhost:5273/tasks

