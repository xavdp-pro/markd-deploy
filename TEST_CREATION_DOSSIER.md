# 🧪 Test de Création de Dossier - Module Documents

## 📋 Objectif
Tester que la création d'un dossier fonctionne correctement :
- Le dossier apparaît dans l'arbre
- Seuls les niveaux nécessaires sont ouverts (pas tout l'arbre)
- Le dossier créé est automatiquement sélectionné

## 🚀 Étapes de Test

### 1. Accéder à l'application
1. Ouvrir le navigateur intégré de Cursor (onglet Browser)
2. Naviguer vers : `https://markd-v2.c9.ooo.ovh`
3. Se connecter avec :
   - Username: `admin`
   - Password: `admin`

### 2. Accéder au module Documents
1. Cliquer sur **"Documents"** dans la barre de navigation

### 3. Ouvrir la console du navigateur
1. Appuyer sur **F12** pour ouvrir les outils de développement
2. Aller dans l'onglet **"Console"**
3. Vérifier que les logs sont visibles (filtres activés)

### 4. Tester la création d'un dossier à la racine
1. Faire un **clic droit** dans la zone de l'arbre (pas sur un dossier)
2. Sélectionner **"Nouveau dossier"**
3. Entrer un nom : `test-racine`
4. Valider

**Résultats attendus :**
- ✅ Logs dans la console : `🔵 [CREATE FOLDER] Starting...`
- ✅ Logs : `✅ [CREATE FOLDER] SUCCESS - Folder created: test-racine`
- ✅ Le dossier `test-racine` apparaît dans l'arbre à la racine
- ✅ Le dossier est automatiquement sélectionné (surbrillance)
- ✅ Logs : `✅ [WEBSOCKET] Selected folder: test-racine`

### 5. Tester la création d'un dossier dans un dossier existant
1. Faire un **clic droit** sur un dossier existant (ex: "Guides")
2. Sélectionner **"Nouveau dossier"**
3. Entrer un nom : `test-sous-dossier`
4. Valider

**Résultats attendus :**
- ✅ Logs : `🔵 [CREATE FOLDER] Path to parent: [...]`
- ✅ Logs : `🔵 [CREATE FOLDER] Expanded path: [...]`
- ✅ Le dossier parent "Guides" s'ouvre automatiquement
- ✅ Le nouveau dossier `test-sous-dossier` apparaît dans "Guides"
- ✅ **SEULEMENT** le chemin vers le dossier est ouvert (pas tout l'arbre)
- ✅ Le dossier créé est automatiquement sélectionné
- ✅ Logs : `🟡 [WEBSOCKET] Path to pendingSelection: [...]`
- ✅ Logs : `✅ [WEBSOCKET] Selected folder: test-sous-dossier`

### 6. Vérifier que l'arbre ne s'ouvre pas entièrement
1. Créer un autre dossier dans un dossier profond (ex: Guides > Sous-dossier)
2. Observer l'arbre

**Résultats attendus :**
- ✅ Seuls les dossiers parents nécessaires sont ouverts
- ✅ Les autres branches de l'arbre restent fermées
- ✅ Le dossier créé est visible et sélectionné

## 🐛 Problèmes à vérifier

### Problème 1 : Le dossier n'apparaît pas
**Symptômes :**
- Pas de dossier dans l'arbre après création
- Logs : `❌ [PENDING SELECTION] NOT FOUND in tree`

**Vérifications :**
- Vérifier les logs WebSocket : `🟡 [WEBSOCKET] tree_changed received`
- Vérifier que l'arbre est rechargé : `🟡 [WEBSOCKET] Tree reloaded - nodes: X`
- Vérifier que le dossier existe dans l'arbre : `🟡 [WEBSOCKET] Node exists in tree: true/false`

### Problème 2 : Tout l'arbre s'ouvre
**Symptômes :**
- Tous les dossiers s'ouvrent après création
- Logs : `🔵 [CREATE FOLDER] Expanded path:` montre trop de dossiers

**Vérifications :**
- Vérifier que `findPathToNode` retourne uniquement le chemin nécessaire
- Vérifier que `setExpanded` ne met pas tous les dossiers à `true`

### Problème 3 : Le dossier n'est pas sélectionné
**Symptômes :**
- Le dossier apparaît mais n'est pas sélectionné
- Logs : `❌ [PENDING SELECTION] NOT FOUND in tree`

**Vérifications :**
- Vérifier que `pendingSelection` est défini avec le bon ID
- Vérifier que `findAndSelectNode` trouve le nœud dans l'arbre
- Vérifier que `setSelected([foundNode])` est appelé

## 📊 Logs à surveiller

### Logs de création
```
🔵 [CREATE FOLDER] Starting - name: test, parentId: folder-guides, workspace: demo
🔵 [CREATE FOLDER] Path to parent: ['folder-guides']
🔵 [CREATE FOLDER] Expanded path: ['folder-guides']
🔵 [CREATE FOLDER] Calling API with: {...}
✅ [CREATE FOLDER] SUCCESS - Folder created: test ID: folder-xxx
✅ [CREATE FOLDER] Set pendingSelection: folder-xxx
```

### Logs WebSocket
```
🟡 [WEBSOCKET] tree_changed received - currentExpanded: {...}, pendingSelection: folder-xxx
🟡 [WEBSOCKET] Tree reloaded - nodes: X
🟡 [WEBSOCKET] Processing pendingSelection: folder-xxx
✅ [WEBSOCKET] Found pendingSelection node: test folder-xxx
🟡 [WEBSOCKET] Path to pendingSelection: ['folder-guides']
🟡 [WEBSOCKET] Expanded path: ['folder-guides']
✅ [WEBSOCKET] Selected folder: test folder-xxx
```

### Logs de sélection
```
🟢 [PENDING SELECTION] Processing: folder-xxx
🟢 [PENDING SELECTION] Path to node: ['folder-guides']
✅ [PENDING SELECTION] Found folder: test folder-xxx
✅ [PENDING SELECTION] Selected folder: test folder-xxx
```

## ✅ Checklist de validation

- [ ] Le dossier apparaît dans l'arbre après création
- [ ] Seuls les niveaux nécessaires sont ouverts
- [ ] Le dossier créé est automatiquement sélectionné
- [ ] Les logs montrent le processus complet
- [ ] Pas d'erreurs dans la console
- [ ] Le WebSocket fonctionne (arbre mis à jour en temps réel)

## 🔧 En cas de problème

1. **Vérifier les logs** dans la console (F12)
2. **Vérifier le réseau** (onglet Network) pour voir les appels API
3. **Vérifier les WebSockets** (onglet Network > WS) pour voir les événements
4. **Relancer le test** après avoir nettoyé la console

## 📝 Notes

- Les logs utilisent des emojis pour faciliter le débogage :
  - 🔵 = Création de dossier
  - 🟡 = WebSocket
  - ✅ = Succès
  - ❌ = Erreur
  - 🟢 = Sélection en attente

