# Activity Logging - Implémentation TODO

## ✅ Complété

### Backend
1. ✅ Créé `activity_logger.py` avec fonctions:
   - `log_activity()` - Enregistre une activité
   - `get_activity_logs()` - Récupère les logs avec filtres
   - `get_activity_stats()` - Statistiques d'activité

2. ✅ Créé `admin_routes.py` avec endpoints API:
   - `GET /api/admin/activity-logs` - Liste des logs (avec filtres)
   - `GET /api/admin/activity-stats` - Statistiques
   - `GET /api/admin/activity-logs/export` - Export CSV

3. ✅ Intégré dans `main.py`:
   - Import de `activity_logger`
   - Inclusion du router `admin_routes`
   - Ajouté logging dans `create_document`

4. ✅ Tables de base de données (déjà créées):
   - `document_activity_log`
   - `task_activity_log`
   - `password_activity_log`

## 🔄 À Compléter

### Backend - Ajouter `log_activity()` dans les routes suivantes:

#### Documents (`main.py`)
- [ ] `PUT /api/documents/{document_id}` (ligne ~1020) - action: 'update'
- [ ] `DELETE /api/documents/{document_id}` (ligne ~1086) - action: 'delete'
- [ ] `POST /api/documents/{document_id}/move` (chercher cette route) - action: 'move'
- [ ] `PUT /api/documents/{document_id}/rename` (si existe) - action: 'rename'

#### Tasks (`tasks_simple.py`)
- [ ] Créer/Update/Delete/Move tasks
- [ ] Chercher toutes les routes CRUD dans `tasks_simple.py`

#### Passwords (`vault.py`)
- [ ] Créer/Update/Delete/Move passwords
- [ ] Chercher toutes les routes CRUD dans `vault.py`

### Frontend - Créer l'interface d'administration

#### 1. Créer `ActivityLogsPage.tsx`
```tsx
// /apps/markd-v2/app/markd-package/frontend/src/pages/ActivityLogsPage.tsx

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Header from '../components/layout/Header';

interface ActivityLog {
  id: string;
  user_id: number;
  username: string;
  user_email: string;
  workspace_id: string;
  item_id: string;
  item_type: 'document' | 'task' | 'password';
  action: string;
  item_name: string;
  item_path?: string;
  created_at: string;
}

const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    item_type: '',
    action: '',
    user_id: '',
    workspace_id: '',
    start_date: '',
    end_date: ''
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [filters, page]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      });
      
      const response = await fetch(`/api/admin/activity-logs?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      )
    );
    window.open(`/api/admin/activity-logs/export?${params}`, '_blank');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Activity Logs
            </h1>
            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Export CSV
            </button>
          </div>

          {/* Filtres */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Filters
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filters.item_type}
                onChange={(e) => setFilters({...filters, item_type: e.target.value})}
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">All Types</option>
                <option value="document">Documents</option>
                <option value="task">Tasks</option>
                <option value="password">Passwords</option>
              </select>

              <select
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="move">Move</option>
                <option value="rename">Rename</option>
              </select>

              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Start Date"
              />
            </div>
          </div>

          {/* Tableau */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Item
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {log.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.item_type === 'document' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        log.item_type === 'task' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        {log.item_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {log.item_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-700 dark:text-gray-300">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={logs.length < limit}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsPage;
```

#### 2. Ajouter la route dans `App.tsx`
```tsx
import ActivityLogsPage from './pages/ActivityLogsPage';

// Dans les routes:
<Route
  path="/admin/activity-logs"
  element={
    <ProtectedRoute>
      <ActivityLogsPage />
    </ProtectedRoute>
  }
/>
```

#### 3. Ajouter un lien dans le menu admin (`Header.tsx`)
```tsx
<button onClick={() => navigate('/admin/activity-logs')}>
  Activity Logs
</button>
```

## 📝 Exemple d'intégration dans une route

```python
# Dans main.py, vault.py, ou tasks_simple.py

from activity_logger import log_activity

@app.post("/api/documents")
async def create_document(...):
    # ... code existant ...
    
    # Après la création réussie:
    log_activity(
        user_id=user['id'],
        workspace_id=document.workspace_id,
        item_id=doc_id,
        action='create',  # ou 'update', 'delete', 'move', 'rename'
        item_type='document',  # ou 'task', 'password'
        item_name=document.name,
        item_path=None  # optionnel
    )
    
    return {"success": True, ...}
```

## 🧪 Tests à effectuer

1. Créer/modifier/supprimer un document → Vérifier que l'activité est loggée
2. Créer/modifier/supprimer une tâche → Vérifier que l'activité est loggée
3. Créer/modifier/supprimer un mot de passe → Vérifier que l'activité est loggée
4. Accéder à `/admin/activity-logs` en tant qu'admin → Voir les logs
5. Tester les filtres (type, action, date)
6. Tester l'export CSV
7. Vérifier que les non-admins n'ont pas accès (403)

## 🚀 Prochaines étapes

1. Redémarrer le backend pour charger les nouveaux modules
2. Ajouter `log_activity()` dans toutes les routes CRUD
3. Créer la page frontend `ActivityLogsPage.tsx`
4. Tester l'ensemble du système
