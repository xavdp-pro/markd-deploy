# Guide d'utilisation - Gestion de Tâches MarkD

## 🎯 Vue d'ensemble

Le système de gestion de tâches de MarkD offre une solution complète pour organiser, suivre et collaborer sur vos projets avec une approche hiérarchique flexible.

## 🌟 Fonctionnalités principales

### Structure hiérarchique flexible
- **Types de tâches configurables** : Epic → Story → Task → Subtask (et plus si besoin)
- **Arbre drag & drop** : Réorganisez facilement vos tâches
- **Navigation intuitive** : Même interface que les documents

### Workflows personnalisables
- **Templates prédéfinis** :
  - Simple : À faire → En cours → Terminé
  - Avec validation : À faire → En cours → En validation → Terminé
- **Création libre** : Créez vos propres processus adaptés à vos besoins

### Collaboration en temps réel
- **WebSocket** : Tous les changements sont synchronisés instantanément
- **Assignations multiples** : Plusieurs utilisateurs par tâche
- **Responsable** : Une personne mène la danse (facultatif)
- **Commentaires** : Discussion directement sur la tâche
- **Timeline** : Historique complet de tous les événements

### Gestion avancée
- **Priorités** : Haute, Moyenne, Basse avec indicateurs visuels
- **Dates d'échéance** : Avec rappels emails automatiques 24h avant
- **Tags flexibles** : Organisez comme vous voulez
- **Fichiers attachés** : Joignez des documents à vos tâches
- **Description Markdown** : Riche formatage et images

## 🚀 Démarrage rapide

### 1. Accéder aux tâches

Cliquez sur le bouton **Tasks** dans la barre de navigation principale.

### 2. Créer votre première tâche

1. Clic droit sur la zone de l'arbre
2. Choisissez le type de tâche (Epic, Story, Task, Subtask)
3. Entrez un titre
4. Cliquez sur Créer

### 3. Éditer une tâche

1. Sélectionnez la tâche dans l'arbre
2. Onglet **Détails** : Cliquez sur "Modifier"
3. Remplissez les champs :
   - **Titre** : Nom de la tâche
   - **Description** : En Markdown (support images, tableaux, etc.)
   - **Workflow** : Choisissez le processus
   - **Statut** : Étape actuelle dans le workflow
   - **Priorité** : Basse, Moyenne, Haute
   - **Date d'échéance** : Pour recevoir un rappel
   - **Assignés** : Sélectionnez les utilisateurs
   - **Responsable** : Cliquez sur la couronne pour définir
   - **Tags** : Ajoutez des labels
4. Cliquez sur "Enregistrer"

### 4. Utiliser la hiérarchie

**Créer une sous-tâche :**
1. Clic droit sur la tâche parent
2. Choisissez le type
3. Les propriétés sont héritées automatiquement (workflow, assignés, tags, etc.)

**Déplacer une tâche :**
- Drag & drop vers une nouvelle position ou parent

**Héritage intelligent :**
Les sous-tâches héritent de leur parent :
- Workspace
- Workflow
- Assignés et responsable
- Tags
- Type de tâche

Vous pouvez ensuite modifier n'importe quelle propriété individuellement.

### 5. Collaborer

**Timeline** :
- Voir tous les événements : création, changements de statut, assignations, etc.
- Automatique, rien à faire

**Commentaires** :
- Onglet "Commentaires"
- Écrivez en Markdown
- Tout le monde voit en temps réel

**Fichiers** :
- Onglet "Fichiers"
- Uploadez des documents, images, etc.
- Téléchargez ou supprimez facilement

## ⚙️ Configuration (Admin)

### Configurer les types de tâches

