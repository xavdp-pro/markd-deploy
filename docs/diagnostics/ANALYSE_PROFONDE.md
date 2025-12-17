# Analyse Approfondie du Projet MarkD-v2

**Date d'analyse** : 2025-01-27  
**Chemin** : `/apps/markd-v2/app`

---

## 📋 Vue d'Ensemble

**MarkD-v2** est une plateforme collaborative complète de gestion de connaissances et de données, développée avec une architecture moderne full-stack.

### Mission
Centraliser la documentation technique, la gestion de tâches, les mots de passe, les fichiers et les schémas réseau dans une interface collaborative avec synchronisation en temps réel.

---

## 🏗️ Architecture Technique

### Stack Technologique

#### Backend
- **Framework** : FastAPI (Python 3.11+)
- **Base de données** : MySQL/MariaDB 8.0+ (utf8mb4)
- **WebSocket** : Socket.IO (python-socketio 5.10.0)
- **Authentification** : JWT (cookies httpOnly)
- **Chiffrement** : AES-256 (mots de passe)
- **Serveur ASGI** : Uvicorn
- **Ports** :
  - API REST : 8000 (configurable via `API_PORT`)
  - MCP Server : 8001 (optionnel)

#### Frontend
- **Framework** : React 18.3.1 + TypeScript 5.5.3
- **Build Tool** : Vite 5.4.20
- **UI Framework** : TailwindCSS 3.4.1
- **Routing** : React Router DOM 6.26.2
- **WebSocket Client** : Socket.IO Client 4.7.2
- **Drag & Drop** : @dnd-kit 6.1.0
- **Markdown** : 
  - Éditeur : @uiw/react-md-editor 4.0.8
  - Rendu : react-markdown 9.0.1
  - Syntaxe : rehype-highlight, remark-gfm
- **PDF Viewer** : react-pdf 10.2.0 + pdfjs-dist
- **Notifications** : react-hot-toast 2.6.0
- **State Management** : React Context (Auth, Settings, Workspace)
- **Port Dev** : 5173

### Structure du Projet

```
markd-package/
├── backend/                    # API FastAPI
│   ├── main.py                # Point d'entrée principal (1700+ lignes)
│   ├── auth.py                # Authentification JWT
│   ├── database.py            # Connexion MySQL (classe Database)
│   ├── encryption_service.py  # Chiffrement AES-256
│   ├── documents.py           # Module Documents (intégré dans main.py)
│   ├── tasks_simple.py        # Module Tasks (1060+ lignes)
│   ├── vault.py               # Module Passwords (683 lignes)
│   ├── files.py               # Module Files (904 lignes)
│   ├── schemas.py             # Module Schemas (1498 lignes)
│   ├── groups.py              # Gestion des groupes
│   ├── admin_routes.py        # Routes admin (logs d'activité)
│   ├── settings.py            # Paramètres système
│   ├── email_service.py       # Envoi d'emails (Mailjet)
│   ├── activity_logger.py     # Journalisation des activités
│   ├── websocket_broadcasts.py # Broadcasts WebSocket harmonisés
│   ├── migrations/            # 23 migrations SQL
│   └── uploads/               # Fichiers uploadés
│       ├── files/             # Fichiers du module Files
│       └── tasks/             # Fichiers attachés aux tâches
├── frontend/                   # Application React
│   ├── src/
│   │   ├── App.tsx            # Routage principal
│   │   ├── DocumentsApp.tsx   # Module Documents
│   │   ├── TasksApp.tsx       # Module Tasks
│   │   ├── FilesApp.tsx       # Module Files
│   │   ├── SchemaApp.tsx      # Module Schemas
│   │   ├── components/        # 30+ composants réutilisables
│   │   ├── pages/             # Pages (Login, Admin, etc.)
│   │   ├── contexts/          # Contextes React (Auth, Settings, Workspace)
│   │   ├── services/          # Services API et WebSocket
│   │   └── types.ts           # Types TypeScript complets
│   └── dist/                  # Build de production
└── database/                   # Scripts SQL
    ├── install.sql            # Installation initiale
    └── schema.sql             # Schéma de base
```

