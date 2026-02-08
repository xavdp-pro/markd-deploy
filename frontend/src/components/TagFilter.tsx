import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Tag as TagIcon, Plus, ChevronDown, X, Search, Check } from 'lucide-react';
import { Tag as TagType } from '../types';

interface TagFilterProps {
  allTags: TagType[];
  selectedTags: string[];
  onTagFilterChange: (tagIds: string[]) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({
  allTags,
  selectedTags,
  onTagFilterChange,
}) => {
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const tagMenuRef = useRef<HTMLDivElement>(null);

  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return allTags;
    const query = tagSearchQuery.toLowerCase();
    return allTags.filter(tag => tag.name.toLowerCase().includes(query));
  }, [allTags, tagSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagFilterChange(selectedTags.filter(id => id !== tagId));
    } else {
      onTagFilterChange([...selectedTags, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onTagFilterChange(selectedTags.filter(id => id !== tagId));
  };

  const clearAll = () => {
    onTagFilterChange([]);
  };

  if (allTags.length === 0) return null;

  return (
    <div 
      className="flex-shrink-0 border-t dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 relative z-10" 
      ref={tagMenuRef}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <TagIcon size={14} className="text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Filter by tags</span>
        {selectedTags.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            {selectedTags.length}
          </span>
        )}
      </div>
      
      {/* Selected tags as badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedTags.map(tagId => {
            const tag = allTags.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag.id);
                  }}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  title="Remove this tag"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            title="Clear all tags"
          >
            Clear all
          </button>
        </div>
      )}
      
      {/* Add/Modify tags button */}
      <button
        type="button"
        onClick={() => setTagMenuOpen(!tagMenuOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 shadow-sm hover:shadow"
      >
        <span className="flex items-center gap-2">
          <Plus size={16} className="text-blue-600 dark:text-blue-400" />
          {selectedTags.length === 0 ? 'Add tags' : 'Edit tags'}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${tagMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      {/* Dropdown menu */}
      {tagMenuOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search tags..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>
          </div>
          
          {/* Tags list */}
          <div 
            className="overflow-y-auto max-h-64 p-2 custom-scrollbar"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: document.documentElement.classList.contains('dark') ? '#4B5563 #1F2937' : '#CBD5E1 #F3F4F6'
            }}
          >
            <style>{`
              .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: #CBD5E1;
                border-radius: 20px;
              }
              .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: #4B5563;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: #94A3B8;
              }
              .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: #6B7280;
              }
            `}</style>
            {filteredTags.length === 0 ? (
              <div className="p-4 text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  No tags found
                </div>
                {tagSearchQuery.trim() && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Tags are created automatically when added to a document, task, or password
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTags.map(tag => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
                        ${isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border-2 border-transparent'
                        }
                      `}
                    >
                      {/* Custom checkbox */}
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTag(tag.id)}
                          className="sr-only"
                        />
                        <div 
                          className={`
                            w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
                            ${isSelected 
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 shadow-sm' 
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                            }
                          `}
                        >
                          {isSelected && (
                            <Check size={14} className="text-white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                      <span 
                        className={`
                          text-sm font-medium transition-colors
                          ${isSelected 
                            ? 'text-blue-700 dark:text-blue-300' 
                            : 'text-gray-700 dark:text-gray-300'
                          }
                        `}
                      >
                        {tag.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagFilter;