1. Menu utilisateur → **Types de tâches**
2. Créez les types dont vous avez besoin
3. Personnalisez :
   - Nom
   - Icône (emoji)
   - Couleur
   - Position (ordre d'affichage)

**Exemples de types :**
- 🎯 Epic (violet) : Grand objectif stratégique
- 📖 Story (bleu) : Fonctionnalité utilisateur
- ✓ Task (vert) : Tâche à réaliser
- → Subtask (gris) : Sous-tâche technique
- 🐛 Bug (rouge) : Correction
- ✨ Feature (jaune) : Nouvelle fonctionnalité
- 🔧 Maintenance (orange) : Technique

### Configurer les workflows

1. Menu utilisateur → **Workflows**
2. Créez votre processus
3. Définissez les statuts avec :
   - Clé technique (ex: `todo`)
   - Label affiché (ex: "À faire")
   - Couleur

**Exemples de workflows :**

**Développement logiciel :**
```
Backlog → À faire → En cours → Review → Testing → Done
```

**Support client :**
```
Nouveau → En cours → En attente → Résolu → Fermé
```

**Marketing :**
```
Idée → Planification → Création → Validation → Publication
```

**Agile Scrum :**
```
Product Backlog → Sprint Backlog → In Progress → Done → Deployed
```

### Marquer un workflow par défaut

Cochez "Workflow par défaut" pour qu'il soit automatiquement sélectionné lors de la création de tâches.

## 🔔 Notifications

### Rappels d'échéance

Un email est envoyé automatiquement 24h avant l'échéance à :
- Le responsable (si défini)
- Tous les utilisateurs assignés

Pour activer les rappels, assurez-vous que le scheduler tourne :
```bash
python backend/task_scheduler.py
```

## 📊 Bonnes pratiques

### Organisation recommandée

```
🎯 Epic: Refonte de l'interface
  ├─ 📖 Story: Nouveau design homepage
  │   ├─ ✓ Task: Créer les maquettes
  │   ├─ ✓ Task: Développer les composants
  │   └─ ✓ Task: Tests utilisateurs
  ├─ 📖 Story: Dashboard analytics
  │   └─ ✓ Task: Intégration API
  └─ 📖 Story: Mode sombre
      ├─ ✓ Task: Design tokens
      └─ → Subtask: Implémenter toggle
```

### Workflows adaptés

- **Petits projets** : Simple (Todo/Doing/Done)
- **Projets avec validation** : Avec validation (+ étape review)
- **Production** : Ajoutez Testing, Staging, Production

### Assignations efficaces

- **Responsable** = Celui qui pilote et décide
- **Assignés** = Ceux qui contribuent
- Un seul responsable, plusieurs assignés possibles

### Tags utiles

- `urgent`, `bloquant`, `facile`, `backend`, `frontend`, `bug`, `feature`
- Filtrez rapidement (fonctionnalité à venir)

## 🔐 Permissions

Même système que les documents :
- **Read** : Voir les tâches
- **Write** : Créer, modifier, assigner
- **Admin** : Configuration (types, workflows)

## 🎨 Interface

### Arbre des tâches (gauche)
- **Icônes** : Type de tâche
- **Badges colorés** : Statut actuel
- **Priorité** : Cercle coloré (rouge = haute, orange = moyenne, gris = basse)
- **Avatars** : Assignés (couronne = responsable)

### Détails (droite)
- **4 onglets** : Détails, Timeline, Commentaires, Fichiers
- **Mode édition** : Cliquez sur "Modifier"
- **Temps réel** : Tout est synchronisé via WebSocket

## 💡 Cas d'usage

### Gestion de projet logiciel
```
Epic → Stories → Tasks → Subtasks
Workflow: Backlog/Todo/Doing/Review/Done
Tags: frontend, backend, devops, bug, feature
```

### Support client
```
Ticket → Sous-problèmes
Workflow: Nouveau/En cours/En attente/Résolu
Tags: urgent, facturation, technique, commercial
```

### Marketing & Contenu
```
Campagne → Actions → Tâches
Workflow: Idée/Planif/Création/Validation/Publication
Tags: réseaux-sociaux, email, blog, vidéo
```

### GTD Personnel
```
Projet → Actions → Contextes
Workflow: Todo/Doing/Done
Tags: @maison, @bureau, @appels, @courses
```

## 🔧 Dépannage

### Les tâches ne s'affichent pas
- Vérifiez le workspace sélectionné
- Vérifiez vos permissions (read minimum)
- Rafraîchissez la page

### Le WebSocket ne fonctionne pas
- Vérifiez que le backend tourne sur le bon port
- Ouvrez la console navigateur (F12) pour voir les erreurs
- Vérifiez la configuration Nginx

### Les emails ne partent pas
- Vérifiez la configuration SMTP dans `.env`
- Lancez le task_scheduler : `python backend/task_scheduler.py`
- Consultez les logs

## 📈 Évolutions futures

- [ ] Filtres avancés (par user, status, priority, tags)
- [ ] Vue Kanban (colonnes par statut)
- [ ] Vue Gantt (timeline visuelle)
- [ ] Dashboard statistiques
- [ ] Export CSV/PDF
- [ ] Templates de projets
- [ ] Récurrence (tâches répétitives)
- [ ] Dépendances entre tâches
- [ ] Points/estimation (Scrum)
- [ ] Burndown charts

## 🎓 Pour aller plus loin

### API Documentation

Consultez `/docs` pour voir tous les endpoints disponibles et tester avec Swagger UI.

### Intégration externe

Les endpoints API permettent d'intégrer MarkD avec d'autres outils :
- Webhooks (à venir)
- CLI
- Scripts d'automatisation
- Agents IA

---

**Besoin d'aide ?** Consultez la documentation complète ou créez une issue sur GitHub.