---

## 📦 Modules Principaux

### 1. Module Documents

**Description** : Gestion hiérarchique de documentation Markdown avec édition collaborative.

**Fonctionnalités** :
- Arbre hiérarchique (dossiers/fichiers)
- Édition Markdown en temps réel avec prévisualisation
- Verrouillage collaboratif (30 min timeout)
- Tags unifiés (extraction automatique depuis Markdown)
- Upload d'images (JPEG, PNG, GIF, WebP, SVG)
- Recherche textuelle
- Drag & drop pour réorganisation
- Présence utilisateurs (qui édite quoi)

**Base de données** :
- Table `documents` : id, name, type, content, parent_id, workspace_id
- Table `document_locks` : verrouillage par utilisateur
- Table `document_tag_links` : liens avec tags unifiés

**API Principale** :
- `GET /api/documents/tree?workspace_id=...`
- `POST /api/documents`
- `PUT /api/documents/{id}`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/lock`
- `PUT /api/documents/{id}/tags`

---

### 2. Module Tasks

**Description** : Gestion de tâches hiérarchiques avec workflow, assignations et timeline.

**Fonctionnalités** :
- Hiérarchie infinie (Epic → Story → Task → Subtask)
- Statuts personnalisables (todo, doing, done, etc.)
- Priorités (low, medium, high)
- Assignations multiples + responsable
- Dates d'échéance avec rappels email automatiques
- Timeline complète (création, modifications, commentaires, fichiers)
- Commentaires Markdown
- Fichiers attachés (max 50 MB)
- Tags unifiés
- Verrouillage collaboratif

**Base de données** :
- Table `tasks` : structure hiérarchique + métadonnées
- Table `task_assignees` : assignations multiples
- Table `task_timeline` : historique complet
- Table `task_comments` : commentaires
- Table `task_files` : fichiers attachés
- Table `task_locks` : verrouillage
- Table `task_tag_links` : tags

**API Principale** :
- `GET /api/tasks/tree?workspace_id=...`
- `POST /api/tasks`
- `PUT /api/tasks/{id}`
- `GET /api/tasks/{id}/timeline`
- `POST /api/tasks/{id}/comments`
- `POST /api/tasks/{id}/files`

---

### 3. Module Passwords (Vault)

**Description** : Coffre-fort sécurisé pour mots de passe avec chiffrement AES-256.

**Fonctionnalités** :
- Structure hiérarchique (dossiers/mots de passe)
- Chiffrement AES-256 (stockage sécurisé)
- Champs : username, password, url, notes
- Catégories : SSH, API, Database, Service, Other
- Tags unifiés
- Verrouillage collaboratif
- Copie rapide username/password

**Base de données** :
- Table `password_vault` : id, title, username, password_encrypted, url, notes
- Table `password_locks` : verrouillage
- Table `password_tag_links` : tags

**API Principale** :
- `GET /api/vault/tree?workspace_id=...`
- `POST /api/vault/passwords`
- `GET /api/vault/passwords/{id}` (avec déchiffrement)
- `PUT /api/vault/passwords/{id}`
- `DELETE /api/vault/passwords/{id}`

**Sécurité** :
- Clé de chiffrement stockée dans `.env` (`ENCRYPTION_KEY`)
- Mots de passe jamais stockés en clair
- Déchiffrement uniquement lors de la consultation

---

### 4. Module Files

**Description** : Gestionnaire de fichiers avec support de tous types de fichiers.

**Fonctionnalités** :
- Structure hiérarchique (dossiers/fichiers)
- Upload de fichiers (max 100 MB)
- Détection MIME type
- Calcul de hash SHA-256
- Viewers intégrés : PDF, Images, Texte
- Tags unifiés
- Verrouillage collaboratif
- Logs d'activité (create, upload, delete, rename, move)

**Base de données** :
- Table `files` : id, name, type, file_path, mime_type, file_size, file_hash
- Table `file_locks` : verrouillage
- Table `file_tag_links` : tags
- Table `file_activity_log` : journalisation

**API Principale** :
- `GET /api/files/tree?workspace_id=...`
- `POST /api/files` (créer dossier ou placeholder)
- `POST /api/files/{id}/upload` (upload contenu)
- `GET /api/files/{id}/content` (vue inline)
- `GET /api/files/{id}/download` (téléchargement)

---

### 5. Module Schemas

**Description** : Éditeur de schémas réseau avec devices et connexions.

**Fonctionnalités** :
- Canvas interactif (drag & drop)
- Bibliothèque de devices (Router, Switch, Server, Firewall, etc.)
- Templates de devices personnalisables par workspace
- Connexions entre devices (ports, VLAN, bandwidth)
- Propriétés détaillées (IP, MAC, modèle, config JSON)
- Export/Import (à venir)
- Tags unifiés
- Verrouillage collaboratif

**Base de données** :
- Table `schemas` : id, name, type, description
- Table `schema_devices` : devices avec positions
- Table `schema_connections` : liens entre devices
- Table `schema_device_templates` : templates personnalisés
- Table `schema_locks` : verrouillage
- Table `schema_tag_links` : tags
- Table `schema_activity_log` : journalisation

**API Principale** :
- `GET /api/schemas/tree?workspace_id=...`
- `GET /api/schemas/device-templates` (bibliothèque)
- `POST /api/schemas/{id}/devices`
- `POST /api/schemas/{id}/connections`
- `PUT /api/schemas/{id}/devices/{device_id}`

---

## 🔐 Système de Permissions

### Architecture

**Modèle** : Permissions basées sur des **groupes** (pas d'assignation directe utilisateur → workspace).

**Structure** :
1. **Utilisateurs** (`users`) : id, username, email, role (admin/user)
2. **Groupes** (`user_groups_table`) : id, name, description, is_business, is_system
3. **Membres** (`user_groups`) : user_id ↔ group_id (many-to-many)
4. **Permissions** (`group_workspace_permissions`) : group_id ↔ workspace_id + permission_level

**Niveaux de permissions** :
- `read` : Consultation uniquement
- `write` : Création, modification, suppression
- `admin` : Toutes permissions + gestion workspace

**Groupes par défaut** :
- `Administrators` : Accès admin à tous les workspaces
- `Users` : Groupe par défaut pour tous les utilisateurs
- `ALL` : Groupe business (tous les utilisateurs automatiquement)

**Logique de vérification** :
- Les admins ont automatiquement tous les droits
- Les utilisateurs héritent du **niveau maximum** de leurs groupes
- Si un utilisateur appartient à plusieurs groupes avec des permissions différentes, le niveau le plus élevé est retenu

**Code de vérification** (`main.py:145-181`) :
```python
async def check_workspace_permission(workspace_id: str, user: Dict, required_level: str = 'read') -> str:
    if user.get('role') == 'admin':
        return 'admin'
    
    # Récupère le niveau max depuis tous les groupes de l'utilisateur
    query = """
        SELECT MAX(CASE gwp.permission_level
            WHEN 'admin' THEN 3
            WHEN 'write' THEN 2
            WHEN 'read' THEN 1
            ELSE 0 END) as max_level
        FROM user_groups ug
        JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
        WHERE ug.user_id = %s AND gwp.workspace_id = %s
    """
