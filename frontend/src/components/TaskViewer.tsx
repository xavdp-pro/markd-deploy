import React, { useEffect, useState, useRef } from 'react';
import { FileEdit, Link, ChevronRight, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import MDEditor from '@uiw/react-md-editor';
import { Task, TaskComment, TaskTag, TaskAssignee, TaskFile, TaskChecklistItem, WorkflowStep } from '../types';
import TaskMetadataPanel from './TaskMetadataPanel';
import TaskComments from './TaskComments';
import TaskFiles from './TaskFiles';
import TaskChecklist from './TaskChecklist';
import PresenceAvatars from './PresenceAvatars';
import MarkdownLinkHandler from './MarkdownLinkHandler';

interface TaskViewerProps {
  task: Task;
  onEdit: () => void;
  canEdit?: boolean;
  presenceUsers?: Array<{ id: string; username: string }>;
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
  comments: TaskComment[];
  commentsLoading?: boolean;
  onAddComment?: (content: string) => Promise<void>;
  onUpdateComment?: (commentId: string, content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  canCollaborate?: boolean;
  currentUserId?: number | null;
  files?: TaskFile[];
  filesLoading?: boolean;
  onUploadFile?: (file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  checklistItems?: TaskChecklistItem[];
  checklistLoading?: boolean;
  onAddChecklistItem?: (text: string, assignedTo?: number | null, parentId?: string | null) => Promise<void>;
  onToggleChecklistItem?: (itemId: string, completed: boolean) => Promise<void>;
  onDeleteChecklistItem?: (itemId: string) => Promise<void>;
  onUpdateChecklistItem?: (itemId: string, text: string) => Promise<void>;
  onUpdateChecklistAssignee?: (itemId: string, userId: number | null) => Promise<void>;
  onUpdateChecklistParent?: (itemId: string, parentId: string | null) => Promise<void>;
  workflowSteps?: WorkflowStep[];
  onKanbanView?: () => void;
}

const TaskViewer: React.FC<TaskViewerProps> = ({
  task,
  onEdit,
  canEdit = true,
  presenceUsers,
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
  comments,
  commentsLoading = false,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  canCollaborate = true,
  currentUserId,
  files = [],
  filesLoading = false,
  onUploadFile,
  onDeleteFile,
  checklistItems = [],
  checklistLoading = false,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onUpdateChecklistItem,
  onUpdateChecklistAssignee,
  onUpdateChecklistParent,
  workflowSteps,
  onKanbanView,
}) => {
  const kanbanBtnRef = useRef<HTMLButtonElement>(null);

  // Random ripple effect on the Kanban button
  useEffect(() => {
    if (!onKanbanView) return;
    let timeout: ReturnType<typeof setTimeout>;
    const triggerRipple = () => {
      const btn = kanbanBtnRef.current;
      if (btn) {
        btn.classList.remove('ripple-active');
        void btn.offsetWidth; // force reflow
        btn.classList.add('ripple-active');
        setTimeout(() => btn.classList.remove('ripple-active'), 1200);
      }
      // Next ripple in 5-15s (random)
      timeout = setTimeout(triggerRipple, 5000 + Math.random() * 10000);
    };
    // First ripple after 2-5s
    timeout = setTimeout(triggerRipple, 2000 + Math.random() * 3000);
    return () => clearTimeout(timeout);
  }, [onKanbanView]);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'files'>(() => {
    try {
      const saved = sessionStorage.getItem('markd_task_active_tab');
      if (saved && ['details', 'checklist', 'comments', 'files'].includes(saved)) {
        return saved as 'details' | 'checklist' | 'comments' | 'files';
      }
    } catch {}
    return 'details';
  });
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState<boolean>(false);
  const commentCount = comments.length;
  const checklistCount = checklistItems.length;
  const completedChecklistCount = checklistItems.filter(item => item.completed).length;
  
  // Load collapsed state from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('markd_task_metadata_collapsed');
      if (saved !== null) {
        setIsMetadataCollapsed(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading metadata collapsed state:', e);
    }
  }, []);

  // Save collapsed state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('markd_task_metadata_collapsed', JSON.stringify(isMetadataCollapsed));
    } catch (e) {
      console.error('Error saving metadata collapsed state:', e);
    }
  }, [isMetadataCollapsed]);
  
  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');

  const copyLinkToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#task=${task.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied! You can paste it in a Markdown document or another task');
  };
  
  const copyMarkdownToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#task=${task.id}`;
    const markdown = `✅ [${task.name}](${url})`;
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown link copied!');
  };

  // Persist active tab to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem('markd_task_active_tab', activeTab); } catch {}
  }, [activeTab]);

  // Only reset tab when switching to a different task
  const prevTaskIdRef = React.useRef(task.id);
  useEffect(() => {
    if (prevTaskIdRef.current !== task.id) {
      prevTaskIdRef.current = task.id;
      setActiveTab(commentCount > 0 ? 'comments' : 'details');
    }
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
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {onKanbanView && (
            <button
              ref={kanbanBtnRef}
              onClick={onKanbanView}
              className="relative rounded-lg p-2 text-indigo-500 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 kanban-glow"
              title="Kanban View"
            >
              <LayoutGrid size={20} />
            </button>
          )}
          {presenceUsers && presenceUsers.length > 0 && (
            <PresenceAvatars users={presenceUsers} />
          )}
          <button
            onClick={copyLinkToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-2"
            title="Copy link to this task"
          >
            <Link className="w-4 h-4" />
            Copy link
          </button>
          <button
            onClick={copyMarkdownToClipboard}
            className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Copy as Markdown link: ✅ [Name](URL)"
          >
            Markdown
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow active:translate-y-0.5 dark:bg-blue-600 dark:hover:bg-blue-500"
              title="Edit task"
            >
              <FileEdit size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden p-6">
        {/* Left Sidebar - Metadata with collapse/expand */}
        {!isMetadataCollapsed && (
          <div className="w-80 flex-shrink-0 overflow-y-auto custom-scrollbar">
            <TaskMetadataPanel
              task={task}
              canEdit={canEdit}
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
              onCollapse={() => setIsMetadataCollapsed(true)}
              workflowSteps={workflowSteps}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Tabs */}
          <nav className="flex items-center gap-6 border-b border-gray-100 px-6 dark:border-gray-800 relative">
            {[
              { id: 'details', label: 'Details' },
              { id: 'checklist', label: `Checklist ${checklistCount > 0 ? `(${completedChecklistCount}/${checklistCount})` : ''}` },
              { id: 'comments', label: `Comments ${commentCount > 0 ? `(${commentCount})` : ''}` },
              { id: 'files', label: 'Files' }
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
            {/* Collapse button when metadata is collapsed - positioned at right of tabs */}
            {isMetadataCollapsed && (
              <button
                onClick={() => setIsMetadataCollapsed(false)}
                className="ml-auto flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                title="Show metadata"
              >
                <ChevronRight size={18} />
              </button>
            )}
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
                  canEdit={canEdit}
                  onAddItem={onAddChecklistItem}
                  onToggleItem={onToggleChecklistItem}
                  onDeleteItem={onDeleteChecklistItem}
                  onUpdateItem={onUpdateChecklistItem}
                  onUpdateAssignee={onUpdateChecklistAssignee}
                  onUpdateParent={onUpdateChecklistParent}
                  workspaceId={workspaceId}
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
                  onUpdate={onUpdateComment}
                  onDelete={onDeleteComment}
                  currentUserId={currentUserId}
                  workspaceId={workspaceId}
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