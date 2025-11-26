import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Tag } from '../types';

interface TagSelectorProps {
  tags: Tag[];
  suggestions?: Tag[];
  onAddTag?: (name: string) => Promise<void> | void;
  onRemoveTag?: (tagId: string) => Promise<void> | void;
  readOnly?: boolean;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  tags,
  suggestions = [],
  onAddTag,
  onRemoveTag,
  readOnly = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already selected
  const availableSuggestions = useMemo(() => {
    const lowerSelected = new Set(tags.map((tag) => tag.name.toLowerCase()));
    const query = inputValue.toLowerCase().trim();
    
    let filtered = suggestions.filter((tag) => !lowerSelected.has(tag.name.toLowerCase()));
    
    if (query) {
      filtered = filtered.filter((tag) => tag.name.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [suggestions, tags, inputValue]);

  // Handle outside click to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = async (name: string) => {
    if (readOnly || !onAddTag) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    
    try {
      setError(null);
      await onAddTag(trimmed);
      setInputValue('');
      setShowSuggestions(false);
      setActiveSuggestionIndex(0);
      // Keep focus on input
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add tag');
    }
  };

  const handleRemove = async (tagId: string) => {
    if (readOnly || !onRemoveTag) return;
    try {
      setError(null);
      await onRemoveTag(tagId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove tag');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation(); // Prevent form submission
      
      if (showSuggestions && availableSuggestions.length > 0 && availableSuggestions[activeSuggestionIndex]) {
         handleAdd(availableSuggestions[activeSuggestionIndex].name);
      } else if (inputValue.trim()) {
         handleAdd(inputValue);
      }
    } else if (event.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      // Disabled to prevent accidental deletion when erasing text
      // handleRemove(tags[tags.length - 1].id);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
      } else {
        setActiveSuggestionIndex(prev => (prev + 1) % availableSuggestions.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
      } else {
        setActiveSuggestionIndex(prev => (prev - 1 + availableSuggestions.length) % availableSuggestions.length);
      }
    } else if (event.key === 'Escape') {
        setShowSuggestions(false);
        inputRef.current?.blur();
    }
  };

  // READ-ONLY VIEW
  if (readOnly) {
    if (tags.length === 0) {
        return <span className="text-sm text-gray-500 dark:text-gray-400 italic">Aucun tag</span>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
  }

  // EDIT MODE
  return (
    <div className="relative space-y-1" ref={containerRef}>
      <div 
        className="min-h-[42px] flex flex-wrap items-center gap-2 p-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700/50 select-none"
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(tag.id); }}
              className="ml-1.5 text-blue-400 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-100 focus:outline-none p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
              setActiveSuggestionIndex(0);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Ajouter des tags..." : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && availableSuggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 left-0 mt-1 w-64 max-h-60 overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-base shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-gray-200 dark:border-gray-700 custom-scrollbar"
        >
          {availableSuggestions.map((tag, index) => (
            <div
              key={tag.id}
              className={`relative cursor-pointer select-none py-2.5 pl-3 pr-9 transition-colors duration-150 ${
                index === activeSuggestionIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200' 
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              onClick={() => handleAdd(tag.name)}
            >
              <span className="block truncate font-medium">{tag.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {error && <p className="text-xs text-red-600 mt-1 animate-pulse">{error}</p>}
    </div>
  );
};

export default TagSelector;