```

---

## 🌐 Workspaces

### Concept

Un **workspace** est un espace de travail isolé contenant :
- Documents
- Tâches
- Mots de passe
- Fichiers
- Schémas

**Isolation** : Toutes les données sont filtrées par `workspace_id`.

**Workspace par défaut** : `demo` (créé automatiquement au démarrage)

**Gestion** :
- Création : Admins uniquement
- Modification : Admins du workspace
- Suppression : Interdite pour `demo`

---

## 🔄 WebSocket & Temps Réel

### Architecture Harmonisée

**Principe** : Chaque module a ses propres événements WebSocket pour éviter les conflits.

**Fichier centralisé** : `backend/websocket_broadcasts.py` (147 lignes)

**Événements par module** :

| Module | Tree Changed | Lock Updated | Content Updated |
|--------|--------------|--------------|-----------------|
| Documents | `document_tree_changed` | `document_lock_updated` | `document_content_updated` |
| Tasks | `task_tree_changed` | `task_lock_updated` | `task_activity_updated` |
| Passwords | `vault_tree_changed` | `vault_lock_updated` | `vault_item_updated` |
| Files | `file_tree_changed` | `file_lock_updated` | `file_content_updated` |
| Schemas | `schema_tree_changed` | `schema_lock_updated` | `schema_content_updated` |

**Présence utilisateurs** :
- `join_document` / `leave_document` : Rejoindre/quitter un document
- `presence_updated` : Liste des utilisateurs présents (affichée via `PresenceAvatars`)

**Notifications Toast** :
- Principe anti-écho : L'utilisateur qui fait l'action ne reçoit pas de notification
- Durée : 25 secondes avec barre de progression
- Bouton "Voir" : Sélectionne l'élément dans l'arbre

---

## 🏷️ Système de Tags Unifié

### Architecture

**Table centrale** : `tags` (partagée entre tous les modules)

**Tables de liaison** :
- `document_tag_links`
- `task_tag_links`
- `password_tag_links`
- `file_tag_links`
- `schema_tag_links`

**Fonctionnalités** :
- Création automatique à la première utilisation
- Suggestions lors de la saisie
- Extraction automatique depuis Markdown (hashtags, frontmatter)
- Filtrage par tags
- Gestion admin (création, modification, suppression)

---

## 📊 Base de Données

### Schéma Principal

**Tables utilisateurs** :
- `users` : Utilisateurs du système
- `user_groups_table` : Groupes d'utilisateurs
- `user_groups` : Appartenance utilisateur ↔ groupe
- `password_reset_tokens` : Tokens de réinitialisation (15 min expiration)

**Tables workspace** :
- `workspaces` : Espaces de travail
- `group_workspace_permissions` : Permissions groupes ↔ workspaces

**Tables modules** :
- `documents` : Documents Markdown
- `tasks` : Tâches
- `password_vault` : Mots de passe (chiffrés)
- `files` : Fichiers
- `schemas` : Schémas réseau
- `schema_devices` : Devices des schémas
- `schema_connections` : Connexions entre devices

**Tables transversales** :
- `tags` : Tags unifiés
- `*_tag_links` : Liaisons tags (5 tables)
- `*_locks` : Verrouillages (5 tables)
- `activity_logs` : Logs d'activité globaux
- `task_timeline` : Timeline des tâches
- `task_comments` : Commentaires des tâches
- `task_files` : Fichiers attachés aux tâches
- `file_activity_log` : Logs fichiers
- `schema_activity_log` : Logs schémas

**Tables système** :
- `system_settings` : Paramètres système (modules activés, etc.)
- `notification_preferences` : Préférences notifications utilisateurs
- `mcp_activity_log` : Logs MCP server (optionnel)

### Migrations

**23 migrations SQL** dans `backend/migrations/` :
- 003 : Système de groupes
- 004 : Groupes business
- 007 : Module Password Vault
- 009 : Hiérarchie Password Vault
- 010-012 : Module Tasks
- 013-015 : Tags unifiés
- 016 : Préférences notifications
- 017 : Logs d'activité
- 018-020 : Verrouillages (passwords, documents, tasks)
- 021 : Module Files
- 022-023 : Module Schemas

---

## 🔒 Sécurité

### Authentification

- **JWT** stocké dans cookie httpOnly (7 jours de validité)
- Cookie `markd_auth` avec `samesite=lax`
- Validation sur chaque requête via `get_current_user()` dependency

### Chiffrement

- **Mots de passe** : AES-256 via `encryption_service.py`
- Clé stockée dans `.env` (`ENCRYPTION_KEY`)
- Jamais de stockage en clair

### Verrouillage

- **Timeout** : 30 minutes
- **Heartbeat** : Toutes les 60 secondes (prolonge le verrou)
- **Force unlock** : Admins uniquement

### Validation Mots de Passe Utilisateurs

Règles strictes (10 caractères minimum) :
- Au moins 1 majuscule (A-Z)
- Au moins 1 minuscule (a-z)
- Au moins 1 chiffre (0-9)
- Au moins 1 symbole

---

## 📧 Emails

### Service Email

**Provider** : Mailjet (SMTP)

**Templates MJML** :
- `forgot_password.html` : Réinitialisation de mot de passe
- `task_assignment.mjml` : Assignation de tâche
- `task_due_reminder.mjml` : Rappel échéance tâche

**Fonctionnalités** :
- Envoi de code de réinitialisation (6 chiffres, 15 min expiration)
- Rappels automatiques de tâches (24h avant échéance)
- Test d'email depuis l'admin

---

## 🎨 Interface Utilisateur

### Design System

- **Framework** : TailwindCSS
- **Mode sombre** : Support complet (toggle via Settings)
- **Responsive** : Design adaptatif
- **Icons** : Lucide React (446+ icons)

### Composants Principaux

**Arbres** :
- `DocumentTree.tsx`
- `TaskTree.tsx`
- `PasswordTree.tsx`
- `FileTree.tsx`
- `SchemaTree.tsx`

**Éditeurs** :
- `DocumentEditor.tsx` : Éditeur Markdown avec preview
- `TaskEditor.tsx` : Édition de tâches
- `PasswordForm.tsx` : Formulaire de mot de passe
- `CustomTemplateEditor.tsx` : Éditeur de templates devices

**Viewers** :
- `DocumentViewer.tsx` : Prévisualisation Markdown
- `FileViewer.tsx` : Viewer multi-format (PDF, images, texte)
- `SchemaCanvas.tsx` : Canvas interactif pour schémas
- `TaskViewer.tsx` : Détails de tâche (4 onglets)

**UI** :
- `PresenceAvatars.tsx` : Avatars des utilisateurs présents
- `TagSelector.tsx` : Sélection de tags avec autocomplete
- `UserMultiSelect.tsx` : Sélection multiple d'utilisateurs
- `WorkflowSelector.tsx` : Sélection de workflow (tâches)

### Pages

- `LoginPage.tsx` : Connexion
- `ForgotPasswordPage.tsx` : Mot de passe oublié
- `AdminPage.tsx` : Gestion utilisateurs
- `WorkspacesAdmin.tsx` : Gestion workspaces
- `GroupsAdmin.tsx` : Gestion groupes
- `TagsAdmin.tsx` : Gestion tags
- `SettingsPage.tsx` : Paramètres utilisateur
- `ProfilePage.tsx` : Profil utilisateur

---

## 📝 Journalisation

### Activity Logger

**Table** : `activity_logs`

**Actions loggées** :
- `create`, `update`, `delete`, `move`, `rename`
- Par module (document, task, password, file, schema)
- Par workspace
- Avec timestamp et user_id

**Utilisation** :
- Historique des actions
- Audit trail
- Accès direct à l'objet (lien cliquable si non supprimé)

---

## 🚀 Déploiement

### Configuration

**Backend `.env`** :
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=markd-v2
MYSQL_USER=markd-v2
MYSQL_PASSWORD=...
SECRET_KEY=...
ENCRYPTION_KEY=...
API_PORT=8000
CORS_ORIGINS=http://localhost:5173
MAIL_HOST=in-v3.mailjet.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=...
```

