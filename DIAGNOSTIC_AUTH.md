# 🔍 Diagnostic - Problème d'Authentification

**Date:** 2025-01-31  
**Problème:** Authentification échoue avec 401 sur l'URL publique

---

## ✅ Ce qui fonctionne

1. **Backend actif** : Le processus Python/uvicorn est en cours d'exécution sur le port 8200
2. **Login via curl local** : `curl http://localhost:8200/api/auth/login` → ✅ **200 OK**
3. **Login via curl public** : `curl https://markd-v2.c9.ooo.ovh/api/auth/login` → ✅ **200 OK**
4. **Configuration Nginx** : Syntaxe correcte, serveur configuré

---

## ❌ Problèmes identifiés

### 1. Cookie `secure=False` en HTTPS

**Fichier:** `backend/auth.py` ligne 106

**Problème:**
```python
secure=False  # Set to True in production with HTTPS
```

Le cookie est configuré avec `secure=False` alors que l'application est servie en HTTPS. Les navigateurs modernes peuvent bloquer les cookies non sécurisés en HTTPS ou les ignorer.

**Impact:** Le cookie JWT n'est peut-être pas accepté par le navigateur.

**Solution:** Mettre `secure=True` en production.

---

### 2. Erreur 500 sur `/api/auth/me`

**Logs Nginx:**
```
GET /api/auth/me HTTP/2.0" 500 13
```

**Test local:**
```bash
curl http://localhost:8200/api/auth/me
# Résultat: {"detail":""}
```

L'endpoint `/api/auth/me` retourne une erreur 500 avec un message vide. Cela peut indiquer un problème dans le code d'authentification.

**À vérifier:** Les logs backend pour voir l'erreur exacte.

---

### 3. Problème de connexion Frontend (IPv6)

**Logs Nginx Error:**
```
connect() failed (111: Connection refused) while connecting to upstream, 
upstream: "http://[::1]:5273/..."
```

Nginx essaie de se connecter au frontend en IPv6 (`[::1]:5273`) mais le frontend écoute probablement en IPv4 (`localhost:5273`).

**Configuration actuelle:**
```nginx
location / {
    proxy_pass http://localhost:5273;  # Peut résoudre en IPv6
}
```

**Solution:** Forcer IPv4 avec `127.0.0.1:5273` au lieu de `localhost:5273`.

---

### 4. Login échoue depuis le navigateur

**Logs Nginx Access:**
```
POST /api/auth/login HTTP/2.0" 401 41
```

Le login via navigateur retourne 401, alors que curl fonctionne (200).

**Causes possibles:**
1. Cookie non accepté (`secure=False`)
2. Cookies bloqués par le navigateur
3. CORS ou headers manquants
4. Problème avec les credentials

---

## 🔧 Solutions à Appliquer

### Solution 1: Activer Secure Cookie

**Fichier:** `backend/auth.py`

```python
response.set_cookie(
    key="markd_auth",
    value=token,
    httponly=True,
    max_age=7 * 24 * 60 * 60,
    samesite="lax",
    secure=True  # ✅ CHANGER ICI pour HTTPS
)
```

### Solution 2: Forcer IPv4 pour le Frontend

**Fichier:** `/etc/nginx/sites-enabled/10-markd-v2.conf`

```nginx
# Frontend (React/Vite on port 5273)
location / {
    proxy_pass http://127.0.0.1:5273;  # ✅ Utiliser 127.0.0.1 au lieu de localhost
    # ... reste de la config
}
```

### Solution 3: Ajouter CORS pour les cookies

**Vérifier:** `backend/main.py` - Configuration CORS

S'assurer que les headers CORS permettent les credentials :
```python
allow_credentials=True,
allow_origins=['https://markd-v2.c9.ooo.ovh']
```

---

## 📋 Checklist de Diagnostic

### À vérifier immédiatement:

- [ ] Les logs backend pour l'erreur 500 sur `/api/auth/me`
- [ ] Le frontend écoute bien sur le port 5273
- [ ] Les cookies sont bien envoyés dans les requêtes (DevTools)
- [ ] La configuration CORS permet les credentials

### Commandes de diagnostic:

```bash
# 1. Vérifier le frontend
netstat -tlnp | grep 5273
# ou
ss -tlnp | grep 5273

# 2. Vérifier les logs backend
tail -f /apps/markd-v2/app/markd-package/logs/backend*.log

# 3. Tester le cookie
curl -v -X POST https://markd-v2.c9.ooo.ovh/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt

# 4. Vérifier la réception du cookie
cat /tmp/cookies.txt

# 5. Tester avec le cookie
curl -v -b /tmp/cookies.txt https://markd-v2.c9.ooo.ovh/api/auth/me
```

---

## 🎯 Prochaines Étapes

1. **Corriger le cookie secure** → `secure=True`
2. **Corriger l'adresse frontend** → `127.0.0.1:5273`
3. **Vérifier les logs backend** pour l'erreur 500
4. **Tester avec les corrections** appliquées

---

## 📊 Résumé des Erreurs

| Endpoint | Méthode | Curl | Navigateur | Status |
|----------|---------|------|------------|--------|
| `/api/auth/login` | POST | ✅ 200 | ❌ 401 | Cookie non accepté |
| `/api/auth/me` | GET | ❌ 500 | ❌ 500 | Erreur serveur |
| Frontend | GET | - | ⚠️ Erreurs | IPv6 connexion refusée |

---

**Fichiers à modifier:**
- `/apps/markd-v2/app/markd-package/backend/auth.py` (ligne 106)
- `/etc/nginx/sites-enabled/10-markd-v2.conf` (ligne ~45)







