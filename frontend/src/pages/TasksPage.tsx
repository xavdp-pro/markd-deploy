import React, { useState, useEffect, useCallback } from 'react';
import { Task, TaskType, Workflow, User } from '../types';
import { api } from '../services/api';
import { websocket } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import TaskTree from '../components/TaskTree';
import TaskDetailPanel from '../components/TaskDetailPanel';
import InputModal from '../components/InputModal';
import ConfirmModal from '../components/ConfirmModal';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  user_permission?: string;
}

const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [workspaceName, setWorkspaceName] = useState<string>('Tasks');
  const [userPermission, setUserPermission] = useState<string>('read');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('markd_tasks_tree_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  

  // Load workspaces
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load data when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadTasksTree();
      loadTaskTypes();
      loadWorkflows();
    }
  }, [currentWorkspace]);

  // WebSocket integration
  useEffect(() => {
    websocket.connect();

    const unsubscribeUpdated = websocket.onTaskUpdated(() => {
      loadTasksTree();
    });

    const unsubscribeStatusChanged = websocket.onTaskStatusChanged(data => {
      toast.success(`${data.user_name} a changé le statut de "${data.task_title}"`);
      loadTasksTree();
    });

    const unsubscribeCommentAdded = websocket.onTaskCommentAdded(data => {
      toast('Nouveau commentaire ajouté', { icon: '💬' });
      // Refresh if viewing this task
      if (selectedTask?.id === data.task_id) {
        loadTask(data.task_id);
      }
    });

    const unsubscribeAssigned = websocket.onTaskAssigned(data => {
      toast(`${data.user_name} a été assigné à une tâche`, { icon: '👤' });
      loadTasksTree();
    });

    const unsubscribeMoved = websocket.onTaskMoved(() => {
      loadTasksTree();
    });

    return () => {
      unsubscribeUpdated();
      unsubscribeStatusChanged();
      unsubscribeCommentAdded();
      unsubscribeAssigned();
      unsubscribeMoved();
    };
  }, [selectedTask]);

  // Save tree width to localStorage
  useEffect(() => {
    localStorage.setItem('markd_tasks_tree_width', treeWidth.toString());
  }, [treeWidth]);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        const accessible = data.workspaces.filter((ws: any) => ws.user_permission && ws.user_permission !== 'none');
        setWorkspaces(accessible);
        if (accessible.length > 0) {
          setCurrentWorkspace(accessible[0].id);
          setWorkspaceName(accessible[0].name);
          setUserPermission(accessible[0].user_permission);
        }
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des workspaces');
    }
  };

  const loadTasksTree = async () => {
    setLoading(true);
    try {
      const response = await api.getTasksTree(currentWorkspace);
      setTasks(response.tasks);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskTypes = async () => {
    try {
      const response = await api.getTaskTypes(currentWorkspace);
      setTaskTypes(response.task_types);
    } catch (error) {
      console.error('Error loading task types:', error);
    }
  };

  const loadWorkflows = async () => {
    try {
      const response = await api.getWorkflows(currentWorkspace);
      setWorkflows(response.workflows);
    } catch (error) {
      console.error('Error loading workflows:', error);
    }
  };

  const loadTask = async (taskId: string) => {
    try {
      const response = await api.getTask(taskId);
      setSelectedTask(response.task);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du chargement de la tâche');
      console.error('Error loading task:', error);
    }
  };

  const handleCreateTask = async (parentId: string | null, title: string) => {
    const defaultWorkflow = workflows.find(w => w.is_default) || workflows[0];
    if (!defaultWorkflow) {
      toast.error('Aucun workflow disponible');
      return;
    }

    // Default task type = "Task" (id 3)
    const defaultTaskType = taskTypes.find(t => t.name === 'Task') || taskTypes[0];
    if (!defaultTaskType) {
      toast.error('Aucun type de tâche disponible');
      return;
    }

    const defaultStatus = defaultWorkflow.statuses[0]?.key || 'todo';

    try {
      const response = await api.createTask({
        workspace_id: currentWorkspace,
        parent_id: parentId,
        task_type_id: defaultTaskType.id,
        workflow_id: defaultWorkflow.id,
        title,
        status: defaultStatus,
        priority: 'medium',
      });

      toast.success('Tâche créée');
      loadTasksTree();
      websocket.notifyTaskUpdated({ action: 'created', task_id: response.id });
      
      // Auto-expand parent
      if (parentId) {
        setExpanded(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleCreateFolder = async (parentId: string | null, title: string) => {
    // For now, folders are just tasks with a special type
    // We could add a "Folder" type or just use Epic
    const folderType = taskTypes.find(t => t.name === 'Epic') || taskTypes[0];
    const defaultWorkflow = workflows.find(w => w.is_default) || workflows[0];

    try {
      const response = await api.createTask({
        workspace_id: currentWorkspace,
        parent_id: parentId,
        task_type_id: folderType.id,
        workflow_id: defaultWorkflow.id,
        title,
        description: '_Dossier de tâches_',
        status: defaultWorkflow.statuses[0]?.key || 'todo',
        priority: 'medium',
      });

      toast.success('Dossier créé');
      loadTasksTree();
      websocket.notifyTaskUpdated({ action: 'created', task_id: response.id });
      
      if (parentId) {
        setExpanded(prev => ({ ...prev, [parentId]: true }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    }
  };

  const handleRenameTask = async (taskId: string, newTitle: string) => {
    try {
      await api.updateTask(taskId, { title: newTitle });
      toast.success('Tâche renommée');
      loadTasksTree();
      websocket.notifyTaskUpdated({ action: 'renamed', task_id: taskId });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du renommage');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      toast.success('Tâche supprimée');
      loadTasksTree();
      websocket.notifyTaskUpdated({ action: 'deleted', task_id: taskId });
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleDuplicateTask = async (taskId: string) => {
    try {
      const response = await api.duplicateTask(taskId);
      toast.success('Tâche dupliquée');
      loadTasksTree();
      websocket.notifyTaskUpdated({ action: 'duplicated', task_id: response.id });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la duplication');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newParentId = over.id === 'root' ? null : (over.id as string);

    try {
      await api.moveTask(taskId, newParentId);
      loadTasksTree();
      websocket.notifyTaskMoved({ task_id: taskId, parent_id: newParentId });
      toast.success('Tâche déplacée');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du déplacement');
    }
  };

  const handleToggle = (taskId: string) => {
    setExpanded(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleTaskUpdate = () => {
    loadTasksTree();
    if (selectedTask) {
      loadTask(selectedTask.id);
    }
  };

  const findTaskById = (taskList: Task[], id: string): Task | null => {
    for (const task of taskList) {
      if (task.id === id) return task;
      if (task.children) {
        const found = findTaskById(task.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleResize = useCallback((e: MouseEvent) => {
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      setTreeWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleResize, handleMouseUp]);

  const allTaskIds = React.useMemo(() => {
    const collectIds = (taskList: Task[]): string[] => {
      let ids: string[] = [];
      for (const task of taskList) {
        ids.push(task.id);
        if (task.children) {
          ids = ids.concat(collectIds(task.children));
        }
      }
      return ids;
    };
    return ['root', ...collectIds(tasks)];
  }, [tasks]);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 flex-col">
      {/* Header with workspace selector */}
      <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Workspace:</label>
          <select
            value={currentWorkspace}
            onChange={e => {
              const ws = workspaces.find(w => w.id === e.target.value);
              if (ws) {
                setCurrentWorkspace(ws.id);
                setWorkspaceName(ws.name);
                setUserPermission(ws.user_permission || 'read');
                setSelectedTask(null);
              }
            }}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          >
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Permission: {userPermission}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 w-full overflow-hidden">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
            {/* Task Tree */}
            <div
              style={{ width: `${treeWidth}px` }}
              className="flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full relative"
            >
              <TaskTree
                tasks={tasks}
                selectedTask={selectedTask}
                onSelect={task => {
                  setSelectedTask(task);
                  loadTask(task.id);
                }}
                onCreateTask={handleCreateTask}
                onCreateFolder={handleCreateFolder}
                onRenameTask={handleRenameTask}
                onDeleteTask={handleDeleteTask}
                onDuplicateTask={handleDuplicateTask}
                expanded={expanded}
                onToggle={handleToggle}
                className="flex-1 overflow-hidden flex flex-col"
              />

              {/* Resize handle */}
              <div
                onMouseDown={() => setIsResizing(true)}
                className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 ${
                  isResizing ? 'bg-blue-500' : ''
                }`}
              />
            </div>
          </SortableContext>
        </DndContext>

        {/* Task Detail Panel */}
        <div className="flex-1 overflow-hidden">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              workflows={workflows}
              taskTypes={taskTypes}
              onUpdate={handleTaskUpdate}
              onClose={() => setSelectedTask(null)}
              workspaceId={currentWorkspace}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-6xl mb-4">📋</div>
                <div className="text-lg">Sélectionnez une tâche pour voir les détails</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="text-gray-900 dark:text-gray-100">Chargement...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;

