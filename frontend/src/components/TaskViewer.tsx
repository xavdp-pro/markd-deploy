import React, { useEffect, useState } from 'react';
import { FileEdit, Lock, Unlock, Link } from 'lucide-react';
import toast from 'react-hot-toast';
import MDEditor from '@uiw/react-md-editor';
import { Task, TaskTimelineItem, TaskComment, TaskTag, TaskAssignee, TaskFile, TaskChecklistItem } from '../types';
import TaskMetadataPanel from './TaskMetadataPanel';
import TaskTimeline from './TaskTimeline';
import TaskComments from './TaskComments';
import TaskFiles from './TaskFiles';
import TaskChecklist from './TaskChecklist';
import PresenceAvatars from './PresenceAvatars';
import MarkdownLinkHandler from './MarkdownLinkHandler';

interface TaskViewerProps {
  task: Task;
  onEdit: () => void;
  canEdit?: boolean;
  lockedByOther?: boolean;
  currentUserId?: string;
  presenceUsers?: Array<{ id: string; username: string }>;
  onUnlock?: () => void;
  isEditing?: boolean;
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: 'low' | 'medium' | 'high') => void;
  onDueDateChange?: (isoDate: string | null) => void;
  tags?: TaskTag[];
  availableTags?: TaskTag[];
  onAddTag?: (name: string) => Promise<void>;
  onRemoveTag?: (tagId: string) => Promise<void>;
  assignees?: TaskAssignee[];
  responsibleId?: number | null;
  onAssigneesChange?: (userIds: number[], responsibleId?: number) => void;
  workspaceId?: string;
  timeline: TaskTimelineItem[];
  timelineLoading?: boolean;
  onAddTimelineEntry?: (entry: { title: string; description?: string }) => Promise<void>;
  comments: TaskComment[];
  commentsLoading?: boolean;
  onAddComment?: (content: string) => Promise<void>;
  canCollaborate?: boolean;
  files?: TaskFile[];
  filesLoading?: boolean;
  onUploadFile?: (file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  onUpdateFileNote?: (fileId: string, note: string) => Promise<void>;
  checklistItems?: TaskChecklistItem[];
  checklistLoading?: boolean;
  onAddChecklistItem?: (text: string) => Promise<void>;
  onToggleChecklistItem?: (itemId: string, completed: boolean) => Promise<void>;
  onDeleteChecklistItem?: (itemId: string) => Promise<void>;
  onUpdateChecklistItem?: (itemId: string, text: string) => Promise<void>;
}

