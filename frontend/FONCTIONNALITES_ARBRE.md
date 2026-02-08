# Fonctionnalités de l'arbre de documents (Markd v2)

## Vue d'ensemble
L'arbre de documents permet de naviguer, gérer et organiser les documents et dossiers dans un workspace.

## Fonctionnalités principales

### 1. Navigation et affichage
- **Arbre hiérarchique** : Affichage des dossiers et fichiers en structure arborescente
- **Expansion/Réduction** : Clic sur la flèche pour développer/réduire les dossiers
- **Icônes visuelles** :
  - 📁 Dossier fermé (jaune)
  - 📂 Dossier ouvert (jaune)
  - 📄 Fichier (bleu)
- **Indicateur de verrouillage** : Affichage d'un cadenas 🔒 si un document est verrouillé par un utilisateur
- **Indicateur MCP** : Point vert/gris sur les dossiers avec configuration MCP active/inactive

### 2. Sélection
- **Sélection simple** : Clic sur un élément pour le sélectionner
- **Sélection multiple Ctrl/Cmd** : Maintenir Ctrl/Cmd + clic pour sélectionner plusieurs éléments
- **Sélection par plage Shift** : Shift + clic pour sélectionner une plage d'éléments
- **Sélection globale Ctrl+A** : Sélectionner tous les éléments de l'arbre
- **Mise en surbrillance** : Les éléments sélectionnés sont surlignés en bleu
- **Sélection persistante** : La sélection est sauvegardée dans l'URL (hash) et le sessionStorage

### 3. Recherche et filtrage
- **Barre de recherche** : Recherche textuelle dans les noms de documents/dossiers
- **Filtrage par tags** : Filtrage des documents par tags (via TagFilter)
- **Expansion automatique** : Les dossiers contenant des résultats sont automatiquement développés lors de la recherche
- **Affichage hiérarchique** : Les résultats de recherche conservent leur structure hiérarchique

### 4. Actions contextuelles (clic droit)
#### Pour les dossiers :
- **Ajouter un document** : Créer un nouveau document dans le dossier
- **Créer un dossier** : Créer un sous-dossier
- **Importer un fichier** : Uploader un fichier (.md, .txt) dans le dossier
- **Configurer MCP** : Ouvrir/créer une configuration MCP pour le dossier
- **Renommer** : Renommer le dossier
- **Copier** : Copier le dossier
- **Supprimer** : Supprimer le dossier et son contenu

#### Pour les fichiers :
- **Renommer** : Renommer le fichier
- **Copier** : Copier le fichier
- **Télécharger** : Télécharger le fichier
- **Déverrouiller** : Déverrouiller un fichier verrouillé (si propriétaire ou admin)
- **Supprimer** : Supprimer le fichier

### 5. Glisser-déposer (Drag & Drop)
- **Déplacer des éléments** : Glisser un élément pour le déplacer dans un autre dossier
- **Indicateur visuel** : Zone de dépôt mise en surbrillance (vert) lors du survol
- **Grip vertical** : Icône de poignée pour indiquer que l'élément est déplaçable
- **Désactivé pour root** : Impossible de déplacer vers la racine

### 6. Raccourcis clavier
- **F2** : Renommer l'élément sélectionné
- **Delete / Backspace** : Supprimer l'élément sélectionné (avec confirmation)
- **Ctrl+A / Cmd+A** : Sélectionner tous les éléments

### 7. Gestion des verrouillages
- **Affichage du verrou** : Indication visuelle si un document est verrouillé
- **Propriétaire** : L'utilisateur qui a verrouillé peut déverrouiller
- **Admin** : Les administrateurs peuvent déverrouiller n'importe quel document
- **Contact admin** : Les autres utilisateurs peuvent voir les informations de contact des admins

### 8. Persistance et restauration
- **SessionStorage** : Sauvegarde de l'état d'expansion des dossiers
- **URL Hash** : Sauvegarde de la sélection dans l'URL (#document=id1,id2)
- **Restauration automatique** : Restauration de la sélection et de l'expansion au rechargement de la page
- **Restauration inter-modules** : Restauration de la sélection lors du retour au module Documents

### 9. Largeur ajustable
- **Redimensionnement** : La largeur de l'arbre peut être ajustée par glisser-déposer
- **Persistance** : La largeur est sauvegardée dans localStorage
- **Limites** : Largeur minimale 200px, maximale 600px

### 10. Permissions
- **Badge de permission** : Affichage du niveau de permission (Admin, RW, RO)
- **Actions conditionnelles** : Certaines actions sont désactivées selon les permissions
- **Mode lecture seule** : Certaines fonctionnalités sont désactivées en mode RO

### 11. Workspace
- **Sélecteur de workspace** : Changement de workspace via un sélecteur (si fourni)
- **Isolation** : Chaque workspace a son propre arbre de documents

### 12. Boutons d'expansion globale
- **Développer tout** : Bouton pour développer tous les dossiers
- **Réduire tout** : Bouton pour réduire tous les dossiers
- **Position** : Boutons positionnés en haut à droite de l'arbre

### 13. Intégration MCP
- **Configuration MCP** : Possibilité de configurer un MCP pour un dossier
- **Indicateur visuel** : Point coloré sur les dossiers avec MCP configuré
- **Modal de configuration** : Interface pour gérer les configurations MCP

## Comportements spécifiques

### Affichage du contenu
- **Fichier sélectionné** : Le contenu du fichier est affiché dans la partie droite
- **Dossier sélectionné** : Aucun contenu n'est affiché à droite (dossiers n'ont pas de contenu)
- **Sélection multiple** : Le contenu du premier fichier est affiché

### Gestion des erreurs
- **Confirmation de suppression** : Modal de confirmation avant suppression
- **Gestion des verrouillages** : Messages d'erreur si tentative de modification d'un document verrouillé
- **Gestion des permissions** : Messages d'erreur si action non autorisée

### Performance
- **Rendu récursif** : Les nœuds sont rendus récursivement pour gérer les arbres profonds
- **Filtrage optimisé** : Le filtrage est effectué de manière efficace
- **Lazy loading** : Les tags sont chargés à la demande

## États et refs utilisés
- `expanded` : État d'expansion des dossiers
- `selected` : État de sélection des éléments
- `tree` : Structure de l'arbre
- `searchQuery` : Requête de recherche
- `selectedTags` : Tags sélectionnés pour le filtrage
- `treeWidth` : Largeur de l'arbre
- `mcpConfigs` : Configurations MCP par dossier
