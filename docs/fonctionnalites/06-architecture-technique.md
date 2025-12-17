# Architecture technique MarkD

## Vue d'ensemble

MarkD est une application web full-stack avec architecture client-serveur et communication temps réel.

## Stack technologique

### Frontend

#### Framework et outils
- **React 18** : Bibliothèque UI avec hooks
- **TypeScript** : Typage statique
- **Vite** : Build tool et dev server rapide
- **React Router v6** : Routing côté client

#### Styling
- **TailwindCSS** : Framework CSS utility-first
- **CSS Modules** : Styles scopés par composant
- **Dark mode** : Support natif avec classes Tailwind

#### Bibliothèques UI
- **Lucide React** : Icônes SVG
- **@dnd-kit** : Drag & drop accessible
- **react-hot-toast** : Notifications toast
- **@uiw/react-md-editor** : Éditeur Markdown
- **react-markdown** : Rendu Markdown
- **react-pdf** : Visualisation PDF

#### Communication
- **Socket.IO Client** : WebSocket temps réel
- **Fetch API** : Requêtes HTTP REST

#### Gestion d'état
- **React useState** : État local des composants
- **React useContext** : État partagé (auth, theme)
- **React useEffect** : Effets de bord et lifecycle

### Backend

#### Framework
- **FastAPI** : Framework web Python moderne
- **Uvicorn** : Serveur ASGI
- **Python 3.9+** : Langage backend

#### Base de données
- **MySQL/MariaDB** : Base de données relationnelle
- **PyMySQL** : Driver MySQL pour Python
- **Connection pooling** : Gestion des connexions

#### Communication temps réel
- **Socket.IO** : WebSocket bidirectionnel
- **python-socketio** : Implémentation Python

#### Sécurité
- **JWT** : JSON Web Tokens pour l'authentification
- **Bcrypt/Argon2** : Hachage des mots de passe
- **Cryptography** : Chiffrement des mots de passe (module Vault)
- **CORS** : Configuration des origines autorisées

#### Validation
- **Pydantic** : Validation des données et schémas
- **FastAPI dependencies** : Injection de dépendances

## Architecture applicative

### Structure frontend

```
frontend/
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── DocumentTree.tsx
│   │   ├── TaskTree.tsx
│   │   ├── PasswordTree.tsx
│   │   ├── DocumentViewer.tsx
│   │   ├── TaskViewer.tsx
│   │   ├── TaskFiles.tsx
│   │   └── ...
│   ├── contexts/            # Contextes React
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── pages/               # Pages principales
│   │   ├── DocumentsApp.tsx
│   │   ├── TasksApp.tsx
│   │   ├── VaultPage.tsx
│   │   └── AdminPage.tsx
│   ├── services/            # Services API
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types.ts             # Types TypeScript
│   ├── App.tsx              # Composant racine
│   └── main.tsx             # Point d'entrée
├── public/                  # Assets statiques
├── index.html               # Template HTML
├── vite.config.ts           # Configuration Vite
└── package.json             # Dépendances npm
```

### Structure backend

```
backend/
├── main.py                  # Point d'entrée FastAPI + Socket.IO
├── auth.py                  # Authentification JWT
├── database.py              # Connexion base de données
├── encryption_service.py    # Chiffrement mots de passe
├── documents.py             # Routes module Documents
├── tasks_simple.py          # Routes module Tasks
├── vault.py                 # Routes module Passwords
├── admin.py                 # Routes menu Admin
├── websocket_handlers.py    # Handlers WebSocket
├── models.py                # Modèles Pydantic
├── requirements.txt         # Dépendances Python
└── uploads/                 # Fichiers uploadés
    └── tasks/               # Fichiers des tâches
```

## Flux de données

### Authentification

```
1. Client → POST /api/auth/login (username, password)
2. Backend → Vérification credentials en base
3. Backend → Génération JWT token
4. Backend → Réponse avec token + user info
5. Client → Stockage token (localStorage)
6. Client → Header Authorization: Bearer {token} pour toutes requêtes
```

### Chargement d'un module

```
1. Client → Sélection module (Documents/Tasks/Passwords)
2. Client → GET /api/{module}/tree?workspace_id=xxx
3. Backend → Vérification permissions utilisateur
4. Backend → Requête SQL pour récupérer l'arbre
5. Backend → Construction de l'arbre hiérarchique
6. Backend → Réponse JSON avec l'arbre
7. Client → Affichage dans la sidebar
8. Client → Connexion WebSocket pour mises à jour temps réel
```