const TaskViewer: React.FC<TaskViewerProps> = ({
  task,
  onEdit,
  canEdit = true,
  lockedByOther = false,
  // currentUserId,
  presenceUsers,
  onUnlock,
  isEditing = false,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  tags = [],
  availableTags = [],
  onAddTag,
  onRemoveTag,
  assignees = [],
  responsibleId = null,
  onAssigneesChange,
  workspaceId = 'demo',
  timeline,
  timelineLoading = false,
  onAddTimelineEntry,
  comments,
  commentsLoading = false,
  onAddComment,
  canCollaborate = true,
  files = [],
  filesLoading = false,
  onUploadFile,
  onDeleteFile,
  onUpdateFileNote,
  checklistItems = [],
  checklistLoading = false,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onUpdateChecklistItem,
}) => {
  const isLockedByMe = task.locked_by !== null && !lockedByOther;
  const canUnlock = isLockedByMe && !isEditing;
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'timeline' | 'comments' | 'files'>('details');
  const commentCount = comments.length;
  const checklistCount = checklistItems.length;
  const completedChecklistCount = checklistItems.filter(item => item.completed).length;
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');

  const copyLinkToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#task=${task.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié ! Vous pouvez le coller dans un document Markdown ou une autre tâche');
  };
  
  const copyMarkdownToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#task=${task.id}`;
    const markdown = `✅ [${task.name}](${url})`;
    navigator.clipboard.writeText(markdown);
    toast.success('Lien Markdown copié !');
  };

  useEffect(() => {
    setActiveTab(commentCount > 0 ? 'comments' : 'details');
  }, [task.id]);
  
  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {task.name}
            </h2>
            {lockedByOther && task.locked_by && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <Lock size={12} />
                Verrouillé par {task.locked_by.user_name}
              </span>
            )}
            {isLockedByMe && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <Lock size={12} />
                Verrouillé par vous
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {presenceUsers && presenceUsers.length > 0 && (
            <PresenceAvatars users={presenceUsers} />
          )}
          <button
            onClick={copyLinkToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-2"
            title="Copier le lien vers cette tâche pour le coller ailleurs"
          >
            <Link className="w-4 h-4" />
            Copier le lien
          </button>
          <button
            onClick={copyMarkdownToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Copier le lien au format Markdown : ✅ [Nom](URL)"
          >
            Markdown
          </button>
          {canUnlock && onUnlock && (
            <button
              onClick={onUnlock}
              className="px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors flex items-center gap-2"
              title="Retirer mon verrou"
            >
              <Unlock className="w-4 h-4" />
              Déverrouiller
            </button>
          )}
          {canEdit && (
            <button
              onClick={onEdit}
              disabled={lockedByOther}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
                ${lockedByOther
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow active:translate-y-0.5 dark:bg-blue-600 dark:hover:bg-blue-500'
                }
              `}
              title={isLockedByMe ? 'Reprendre l\'édition' : lockedByOther ? `Verrouillé par ${task.locked_by?.user_name}` : 'Éditer la tâche'}
            >
              <FileEdit size={16} />
              {isLockedByMe ? 'Reprendre' : 'Éditer'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden p-6">
        {/* Left Sidebar - Metadata */}
        <div className="w-80 flex-shrink-0 overflow-y-auto custom-scrollbar">
          <TaskMetadataPanel
            task={task}
            canEdit={canEdit && !lockedByOther}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDueDateChange={onDueDateChange}
            tags={tags}
            availableTags={availableTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            assignees={assignees}
            responsibleId={responsibleId ?? undefined}
            onAssigneesChange={onAssigneesChange}
            workspaceId={workspaceId}
            className="h-auto"
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Tabs */}
          <nav className="flex gap-6 border-b border-gray-100 px-6 dark:border-gray-800">
            {[
              { id: 'details', label: 'Détails' },
              { id: 'checklist', label: `Checklist ${checklistCount > 0 ? `(${completedChecklistCount}/${checklistCount})` : ''}` },
              { id: 'timeline', label: 'Historique' },
              { id: 'comments', label: `Commentaires ${commentCount > 0 ? `(${commentCount})` : ''}` },
              { id: 'files', label: 'Fichiers' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  relative py-4 text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }
                `}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden bg-white p-0 dark:bg-gray-900">
            {activeTab === 'details' && (
              <div className="h-full overflow-hidden">
                <MDEditor
                  value={task.content || ''}
                  preview="preview"
                  hideToolbar={true}
                  visibleDragbar={false}
                  height="100%"
                  data-color-mode={isDarkMode ? 'dark' : 'light'}
                  previewOptions={{
                    className: 'p-8 h-full prose dark:prose-invert max-w-none font-sans',
                    style: { backgroundColor: 'transparent' },
                    components: {
                      a: MarkdownLinkHandler,
                    },
                  }}
                  className="!border-0"
                />
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="h-full overflow-hidden">
                <TaskChecklist
                  items={checklistItems}
                  loading={checklistLoading}
                  canEdit={canEdit && !lockedByOther}
                  onAddItem={onAddChecklistItem}
                  onToggleItem={onToggleChecklistItem}
                  onDeleteItem={onDeleteChecklistItem}
                  onUpdateItem={onUpdateChecklistItem}
                />
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="h-full overflow-y-auto p-6">
                <TaskTimeline
                  items={timeline}
                  loading={timelineLoading}
                  canAdd={canCollaborate}
                  onAdd={onAddTimelineEntry}
                />
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="h-full overflow-hidden">
                <TaskComments
                  comments={comments}
                  loading={commentsLoading}
                  canAdd={canCollaborate}
                  onAdd={onAddComment}
                />
              </div>
            )}

            {activeTab === 'files' && (
              <div className="h-full overflow-y-auto p-6">
                <TaskFiles
                  files={files}
                  loading={filesLoading}
                  canUpload={canCollaborate && !!onUploadFile}
                  onUpload={onUploadFile}
                  onDelete={onDeleteFile}
                  onUpdateFileNote={onUpdateFileNote}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskViewer;