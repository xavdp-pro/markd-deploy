# 🚀 Démarrage Rapide - Gestion de Tâches

## ⚡ En 3 minutes

### 1. Services déjà démarrés ✅

Les services sont actuellement en cours d'exécution :
- **Backend** : http://localhost:8200 ✅
- **Frontend** : http://localhost:5273 ✅
- **API Docs** : http://localhost:8200/docs ✅

### 2. Accéder à l'interface

1. Ouvrez votre navigateur
2. Allez sur : **http://localhost:5273**
3. Connectez-vous :
   - **Username** : `admin`
   - **Password** : `admin`
4. Cliquez sur **"Tasks"** dans la barre de navigation

### 3. Créer votre première tâche

1. **Clic droit** dans la zone de l'arbre
2. Choisissez **"Epic"** (ou Story, Task...)
3. Entrez un titre, par exemple : "Mon premier projet"
4. Cliquez sur **"Créer"**

### 4. Créer une hiérarchie

1. **Clic droit sur votre Epic**
2. Choisissez **"Story"**
3. Entrez : "Fonctionnalité principale"
4. **Clic droit sur la Story**
5. Choisissez **"Task"**
6. Entrez : "Implémenter le feature"

Vous avez maintenant : Epic → Story → Task 🎉

### 5. Éditer une tâche

1. **Cliquez sur n'importe quelle tâche**
2. Panneau de droite : Cliquez sur **"Modifier"**
3. Ajoutez :
   - Description en Markdown
   - Changez le statut : "En cours"
   - Définissez la priorité : "Haute"
   - Ajoutez une date d'échéance
   - Ajoutez des tags : `urgent`, `backend`
4. Cliquez sur **"Enregistrer"**

### 6. Tester le temps réel

1. **Ouvrez un 2ème onglet** : http://localhost:5273
2. Connectez-vous aussi
3. Allez sur **Tasks**
4. Sélectionnez la même tâche dans les 2 onglets
5. **Onglet 1** : Changez le statut
6. **Onglet 2** : 🎊 Vous voyez le changement instantanément !

## 🎯 Types de tâches par défaut

- 🎯 **Epic** : Grand objectif stratégique
- 📖 **Story** : Fonctionnalité utilisateur
- ✓ **Task** : Tâche à réaliser
- → **Subtask** : Sous-tâche détaillée

## 🔄 Workflows par défaut

### Simple (par défaut)
```
À faire → En cours → Terminé
```

### Avec validation
```
À faire → En cours → En validation → Terminé
```

## ⚙️ Configuration (Admin)

### Personnaliser les types
1. Menu utilisateur (en haut à droite)
2. Cliquez sur **"Types de tâches"**
3. Créez vos propres types (Bug, Feature, etc.)
4. Personnalisez icône et couleur

### Personnaliser les workflows
1. Menu utilisateur
2. Cliquez sur **"Workflows"**
3. Créez votre processus sur mesure
4. Ajoutez autant de statuts que nécessaire

## 📋 Cas d'usage rapide

### Projet Agile
```
🎯 Epic: Refonte UI
  📖 Story: New Homepage
    ✓ Task: Design mockups
    ✓ Task: Implement components
    → Subtask: Create button
    → Subtask: Create header
```

### Support Client
```
🎯 Sprint 1
  📖 Ticket #123: Bug login
    ✓ Task: Investigate
    ✓ Task: Fix code
    ✓ Task: Test
```

## 🛑 Arrêter les services

```bash
cd /apps/markd-v2/app/markd-package
./stop.sh
```

## 🔄 Redémarrer

```bash
cd /apps/markd-v2/app/markd-package
./start.sh --auto \
  --db-name markd-v2 \
  --db-user markd-v2 \
  --db-password 'iUfEjw1P1OSCuJlUVMlO' \
  --backend-port 8200 \
  --frontend-port 5273 \
  --skip-db-import
```

## 📚 Documentation complète

- **TASKS_GUIDE.md** : Guide utilisateur détaillé
- **TESTING_TASKS.md** : Procédures de test
- **FEATURE_SUMMARY.md** : Récapitulatif technique

## 💡 Astuces

- **Drag & drop** : Réorganisez facilement les tâches
- **Clic droit** : Accès rapide aux actions
- **Héritage** : Les sous-tâches héritent des propriétés parent
- **Temps réel** : Tous les changements sont synchronisés
- **Markdown** : Descriptions et commentaires riches

---

**Prêt à collaborer ! 🎉**

