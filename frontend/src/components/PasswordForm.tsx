import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Tag } from 'lucide-react';
import { Tag as TagType } from '../types';
import TagSelector from './TagSelector';

export interface PasswordFormData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

interface PasswordFormProps {
  initialData?: PasswordFormData;
  initialTags?: TagType[];
  allTags: TagType[];
  onSubmit: (data: PasswordFormData, tags: TagType[]) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
  workspaceId: string;
}

const PasswordForm: React.FC<PasswordFormProps> = ({
  initialData,
  initialTags = [],
  allTags,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
  // workspaceId
}) => {
  const [formData, setFormData] = useState<PasswordFormData>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: ''
  });
  const [tags, setTags] = useState<TagType[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
    if (initialTags) {
      setTags(initialTags);
    }
  }, [initialData, initialTags]);

  // Helper to generate password
  const generatePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData, tags);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEditing ? 'Modifier le mot de passe' : 'Nouveau mot de passe'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Titre *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: MariaDB Production"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Login (Username) *
          </label>
          <input
            type="text"
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            autoComplete="username"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: admin"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password *
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono transition-all duration-200"
                placeholder={isEditing ? "Entrez le nouveau mot de passe" : "Mot de passe"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <div className="relative w-4 h-4">
                  <Eye
                    className={`absolute inset-0 w-4 h-4 transition-opacity duration-300 ${
                      showPassword ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <EyeOff
                    className={`absolute inset-0 w-4 h-4 transition-opacity duration-300 ${
                      showPassword ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={generatePassword}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Générer
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            URL (optionnel)
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Commentaires (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Commentaires additionnels..."
          />
        </div>

        {/* Tags section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
          </div>
          <TagSelector
            tags={tags}
            suggestions={allTags}
            onAddTag={(name) => {
              const exists = tags.some(t => t.name.toLowerCase() === name.toLowerCase());
              if (exists) return;
              const newTag: TagType = {
                id: `temp-${Date.now()}`,
                name: name
              };
              setTags(prev => [...prev, newTag]);
            }}
            onRemoveTag={(tagId) => {
              setTags(prev => prev.filter(t => t.id !== tagId));
            }}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Créer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordForm;
