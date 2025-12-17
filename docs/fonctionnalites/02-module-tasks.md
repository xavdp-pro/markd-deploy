# Module Tasks - Documentation complète

## Vue d'ensemble

Le module Tasks permet de gérer des tâches et projets avec suivi complet, assignation, timeline, commentaires et fichiers attachés.

## Fonctionnalités principales

### 1. Gestion hiérarchique
- **Arbre de tâches** : Organisation en dossiers et tâches
- **Drag & drop** : Réorganisation par glisser-déposer
- **Navigation** : Expand/collapse des dossiers
- **Sélection** : Clic pour afficher détails complets

### 2. Gestion des tâches
- **Statuts** : todo, doing, done
- **Priorités** : low, medium, high
- **Dates d'échéance** : Date picker avec validation
- **Description** : Contenu Markdown
- **Assignation** : Multi-utilisateurs avec responsable
- **Tags** : Catégorisation flexible

### 3. Timeline automatique
- **Historique complet** : Tous les événements enregistrés
- **Types d'événements** :
  - Création/modification/suppression
  - Changement de statut
  - Changement de priorité
  - Changement d'assignés/responsable
  - Changement de tags
  - Changement de date d'échéance
  - Ajout/suppression de fichiers
  - Ajout de commentaires
- **Entrées manuelles** : Possibilité d'ajouter des notes
- **Métadonnées** : Utilisateur, date, détails du changement

### 4. Commentaires
- **Discussion** : Fil de commentaires par tâche
- **Auteur** : Nom et date affichés
- **Markdown** : Support du formatage
- **Notifications** : Entrée timeline automatique

### 5. Fichiers attachés
- **Upload** : Drag & drop ou bouton
- **Limite** : 50 MB par fichier
- **Types** : Tous types de fichiers
- **Prévisualisation** : Images affichées
- **Viewer PDF** : Visualisation interne fullscreen
- **Téléchargement** : Bouton de téléchargement
- **Notes markdown** : Note par fichier
- **Suppression** : Avec confirmation

### 6. Filtres multiples
- **Recherche textuelle** : Par nom de tâche
- **Filtre statut** : all/todo/doing/done
- **Filtre priorité** : all/low/medium/high
- **Filtre tags** : Sélection multiple
- **Combinaison** : Tous filtres applicables simultanément

### 7. Vue Kanban
- **Colonnes** : Todo, Doing, Done
- **Drag & drop** : Déplacement entre colonnes
- **Changement statut** : Automatique lors du déplacement
- **Compteurs** : Nombre de tâches par colonne
- **Filtres** : Recherche et tags applicables

### 8. Assignation
- **Multi-utilisateurs** : Plusieurs assignés par tâche
- **Responsable** : Un responsable parmi les assignés
- **Sélecteur** : Interface de sélection multiple
- **Affichage** : Badges dans l'arbre et vue détail
- **Timeline** : Changements enregistrés automatiquement

## Interface utilisateur

### Sidebar (arbre)
- **Sélecteur de workspace** : Changement de workspace
- **Barre de recherche** : Recherche textuelle
- **Filtres statut/priorité** : Sticky en bas
- **Filtre de tags** : Sticky tout en bas
- **Arbre hiérarchique** : Dossiers et tâches
- **Indicateurs visuels** :
  - Badge de statut (couleur)
  - Badge de priorité (couleur)
  - Icône assignés
  - Date d'échéance
- **Menu contextuel** : Clic droit pour actions
- **Boutons expand/collapse** : Tout développer/réduire
- **Badge de permission** : Admin/RW/RO

### Zone de contenu - Onglets

#### Onglet Détails
- **Métadonnées** : Statut, priorité, date d'échéance
- **Assignés** : Liste avec responsable
- **Description** : Contenu Markdown
- **Tags** : Affichage et gestion
- **Boutons** : Éditer, Enregistrer, Annuler

