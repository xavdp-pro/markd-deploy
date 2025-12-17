# Checklist de Test - Module Tasks

## 📋 Plan de Test Complet

Ce document liste toutes les fonctionnalités du module Tasks à tester dans l'interface web.

---

## ✅ Configuration Préalable

- [ ] Exécuter la migration SQL `024_task_checklist.sql` dans la base de données
- [ ] Redémarrer le serveur backend pour charger les nouveaux endpoints
- [ ] Vérifier que le frontend compile sans erreurs
- [ ] Ouvrir l'application dans le navigateur (https://markd-v2.c9.ooo.ovh)

---

## 🎯 Fonctionnalités de Base - Arbre des Tâches

### 1. Navigation et Affichage
- [ ] L'arbre des tâches s'affiche correctement dans la sidebar gauche
- [ ] Les dossiers et tâches sont visibles
- [ ] L'indentation des sous-éléments est correcte
- [ ] Le panneau de droite affiche "Select a task to get started" quand aucune tâche n'est sélectionnée

### 2. Expansion/Collapse des Dossiers
- [ ] Cliquer sur un dossier pour l'expander/réduire fonctionne
- [ ] Le bouton "Expand All" fonctionne
- [ ] Le bouton "Collapse All" fonctionne
- [ ] L'état d'expansion est sauvegardé dans sessionStorage

### 3. Sélection
- [ ] Cliquer sur une tâche la sélectionne
- [ ] La tâche sélectionnée est surlignée
- [ ] Le panneau de droite affiche les détails de la tâche sélectionnée
- [ ] La sélection est sauvegardée dans l'URL hash
- [ ] La sélection est restaurée au rechargement de la page

---

## ➕ Création

### 4. Créer une Tâche
- [ ] Le bouton "+" permet de créer une nouvelle tâche
- [ ] Le formulaire de création s'affiche
- [ ] Le nom est requis
- [ ] La tâche est créée avec succès
- [ ] Un toast "Tâche créée" s'affiche
- [ ] La tâche apparaît dans l'arbre
- [ ] La tâche est automatiquement sélectionnée après création

### 5. Créer un Dossier
- [ ] Le bouton "Nouveau dossier" fonctionne
- [ ] Le dossier est créé avec succès
- [ ] Le dossier apparaît dans l'arbre
- [ ] On peut créer des sous-dossiers et sous-tâches dans un dossier

---

## ✏️ Édition

### 6. Renommer
- [ ] Double-cliquer sur le nom d'une tâche/dossier permet de le renommer
- [ ] Le champ de texte s'affiche pour l'édition
- [ ] Appuyer sur Entrée sauvegarde le nouveau nom
- [ ] Appuyer sur Échap annule l'édition
- [ ] Le nouveau nom est sauvegardé dans la base de données
- [ ] Un toast "Renommé" s'affiche
- [ ] L'arbre se met à jour automatiquement

### 7. Éditer le Contenu
- [ ] Le bouton "Éditer" est visible pour les tâches (pas les dossiers)
- [ ] Cliquer sur "Éditer" verrouille la tâche
- [ ] L'éditeur de contenu Markdown s'affiche
- [ ] Le contenu peut être modifié
- [ ] Le bouton "Enregistrer" sauvegarde les modifications
- [ ] Le bouton "Annuler" annule les modifications et déverrouille
- [ ] Le verrou est automatiquement retiré après sauvegarde

---

## 🗑️ Suppression

### 8. Supprimer une Tâche/Dossier
- [ ] Le bouton de suppression est visible (si permissions suffisantes)
- [ ] Une confirmation est demandée avant suppression
- [ ] La suppression fonctionne
- [ ] Un toast "Supprimé" s'affiche
- [ ] La tâche/dossier disparaît de l'arbre
- [ ] Les sous-éléments sont également supprimés (CASCADE)
- [ ] Si la tâche était sélectionnée, la sélection est effacée

