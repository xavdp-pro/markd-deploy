# Menu Admin - Documentation complète

## Vue d'ensemble

Le menu Admin permet de gérer les utilisateurs, groupes, workspaces et permissions de l'application MarkD.

## Accès

- **Icône** : Engrenage dans la barre de navigation
- **Permissions** : Réservé aux utilisateurs avec rôle Admin
- **Position** : Menu déroulant en haut à droite

## Sections principales

### 1. Gestion des utilisateurs

#### Fonctionnalités
- **Liste des utilisateurs** : Tableau avec tous les utilisateurs
- **Création** : Formulaire de création d'utilisateur
- **Modification** : Édition des informations utilisateur
- **Suppression** : Suppression avec confirmation
- **Réinitialisation mot de passe** : Génération nouveau mot de passe
- **Activation/Désactivation** : Activer ou désactiver un compte

#### Informations utilisateur
- **ID** : Identifiant unique
- **Username** : Nom d'utilisateur (unique)
- **Email** : Adresse email (unique)
- **Nom complet** : Prénom et nom
- **Rôle** : User ou Admin
- **Statut** : Actif ou Inactif
- **Date de création** : Date d'inscription
- **Dernière connexion** : Date de dernière connexion

#### Opérations
- **Créer un utilisateur** :
  - Saisie username, email, nom, mot de passe
  - Sélection du rôle (User/Admin)
  - Validation unicité username et email
  - Hachage du mot de passe
  - Création en base

- **Modifier un utilisateur** :
  - Modification email, nom, rôle
  - Changement de mot de passe (optionnel)
  - Activation/désactivation du compte

- **Supprimer un utilisateur** :
  - Confirmation requise
  - Vérification des dépendances
  - Suppression en cascade ou réassignation

### 2. Gestion des groupes

#### Fonctionnalités
- **Liste des groupes** : Tableau avec tous les groupes
- **Création** : Formulaire de création de groupe
- **Modification** : Édition du nom et description
- **Suppression** : Suppression avec confirmation
- **Gestion des membres** : Ajout/retrait d'utilisateurs

#### Informations groupe
- **ID** : Identifiant unique
- **Nom** : Nom du groupe (unique)
- **Description** : Description du groupe
- **Nombre de membres** : Compteur d'utilisateurs
- **Date de création** : Date de création

#### Opérations
- **Créer un groupe** :
  - Saisie nom et description
  - Validation unicité du nom
  - Création en base

- **Ajouter des membres** :
  - Sélection multiple d'utilisateurs
  - Ajout dans table `group_members`
  - Mise à jour des permissions

- **Retirer des membres** :
  - Sélection d'utilisateurs à retirer
  - Suppression de `group_members`
  - Révocation des permissions associées

### 3. Gestion des workspaces

#### Fonctionnalités
- **Liste des workspaces** : Tableau avec tous les workspaces
- **Création** : Formulaire de création de workspace
- **Modification** : Édition du nom et description
- **Suppression** : Suppression avec confirmation (CASCADE)
- **Permissions** : Gestion des accès par groupe

#### Informations workspace
- **ID** : Identifiant unique
- **Nom** : Nom du workspace (unique)
- **Description** : Description du workspace
- **Créateur** : Utilisateur ayant créé le workspace
- **Date de création** : Date de création
- **Nombre de documents** : Compteur de documents
- **Nombre de tâches** : Compteur de tâches
- **Nombre de mots de passe** : Compteur de mots de passe

#### Opérations
- **Créer un workspace** :
  - Saisie nom et description
  - Validation unicité du nom
  - Création en base
  - Attribution permissions par défaut

- **Modifier un workspace** :
  - Modification nom et description
  - Mise à jour des métadonnées

- **Supprimer un workspace** :
  - Confirmation requise
  - Avertissement sur suppression CASCADE
  - Suppression de toutes les données associées

### 4. Gestion des permissions

