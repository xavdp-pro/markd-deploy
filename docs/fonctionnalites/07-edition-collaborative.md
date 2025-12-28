# Édition Collaborative avec Yjs

## Vue d'ensemble

MarkD utilise **Yjs** pour permettre l'édition collaborative en temps réel des documents. Plusieurs utilisateurs (humains et agents MCP) peuvent modifier le même document simultanément sans conflits.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Yjs WebSocket Server                      │
│                    (Node.js - Port 1234)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│   │  Navigateur │  │  Navigateur │  │  Agent MCP  │         │
│   │  (React)    │  │  (React)    │  │  (Python)   │         │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│          │                │                │                 │
│          └────────────────┼────────────────┘                 │
│                           ▼                                  │
│   ┌──────────────────────────────────────────────────┐      │
│   │              Y.Doc (Document partagé)             │      │
│   │  - Synchronisation CRDT                          │      │
│   │  - Résolution automatique des conflits           │      │
│   │  - Awareness (présence utilisateurs)             │      │
│   └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Composants

### 1. Serveur Yjs (`yjs-server/`)

Serveur WebSocket Node.js qui gère la synchronisation des documents.

**Démarrage:**
```bash
cd yjs-server
npm install
npm start
```

**Endpoints:**
- `ws://localhost:1234` - WebSocket pour la synchronisation
- `http://localhost:1234/health` - Vérification de santé
- `http://localhost:1234/stats` - Statistiques des connexions

### 2. Hook useYjs (`frontend/src/hooks/useYjs.ts`)

Hook React pour l'intégration Yjs dans les composants.

**Usage:**
```typescript
const { content, setContent, users, isConnected, isSynced } = useYjs({
  documentId: 'doc-123',
  userId: 'user-456',
  userName: 'Jean Dupont',
  initialContent: '# Mon document',
});
```

### 3. Éditeur Collaboratif (`frontend/src/components/CollaborativeEditor.tsx`)

Composant d'édition Markdown avec synchronisation temps réel.

**Fonctionnalités:**
- Édition simultanée par plusieurs utilisateurs
- Affichage des collaborateurs connectés
- Indicateur de connexion/synchronisation
- Support images et tags

### 4. Client Python (`backend/yjs_client.py`)

Client Yjs pour les agents MCP.

**Usage:**
```python
from yjs_client import YjsClient

async with YjsClient(
    document_id="doc-123",
    agent_name="Documentation Bot",
) as client:
    # Lire le contenu
    content = client.get_content()
    
    # Ajouter du contenu
    await client.append_text("\n## Nouvelle section\n")
    
    # Remplacer le contenu
    await client.set_content("Nouveau contenu complet")
```

## Configuration

### Variables d'environnement

**Frontend (`.env`):**
```
VITE_YJS_WS_URL=ws://localhost:1234
```

**Yjs Server (`yjs-server/.env`):**
```
YJS_PORT=1234
YJS_HOST=0.0.0.0
```

## Démarrage

### Mode développement

```bash
# Terminal 1: Backend principal
./start-backend.sh

# Terminal 2: Frontend
./start-frontend.sh

# Terminal 3: Serveur Yjs
./start-yjs.sh
```

### Tout en un

```bash
./start.sh
```

## Avantages par rapport au verrouillage

| Aspect | Verrouillage | Yjs Collaboratif |
|--------|-------------|------------------|
| Édition simultanée | ❌ Un seul utilisateur | ✅ Multiples utilisateurs |
| Conflits | ❌ Bloquant | ✅ Résolus automatiquement |
| Temps réel | ❌ Après sauvegarde | ✅ Instantané |
| Agents MCP | ❌ Doivent attendre | ✅ Éditent en parallèle |
| Offline | ❌ Non supporté | ✅ Synchronisation au retour |

## Sécurité

- Les connexions WebSocket passent par l'authentification du backend
- Les agents MCP utilisent des tokens dédiés
- Les modifications sont tracées via l'awareness Yjs

## Dépannage

### Le serveur Yjs ne démarre pas

```bash
cd yjs-server
rm -rf node_modules
npm install
npm start
```

### Pas de synchronisation

1. Vérifier que le serveur Yjs est en cours d'exécution
2. Vérifier l'URL WebSocket dans la console du navigateur
3. Vérifier les logs: `http://localhost:1234/stats`

### Conflits de contenu

Yjs résout automatiquement les conflits. Si le contenu semble incorrect :
1. Rafraîchir la page
2. Vérifier que tous les clients utilisent le même `documentId`