---

## 📂 Déplacement

### 9. Drag & Drop
- [ ] On peut faire glisser une tâche/dossier
- [ ] Le drag visual feedback fonctionne (DragOverlay)
- [ ] On peut déposer sur un dossier parent
- [ ] Le déplacement est sauvegardé
- [ ] Un toast "Déplacé" s'affiche
- [ ] L'arbre se réorganise correctement

---

## 🏷️ Tags

### 10. Gestion des Tags
- [ ] Les tags existants s'affichent dans le panneau de droite
- [ ] Le champ de recherche de tags fonctionne (autocomplétion)
- [ ] On peut ajouter un nouveau tag en le tapant
- [ ] On peut ajouter un tag existant en le sélectionnant
- [ ] Les tags ajoutés s'affichent immédiatement
- [ ] On peut supprimer un tag en cliquant sur la croix
- [ ] Un toast "Tag ajouté" / "Tag supprimé" s'affiche
- [ ] Les tags sont sauvegardés dans la base de données

### 11. Filtrage par Tags
- [ ] La barre de recherche de tags dans la sidebar fonctionne
- [ ] Sélectionner un tag filtre les tâches
- [ ] Seules les tâches avec le tag sélectionné sont visibles
- [ ] On peut sélectionner plusieurs tags (ET logique)
- [ ] Désélectionner tous les tags affiche toutes les tâches

---

## 👥 Assignation

### 12. Assigner des Utilisateurs
- [ ] Le champ "Assignés" est visible dans le panneau de droite
- [ ] Le sélecteur d'utilisateurs s'affiche
- [ ] On peut sélectionner plusieurs utilisateurs
- [ ] On peut définir un responsable parmi les assignés
- [ ] Les assignés sont sauvegardés
- [ ] Un toast "Assignations mises à jour" s'affiche
- [ ] Les noms des assignés s'affichent dans le panneau

---

## 📊 Statut et Priorité

### 13. Statut (Todo/Doing/Done)
- [ ] Le sélecteur de statut est visible
- [ ] On peut changer le statut d'une tâche
- [ ] Le nouveau statut est sauvegardé
- [ ] Un toast "Statut mis à jour" s'affiche
- [ ] L'entrée "status_changed" est ajoutée à la timeline

### 14. Priorité (Low/Medium/High)
- [ ] Le sélecteur de priorité est visible
- [ ] On peut changer la priorité
- [ ] La nouvelle priorité est sauvegardée
- [ ] Un toast "Mis à jour" s'affiche
- [ ] L'entrée "priority_changed" est ajoutée à la timeline

### 15. Filtrage par Statut/Priorité
- [ ] Les filtres "Tous/Todo/Doing/Done" fonctionnent
- [ ] Les filtres de priorité fonctionnent
- [ ] La combinaison de filtres fonctionne (statut ET priorité)
- [ ] Le nombre de tâches filtrées est correct

---

## 📅 Date d'Échéance

### 16. Gestion de la Date d'Échéance
- [ ] Le champ "Date d'échéance" est visible
- [ ] On peut sélectionner une date dans le date picker
- [ ] On peut effacer la date
- [ ] La date est sauvegardée
- [ ] L'entrée "due_date_changed" est ajoutée à la timeline

---

## 📁 Fichiers

### 17. Upload de Fichiers
- [ ] Le bouton "Upload" ou glisser-déposer fonctionne
- [ ] Le sélecteur de fichiers s'ouvre
- [ ] On peut sélectionner un fichier
- [ ] Le fichier est uploadé avec succès
- [ ] Un toast "Fichier uploadé" s'affiche
- [ ] Le fichier apparaît dans la liste des fichiers
- [ ] L'entrée "file_added" est ajoutée à la timeline

