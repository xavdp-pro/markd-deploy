# Guide d'utilisation MarkD

## Démarrage rapide

### Première connexion
1. Accédez à l'URL de l'application
2. Connectez-vous avec vos identifiants
3. Sélectionnez un workspace (ou créez-en un si admin)
4. Choisissez un module (Documents, Tasks, Passwords)

### Interface générale

#### Barre de navigation
- **Logo MarkD** : Retour à l'accueil
- **Sélecteur de module** : Documents / Tasks / Passwords
- **Sélecteur de workspace** : Changement de workspace
- **Menu utilisateur** : Profil, paramètres, déconnexion
- **Menu admin** : Gestion (si admin)
- **Mode sombre/clair** : Basculement du thème

#### Structure en 2 colonnes
- **Sidebar gauche** : Arbre hiérarchique, recherche, filtres
- **Zone principale** : Contenu détaillé, édition, onglets

## Module Documents

### Créer un document
1. Clic droit sur un dossier (ou racine)
2. Sélectionner "Nouveau document"
3. Saisir le nom (avec extension .md)
4. Le document est créé et sélectionné
5. Cliquer sur "Éditer" pour ajouter du contenu

### Éditer un document
1. Cliquer sur le document dans l'arbre
2. Cliquer sur le bouton "Éditer"
3. Le document est verrouillé automatiquement
4. Éditer dans le panneau gauche (Markdown)
5. Voir la prévisualisation dans le panneau droit
6. Sauvegarder (auto-save ou bouton)
7. Cliquer sur "Annuler" ou fermer pour déverrouiller

### Organiser les documents
- **Créer des dossiers** : Clic droit → "Nouveau dossier"
- **Déplacer** : Glisser-déposer vers un dossier
- **Renommer** : Clic droit → "Renommer" ou F2
- **Copier** : Clic droit → "Copier"
- **Supprimer** : Clic droit → "Supprimer" (confirmation)

### Rechercher et filtrer
- **Recherche textuelle** : Saisir dans la barre de recherche
- **Filtrer par tags** : Cliquer sur le filtre en bas, sélectionner des tags
- **Combiner** : Recherche + tags pour affiner
- **Effacer** : Cliquer sur X pour réinitialiser

### Ajouter des tags
1. Sélectionner un document
2. En mode lecture : voir les tags (lecture seule)
3. Cliquer sur "Éditer"
4. Ajouter/retirer des tags dans le sélecteur
5. Sauvegarder

### Extraction automatique de tags
Les tags sont extraits automatiquement depuis :
- Hashtags : `#important #api`
- Frontmatter YAML :
  ```yaml
  ---
  tags: [important, api]
  ---
  ```
- Section Tags : `Tags: important, api`

## Module Tasks

### Créer une tâche
1. Clic droit sur un dossier (ou racine)
2. Sélectionner "Nouvelle tâche"
3. Saisir le nom
4. La tâche est créée avec status=todo, priority=medium
5. Cliquer dessus pour éditer les détails

### Gérer une tâche
1. Cliquer sur la tâche dans l'arbre
2. Onglet "Détails" :
   - Modifier le statut (todo/doing/done)
   - Modifier la priorité (low/medium/high)
   - Définir une date d'échéance
   - Assigner des utilisateurs
   - Désigner un responsable
   - Ajouter des tags
   - Éditer la description (Markdown)

### Suivre l'activité
1. Onglet "Timeline" : Voir l'historique complet
2. Tous les changements sont enregistrés automatiquement
3. Possibilité d'ajouter des notes manuelles

### Collaborer
1. Onglet "Commentaires" : Ajouter des commentaires
2. Onglet "Fichiers" : Attacher des documents
3. Les assignés reçoivent des notifications (WebSocket)

### Attacher des fichiers
1. Onglet "Fichiers"
2. Glisser-déposer un fichier ou cliquer sur "Choisir un fichier"
3. Le fichier est uploadé (max 50 MB)
4. Cliquer sur "Ouvrir" pour visualiser (PDF, images)
5. Cliquer sur "Télécharger" pour télécharger
6. Ajouter une note markdown pour le fichier
7. Supprimer avec le bouton poubelle

### Vue Kanban
1. Cliquer sur l'icône Kanban (si disponible)
2. Voir les tâches en colonnes (Todo, Doing, Done)
3. Glisser-déposer entre colonnes pour changer le statut
4. Filtrer par recherche et tags

### Filtrer les tâches
- **Recherche** : Saisir dans la barre de recherche
- **Statut** : Sélectionner all/todo/doing/done
- **Priorité** : Sélectionner all/low/medium/high
- **Tags** : Sélectionner des tags
- **Combiner** : Tous les filtres s'appliquent en AND

## Module Passwords

### Ajouter un mot de passe
1. Clic droit sur un dossier (ou racine)
2. Sélectionner "Nouveau mot de passe"
3. Saisir le nom
4. Le mot de passe est créé et sélectionné
5. Cliquer sur "Éditer"
6. Remplir :
   - Titre
   - Nom d'utilisateur (requis)
   - Mot de passe (requis)
   - URL (optionnel)
   - Notes (optionnel)
   - Tags
7. Sauvegarder

### Consulter un mot de passe
1. Cliquer sur l'entrée dans l'arbre
2. Le mot de passe est affiché masqué (••••••)
3. Cliquer sur l'icône œil pour révéler
4. Cliquer sur les boutons "Copier" pour copier dans le presse-papiers
5. Toast de confirmation après copie

