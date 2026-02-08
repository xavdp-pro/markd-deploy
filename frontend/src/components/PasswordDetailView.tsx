import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Edit2, Trash2, Tag, Unlock, Link } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PasswordDetail, Tag as TagType } from '../types';
import TagSelector from './TagSelector';
import PresenceAvatars from './PresenceAvatars';

interface PasswordDetailViewProps {
  password: PasswordDetail;
  tags: TagType[];
  allTags: TagType[];
  onEdit: () => void;
  onDelete: () => void;
  onAddTag: (name: string) => Promise<void> | void;
  onRemoveTag: (tagId: string) => Promise<void> | void;
  readOnly?: boolean; // If true, hides Edit/Delete buttons and prevents tag changes
  presenceUsers?: Array<{ id: string; username: string }>;
  lockedBy?: { user_id: string; user_name: string } | null;
  currentUserId?: string;
  onUnlock?: () => void;
  isEditing?: boolean;
}

const PasswordDetailView: React.FC<PasswordDetailViewProps> = ({
  password,
  tags,
  allTags,
  onEdit,
  onDelete,
  onAddTag,
  onRemoveTag,
  readOnly = false,
  presenceUsers,
  lockedBy,
  currentUserId,
  onUnlock,
  isEditing = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyLinkToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#password=${password.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied! You can paste it in a Markdown document');
  };
  
  const copyMarkdownToClipboard = () => {
    const url = `${window.location.origin}${window.location.pathname}#password=${password.id}`;
    const markdown = `🔑 [${password.name}](${url})`;
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown link copied!');
  };

  // Check if current user can unlock
  const canUnlock = lockedBy && currentUserId && 
                    String(lockedBy.user_id) === String(currentUserId) && 
                    !isEditing;

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{password.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {presenceUsers && presenceUsers.length > 0 && (
              <PresenceAvatars users={presenceUsers} />
            )}
            <button
              onClick={copyLinkToClipboard}
              className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-2"
              title="Copy link to this password for pasting in a Markdown document"
            >
              <Link className="w-4 h-4" />
              Copy link
            </button>
            <button
              onClick={copyMarkdownToClipboard}
              className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Copy link as Markdown: 🔑 [Name](URL)"
            >
              Markdown
            </button>
            {canUnlock && onUnlock && (
              <button
                onClick={onUnlock}
                className="px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors flex items-center gap-2"
                title="Remove my lock"
              >
                <Unlock className="w-4 h-4" />
                Unlock
              </button>
            )}
            {!readOnly && (
              <div className="flex gap-2">
                <button
                  onClick={onEdit}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Login (Username)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={password.username || ''}
                readOnly
                placeholder="Not set"
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(password.username || '', 'Login')}
                disabled={!password.username}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copy login"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password.password || ''}
                  readOnly
                  autoComplete="off"
                  placeholder="Not set"
                  className="w-full px-3 py-2 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded font-mono text-gray-900 dark:text-gray-100 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!password.password}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <div className="relative w-5 h-5">
                    <Eye
                      className={`absolute inset-0 w-5 h-5 transition-opacity duration-300 ${
                        showPassword ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                    <EyeOff
                      className={`absolute inset-0 w-5 h-5 transition-opacity duration-300 ${
                        showPassword ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(password.password || '', 'Password')}
                disabled={!password.password}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copy password"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={password.url || ''}
                readOnly
                placeholder="Not set"
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(password.url || '', 'URL')}
                disabled={!password.url}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copy URL"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comments
            </label>
            <div className="flex items-start gap-2">
              <textarea
                value={password.notes || ''}
                readOnly
                placeholder="Not set"
                rows={3}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 resize-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(password.notes || '', 'Comments')}
                disabled={!password.notes}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
                title="Copy comments"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <p>Created: {password.created_at ? new Date(password.created_at).toLocaleString() : '-'}</p>
            <p>Modified: {password.updated_at ? new Date(password.updated_at).toLocaleString() : '-'}</p>
          </div>

          {/* Tags section - at the very bottom */}
          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
            </div>
            <TagSelector
              tags={tags}
              suggestions={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordDetailView;