### Édition collaborative

```
1. User A → Sélection document
2. User A → Clic "Éditer"
3. Client A → POST /api/documents/{id}/lock
4. Backend → Insertion dans document_locks
5. Backend → WebSocket broadcast "lock_updated"
6. Client B → Réception event, affichage icône lock
7. User A → Modifications du contenu
8. Client A → PUT /api/documents/{id} (auto-save)
9. Backend → Mise à jour en base
10. Backend → WebSocket broadcast "tree_updated"
11. Client B → Réception event, rafraîchissement arbre
12. User A → Fin édition
13. Client A → DELETE /api/documents/{id}/lock
14. Backend → Suppression de document_locks
15. Backend → WebSocket broadcast "lock_updated"
16. Client B → Réception event, retrait icône lock
```

### Upload de fichier

```
1. User → Drag & drop fichier dans zone upload
2. Client → FormData avec fichier
3. Client → POST /api/tasks/{id}/files (multipart/form-data)
4. Backend → Validation taille (max 50 MB)
5. Backend → Génération UUID pour file_id
6. Backend → Sauvegarde fichier dans uploads/tasks/{task_id}/
7. Backend → Insertion métadonnées dans task_files
8. Backend → Insertion entrée timeline "file_added"
9. Backend → Réponse avec métadonnées fichier
10. Client → Rafraîchissement liste fichiers
11. Backend → WebSocket broadcast mise à jour
```

## Base de données

### Schéma relationnel

```
users (1) ──< (N) group_members (N) >── (1) groups
groups (1) ──< (N) group_workspace_permissions (N) >── (1) workspaces

workspaces (1) ──< (N) documents
workspaces (1) ──< (N) tasks
workspaces (1) ──< (N) password_vault

documents (1) ──< (1) document_locks
documents (1) ──< (N) document_tag_links (N) >── (1) tags

tasks (1) ──< (1) task_locks
tasks (1) ──< (N) task_tag_links (N) >── (1) tags
tasks (1) ──< (N) task_assignees (N) >── (1) users
tasks (1) ──< (N) task_timeline
tasks (1) ──< (N) task_comments
tasks (1) ──< (N) task_files

password_vault (1) ──< (N) password_tag_links (N) >── (1) tags
```

### Indexes

#### Documents
- `idx_parent` sur `parent_id` : Requêtes hiérarchiques rapides
- `idx_workspace` sur `workspace_id` : Filtrage par workspace
- `idx_type` sur `type` : Distinction fichiers/dossiers

#### Tasks
- `idx_parent` sur `parent_id` : Requêtes hiérarchiques
- `idx_workspace` sur `workspace_id` : Filtrage par workspace
- `idx_status` sur `status` : Filtrage par statut
- `idx_task_timeline_task` sur `task_id` : Timeline rapide
- `idx_task_timeline_created` sur `created_at` : Tri chronologique

#### Passwords
- `idx_parent` sur `parent_id` : Requêtes hiérarchiques
- `idx_workspace` sur `workspace_id` : Filtrage par workspace
- `idx_category` sur `category` : Filtrage par catégorie (deprecated)

#### Tags
- `idx_tags_name` sur `name` : Recherche de tags rapide

### Contraintes d'intégrité

- **CASCADE DELETE** : Suppression récursive des enfants
- **FOREIGN KEY** : Intégrité référentielle
- **UNIQUE** : Unicité des noms (username, email, workspace_id)
- **NOT NULL** : Champs obligatoires

## Communication temps réel

### WebSocket Events

#### Côté serveur (émission)
- `tree_updated` : Arbre modifié (création, modification, suppression, déplacement)
- `lock_updated` : Verrouillage modifié (lock, unlock)
- `notification` : Notification générale avec toast

#### Côté client (réception)
- Écoute des events
- Mise à jour de l'état React
- Rafraîchissement de l'UI
- Affichage des toasts

#### Côté client (émission)
- `request_tree` : Demande de mise à jour de l'arbre
- `document_editing` : Notification d'édition en cours

### Gestion des connexions

```typescript
// Connexion automatique
useEffect(() => {
  socket.connect();
  
  socket.on('connect', () => {
    console.log('WebSocket connected');
  });
  
  socket.on('tree_updated', (data) => {
    setTree(data.tree);
  });
  
  socket.on('lock_updated', (data) => {
    updateLockStatus(data.document_id, data.locked_by);
  });
  
  return () => {
    socket.disconnect();
  };
}, []);
```

## Sécurité