#### Onglet Timeline
- **Historique** : Liste chronologique des événements
- **Icônes** : Par type d'événement
- **Détails** : Utilisateur, date, description
- **Métadonnées** : Informations supplémentaires si disponibles
- **Ajout manuel** : Bouton pour ajouter une note

#### Onglet Commentaires
- **Liste** : Tous les commentaires
- **Auteur** : Nom et date
- **Contenu** : Markdown supporté
- **Ajout** : Champ de saisie + bouton

#### Onglet Fichiers
- **Liste** : Tous les fichiers attachés
- **Informations** : Nom, taille, auteur, date
- **Actions** :
  - Bouton "Ouvrir" : Viewer interne (PDF) ou nouvel onglet
  - Bouton "Télécharger" : Téléchargement direct
  - Bouton "Supprimer" : Avec confirmation
- **Notes** : Zone markdown par fichier (éditable)
- **Upload** : Zone drag & drop compacte en bas

### Panneau métadonnées
- **Sélecteur statut** : Dropdown todo/doing/done
- **Sélecteur priorité** : Dropdown low/medium/high
- **Date picker** : Sélection date d'échéance
- **Sélecteur assignés** : Multi-select avec recherche
- **Sélecteur responsable** : Dropdown (parmi assignés)
- **Éditable** : Uniquement si permission Write/Admin

## Opérations disponibles

### Création
- **Nouvelle tâche** : Clic droit → "Nouvelle tâche"
- **Nouveau dossier** : Clic droit → "Nouveau dossier"
- **Valeurs par défaut** : status=todo, priority=medium
- **Timeline** : Entrée "created" automatique

### Édition
- **Clic sur tâche** : Affichage détails complets
- **Chargement** : Tags, timeline, comments, files, assignees
- **Verrouillage** : Lock automatique si édition
- **Modification** : Tous champs éditables si Write/Admin
- **Sauvegarde** : Auto-save ou manuelle
- **Timeline** : Entrées automatiques pour chaque changement

### Changement de statut
- **Sélecteur** : Dropdown dans panneau métadonnées
- **Kanban** : Drag & drop entre colonnes
- **Timeline** : Entrée "status_changed" automatique
- **Notification** : WebSocket aux autres utilisateurs

### Assignation
- **Sélection** : Multi-select d'utilisateurs
- **Responsable** : Doit être parmi les assignés
- **Validation** : Vérification côté serveur
- **Timeline** : Entrées "assignees_updated" et "responsible_changed"
- **Affichage** : Badges dans arbre et vue détail

### Gestion des fichiers
- **Upload** : Drag & drop ou bouton "Choisir un fichier"
- **Stockage** : `uploads/tasks/{task_id}/{file_id}_{original_name}`
- **Timeline** : Entrée "file_added" automatique
- **Visualisation** :
  - PDF : Viewer fullscreen interne avec react-pdf
  - Images : Viewer fullscreen interne
  - Autres : Téléchargement
- **Notes** : Éditeur markdown par fichier avec sauvegarde
- **Suppression** : Bouton avec confirmation + entrée timeline

### Commentaires
- **Ajout** : Champ texte + bouton "Ajouter"
- **Timeline** : Entrée "comment_added" automatique
- **Affichage** : Liste chronologique
- **Markdown** : Support du formatage

## Base de données

