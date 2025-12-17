# Module Documents - Documentation complète

## Vue d'ensemble

Le module Documents permet de gérer une base de connaissances collaborative en Markdown avec une hiérarchie de dossiers et fichiers.

## Fonctionnalités principales

### 1. Gestion hiérarchique
- **Arbre de documents** : Organisation en dossiers et fichiers
- **Drag & drop** : Réorganisation par glisser-déposer
- **Navigation** : Expand/collapse des dossiers
- **Sélection** : Clic pour sélectionner et afficher

### 2. Édition Markdown
- **Éditeur temps réel** : Prévisualisation côte à côte
- **Syntaxe Markdown** : Support complet (titres, listes, code, tableaux, etc.)
- **Auto-save** : Sauvegarde automatique pendant l'édition
- **Verrouillage** : Prévention des conflits d'édition

### 3. Système de verrouillage
- **Lock automatique** : Verrouillage lors de l'édition
- **Indicateur visuel** : Icône cadenas sur documents verrouillés
- **Information utilisateur** : Affichage de qui a verrouillé
- **Force unlock** : Déverrouillage forcé (admin uniquement)
- **Unlock automatique** : Libération à la fin de l'édition

### 4. Tags et recherche
- **Tags multiples** : Association de plusieurs tags par document
- **Extraction automatique** : Détection des tags dans le contenu Markdown
- **Recherche textuelle** : Filtrage par nom de document
- **Filtre par tags** : Sélection multiple de tags
- **Auto-expansion** : Dossiers contenant résultats automatiquement ouverts

### 5. Permissions
- **Read** : Consultation uniquement
- **Write** : Création, modification, suppression, gestion tags
- **Admin** : Toutes permissions + force unlock

### 6. Collaboration temps réel
- **WebSocket** : Notifications en temps réel
- **Synchronisation** : Mise à jour automatique pour tous les utilisateurs
- **Notifications de lock** : Alerte quand document verrouillé/déverrouillé

## Interface utilisateur

### Sidebar (arbre)
- **Sélecteur de workspace** : Changement de workspace
- **Barre de recherche** : Recherche textuelle
- **Arbre hiérarchique** : Dossiers et fichiers
- **Menu contextuel** : Clic droit pour actions (créer, renommer, supprimer, copier)
- **Boutons expand/collapse** : Développer/réduire tout l'arbre
- **Filtre de tags** : Sticky en bas, sélection multiple
- **Badge de permission** : Affichage du niveau d'accès (Admin/RW/RO)
- **Redimensionnable** : Largeur ajustable

### Zone de contenu
- **Mode lecture** : Prévisualisation Markdown avec bouton "Éditer"
- **Mode édition** : Éditeur split view (code + preview)
- **Métadonnées** : Dates de création/modification
- **Tags** : Affichage et gestion (lecture seule en mode view)
- **Boutons d'action** : Enregistrer, Annuler, Force unlock

## Opérations disponibles

### Création
- **Nouveau document** : Clic droit sur dossier → "Nouveau document"
- **Nouveau dossier** : Clic droit → "Nouveau dossier"
- **Sélection automatique** : Document/dossier créé automatiquement sélectionné

### Édition
- **Clic sur document** : Affichage en mode lecture
- **Bouton "Éditer"** : Passage en mode édition
- **Verrouillage automatique** : Lock lors du début d'édition
- **Sauvegarde** : Auto-save ou bouton "Enregistrer"
- **Annulation** : Bouton "Annuler" pour abandonner modifications

### Suppression
- **Clic droit → Supprimer** : Confirmation requise
- **Cascade** : Suppression récursive des enfants
- **WebSocket** : Notification aux autres utilisateurs

### Déplacement
- **Drag & drop** : Glisser-déposer vers nouveau parent
- **Validation** : Impossible de déplacer dans soi-même ou descendants
- **Mise à jour** : Arbre actualisé automatiquement