### Authentification
- **JWT** : Tokens signés avec secret
- **Expiration** : Tokens avec durée de vie limitée
- **Refresh** : Renouvellement automatique
- **Stockage** : localStorage côté client

### Autorisation
- **Middleware** : Vérification du token à chaque requête
- **Permissions** : Vérification des droits par workspace
- **Rôles** : User vs Admin

### Validation
- **Frontend** : Validation basique pour UX
- **Backend** : Validation stricte avec Pydantic
- **SQL** : Requêtes paramétrées (pas de SQL injection)

### Chiffrement
- **Mots de passe utilisateurs** : Bcrypt/Argon2
- **Mots de passe vault** : Cryptography (AES ou similaire)
- **HTTPS** : Obligatoire en production

### CORS
- **Origines autorisées** : Liste blanche dans .env
- **Credentials** : Autorisés pour les cookies/auth
- **Headers** : Authorization, Content-Type autorisés

## Performance

### Frontend
- **Code splitting** : Chargement lazy des modules
- **Memoization** : React.memo pour composants lourds
- **Virtual scrolling** : Pour listes très longues (si nécessaire)
- **Debouncing** : Recherche et auto-save

### Backend
- **Connection pooling** : Réutilisation des connexions DB
- **Indexes** : Requêtes optimisées
- **Pagination** : Pour grandes listes (si nécessaire)
- **Caching** : Redis pour données fréquentes (optionnel)

### Base de données
- **Indexes** : Sur colonnes fréquemment requêtées
- **Requêtes optimisées** : JOINs efficaces
- **Transactions** : Pour opérations atomiques
- **Nettoyage** : Suppression des locks orphelins

## Déploiement

### Frontend
```bash
# Build production
npm run build

# Génère dist/ avec assets optimisés
# Servir avec Nginx ou autre serveur statique
```

### Backend
```bash
# Démarrage avec Socket.IO
python main.py

# Ou avec Uvicorn
uvicorn main:socket_app --host 0.0.0.0 --port 8200

# NE PAS utiliser main:app (sans Socket.IO)
```

### Nginx
```nginx
# Frontend (statique)
location / {
    root /path/to/frontend/dist;
    try_files $uri $uri/ /index.html;
}

# Backend API
location /api/ {
    proxy_pass http://localhost:8200;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# WebSocket
location /socket.io/ {
    proxy_pass http://localhost:8200;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Variables d'environnement

#### Backend (.env)
```bash
# Base de données
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=markd-v2
MYSQL_USER=markd-v2
MYSQL_PASSWORD=xxx

# API
API_PORT=8200
SECRET_KEY=xxx

# CORS
CORS_ORIGINS=https://markd-v2.example.com

# Frontend
FRONTEND_PORT=5273
FRONTEND_URL=https://markd-v2.example.com
```

#### Frontend (.env)
```bash
VITE_API_URL=https://markd-v2.example.com/api
VITE_WS_URL=https://markd-v2.example.com
```

## Monitoring et logs

### Backend
- **Logs FastAPI** : Uvicorn logs
- **Logs applicatifs** : Python logging
- **Logs d'erreurs** : Traceback complets
- **Logs d'activité** : Table activity_logs

### Frontend
- **Console logs** : En développement
- **Error boundaries** : Capture des erreurs React
- **Sentry** : Monitoring d'erreurs (optionnel)

### Base de données
- **Slow query log** : Requêtes lentes
- **Error log** : Erreurs MySQL
- **General log** : Toutes requêtes (debug uniquement)

## Maintenance

### Tâches régulières
- **Backup base de données** : Quotidien
- **Nettoyage des logs** : Hebdomadaire
- **Mise à jour dépendances** : Mensuel
- **Audit de sécurité** : Trimestriel

### Scripts utiles
```bash
# Backup MySQL
mysqldump -u markd-v2 -p markd-v2 > backup.sql

# Nettoyage des locks orphelins
DELETE FROM document_locks WHERE locked_at < NOW() - INTERVAL 1 HOUR;
DELETE FROM task_locks WHERE locked_at < NOW() - INTERVAL 1 HOUR;

# Nettoyage des logs anciens
DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL 90 DAY;
```

## Évolutions futures

### Fonctionnalités
- Export/import de données
- API publique avec rate limiting
- Notifications email
- Intégrations tierces (Slack, Teams)
- Mobile app (React Native)

### Technique
- Migration vers PostgreSQL
- Redis pour caching
- Elasticsearch pour recherche avancée
- Docker/Kubernetes pour déploiement
- CI/CD automatisé
