# MarkD - Vue d'ensemble

## Description générale

MarkD est une application web collaborative de gestion de connaissances et de tâches comprenant trois modules principaux :

1. **Documents** : Gestion hiérarchique de documents Markdown
2. **Tasks** : Gestion de tâches et projets avec suivi
3. **Passwords** : Coffre-fort sécurisé de mots de passe

## Architecture technique

### Stack technologique

**Frontend :**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Router (navigation)
- Socket.IO Client (temps réel)
- @dnd-kit (drag & drop)
- react-markdown (rendu Markdown)
- @uiw/react-md-editor (édition Markdown)

**Backend :**
- Python 3.x
- FastAPI (API REST)
- Socket.IO (WebSocket temps réel)
- MySQL/MariaDB (base de données)
- Cryptography (chiffrement mots de passe)

### Fonctionnalités transversales

#### Système de workspaces
- Organisation multi-workspaces
- Isolation des données par workspace
- Permissions par workspace et par groupe

#### Système de permissions
- **Read** : Consultation uniquement
- **Write** : Création, modification, suppression
- **Admin** : Toutes permissions + gestion avancée

#### Système de tags unifié
- Table centrale `tags` partagée entre modules
- Liaison many-to-many avec chaque module
- Suggestions automatiques
- Filtrage par tags

#### WebSocket temps réel
- Notifications en temps réel
- Synchronisation multi-utilisateurs
- Mise à jour automatique des arbres
- Notifications de verrouillage

#### Interface utilisateur
- Arbre hiérarchique avec drag & drop
- Recherche textuelle en temps réel
- Filtres multiples (tags, statut, priorité)
- Mode sombre/clair
- Responsive design
- Sidebar redimensionnable

## Modules principaux

### 1. Module Documents
Gestion de documentation technique en Markdown avec :
- Hiérarchie dossiers/fichiers
- Verrouillage collaboratif
- Tags et recherche
- Prévisualisation Markdown temps réel

### 2. Module Tasks
Gestion de tâches et projets avec :
- Statuts (todo/doing/done)
- Priorités (low/medium/high)
- Assignation multi-utilisateurs
- Timeline automatique
- Commentaires
- Fichiers attachés
- Dates d'échéance

### 3. Module Passwords
Coffre-fort sécurisé avec :
- Chiffrement des mots de passe
- Hiérarchie dossiers/mots de passe
- Copie rapide dans presse-papiers
- Tags et catégorisation
- Recherche sécurisée

## Menu Admin

Le menu admin permet de gérer :
- **Utilisateurs** : Création, modification, suppression
- **Groupes** : Gestion des groupes d'utilisateurs
- **Workspaces** : Création et configuration
- **Permissions** : Attribution des droits par groupe/workspace
- **Logs** : Consultation de l'activité système

## Sécurité

- Authentification JWT
- Chiffrement des mots de passe (module Passwords)
- Permissions granulaires
- Validation côté serveur
- Protection CSRF
- CORS configuré

## Déploiement

- Frontend : Vite build + Nginx
- Backend : Uvicorn + Socket.IO
- Base de données : MySQL/MariaDB
- Reverse proxy : Nginx
- Process manager : PM2 (optionnel)

## Documentation technique

Voir les fichiers détaillés :
- `01-module-documents.md` : Documentation complète du module Documents
- `02-module-tasks.md` : Documentation complète du module Tasks
- `03-module-passwords.md` : Documentation complète du module Passwords
- `04-menu-admin.md` : Documentation du menu d'administration
- `05-api-reference.md` : Référence complète des API
