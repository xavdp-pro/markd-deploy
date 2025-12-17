# Module Passwords (Vault) - Documentation complète

## Vue d'ensemble

Le module Passwords (Vault) est un coffre-fort sécurisé pour stocker et gérer des mots de passe avec chiffrement, hiérarchie et recherche.

## Fonctionnalités principales

### 1. Gestion hiérarchique
- **Arbre de mots de passe** : Organisation en dossiers et entrées
- **Drag & drop** : Réorganisation par glisser-déposer
- **Navigation** : Expand/collapse des dossiers
- **Tri automatique** : Dossiers toujours avant mots de passe

### 2. Sécurité
- **Chiffrement** : Tous les mots de passe chiffrés en base
- **Déchiffrement à la demande** : Uniquement lors de la consultation
- **Pas de transmission chiffrée** : Mots de passe jamais envoyés chiffrés dans l'arbre
- **Affichage masqué** : Type "password" par défaut
- **Bouton afficher/masquer** : Icône œil pour révéler

### 3. Gestion des entrées
- **Titre** : Nom de l'entrée (requis)
- **Nom d'utilisateur** : Login/username (requis pour mots de passe)
- **Mot de passe** : Password (requis pour mots de passe)
- **URL** : Site web associé (optionnel)
- **Notes** : Commentaires/informations (optionnel)
- **Tags** : Catégorisation flexible

### 4. Copie rapide
- **Boutons copier** : Pour chaque champ (login, password, URL, notes)
- **Presse-papiers** : Utilise `navigator.clipboard.writeText()`
- **Toast confirmation** : Notification après copie
- **Sécurité** : Pas de log des mots de passe copiés

### 5. Recherche et filtrage
- **Recherche textuelle** : Par titre
- **Filtre par tags** : Sélection multiple
- **Auto-expansion** : Dossiers contenant résultats ouverts automatiquement
- **Combinaison** : Recherche + tags

### 6. Types d'entrées
- **Mots de passe** : Entrées avec username et password obligatoires
- **Dossiers** : Organisation, username et password optionnels
- **Validation** : Côté serveur selon le type

## Interface utilisateur

### Sidebar (arbre)
- **Sélecteur de workspace** : Changement de workspace
- **Barre de recherche** : Recherche textuelle
- **Arbre hiérarchique** : Dossiers et mots de passe
- **Indicateurs visuels** :
  - Icône dossier pour dossiers
  - Icône clé pour mots de passe
- **Menu contextuel** : Clic droit pour actions
- **Boutons expand/collapse** : Position top-[14px] right-2
- **Filtre de tags** : Sticky en bas
- **Badge de permission** : Admin/RW/RO
- **Tri** : Dossiers avant mots de passe, puis alphabétique

### Zone de contenu

#### Mode lecture
- **Titre** : Nom de l'entrée
- **Username** : Avec bouton copier
- **Password** : Masqué avec bouton afficher/masquer et copier
- **URL** : Lien cliquable avec bouton copier
- **Notes** : Textarea avec bouton copier
- **Tags** : Affichage (lecture seule en mode view)
- **Métadonnées** : Dates de création/modification, créateur
- **Bouton "Éditer"** : Si permission Write/Admin

#### Mode édition
- **Formulaire** : Tous champs éditables
- **Champ password** : Type password ou text selon état afficher/masquer
- **Tags** : Sélecteur éditable
- **Boutons** : Enregistrer, Annuler
- **Validation** : Username et password requis pour type='password'

## Opérations disponibles

### Création
- **Nouveau mot de passe** : Clic droit → "Nouveau mot de passe"
- **Nouveau dossier** : Clic droit → "Nouveau dossier"
- **Validation** : Username et password obligatoires pour mots de passe
- **Chiffrement** : Automatique avant stockage
- **Sélection automatique** : Après création

### Édition
- **Clic sur entrée** : Affichage en mode lecture
- **Déchiffrement** : Mot de passe déchiffré pour affichage
- **Bouton "Éditer"** : Passage en mode édition
- **Modification** : Tous champs éditables
- **Rechiffrement** : Si mot de passe modifié
- **Sauvegarde** : Bouton "Enregistrer"

### Suppression
- **Clic droit → Supprimer** : Confirmation requise
- **Cascade** : Suppression récursive des enfants
- **Sécurité** : Suppression définitive, pas de corbeille

### Déplacement
- **Drag & drop** : Glisser-déposer vers nouveau parent
- **Validation** : Impossible de déplacer dans soi-même ou descendants
- **Déplacement à la racine** : parent_id explicitement null
- **Mise à jour partielle** : Seul parent_id modifié, pas besoin du mot de passe

### Renommage
- **Clic droit → Renommer** : Modal de saisie
- **Raccourci F2** : Renommage rapide
- **Validation** : Titre non vide requis

### Copie dans presse-papiers
- **Bouton copier login** : Copie le username
- **Bouton copier password** : Copie le mot de passe (déchiffré)
- **Bouton copier URL** : Copie l'URL
- **Bouton copier notes** : Copie les notes
- **Feedback** : Toast de confirmation

## Chiffrement