### 18. Visualisation de Fichiers
- [ ] Cliquer sur un fichier l'ouvre (si type supporté)
- [ ] Les PDFs s'affichent dans un viewer intégré
- [ ] Les images s'affichent en plein écran
- [ ] Les autres types de fichiers se téléchargent
- [ ] Le bouton de téléchargement fonctionne

### 19. Notes Markdown sur Fichiers
- [ ] Le champ "Note" est visible pour chaque fichier
- [ ] On peut éditer la note en Markdown
- [ ] La note est sauvegardée automatiquement
- [ ] Un toast "Note mise à jour" s'affiche

### 20. Suppression de Fichiers
- [ ] Le bouton de suppression est visible
- [ ] Une confirmation est demandée
- [ ] Le fichier est supprimé
- [ ] Un toast "Fichier supprimé" s'affiche
- [ ] L'entrée "file_removed" est ajoutée à la timeline

---

## 💬 Commentaires

### 21. Ajouter un Commentaire
- [ ] L'onglet "Commentaires" est visible
- [ ] Le champ de texte pour ajouter un commentaire fonctionne
- [ ] Le bouton "Ajouter" fonctionne
- [ ] Le commentaire est ajouté
- [ ] Un toast "Commentaire ajouté" s'affiche
- [ ] Le commentaire apparaît dans la liste
- [ ] L'entrée "comment_added" est ajoutée à la timeline

### 22. Affichage des Commentaires
- [ ] Les commentaires sont affichés dans l'ordre chronologique
- [ ] L'auteur et la date sont affichés
- [ ] Le formatage Markdown fonctionne dans les commentaires

---

## 📈 Timeline

### 23. Consultation de la Timeline
- [ ] L'onglet "Timeline" est visible
- [ ] Les événements sont affichés dans l'ordre chronologique (plus récent en premier)
- [ ] Tous les types d'événements sont visibles (created, updated, status_changed, etc.)
- [ ] Les métadonnées sont affichées correctement

### 24. Ajout Manuel d'Entrée Timeline
- [ ] Le bouton "Ajouter une entrée" fonctionne
- [ ] Le formulaire s'affiche (titre, description, type)
- [ ] L'entrée est ajoutée
- [ ] Un toast "Entrée ajoutée" s'affiche
- [ ] L'entrée apparaît dans la timeline

---

## ✅ Checklist (Sous-tâches)

### 25. Affichage de la Checklist
- [ ] L'onglet "Checklist" est visible
- [ ] La checklist s'affiche (vide si aucune sous-tâche)
- [ ] Le compteur de progression est visible (X/Y terminées)
- [ ] La barre de progression est visible

### 26. Ajouter un Item de Checklist
- [ ] Le champ "Ajouter une sous-tâche..." est visible
- [ ] On peut taper du texte
- [ ] Le bouton "Ajouter" fonctionne
- [ ] L'item est ajouté
- [ ] Un toast "Item ajouté" s'affiche
- [ ] L'item apparaît dans la liste
- [ ] **BUG CORRIGÉ : L'endpoint POST /api/tasks/{id}/checklist fonctionne**

### 27. Cocher/Décocher un Item
- [ ] Cliquer sur la checkbox change l'état (complété/non complété)
- [ ] L'état est sauvegardé dans la base de données
- [ ] Le compteur de progression se met à jour
- [ ] La barre de progression se met à jour
- [ ] L'item complété est barré visuellement

### 28. Modifier un Item
- [ ] Double-cliquer ou cliquer sur le texte permet d'éditer
- [ ] Le champ d'édition s'affiche
- [ ] Modifier et appuyer sur Entrée sauvegarde
- [ ] Appuyer sur Échap annule
- [ ] Un toast "Item mis à jour" s'affiche

### 29. Supprimer un Item
- [ ] Le bouton de suppression apparaît au survol
- [ ] Cliquer supprime l'item
- [ ] Un toast "Item supprimé" s'affiche
- [ ] Le compteur et la barre de progression se mettent à jour

### 30. Réorganiser les Items (Drag & Drop)
- [ ] On peut faire glisser un item pour le réorganiser
- [ ] L'ordre est sauvegardé
- [ ] L'ordre persiste après rechargement

---

## 🔒 Verrouillage

### 31. Verrouillage pour Édition
- [ ] Quand on clique sur "Éditer", la tâche est verrouillée
- [ ] Un message indique que la tâche est verrouillée par l'utilisateur
- [ ] Les autres utilisateurs voient que la tâche est verrouillée
- [ ] Le heartbeat maintient le verrou pendant l'édition

### 32. Déverrouillage
- [ ] Après sauvegarde, le verrou est retiré automatiquement
- [ ] Le bouton "Annuler" retire aussi le verrou
- [ ] Le bouton "Retirer le verrou" (si visible) fonctionne

### 33. Force Unlock (Admin)
- [ ] Les admins peuvent forcer le déverrouillage
- [ ] Un toast "Déverrouillé" s'affiche

---

## 🔍 Recherche

### 34. Recherche Textuelle
- [ ] Le champ de recherche dans la sidebar fonctionne
- [ ] La recherche filtre les tâches par nom
- [ ] La recherche est case-insensitive
- [ ] Le bouton "Effacer" réinitialise la recherche

---

## 🎨 Vue Kanban

### 35. Ouvrir la Vue Kanban
- [ ] Le bouton "Vue Kanban" dans la sidebar fonctionne
- [ ] La modal Kanban s'ouvre
- [ ] Les tâches sont organisées par colonnes (Todo/Doing/Done)

### 36. Déplacer dans Kanban
- [ ] On peut faire glisser une tâche d'une colonne à l'autre
- [ ] Le statut de la tâche est mis à jour
- [ ] Un toast "Statut mis à jour" s'affiche

---

## 🌐 WebSocket / Temps Réel

### 37. Mises à Jour en Temps Réel
- [ ] Si un autre utilisateur crée/modifie une tâche, l'arbre se met à jour automatiquement
- [ ] Si un autre utilisateur verrouille une tâche, l'état se met à jour
- [ ] Les commentaires ajoutés par d'autres apparaissent automatiquement
- [ ] Les fichiers uploadés par d'autres apparaissent automatiquement

---

## 🔐 Permissions

### 38. Permissions Read
- [ ] En mode read-only, les boutons de modification sont désactivés/cachés
- [ ] On peut voir tous les détails
- [ ] On ne peut pas créer/modifier/supprimer

### 39. Permissions Write
- [ ] Toutes les fonctionnalités d'édition sont disponibles
- [ ] On ne peut pas faire de force unlock

### 40. Permissions Admin
- [ ] Toutes les fonctionnalités sont disponibles
- [ ] On peut faire force unlock

---

## 🐛 Bugs Connus et Corrigés

- [x] **BUG CORRIGÉ** : La checklist retournait 404 - Les endpoints backend ont été ajoutés
- [x] **BUG CORRIGÉ** : `refreshTaskChecklist` ne chargeait pas les items - Corrigé pour appeler l'API
- [x] **BUG CORRIGÉ** : Boucles infinies dans TasksApp - Corrigé avec useRef pour éviter les re-renders

---

## 📝 Notes de Test

**Date de test :** _________________

**Testeur :** _________________

**Version testée :** _________________

**Résultats :**
- Fonctionnalités OK : ___ / 40
- Bugs trouvés : ___
- Commentaires : _________________________________________________

---

## 🚀 Commandes pour Appliquer les Corrections

1. **Appliquer la migration SQL :**
   ```bash
   mysql -u root < /apps/markd-v2/app/markd-package/backend/migrations/024_task_checklist.sql
   ```

2. **Redémarrer le serveur backend** (si nécessaire)

3. **Vérifier que le frontend compile :**
   ```bash
   cd /apps/markd-v2/app/markd-package/frontend
   npm run build
   ```

