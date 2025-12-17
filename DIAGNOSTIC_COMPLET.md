# 🔍 Diagnostic Complet - MarkD v2

**Date:** 2025-01-31  
**Problème principal:** Authentification échoue avec 401 sur l'URL publique

---

## ✅ État Actuel

### Services Actifs
- ✅ **Backend** : Port 8200 (Python/uvicorn) - **ACTIF**
- ⚠️ **Frontend** : Port 5273 - **ACTIF** mais problèmes de connexion
- ✅ **Nginx** : Configuration OK, syntaxe valide

### Tests Réussis
- ✅ Login via `curl` local : **200 OK**
- ✅ Login via `curl` public : **200 OK**  
- ✅ `/api/auth/me` fonctionne (logs récents montrent 200 OK)

---

## ❌ Problèmes Identifiés

### 1. Cookie `secure=False` en HTTPS ⚠️ CRITIQUE

**Fichier:** `backend/auth.py` ligne 106

```python
secure=False  # Set to True in production with HTTPS
```

**Problème:**  
Le cookie JWT est configuré avec `secure=False` alors que l'application est servie en HTTPS. Les navigateurs modernes peuvent :
- Bloquer complètement les cookies non sécurisés en HTTPS
- Afficher des warnings
- Ignorer silencieusement le cookie

**Impact:**  
Le cookie n'est pas accepté par le navigateur, donc l'authentification échoue.

**Solution:**
```python
secure=True  # ✅ Pour HTTPS
```

---

### 2. Connexion Frontend en IPv6 ❌

**Logs Nginx Error:**
```
connect() failed (111: Connection refused) while connecting to upstream, 
upstream: "http://[::1]:5273/..."
```

**Problème:**  
Nginx essaie de se connecter au frontend en IPv6 (`[::1]:5273`) mais le frontend écoute probablement en IPv4 (`127.0.0.1:5273` ou `localhost:5273`).

**Configuration actuelle:**
```nginx
location / {
    proxy_pass http://localhost:5273;  # Peut résoudre en IPv6
}
```

**Solution:**  
Forcer IPv4 :
```nginx
location / {
    proxy_pass http://127.0.0.1:5273;  # ✅ IPv4 explicite
}
```

---

### 3. Erreur 500 sur `/api/auth/me` (intermittent)

**Observation:**  
Les logs récents montrent que `/api/auth/me` fonctionne maintenant (200 OK), mais il y avait des erreurs 500 auparavant.

**Cause possible:**  
- Exception non gérée lors de la vérification du token
- Problème de connexion à la base de données
- Token malformé

**À surveiller:**  
Vérifier les logs backend en cas de nouvelle erreur.

---

### 4. Login échoue depuis le navigateur (401)

**Logs Nginx Access:**
```
POST /api/auth/login HTTP/2.0" 401 41
```

**Causes probables:**
1. **Cookie non accepté** (`secure=False` en HTTPS)
2. **Credentials non transmis** correctement
3. **CORS** bloquant la requête
4. **Mot de passe incorrect** (mais curl fonctionne, donc probablement pas ça)

**Hypothèse principale:**  
Le cookie n'est pas accepté par le navigateur à cause de `secure=False`.

---

## 🔧 Solutions à Appliquer

### Solution 1: Activer Secure Cookie (URGENT)

**Fichier:** `/apps/markd-v2/app/markd-package/backend/auth.py`

**Ligne 106:**
```python
# AVANT
secure=False  # Set to True in production with HTTPS

# APRÈS
secure=True  # ✅ Requis pour HTTPS
```

**Alternative (détection automatique):**
```python
secure=os.getenv('FORCE_SECURE_COOKIES', 'true').lower() == 'true'
```

---

### Solution 2: Forcer IPv4 pour Frontend

**Fichier:** `/etc/nginx/sites-enabled/10-markd-v2.conf`

**Ligne ~45:**
```nginx
# AVANT
location / {
    proxy_pass http://localhost:5273;
    # ...
}

# APRÈS
location / {
    proxy_pass http://127.0.0.1:5273;  # ✅ IPv4 explicite
    # ...
}
```

