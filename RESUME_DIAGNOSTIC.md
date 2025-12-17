# 📋 Résumé du Diagnostic - MarkD v2

**Date:** 2025-01-31  
**Problème:** Authentification échoue avec 401 sur l'URL publique

---

## 🎯 Problème Principal

Le login fonctionne via `curl` mais échoue depuis le navigateur avec une erreur 401.

---

## 🔴 Cause Principale Identifiée

### Cookie `secure=False` en HTTPS

**Fichier:** `backend/auth.py` ligne 106

Le cookie JWT est configuré avec `secure=False` alors que l'application est servie en HTTPS. Les navigateurs modernes bloquent les cookies non sécurisés en HTTPS, ce qui empêche l'authentification.

---

## ✅ Solutions à Appliquer

### 1. Corriger le Cookie Secure (URGENT)

**Fichier:** `/apps/markd-v2/app/markd-package/backend/auth.py`

```python
# Ligne 106 - CHANGER:
secure=False  # ❌

# EN:
secure=True  # ✅
```

### 2. Forcer IPv4 pour Frontend (Optionnel mais recommandé)

**Fichier:** `/etc/nginx/sites-enabled/10-markd-v2.conf`

```nginx
# Ligne 50 - CHANGER:
proxy_pass http://localhost:5273;  # Peut résoudre en IPv6

# EN:
proxy_pass http://127.0.0.1:5273;  # IPv4 explicite
```

Puis recharger Nginx :
```bash
nginx -t && systemctl reload nginx
```

---

## 📝 Commandes Rapides

```bash
# 1. Corriger le cookie
cd /apps/markd-v2/app/markd-package/backend
sed -i 's/secure=False/secure=True/' auth.py

# 2. Corriger Nginx (si nécessaire)
sed -i 's|proxy_pass http://localhost:5273;|proxy_pass http://127.0.0.1:5273;|' /etc/nginx/sites-enabled/10-markd-v2.conf
nginx -t && systemctl reload nginx

# 3. Vérifier que ça fonctionne
curl -v -X POST https://markd-v2.c9.ooo.ovh/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c /tmp/cookies.txt
```

---

## 🔍 Tests Effectués

- ✅ Backend actif sur port 8200
- ✅ Login fonctionne via curl (local et public)
- ✅ Configuration Nginx correcte
- ❌ Login échoue depuis navigateur (cookie non accepté)

---

## 📚 Documentation Complète

Voir `DIAGNOSTIC_COMPLET.md` pour le diagnostic détaillé.

---

**Action immédiate requise:** Changer `secure=False` → `secure=True` dans `auth.py`