### Table `tasks`
```sql
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('task','folder') NOT NULL,
  content LONGTEXT,
  parent_id VARCHAR(36),
  workspace_id VARCHAR(50) DEFAULT 'default',
  user_id INT,
  status VARCHAR(50) DEFAULT 'todo',
  priority ENUM('low','medium','high') DEFAULT 'medium',
  assigned_to VARCHAR(255),
  responsible_user_id INT,
  responsible_user_name VARCHAR(255),
  due_date DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

### Table `task_assignees`
```sql
CREATE TABLE task_assignees (
  task_id VARCHAR(36) NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

### Table `task_timeline`
```sql
CREATE TABLE task_timeline (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSON,
  user_id INT,
  user_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

### Table `task_comments`
```sql
CREATE TABLE task_comments (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  user_id INT,
  user_name VARCHAR(255),
  content LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

### Table `task_files`
```sql
CREATE TABLE task_files (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(255),
  file_size BIGINT,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by INT,
  uploaded_by_name VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  markdown_note TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
```

## API Endpoints

### Tâches
- `GET /api/tasks/tree?workspace_id=xxx` : Récupère l'arbre complet
- `GET /api/tasks/{id}` : Récupère une tâche spécifique
- `POST /api/tasks` : Crée une tâche/dossier
- `PUT /api/tasks/{id}` : Met à jour une tâche
- `DELETE /api/tasks/{id}` : Supprime une tâche
- `POST /api/tasks/{id}/move` : Déplace une tâche
- `POST /api/tasks/{id}/copy` : Copie une tâche

### Assignation
- `GET /api/tasks/{id}/assignees` : Récupère les assignés
- `PUT /api/tasks/{id}/assignees` : Met à jour les assignés

### Timeline
- `GET /api/tasks/{id}/timeline` : Récupère l'historique
- `POST /api/tasks/{id}/timeline` : Ajoute une entrée manuelle

### Commentaires
- `GET /api/tasks/{id}/comments` : Récupère les commentaires
- `POST /api/tasks/{id}/comments` : Ajoute un commentaire

### Fichiers
- `GET /api/tasks/{id}/files` : Liste les fichiers
- `POST /api/tasks/{id}/files` : Upload un fichier
- `GET /api/tasks/{id}/files/{file_id}/download?download=false` : Télécharge/visualise
- `DELETE /api/tasks/{id}/files/{file_id}` : Supprime un fichier
- `PUT /api/tasks/{id}/files/{file_id}/note` : Met à jour la note markdown

### Tags
- `GET /api/tasks/{id}/tags` : Récupère les tags
- `PUT /api/tasks/{id}/tags` : Met à jour les tags

### Verrouillage
- `POST /api/tasks/{id}/lock` : Verrouille une tâche
- `DELETE /api/tasks/{id}/lock?user_id=xxx` : Déverrouille
- `POST /api/tasks/{id}/force-unlock` : Force le déverrouillage (admin)

## Flux de travail typique

### Création et suivi d'une tâche
1. Clic droit → "Nouvelle tâche"
2. Saisie du nom
3. Création via API avec status=todo, priority=medium
4. Entrée timeline "created" automatique
5. Sélection automatique de la tâche
6. Édition des détails (description, assignés, date)
7. Changements enregistrés avec entrées timeline
8. Ajout de commentaires et fichiers
9. Changement de statut todo → doing → done
10. Historique complet dans timeline

### Collaboration sur une tâche
1. Utilisateur A crée une tâche
2. Utilisateur A assigne utilisateur B
3. Notification WebSocket à utilisateur B
4. Utilisateur B ajoute un commentaire
5. Entrée timeline "comment_added"
6. Utilisateur B upload un fichier
7. Entrée timeline "file_added"
8. Utilisateur A change le statut à "done"
9. Entrée timeline "status_changed"
10. Tous les utilisateurs voient les mises à jour en temps réel

### Recherche et filtrage avancé
1. Saisie dans barre de recherche : "API"
2. Sélection filtre statut : "doing"
3. Sélection filtre priorité : "high"
4. Sélection tags : "backend", "urgent"
5. Affichage uniquement des tâches correspondant à TOUS les critères
6. Auto-expansion des dossiers contenant résultats
7. Compteur de résultats affiché

## Optimisations

- **Chargement paresseux** : Détails chargés uniquement à la sélection
- **Chargement parallèle** : Tags, timeline, comments, files, assignees en parallèle
- **Cache** : Tags disponibles et tags par tâche mis en cache
- **WebSocket** : Notifications push, pas de polling
- **Timeline automatique** : Pas besoin de logging manuel
