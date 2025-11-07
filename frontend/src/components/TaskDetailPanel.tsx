import React, { useState, useEffect } from 'react';
import { Task, TaskComment, TaskFile, Workflow, TaskType, User } from '../types';
import { X, Calendar, Tag, Clock, Upload, Send, Trash2, Edit2, Download } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIcon from './TaskPriorityIcon';
import TaskTypeIcon from './TaskTypeIcon';
import TaskAssigneeAvatars from './TaskAssigneeAvatars';
import UserMultiSelect from './UserMultiSelect';
import WorkflowSelector from './WorkflowSelector';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface TaskDetailPanelProps {
  task: Task;
  workflows: Workflow[];
  taskTypes: TaskType[];
  onUpdate: () => void;
  onClose: () => void;
  workspaceId: string;
}

type Tab = 'details' | 'timeline' | 'comments' | 'files';

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  workflows,
  taskTypes,
  onUpdate,
  onClose,
  workspaceId,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    due_date: task.due_date || '',
    responsible_user_id: task.responsible_user_id,
    task_type_id: task.task_type_id,
    workflow_id: task.workflow_id,
  });
  
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>(
    task.assigned_users?.map(u => u.id) || []
  );
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [newTag, setNewTag] = useState('');
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (activeTab === 'timeline' || activeTab === 'comments') {
      loadComments();
    }
  }, [activeTab, task.id]);

  useEffect(() => {
    if (activeTab === 'files') {
      loadFiles();
    }
  }, [activeTab, task.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const response = await api.getComments(task.id);
      setComments(response.comments);
    } catch (error) {
      toast.error('Erreur lors du chargement des commentaires');
    } finally {
      setLoadingComments(false);
    }
  };

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const response = await api.getTaskFiles(task.id);
      setFiles(response.files);
    } catch (error) {
      toast.error('Erreur lors du chargement des fichiers');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.updateTask(task.id, editData);
      
      // Update assignments
      await api.assignUsers(task.id, assignedUserIds, editData.responsible_user_id || undefined);
      
      // Update tags (simple approach: delete all and recreate)
      const currentTags = task.tags || [];
      for (const tag of currentTags) {
        if (!tags.includes(tag)) {
          await api.removeTag(task.id, tag);
        }
      }
      for (const tag of tags) {
        if (!currentTags.includes(tag)) {
          await api.addTag(task.id, tag);
        }
      }
      
      toast.success('Tâche mise à jour');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await api.addComment(task.id, newComment);
      setNewComment('');
      loadComments();
      toast.success('Commentaire ajouté');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout du commentaire');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.deleteComment(task.id, commentId);
      loadComments();
      toast.success('Commentaire supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadTaskFile(task.id, file);
      loadFiles();
      toast.success('Fichier uploadé');
    } catch (error) {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    try {
      await api.deleteTaskFile(task.id, fileId);
      loadFiles();
      toast.success('Fichier supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const timelineComments = comments.filter(c => c.type === 'system');
  const userComments = comments.filter(c => c.type === 'comment');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <TaskTypeIcon
            icon={task.type_icon}
            color={task.type_color}
            name={task.type_name || 'Task'}
          />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {task.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'details' as Tab, label: 'Détails' },
          { key: 'timeline' as Tab, label: 'Timeline' },
          { key: 'comments' as Tab, label: 'Commentaires' },
          { key: 'files' as Tab, label: 'Fichiers' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Titre
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.title}
                  onChange={e => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{task.title}</div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              {isEditing ? (
                <MDEditor
                  value={editData.description}
                  onChange={value => setEditData({ ...editData, description: value || '' })}
                  height={200}
                  preview="edit"
                />
              ) : (
                <MDEditor.Markdown
                  source={task.description || '_Aucune description_'}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                />
              )}
            </div>

            {/* Workflow and Status */}
            {isEditing ? (
              <WorkflowSelector
                workflows={workflows}
                selectedWorkflowId={editData.workflow_id}
                currentStatus={editData.status}
                onWorkflowChange={workflow_id => setEditData({ ...editData, workflow_id })}
                onStatusChange={status => setEditData({ ...editData, status })}
              />
            ) : (
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Workflow
                  </label>
                  <div>{task.workflow_name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  {task.workflow_statuses && (
                    <TaskStatusBadge status={task.status} workflowStatuses={task.workflow_statuses} />
                  )}
                </div>
              </div>
            )}

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priorité
              </label>
              {isEditing ? (
                <select
                  value={editData.priority}
                  onChange={e => setEditData({ ...editData, priority: e.target.value as any })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                </select>
              ) : (
                <TaskPriorityIcon priority={task.priority} size={20} showLabel />
              )}
            </div>

            {/* Due date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date d'échéance
              </label>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editData.due_date}
                  onChange={e => setEditData({ ...editData, due_date: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  {task.due_date ? formatDate(task.due_date) : 'Aucune'}
                </div>
              )}
            </div>

            {/* Assignees */}
            {isEditing ? (
              <UserMultiSelect
                selectedUserIds={assignedUserIds}
                responsibleUserId={editData.responsible_user_id}
                onSelectionChange={(userIds, responsibleId) => {
                  setAssignedUserIds(userIds);
                  setEditData({ ...editData, responsible_user_id: responsibleId || null });
                }}
                workspaceId={workspaceId}
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assignés
                </label>
                <TaskAssigneeAvatars
                  assignedUsers={task.assigned_users || []}
                  responsibleUserId={task.responsible_user_id}
                  maxDisplay={5}
                  size="md"
                />
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 rounded text-sm flex items-center gap-1"
                  >
                    <Tag size={12} />
                    {tag}
                    {isEditing && (
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1">
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Nouveau tag..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Ajouter
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Modifier
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {loadingComments ? (
              <div className="text-center text-gray-400">Chargement...</div>
            ) : timelineComments.length === 0 ? (
              <div className="text-center text-gray-400">Aucun événement</div>
            ) : (
              timelineComments.map(comment => (
                <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Clock size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{comment.content}</div>
                    <div className="text-xs text-gray-400 mt-1">{formatDate(comment.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Add comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ajouter un commentaire
              </label>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Écrivez votre commentaire (Markdown supporté)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100 min-h-[100px]"
              />
              <button
                onClick={handleAddComment}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Send size={16} />
                Envoyer
              </button>
            </div>

            {/* Comments list */}
            <div className="space-y-3">
              {loadingComments ? (
                <div className="text-center text-gray-400">Chargement...</div>
              ) : userComments.length === 0 ? (
                <div className="text-center text-gray-400">Aucun commentaire</div>
              ) : (
                userComments.map(comment => (
                  <div key={comment.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {comment.username}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                    <MDEditor.Markdown
                      source={comment.content}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ajouter un fichier
              </label>
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full"
              />
              {uploading && <div className="text-sm text-gray-400 mt-2">Upload en cours...</div>}
            </div>

            {/* Files list */}
            <div className="space-y-2">
              {loadingFiles ? (
                <div className="text-center text-gray-400">Chargement...</div>
              ) : files.length === 0 ? (
                <div className="text-center text-gray-400">Aucun fichier</div>
              ) : (
                files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Upload size={20} className="text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {file.filename}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatFileSize(file.file_size)} • {file.username} • {formatDate(file.uploaded_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={file.file_path}
                        download
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <Download size={16} className="text-blue-500" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailPanel;