### Copie
- **Clic droit → Copier** : Duplication du document/dossier
- **Récursif** : Copie des enfants si dossier
- **Nouveau nom** : Suffixe " (copie)" ajouté

### Renommage
- **Clic droit → Renommer** : Modal de saisie
- **Raccourci F2** : Renommage rapide
- **Validation** : Nom non vide requis

### Téléchargement
- **Clic droit → Télécharger** : Export du document en .md
- **Nom original** : Conserve le nom du fichier

## Extraction automatique de tags

Le système extrait automatiquement les tags depuis le contenu Markdown :

### Sources d'extraction
1. **Hashtags** : `#tag1 #tag2` dans le contenu
2. **Frontmatter YAML** :
   ```yaml
   ---
   tags: [tag1, tag2]
   ---
   ```
3. **Section Tags** : `Tags: tag1, tag2`

### Comportement
- Extraction lors de la création/modification
- Mise à jour automatique des tags
- Création automatique des tags manquants

## Base de données

### Table `documents`
```sql
CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('file','folder') NOT NULL,
  content LONGTEXT,
  parent_id VARCHAR(36),
  workspace_id VARCHAR(50) DEFAULT 'default',
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES documents(id) ON DELETE CASCADE
)
```

### Table `document_locks`
```sql
CREATE TABLE document_locks (
  document_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
)
```

### Table `document_tag_links`
```sql
CREATE TABLE document_tag_links (
  document_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
)
```

## API Endpoints

### Documents
- `GET /api/documents/tree?workspace_id=xxx` : Récupère l'arbre complet
- `GET /api/documents/{id}` : Récupère un document spécifique
- `POST /api/documents` : Crée un document/dossier
- `PUT /api/documents/{id}` : Met à jour un document
- `DELETE /api/documents/{id}` : Supprime un document
- `POST /api/documents/{id}/move` : Déplace un document
- `POST /api/documents/{id}/copy` : Copie un document

### Verrouillage
- `POST /api/documents/{id}/lock` : Verrouille un document
- `DELETE /api/documents/{id}/lock?user_id=xxx` : Déverrouille
- `POST /api/documents/{id}/force-unlock` : Force le déverrouillage (admin)

### Tags
- `GET /api/documents/{id}/tags` : Récupère les tags d'un document
- `PUT /api/documents/{id}/tags` : Met à jour les tags
- `GET /api/documents/tags/suggestions?query=&limit=20` : Suggestions de tags

### WebSocket Events
- `tree_updated` : Arbre mis à jour
- `lock_updated` : Verrouillage modifié
- `request_tree` : Demande de mise à jour
- `document_editing` : Notification d'édition en cours

## Flux de travail typique

### Création d'un document
1. Clic droit sur dossier parent → "Nouveau document"
2. Saisie du nom dans modal
3. Création via API `POST /api/documents`
4. WebSocket notifie les autres utilisateurs
5. Document sélectionné automatiquement
6. Entrée en mode édition

### Édition collaborative
1. Utilisateur A sélectionne un document
2. Clic sur "Éditer"
3. Verrouillage automatique via API
4. WebSocket notifie utilisateur B que document verrouillé
5. Utilisateur A modifie le contenu
6. Auto-save ou sauvegarde manuelle
7. Extraction automatique des tags
8. Fin d'édition → déverrouillage
9. WebSocket notifie utilisateur B que document libéré

### Recherche et filtrage
1. Saisie dans barre de recherche
2. Filtrage en temps réel de l'arbre
3. Sélection de tags dans filtre
4. Combinaison recherche + tags
5. Auto-expansion des dossiers contenant résultats
6. Affichage uniquement des documents correspondants

## Optimisations

- **Chargement paresseux** : Contenu chargé uniquement à la sélection
- **Cache des tags** : Tags disponibles chargés une fois
- **WebSocket** : Évite le polling, notifications push
- **Arbre complet** : Une seule requête pour l'arbre entier