### Service de chiffrement
- **Fichier** : `encryption_service.py`
- **Méthodes** :
  - `encrypt(password: str) -> str` : Chiffre un mot de passe
  - `decrypt(encrypted: str) -> str` : Déchiffre un mot de passe

### Flux de chiffrement
1. **Création** : Mot de passe en clair → `encrypt()` → stockage chiffré
2. **Stockage** : `password_encrypted` contient la version chiffrée
3. **Récupération** : `password_encrypted` → `decrypt()` → mot de passe en clair
4. **Transmission** : Mot de passe en clair envoyé uniquement lors de GET détails
5. **Arbre** : Mots de passe JAMAIS inclus dans l'arbre

### Sécurité
- **Pas de log** : Mots de passe jamais loggés en clair
- **Transmission sécurisée** : HTTPS obligatoire en production
- **Permissions** : Vérification à chaque requête
- **Pas de cache** : Mots de passe pas mis en cache côté client

## Base de données

### Table `password_vault`
```sql
CREATE TABLE password_vault (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36),
  type ENUM('folder','password') DEFAULT 'password',
  title VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  password_encrypted TEXT,
  url VARCHAR(500),
  notes TEXT,
  category ENUM('ssh','api','database','service','other') DEFAULT 'other',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES password_vault(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
)
```

### Table `password_tag_links`
```sql
CREATE TABLE password_tag_links (
  password_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (password_id, tag_id),
  FOREIGN KEY (password_id) REFERENCES password_vault(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
)
```

### Tri des résultats
```sql
ORDER BY 
  CASE WHEN type = 'folder' THEN 0 ELSE 1 END,
  title ASC
```
Assure que les dossiers sont toujours affichés avant les mots de passe.

## API Endpoints

### Mots de passe
- `GET /api/vault/tree?workspace_id=xxx` : Récupère l'arbre (sans mots de passe)
- `GET /api/vault/passwords/{id}` : Récupère un mot de passe (avec déchiffrement)
- `POST /api/vault/passwords` : Crée un mot de passe/dossier
- `PUT /api/vault/passwords/{id}` : Met à jour un mot de passe
- `DELETE /api/vault/passwords/{id}` : Supprime un mot de passe
- `PATCH /api/vault/passwords/{id}/rename?new_name=xxx` : Renomme

### Tags
- `GET /api/vault/passwords/{id}/tags` : Récupère les tags
- `PUT /api/vault/passwords/{id}/tags` : Met à jour les tags
- `GET /api/vault/passwords/tags/suggestions?query=&limit=20` : Suggestions

### Particularités API

#### Création (POST)
- **Validation** : Pour type='password', username et password OBLIGATOIRES
- **Chiffrement** : Password chiffré automatiquement avant stockage
- **Réponse** : Retourne uniquement l'ID, pas le mot de passe

#### Récupération détails (GET)
- **Déchiffrement** : Password déchiffré avant envoi
- **Champ** : `password` contient le mot de passe en clair
- **Sécurité** : Uniquement si utilisateur autorisé

#### Mise à jour (PUT)
- **Validation conditionnelle** : Username et password validés UNIQUEMENT s'ils sont fournis
- **Déplacement** : Possible de déplacer sans fournir le mot de passe
- **Rechiffrement** : Si password fourni, rechiffré avant stockage
- **parent_id null** : Détection explicite pour déplacement à la racine

## Flux de travail typique

### Ajout d'un nouveau mot de passe
1. Clic droit sur dossier → "Nouveau mot de passe"
2. Saisie du nom dans modal
3. Création via API avec champs vides
4. Sélection automatique
5. Passage en mode édition
6. Saisie username, password, URL, notes
7. Sélection de tags
8. Sauvegarde
9. Chiffrement automatique du password
10. Stockage en base avec password_encrypted

### Consultation d'un mot de passe
1. Clic sur entrée dans l'arbre
2. Chargement via API GET détails
3. Déchiffrement côté serveur
4. Affichage en mode lecture avec password masqué
5. Clic sur bouton "Afficher" pour révéler
6. Clic sur bouton "Copier" pour copier dans presse-papiers
7. Toast de confirmation

### Organisation avec dossiers
1. Création de dossiers thématiques (ex: "Production", "Développement")
2. Création de sous-dossiers si nécessaire
3. Drag & drop des mots de passe vers les dossiers
4. Mise à jour automatique de parent_id
5. Recherche et filtrage par tags pour retrouver rapidement

### Recherche sécurisée
1. Saisie dans barre de recherche : "github"
2. Filtrage en temps réel de l'arbre
3. Sélection de tags : "production"
4. Affichage uniquement des entrées correspondantes
5. Auto-expansion des dossiers contenant résultats
6. Clic sur résultat pour voir détails
7. Copie rapide du mot de passe

## Permissions

- **Read** : Consultation des mots de passe (déchiffrés), pas de modification
- **Write** : Création, modification, suppression, gestion tags
- **Admin** : Identique à Write pour ce module

## Optimisations

- **Arbre sans mots de passe** : Chargement rapide, pas de déchiffrement massif
- **Déchiffrement à la demande** : Uniquement lors de la consultation
- **Cache des tags** : Tags disponibles chargés une fois
- **Pas de cache des mots de passe** : Sécurité avant performance