#### Fonctionnalités
- **Matrice de permissions** : Vue groupe × workspace
- **Attribution** : Sélection du niveau d'accès
- **Révocation** : Suppression des permissions
- **Vue par groupe** : Permissions d'un groupe
- **Vue par workspace** : Groupes ayant accès

#### Niveaux de permission
- **None** : Pas d'accès
- **Read** : Lecture seule
- **Write** : Lecture et écriture
- **Admin** : Tous droits + gestion avancée

#### Matrice de permissions
```
                Workspace A    Workspace B    Workspace C
Groupe Dev      Write          Read           None
Groupe Admin    Admin          Admin          Admin
Groupe Support  Read           Read           Write
```

#### Opérations
- **Attribuer une permission** :
  - Sélection groupe et workspace
  - Choix du niveau (Read/Write/Admin)
  - Insertion dans `group_workspace_permissions`

- **Modifier une permission** :
  - Sélection groupe et workspace
  - Changement du niveau
  - Mise à jour en base

- **Révoquer une permission** :
  - Sélection groupe et workspace
  - Suppression de `group_workspace_permissions`

### 5. Logs et activité

#### Fonctionnalités
- **Journal d'activité** : Historique des actions
- **Filtres** : Par utilisateur, date, type d'action
- **Export** : Téléchargement des logs
- **Recherche** : Recherche textuelle dans les logs

#### Informations loggées
- **Connexions** : Login/logout des utilisateurs
- **Modifications** : Création/modification/suppression
- **Permissions** : Changements de permissions
- **Erreurs** : Erreurs système et échecs d'authentification
- **Actions admin** : Toutes actions dans le menu admin

#### Types d'événements
- `user_login` : Connexion utilisateur
- `user_logout` : Déconnexion utilisateur
- `user_created` : Création utilisateur
- `user_updated` : Modification utilisateur
- `user_deleted` : Suppression utilisateur
- `group_created` : Création groupe
- `group_updated` : Modification groupe
- `group_deleted` : Suppression groupe
- `workspace_created` : Création workspace
- `workspace_updated` : Modification workspace
- `workspace_deleted` : Suppression workspace
- `permission_granted` : Permission accordée
- `permission_revoked` : Permission révoquée
- `password_reset` : Réinitialisation mot de passe
- `failed_login` : Échec de connexion

## Base de données