### Scripts de Démarrage

- `start.sh` : Démarre backend + frontend
- `start-backend.sh` : Backend uniquement
- `start-frontend.sh` : Frontend uniquement
- `stop.sh` : Arrête tous les services
- `status.sh` : Statut des services

### Production (PM2)

**Fichier** : `ecosystem.config.js`

**Processus** :
- `backend` : API FastAPI (port 8000)
- `frontend` : Build Vite servi par Nginx
- `mcp-server` : Server MCP optionnel (port 8001)

---

## 🔧 Fonctionnalités Avancées

### Extraction Automatique de Tags

**Sources** :
1. Frontmatter YAML : `---\ntags: tag1, tag2\n---`
2. Hashtags : `#tag1 #tag2`
3. Section Tags : `Tags: tag1, tag2`

**Code** : `main.py:255-310` (`extract_tags_from_markdown`)

### Templates de Devices (Schemas)

**Built-in** :
- Router, Switch, Server, Firewall, Access Point, etc.

**Personnalisables** :
- Création de templates par workspace
- SVG custom pour icônes
- Ports configurables (WAN/LAN, positions)

### Rappels Automatiques (Tasks)

**Scheduler** : `task_scheduler.py` (136 lignes)

**Fonctionnalité** :
- Vérifie toutes les heures les tâches avec échéance dans 24h
- Envoie email de rappel automatiquement
- Template MJML personnalisé