**Redémarrer Nginx après modification:**
```bash
nginx -t && systemctl reload nginx
```

---

### Solution 3: Vérifier CORS

**Fichier:** `backend/main.py` ligne 33

**Vérifier que:**
```python
allow_origins=['https://markd-v2.c9.ooo.ovh', 'http://localhost:5273'],
allow_credentials=True,  # ✅ Important pour les cookies
```

---

### Solution 4: Vérifier le Frontend

**Commande:**
```bash
# Vérifier sur quel port/interface le frontend écoute
netstat -tlnp | grep 5273
# ou
ss -tlnp | grep 5273
```

**Résultat attendu:**
```
tcp  0.0.0.0:5273  LISTEN  <PID>/node
```

Si c'est `127.0.0.1:5273` ou `localhost:5273`, c'est OK.

---

## 📋 Checklist de Diagnostic

### À vérifier immédiatement:

- [ ] **Cookie secure** : Changer `secure=False` → `secure=True`
- [ ] **Nginx config** : Changer `localhost:5273` → `127.0.0.1:5273`
- [ ] **CORS config** : Vérifier `allow_credentials=True`
- [ ] **Frontend actif** : Vérifier que le port 5273 écoute bien
- [ ] **Logs backend** : Surveiller les erreurs 500

### Commandes de diagnostic:

```bash
# 1. Vérifier le frontend
ss -tlnp | grep 5273

# 2. Vérifier le backend
ss -tlnp | grep 8200

# 3. Tester le login avec cookie
curl -v -X POST https://markd-v2.c9.ooo.ovh/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt

# 4. Vérifier le cookie créé
cat /tmp/cookies.txt

# 5. Tester avec le cookie
curl -v -b /tmp/cookies.txt https://markd-v2.c9.ooo.ovh/api/auth/me

# 6. Vérifier les logs Nginx
tail -f /apps/markd-v2/log/nginx-error.log

# 7. Vérifier les logs backend
tail -f /apps/markd-v2/app/markd-package/logs/backend*.log
```

---

## 🎯 Plan d'Action

### Étape 1: Corrections Immédiates (5 min)

1. ✅ Changer `secure=False` → `secure=True` dans `auth.py`
2. ✅ Changer `localhost:5273` → `127.0.0.1:5273` dans Nginx
3. ✅ Redémarrer/recharger les services

### Étape 2: Tests (5 min)

1. ✅ Tester le login via navigateur
2. ✅ Vérifier que le cookie est bien créé (DevTools)
3. ✅ Vérifier que `/api/auth/me` fonctionne

### Étape 3: Vérifications (10 min)

1. ✅ Vérifier les logs backend pour erreurs
2. ✅ Vérifier les logs Nginx pour erreurs
3. ✅ Tester tous les modules après login

---

## 📊 Résumé des Erreurs

| Problème | Fichier | Ligne | Criticité | Solution |
|----------|---------|-------|-----------|----------|
| Cookie secure=False | `backend/auth.py` | 106 | 🔴 Critique | `secure=True` |
| IPv6 connexion | `nginx conf` | ~45 | 🟡 Moyen | `127.0.0.1:5273` |
| Erreur 500 /auth/me | Backend | - | 🟢 Mineur | Surveiller logs |
| Frontend connexion | Nginx | - | 🟡 Moyen | IPv4 explicite |

---

## 🔐 Sécurité

### Recommandations

1. **Toujours utiliser `secure=True` en HTTPS**
2. **Utiliser `SameSite=None` si besoin de cross-domain**
3. **Valider les origines CORS strictement**
4. **Utiliser des cookies httponly (déjà fait ✅)**

---

**Fichiers à modifier:**
- `/apps/markd-v2/app/markd-package/backend/auth.py` (ligne 106)
- `/etc/nginx/sites-enabled/10-markd-v2.conf` (ligne ~45)

**Commandes à exécuter:**
```bash
# 1. Redémarrer le backend pour appliquer secure=True
cd /apps/markd-v2/app/markd-package/backend
# Si utilisé avec uvicorn, il redémarre automatiquement en mode --reload
# Sinon, redémarrer manuellement

# 2. Recharger Nginx
nginx -t && systemctl reload nginx
```







