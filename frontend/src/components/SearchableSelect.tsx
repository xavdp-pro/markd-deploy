import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  readOnly?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  readOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find(opt => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(
    () => options.filter(opt => 
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [options, searchQuery]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    if (disabled || readOnly) return;
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || readOnly) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  if (readOnly) {
    return (
      <div className={`px-3 py-2 border border-transparent text-gray-900 dark:text-gray-100 ${className}`}>
        {selectedOption ? selectedOption.label : '-'}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div
        className={`
          flex items-center justify-between w-full px-3 py-2 bg-white dark:bg-gray-700
          border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
          cursor-pointer transition-all duration-200
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-gray-400 dark:hover:border-gray-500'}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
              <span className="block truncate text-gray-900 dark:text-gray-100">
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-8 pr-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center italic">
                No results found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`
                    flex items-center justify-between px-3 py-2 cursor-pointer text-sm
                    ${index === highlightedIndex ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    ${option.value === value ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''}
                  `}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    {option.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-0.5 mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {option.value === value && (
                    <Check size={14} className="text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