---

## 📈 Statistiques du Code

### Backend

- **Fichiers Python** : 17
- **Lignes de code** : ~8000+
- **Endpoints API** : 100+
- **Migrations SQL** : 23

**Fichiers principaux** :
- `main.py` : 1700 lignes (Documents + Workspaces + Admin)
- `tasks_simple.py` : 1060 lignes
- `schemas.py` : 1498 lignes
- `files.py` : 904 lignes
- `vault.py` : 683 lignes

### Frontend

- **Composants** : 30+
- **Pages** : 10+
- **Services** : API + WebSocket
- **Types TypeScript** : ~275 lignes (types.ts complet)

---

## 🎯 Points Forts

1. **Architecture modulaire** : Chaque module est indépendant
2. **Synchronisation temps réel** : WebSocket harmonisé
3. **Sécurité robuste** : JWT + chiffrement AES-256
4. **Permissions granulaires** : Système de groupes flexible
5. **Interface moderne** : React + TailwindCSS
6. **Extensibilité** : Architecture prête pour nouveaux modules
7. **Documentation** : Code bien commenté (en anglais)

---

## 🔮 Évolutions Possibles

### Améliorations Techniques

- [ ] Cache Redis pour performances
- [ ] Pagination pour gros arbres
- [ ] Recherche full-text avancée
- [ ] Export/Import (JSON, ZIP)
- [ ] Versioning des documents
- [ ] Historique de modifications (diff)
- [ ] Notifications push navigateur
- [ ] API GraphQL (alternative REST)
- [ ] Tests automatisés (backend + frontend)

### Nouvelles Fonctionnalités

- [ ] Module Calendrier
- [ ] Module Wiki (liens internes)
- [ ] Module Notes (notes rapides)
- [ ] Module Contacts
- [ ] Intégration Git (sync docs)
- [ ] Plugin système
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)

---

## 📚 Documentation Disponible

- `README.md` : Documentation principale
- `FEATURE_SUMMARY.md` : Résumé des fonctionnalités
- `TASKS_GUIDE.md` : Guide utilisateur Tasks
- `TESTING_TASKS.md` : Tests Tasks
- `SECURITY.md` : Guide sécurité
- `CHANGELOG.md` : Historique des versions
- `CONTRIBUTING.md` : Guide contribution

---

## 🎓 Conclusion

**MarkD-v2** est une plateforme mature et bien architecturée pour la gestion collaborative de connaissances. L'architecture modulaire, la synchronisation temps réel, et le système de permissions robuste en font une solution complète et extensible.

Le code est propre, bien structuré, et suit les meilleures pratiques (séparation des responsabilités, DRY, sécurité). La base est solide pour des évolutions futures.

---

**Analyse réalisée le** : 2025-01-27  
**Version analysée** : MarkD v2.0  
**Statut** : ✅ Production Ready