### Organiser les mots de passe
- **Créer des dossiers** : Clic droit → "Nouveau dossier"
- **Déplacer** : Glisser-déposer vers un dossier
- **Renommer** : Clic droit → "Renommer" ou F2
- **Supprimer** : Clic droit → "Supprimer" (confirmation)

### Rechercher un mot de passe
- **Recherche textuelle** : Saisir dans la barre de recherche
- **Filtrer par tags** : Sélectionner des tags
- **Combiner** : Recherche + tags
- Les dossiers contenant des résultats s'ouvrent automatiquement

### Sécurité
- Les mots de passe sont chiffrés en base de données
- Ils ne sont déchiffrés que lors de la consultation
- Utilisez des mots de passe forts et uniques
- Ne partagez jamais vos identifiants MarkD

## Fonctionnalités communes

### Drag & Drop
- Glisser-déposer pour réorganiser l'arbre
- Déposer sur un dossier pour déplacer dedans
- Déposer sur la racine pour déplacer à la racine
- Impossible de déplacer dans soi-même ou ses descendants

### Expand/Collapse
- **Cliquer sur la flèche** : Développer/réduire un dossier
- **Bouton "Tout développer"** : Ouvre tous les dossiers
- **Bouton "Tout réduire"** : Ferme tous les dossiers
- Position : En haut à droite de l'arbre

### Recherche
- **Temps réel** : Résultats affichés pendant la saisie
- **Insensible à la casse** : Majuscules/minuscules ignorées
- **Auto-expansion** : Dossiers contenant résultats ouverts
- **Effacer** : Cliquer sur X pour réinitialiser

### Tags
- **Sélecteur** : Menu déroulant avec recherche
- **Création automatique** : Nouveaux tags créés à la volée
- **Suggestions** : Tags existants proposés
- **Badges** : Tags sélectionnés affichés en badges
- **Suppression** : Cliquer sur X sur un badge

### Permissions
- **Read (RO)** : Consultation uniquement, pas de modification
- **Write (RW)** : Création, modification, suppression
- **Admin** : Toutes permissions + gestion avancée
- **Badge** : Niveau affiché en haut de la sidebar

### Notifications temps réel
- **WebSocket** : Connexion automatique
- **Toasts** : Notifications visuelles (25 secondes)
- **Barre de progression** : Décompte du temps
- **Bouton "Voir"** : Accès direct à l'élément modifié
- **Anti-écho** : Pas de notification pour vos propres actions

### Sidebar redimensionnable
- **Poignée** : Barre verticale entre sidebar et contenu
- **Glisser** : Déplacer pour ajuster la largeur
- **Limites** : Largeur min/max respectées
- **Persistance** : Largeur sauvegardée

## Raccourcis clavier

### Globaux
- **F2** : Renommer l'élément sélectionné
- **Ctrl+F** : Focus sur la barre de recherche
- **Échap** : Fermer les modals

### Module Documents
- **Ctrl+S** : Sauvegarder (en mode édition)
- **Ctrl+E** : Basculer édition/lecture

### Module Tasks
- **Ctrl+Enter** : Ajouter un commentaire (si focus dans champ)

## Astuces et bonnes pratiques

### Organisation
- Créez une structure de dossiers claire et logique
- Utilisez des noms descriptifs
- Évitez les hiérarchies trop profondes (max 4-5 niveaux)
- Regroupez par thème, projet ou équipe

### Tags
- Utilisez des tags cohérents (minuscules, pas d'espaces)
- Créez une liste de tags standards pour l'équipe
- Combinez tags génériques et spécifiques
- Exemples : `urgent`, `backend`, `production`, `bug`

### Collaboration
- Vérifiez les verrouillages avant d'éditer
- Ajoutez des commentaires pour expliquer vos changements
- Assignez clairement les tâches
- Utilisez la timeline pour suivre l'historique

### Sécurité (Passwords)
- Utilisez des mots de passe forts (12+ caractères, mixte)
- Ne réutilisez jamais le même mot de passe
- Organisez par environnement (dev, staging, prod)
- Ajoutez des notes pour le contexte

### Performance
- Utilisez la recherche plutôt que de parcourir l'arbre
- Fermez les dossiers inutilisés
- Filtrez par tags pour réduire l'affichage
- Évitez d'ouvrir trop d'onglets simultanément

## Résolution de problèmes

### Document verrouillé
- **Problème** : "Document verrouillé par X"
- **Solution** : Attendre que X termine ou demander à un admin de forcer le déverrouillage

### Modifications non sauvegardées
- **Problème** : Changements perdus
- **Solution** : Vérifier l'auto-save, sauvegarder manuellement, vérifier la connexion

### Fichier ne s'upload pas
- **Problème** : Upload échoue
- **Solution** : Vérifier la taille (max 50 MB), vérifier la connexion, réessayer

### Mot de passe non visible
- **Problème** : Mot de passe reste masqué
- **Solution** : Cliquer sur l'icône œil, vérifier les permissions (Read minimum)

### Arbre ne se met pas à jour
- **Problème** : Changements des autres non visibles
- **Solution** : Vérifier la connexion WebSocket, rafraîchir la page

### Permissions insuffisantes
- **Problème** : "Vous n'avez pas les permissions"
- **Solution** : Contacter un admin pour obtenir les droits nécessaires

## Support

Pour toute question ou problème :
- Consultez cette documentation
- Contactez votre administrateur MarkD
- Vérifiez les logs (si admin)
- Signalez les bugs à l'équipe de développement