### Table `users`
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role ENUM('user','admin') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
)
```

### Table `groups`
```sql
CREATE TABLE groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Table `group_members`
```sql
CREATE TABLE group_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### Table `workspaces`
```sql
CREATE TABLE workspaces (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
)
```

### Table `group_workspace_permissions`
```sql
CREATE TABLE group_workspace_permissions (
  group_id INT NOT NULL,
  workspace_id VARCHAR(50) NOT NULL,
  permission ENUM('read','write','admin') NOT NULL,
  PRIMARY KEY (group_id, workspace_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)
```

### Table `activity_logs`
```sql
CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

## API Endpoints

### Utilisateurs
- `GET /api/admin/users` : Liste tous les utilisateurs
- `GET /api/admin/users/{id}` : Détails d'un utilisateur
- `POST /api/admin/users` : Crée un utilisateur
- `PUT /api/admin/users/{id}` : Modifie un utilisateur
- `DELETE /api/admin/users/{id}` : Supprime un utilisateur
- `POST /api/admin/users/{id}/reset-password` : Réinitialise le mot de passe
- `PATCH /api/admin/users/{id}/toggle-active` : Active/désactive un compte

### Groupes
- `GET /api/admin/groups` : Liste tous les groupes
- `GET /api/admin/groups/{id}` : Détails d'un groupe
- `POST /api/admin/groups` : Crée un groupe
- `PUT /api/admin/groups/{id}` : Modifie un groupe
- `DELETE /api/admin/groups/{id}` : Supprime un groupe
- `GET /api/admin/groups/{id}/members` : Liste les membres
- `POST /api/admin/groups/{id}/members` : Ajoute des membres
- `DELETE /api/admin/groups/{id}/members/{user_id}` : Retire un membre

### Workspaces
- `GET /api/admin/workspaces` : Liste tous les workspaces
- `GET /api/admin/workspaces/{id}` : Détails d'un workspace
- `POST /api/admin/workspaces` : Crée un workspace
- `PUT /api/admin/workspaces/{id}` : Modifie un workspace
- `DELETE /api/admin/workspaces/{id}` : Supprime un workspace
- `GET /api/admin/workspaces/{id}/stats` : Statistiques du workspace

### Permissions
- `GET /api/admin/permissions` : Matrice complète des permissions
- `GET /api/admin/permissions/group/{group_id}` : Permissions d'un groupe
- `GET /api/admin/permissions/workspace/{workspace_id}` : Permissions d'un workspace
- `POST /api/admin/permissions` : Attribue une permission
- `PUT /api/admin/permissions` : Modifie une permission
- `DELETE /api/admin/permissions` : Révoque une permission

### Logs
- `GET /api/admin/logs?user_id=&event_type=&start_date=&end_date=` : Liste les logs
- `GET /api/admin/logs/export` : Exporte les logs en CSV

## Sécurité

### Authentification
- **JWT** : Tokens avec expiration
- **Refresh tokens** : Renouvellement automatique
- **Vérification rôle** : Middleware vérifie rôle Admin

### Validation
- **Côté serveur** : Toutes les opérations validées
- **Unicité** : Username et email uniques
- **Complexité mot de passe** : Minimum 8 caractères
- **Hachage** : Bcrypt ou Argon2 pour les mots de passe

### Audit
- **Logging complet** : Toutes actions admin loggées
- **Traçabilité** : Qui, quand, quoi
- **IP et User-Agent** : Enregistrés pour chaque action
- **Métadonnées** : Détails des changements en JSON

## Flux de travail typique

### Création d'un nouvel utilisateur
1. Admin accède au menu Admin → Utilisateurs
2. Clic sur "Nouveau utilisateur"
3. Saisie username, email, nom, mot de passe, rôle
4. Validation et création
5. Log "user_created" enregistré
6. Utilisateur peut se connecter

### Attribution de permissions
1. Admin accède au menu Admin → Permissions
2. Sélection d'un groupe
3. Sélection d'un workspace
4. Choix du niveau (Read/Write/Admin)
5. Validation et enregistrement
6. Log "permission_granted" enregistré
7. Membres du groupe ont accès au workspace

### Organisation par groupes
1. Création de groupes thématiques (Dev, Support, Admin)
2. Ajout d'utilisateurs dans les groupes
3. Attribution de permissions par groupe
4. Tous les membres héritent des permissions du groupe
5. Modification centralisée des accès

### Gestion d'un workspace
1. Création d'un workspace "Projet X"
2. Attribution permissions :
   - Groupe Dev : Write
   - Groupe Support : Read
   - Groupe Admin : Admin
3. Membres peuvent accéder selon leurs permissions
4. Statistiques visibles dans le menu admin
5. Suppression possible avec confirmation

## Bonnes pratiques

### Gestion des utilisateurs
- Utiliser des groupes plutôt que des permissions individuelles
- Désactiver les comptes au lieu de les supprimer
- Forcer la réinitialisation du mot de passe à la première connexion
- Vérifier régulièrement les comptes inactifs

### Gestion des permissions
- Principe du moindre privilège
- Permissions par groupe, pas par utilisateur
- Révision régulière des accès
- Documentation des raisons d'attribution

### Sécurité
- Mots de passe complexes obligatoires
- Rotation régulière des mots de passe admin
- Surveillance des logs d'échecs de connexion
- Audit régulier des permissions

### Maintenance
- Nettoyage des logs anciens
- Archivage des workspaces inactifs
- Suppression des groupes vides
- Mise à jour des informations utilisateurs
