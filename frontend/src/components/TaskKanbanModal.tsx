import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Task, WorkflowStep } from '../types';
import { ArrowLeft, CheckSquare, Calendar, GripVertical, GripHorizontal, Filter, X, ChevronDown, ChevronLeft, ChevronRight, Check, Plus, Pencil, Trash2, Palette, ExternalLink, Settings2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  rectIntersection,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../services/api';

interface TaskKanbanProps {
  tasks: Task[];
  workspaceId: string;
  onBack: () => void;
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, status: string) => void;
  onReorder?: (taskIds: string[]) => void;
}

// Available colors for workflow steps
const STEP_COLORS = [
  { name: 'gray', bg: 'bg-gray-100 dark:bg-gray-800/50', header: 'bg-gray-200/80 dark:bg-gray-700/50', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400' },
  { name: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/10', header: 'bg-blue-100 dark:bg-blue-900/30', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { name: 'green', bg: 'bg-green-50 dark:bg-green-900/10', header: 'bg-green-100 dark:bg-green-900/30', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  { name: 'amber', bg: 'bg-amber-50 dark:bg-amber-900/10', header: 'bg-amber-100 dark:bg-amber-900/30', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { name: 'red', bg: 'bg-red-50 dark:bg-red-900/10', header: 'bg-red-100 dark:bg-red-900/30', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { name: 'purple', bg: 'bg-purple-50 dark:bg-purple-900/10', header: 'bg-purple-100 dark:bg-purple-900/30', dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  { name: 'pink', bg: 'bg-pink-50 dark:bg-pink-900/10', header: 'bg-pink-100 dark:bg-pink-900/30', dot: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400' },
  { name: 'teal', bg: 'bg-teal-50 dark:bg-teal-900/10', header: 'bg-teal-100 dark:bg-teal-900/30', dot: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400' },
  { name: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-900/10', header: 'bg-indigo-100 dark:bg-indigo-900/30', dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  { name: 'cyan', bg: 'bg-cyan-50 dark:bg-cyan-900/10', header: 'bg-cyan-100 dark:bg-cyan-900/30', dot: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
  { name: 'lime', bg: 'bg-lime-50 dark:bg-lime-900/10', header: 'bg-lime-100 dark:bg-lime-900/30', dot: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
  { name: 'orange', bg: 'bg-orange-50 dark:bg-orange-900/10', header: 'bg-orange-100 dark:bg-orange-900/30', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { name: 'rose', bg: 'bg-rose-50 dark:bg-rose-900/10', header: 'bg-rose-100 dark:bg-rose-900/30', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { name: 'sky', bg: 'bg-sky-50 dark:bg-sky-900/10', header: 'bg-sky-100 dark:bg-sky-900/30', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { name: 'violet', bg: 'bg-violet-50 dark:bg-violet-900/10', header: 'bg-violet-100 dark:bg-violet-900/30', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  { name: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-900/10', header: 'bg-emerald-100 dark:bg-emerald-900/30', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
];

const getColorConfig = (color: string) => STEP_COLORS.find(c => c.name === color) || STEP_COLORS[0];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };

// Custom select dropdown with keyboard navigation
const CustomSelect: React.FC<{
  value: string;
  options: { value: string; label: string; dot?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || options[0]?.label;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Reset highlight when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(o => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightIndex >= 0) {
      const items = listRef.current.children;
      if (items[highlightIndex]) (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < options.length) {
          onChange(options[highlightIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isOpen
            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
            : value
            ? 'border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500'
        }`}
      >
        {options.find(o => o.value === value)?.dot && (
          <span className={`inline-block h-2 w-2 rounded-full ${options.find(o => o.value === value)?.dot}`} />
        )}
        <span>{selectedLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          role="listbox"
        >
          {options.map((option, idx) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors ${
                idx === highlightIndex
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
              }`}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
            >
              {option.dot && <span className={`inline-block h-2 w-2 rounded-full ${option.dot}`} />}
              <span className="flex-1">{option.label}</span>
              {option.value === value && <Check size={12} className="text-blue-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Searchable select (Select2-style) — dropdown with search input for large lists
const SearchableSelect: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || options[0]?.label;
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) { setSearch(''); setHighlightIndex(0); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [isOpen]);

  useEffect(() => { setHighlightIndex(0); }, [search]);

  useEffect(() => {
    if (isOpen && listRef.current && highlightIndex >= 0) {
      const items = listRef.current.children;
      if (items[highlightIndex]) (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setHighlightIndex(prev => Math.max(prev - 1, 0)); break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          onChange(filtered[highlightIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape': e.preventDefault(); setIsOpen(false); break;
    }
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isOpen
            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
            : value
            ? 'border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500'
        }`}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 p-1.5 dark:border-gray-700">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:placeholder-gray-500"
            />
          </div>
          <ul ref={listRef} className="max-h-[200px] overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">No results</li>
            ) : (
              filtered.map((option, idx) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    idx === highlightIndex
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => { onChange(option.value); setIsOpen(false); }}
                >
                  <span className="flex-1">{option.label}</span>
                  {option.value === value && <Check size={12} className="text-blue-500" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// Custom calendar date picker dropdown with month/year selectors
const DatePickerInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months' | 'years'>('days');
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const [yearRangeStart, setYearRangeStart] = useState(Math.floor((parsed?.getFullYear() || today.getFullYear()) / 12) * 12);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const d = value ? new Date(value + 'T00:00:00') : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setYearRangeStart(Math.floor(d.getFullYear() / 12) * 12);
      setPickerView('days');
    }
  }, [isOpen, value]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  // Build day grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDay = (day: number) => {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setIsOpen(false);
  };

  const displayValue = parsed
    ? parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isOpen
            ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
            : value
            ? 'border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 dark:hover:border-gray-500'
        }`}
      >
        <Calendar size={11} />
        <span>{displayValue || label}</span>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="ml-auto rounded-full p-0.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[250px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">

          {/* ── YEARS VIEW ── */}
          {pickerView === 'years' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setYearRangeStart(y => y - 12)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {yearRangeStart} – {yearRangeStart + 11}
                </span>
                <button onClick={() => setYearRangeStart(y => y + 12)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(y => (
                  <button
                    key={y}
                    onClick={() => { setViewYear(y); setPickerView('months'); }}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                      y === viewYear
                        ? 'bg-blue-500 text-white'
                        : y === today.getFullYear()
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── MONTHS VIEW ── */}
          {pickerView === 'months' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setViewYear(y => y - 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setPickerView('years'); }}
                  className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {viewYear}
                </button>
                <button onClick={() => setViewYear(y => y + 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => { setViewMonth(i); setPickerView('days'); }}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                      i === viewMonth && viewYear === (parsed?.getFullYear() || -1)
                        ? 'bg-blue-500 text-white'
                        : i === today.getMonth() && viewYear === today.getFullYear()
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── DAYS VIEW ── */}
          {pickerView === 'days' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPickerView('months')}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {monthNames[viewMonth]}
                  </button>
                  <button
                    onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setPickerView('years'); }}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {viewYear}
                  </button>
                </div>
                <button onClick={nextMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-0.5">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = dateStr === value;
                  const isToday = dateStr === todayStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => selectDay(day)}
                      className={`h-7 w-full rounded text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : isToday
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
                <button
                  onClick={() => { onChange(todayStr); setIsOpen(false); }}
                  className="w-full rounded-md py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                >
                  Today
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  return {
    text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    isOverdue: date < now,
    isToday: date.toDateString() === now.toDateString(),
  };
};

// Fixed-position tooltip that escapes overflow containers via portal
const FixedTooltip: React.FC<{ children: React.ReactNode; label: string; badge?: string }> = ({ children, label, badge }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShow(true);
  };

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && ReactDOM.createPortal(
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="mb-1.5 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-gray-700">
            <span>{label}</span>
            {badge && (
              <span className="ml-1.5 rounded bg-blue-500/30 px-1 py-0.5 text-[9px] text-blue-200">{badge}</span>
            )}
          </div>
          <div className="mx-auto w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>,
        document.body
      )}
    </div>
  );
};

// Sortable task card
const SortableTaskCard: React.FC<{ task: Task; onClick: (t: Task) => void }> = ({ task, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const dueDate = formatDate(task.due_date);
  const assignees = task.assignees || [];

  return (
    <div ref={setNodeRef} style={style} className="group flex rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Drag handle — thin left strip */}
      <button
        {...attributes} {...listeners}
        className="flex w-5 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-l-[7px] bg-gray-50 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing dark:bg-gray-800/50 dark:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-400"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>

      {/* Card content */}
      <div className="flex-1 min-w-0 p-2.5">
        {/* Row 1: Title + open icon */}
        <div className="flex items-start justify-between gap-1 mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">{task.name}</h4>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(task); }}
            className="flex-shrink-0 rounded-md p-1 text-blue-400 transition-all hover:bg-blue-100 hover:text-blue-600 dark:text-blue-500 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
            title="Open task"
          >
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Row 2: Priority + Deadline */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {task.priority && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[task.priority] || ''}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {dueDate ? (
            <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              dueDate.isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : dueDate.isToday ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              <Calendar size={9} />{dueDate.text}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
              <Calendar size={9} />No deadline
            </span>
          )}
        </div>

        {/* Row 3: Assignees */}
        <div className="flex items-center">
          {assignees.length > 0 ? (
            <div className="flex items-center -space-x-1.5">
              {assignees.slice(0, 5).map((a) => {
                const initials = a.user_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                const isResponsible = task.responsible_user_id === a.user_id;
                return (
                  <FixedTooltip key={a.user_id} label={a.user_name} badge={isResponsible ? 'responsible' : undefined}>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white border-2 border-white dark:border-gray-800 cursor-default transition-transform hover:scale-110 ${
                        isResponsible ? 'bg-blue-500 ring-1 ring-blue-300 dark:ring-blue-700' : 'bg-gray-400 dark:bg-gray-600'
                      }`}
                    >
                      {initials}
                    </span>
                  </FixedTooltip>
                );
              })}
              {assignees.length > 5 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[9px] font-medium text-gray-600 border-2 border-white dark:border-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  +{assignees.length - 5}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Drag overlay card
const TaskCardOverlay: React.FC<{ task: Task }> = ({ task }) => (
  <div className="w-72 cursor-grabbing rounded-lg border border-blue-300 bg-white p-3 shadow-xl ring-2 ring-blue-400/50 dark:border-blue-600 dark:bg-gray-800">
    <div className="flex items-start gap-2">
      <GripVertical size={14} className="mt-0.5 flex-shrink-0 text-blue-400" />
      <div className="flex-1 min-w-0">
        <h4 className="mb-1 text-sm font-medium text-gray-900 dark:text-white">{task.name}</h4>
        {task.priority && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[task.priority] || ''}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
      </div>
    </div>
  </div>
);

// Sortable + droppable column with inline editing
const KanbanColumn: React.FC<{
  step: WorkflowStep;
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onUpdateStep?: (stepId: string, data: { name?: string; color?: string }) => void;
  onDeleteStep?: (stepId: string) => void;
  canEdit: boolean;
}> = ({ step, tasks, onTaskClick, onUpdateStep, onDeleteStep, canEdit }) => {
  const colorCfg = getColorConfig(step.color);
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `column-${step.slug}` });
  const {
    attributes: colAttributes,
    listeners: colListeners,
    setNodeRef: setSortRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: colIsDragging,
  } = useSortable({ id: `step-${step.id}` });
  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
    opacity: colIsDragging ? 0.5 : 1,
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(step.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu && !showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu, showColorPicker]);

  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== step.name && onUpdateStep) onUpdateStep(step.id, { name: trimmed });
    setIsEditing(false);
  };

  return (
    <div ref={setSortRef} style={colStyle} className={`relative flex w-[300px] min-w-[280px] flex-shrink-0 flex-col rounded-xl ${colorCfg.bg} border ${isOver ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-800' : 'border-gray-200/50 dark:border-gray-700/50'} transition-all`}>
      <div className={`flex items-center gap-2 rounded-t-[11px] px-3 py-3 ${colorCfg.header}`} ref={menuRef}>
        {canEdit && (
          <button
            {...colAttributes}
            {...colListeners}
            className="flex-shrink-0 cursor-grab touch-none rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-400"
            onClick={(e) => e.stopPropagation()}
          >
            <GripHorizontal size={14} />
          </button>
        )}
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorCfg.dot}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditName(step.name); setIsEditing(false); } }}
            className="flex-1 rounded border border-blue-300 bg-white px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-600 dark:bg-gray-800 dark:text-white"
          />
        ) : (
          <h3 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{step.name}</h3>
        )}
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
          {tasks.length}
        </span>
        {canEdit && !isEditing && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-1 text-gray-400 hover:bg-white/60 hover:text-gray-600 dark:hover:bg-gray-700/60 dark:hover:text-gray-300 transition-colors"
          >
            <Settings2 size={13} />
          </button>
        )}

      </div>

      {/* Column menu — positioned relative to column */}
      {showMenu && (
        <div className="absolute right-2 top-11 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => { setShowMenu(false); setEditName(step.name); setIsEditing(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
          >
            <Pencil size={12} /> Rename
          </button>
          <button
            onClick={() => { setShowMenu(false); setShowColorPicker(true); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
          >
            <Palette size={12} /> Change color
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button
            onClick={() => { setShowMenu(false); if (onDeleteStep) onDeleteStep(step.id); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={12} /> Delete column
          </button>
        </div>
      )}

      {/* Color picker — positioned relative to column */}
      {showColorPicker && (
        <div className="absolute right-2 top-11 z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Pick a color</p>
          <div className="grid grid-cols-4 gap-2">
            {STEP_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => { if (onUpdateStep) onUpdateStep(step.id, { color: c.name }); setShowColorPicker(false); }}
                className={`h-7 w-7 rounded-full ${c.dot} transition-transform hover:scale-110 ${step.color === c.name ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                title={c.name}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={setDropRef} className="flex flex-1 flex-col min-h-0" data-column-id={step.slug}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar min-h-[120px]">
            {tasks.length === 0 ? (
              <div className="flex h-full min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300/60 text-xs text-gray-400 dark:border-gray-600/60 dark:text-gray-500">
                Drop tasks here
              </div>
            ) : (
              tasks.map((task) => <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />)
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// Column drag overlay
const ColumnOverlay: React.FC<{ step: WorkflowStep; taskCount: number }> = ({ step, taskCount }) => {
  const colorCfg = getColorConfig(step.color);
  return (
    <div className={`w-[300px] rounded-xl ${colorCfg.bg} border border-blue-400 shadow-2xl ring-2 ring-blue-400/50 opacity-90`}>
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-3 ${colorCfg.header}`}>
        <GripHorizontal size={14} className="text-blue-400" />
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorCfg.dot}`} />
        <h3 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{step.name}</h3>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
          {taskCount}
        </span>
      </div>
      <div className="p-3 text-xs text-gray-400 text-center">
        {taskCount} task{taskCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

const TaskKanban: React.FC<TaskKanbanProps> = ({
  tasks,
  workspaceId,
  onBack,
  onSelectTask,
  onStatusChange,
  onReorder: _onReorder,
}) => {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [localTasksByStatus, setLocalTasksByStatus] = useState<Record<string, Task[]>>({});
  const [kanbanOrder, setKanbanOrder] = useState<Record<string, string[]>>({});
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeStep, setActiveStep] = useState<WorkflowStep | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);

  // Sortable IDs for columns (step-{id})
  const stepSortableIds = useMemo(() => workflowSteps.map(s => `step-${s.id}`), [workflowSteps]);

  // Sync top scrollbar width with board content width
  useEffect(() => {
    const board = boardScrollRef.current;
    const inner = topScrollInnerRef.current;
    if (!board || !inner) return;
    const sync = () => {
      const contentWidth = board.scrollWidth;
      inner.style.width = contentWidth + 'px';
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(board);
    // Also observe the first child (the flex container)
    if (board.firstElementChild) observer.observe(board.firstElementChild);
    return () => observer.disconnect();
  }, [workflowSteps]);

  // Load workflow steps and kanban order from backend
  const loadSteps = useCallback(async () => {
    try {
      const [stepsRes, orderRes] = await Promise.all([
        api.getWorkflowSteps(workspaceId),
        api.getKanbanOrder(workspaceId),
      ]);
      if (stepsRes.success) setWorkflowSteps(stepsRes.steps);
      if (orderRes.success) setKanbanOrder(orderRes.order);
    } catch (e) { console.error('Failed to load workflow steps', e); }
    finally { setStepsLoading(false); }
  }, [workspaceId]);

  useEffect(() => { loadSteps(); }, [loadSteps]);

  // Collect all unique assignees from task.assignees arrays
  const allAssignees = useMemo(() => {
    const map = new Map<number, string>();
    const collect = (list: Task[]) => {
      list.forEach(t => {
        if (t.type === 'task' && t.assignees) {
          t.assignees.forEach(a => map.set(a.user_id, a.user_name));
        }
        if (t.children) collect(t.children);
      });
    };
    collect(tasks);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Flatten the tree to get ALL tasks (including those inside folders)
  const allTasks = useMemo(() => {
    const result: Task[] = [];
    const collect = (nodes: Task[]) => {
      for (const n of nodes) {
        if (n.type === 'task') result.push(n);
        if (n.children) collect(n.children);
      }
    };
    collect(tasks);
    return result;
  }, [tasks]);

  // Filter tasks, then group by status
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && !(t.assignees || []).some(a => a.user_id === Number(assigneeFilter))) return false;
      if (dateFrom || dateTo) {
        if (!t.due_date) return false;
        const d = t.due_date.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [allTasks, priorityFilter, assigneeFilter, dateFrom, dateTo]);

  // Sync local state with filtered tasks — group by workflow step slugs, apply saved order
  useEffect(() => {
    const slugs = workflowSteps.map(s => s.slug);
    const grouped: Record<string, Task[]> = {};
    slugs.forEach(s => { grouped[s] = []; });
    filteredTasks.forEach((task) => {
      const status = task.status || (slugs[0] || 'todo');
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        const first = slugs[0] || 'todo';
        if (!grouped[first]) grouped[first] = [];
        grouped[first].push(task);
      }
    });
    // Apply saved kanban order within each column
    for (const slug of slugs) {
      const savedIds = kanbanOrder[slug];
      if (savedIds && savedIds.length > 0) {
        const taskMap = new Map(grouped[slug].map(t => [t.id, t]));
        const ordered: Task[] = [];
        // First add tasks in saved order
        for (const id of savedIds) {
          const t = taskMap.get(id);
          if (t) { ordered.push(t); taskMap.delete(id); }
        }
        // Then append any new tasks not yet in saved order
        taskMap.forEach(t => ordered.push(t));
        grouped[slug] = ordered;
      }
    }
    setLocalTasksByStatus(grouped);
  }, [filteredTasks, workflowSteps, kanbanOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Custom collision detection: prefer pointerWithin for precision, fall back to
  // rectIntersection for column droppables, then closestCenter for sortable items.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First try pointerWithin — most precise
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // Fall back to rectIntersection — catches column droppables even in empty areas
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    // Last resort
    return closestCenter(args);
  }, []);

  // Find which column a task belongs to
  const findTaskColumn = useCallback((taskId: string): string | null => {
    for (const [status, columnTasks] of Object.entries(localTasksByStatus)) {
      if (columnTasks.some(t => t.id === taskId)) return status;
    }
    return null;
  }, [localTasksByStatus]);

  // Resolve an over ID to a column status — handles both task IDs and column droppable IDs
  const resolveColumn = useCallback((id: string): string | null => {
    if (id.startsWith('column-')) return id.replace('column-', '');
    return findTaskColumn(id);
  }, [findTaskColumn]);

  // Detect whether a drag ID is a column (step-*) or a task
  const isStepDrag = (id: string) => id.startsWith('step-');

  // Track the original column when a task drag starts
  const dragOriginColumnRef = useRef<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (isStepDrag(id)) {
      const stepId = id.replace('step-', '');
      setActiveStep(workflowSteps.find(s => s.id === stepId) || null);
      setActiveTask(null);
      dragOriginColumnRef.current = null;
    } else {
      const task = filteredTasks.find(t => t.id === id);
      setActiveTask(task || null);
      setActiveStep(null);
      dragOriginColumnRef.current = findTaskColumn(id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (isStepDrag(activeId)) return;

    const activeColumn = findTaskColumn(activeId);
    const overColumn = resolveColumn(overId);
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    setLocalTasksByStatus(prev => {
      const activeItems = [...(prev[activeColumn] || [])];
      const overItems = [...(prev[overColumn] || [])];
      const activeIndex = activeItems.findIndex(t => t.id === activeId);
      if (activeIndex === -1) return prev;
      const [movedTask] = activeItems.splice(activeIndex, 1);
      const overIndex = overId.startsWith('column-') ? -1 : overItems.findIndex(t => t.id === overId);
      overItems.splice(overIndex >= 0 ? overIndex : overItems.length, 0, movedTask);
      return { ...prev, [activeColumn]: activeItems, [overColumn]: overItems };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const originColumn = dragOriginColumnRef.current;
    dragOriginColumnRef.current = null;

    // ── Column reorder ──
    if (isStepDrag(activeId)) {
      setActiveStep(null);
      if (!over) return;
      const overId = over.id as string;
      if (!isStepDrag(overId) || activeId === overId) return;
      const oldIndex = stepSortableIds.indexOf(activeId);
      const newIndex = stepSortableIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(workflowSteps, oldIndex, newIndex);
      setWorkflowSteps(reordered);
      api.reorderWorkflowSteps(workspaceId, reordered.map(s => s.id)).catch(console.error);
      return;
    }

    // ── Task reorder / move ──
    setActiveTask(null);
    if (!over) return;

    // Where is the task NOW (after handleDragOver may have moved it)
    const currentColumn = findTaskColumn(activeId);
    if (!currentColumn) return;

    // Did the task change columns?
    const crossColumn = originColumn !== null && originColumn !== currentColumn;

    if (crossColumn) {
      // Cross-column move: handleDragOver already moved the task visually.
      // Just persist the status change and the new order of both columns.
      if (onStatusChange) onStatusChange(activeId, currentColumn);
      const sourceIds = (localTasksByStatus[originColumn!] || []).map(t => t.id);
      const targetIds = (localTasksByStatus[currentColumn] || []).map(t => t.id);
      api.saveKanbanOrder(workspaceId, originColumn!, sourceIds).catch(console.error);
      api.saveKanbanOrder(workspaceId, currentColumn, targetIds).catch(console.error);
      setKanbanOrder(o => ({ ...o, [originColumn!]: sourceIds, [currentColumn]: targetIds }));
    } else {
      // Same column reorder
      const overId = over.id as string;
      if (overId.startsWith('column-') || overId === activeId) return;
      setLocalTasksByStatus(prev => {
        const items = [...(prev[currentColumn] || [])];
        const oldIndex = items.findIndex(t => t.id === activeId);
        const newIndex = items.findIndex(t => t.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const reordered = arrayMove(items, oldIndex, newIndex);
        const newIds = reordered.map(t => t.id);
        api.saveKanbanOrder(workspaceId, currentColumn, newIds).catch(console.error);
        setKanbanOrder(prev => ({ ...prev, [currentColumn]: newIds }));
        return { ...prev, [currentColumn]: reordered };
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    onSelectTask(task);
    onBack();
  };

  // ── Workflow step management ──
  const handleAddColumn = async () => {
    const name = newColumnName.trim();
    if (!name) return;
    try {
      const res = await api.createWorkflowStep(workspaceId, name, STEP_COLORS[workflowSteps.length % STEP_COLORS.length].name);
      if (res.success) {
        setWorkflowSteps(prev => [...prev, res.step]);
        setNewColumnName('');
        setAddingColumn(false);
      }
    } catch (e) { console.error('Failed to add column', e); }
  };

  const handleUpdateStep = async (stepId: string, data: { name?: string; color?: string }) => {
    try {
      const res = await api.updateWorkflowStep(stepId, data);
      if (res.success) {
        setWorkflowSteps(prev => prev.map(s => s.id === stepId ? res.step : s));
      }
    } catch (e) { console.error('Failed to update step', e); }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (workflowSteps.length <= 1) return;
    try {
      const res = await api.deleteWorkflowStep(stepId);
      if (res.success) {
        setWorkflowSteps(prev => prev.filter(s => s.id !== stepId));
      }
    } catch (e) { console.error('Failed to delete step', e); }
  };

  useEffect(() => { if (addingColumn && addInputRef.current) addInputRef.current.focus(); }, [addingColumn]);

  // Progress: count tasks in the last column as "completed"
  const totalTasks = allTasks.length;
  const lastSlug = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1].slug : 'done';
  const completedTasks = (localTasksByStatus[lastSlug] || []).length;
  const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const hasFilters = priorityFilter !== null || assigneeFilter !== null || dateFrom !== '' || dateTo !== '';
  const canEdit = !!onStatusChange; // If user can change status, they can edit workflow

  if (stepsLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-400">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" title="Back to list">
          <ArrowLeft size={16} /> List
        </button>

        <div className="h-5 w-px bg-gray-300 dark:bg-gray-700" />

        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Kanban</h2>

        {/* Progress */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <CheckSquare size={14} />
          <span>{completedTasks}/{totalTasks}</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <span>{Math.round(progressPct)}%</span>
        </div>

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={() => { setPriorityFilter(null); setAssigneeFilter(null); setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X size={12} /> Clear
            </button>
          )}

          <Filter size={14} className="text-gray-400" />

          <CustomSelect
            value={priorityFilter || ''}
            onChange={(v) => setPriorityFilter(v || null)}
            options={[
              { value: '', label: 'All priorities' },
              { value: 'high', label: 'High', dot: 'bg-red-500' },
              { value: 'medium', label: 'Medium', dot: 'bg-amber-500' },
              { value: 'low', label: 'Low', dot: 'bg-gray-400' },
            ]}
          />

          <SearchableSelect
            value={assigneeFilter || ''}
            onChange={(v) => setAssigneeFilter(v || null)}
            options={[
              { value: '', label: 'All assignees' },
              ...allAssignees.map(a => ({ value: String(a.id), label: a.name })),
            ]}
          />

          <DatePickerInput label="From" value={dateFrom} onChange={setDateFrom} />
          <DatePickerInput label="To" value={dateTo} onChange={setDateTo} />
        </div>
      </div>

      {/* Top scrollbar — synced with the board */}
      <div
        ref={topScrollRef}
        className="kanban-top-scroll overflow-x-auto overflow-y-hidden flex-shrink-0"
        onScroll={() => {
          if (boardScrollRef.current && topScrollRef.current) {
            boardScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
          }
        }}
      >
        <div ref={topScrollInnerRef} style={{ height: 1 }} />
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={stepSortableIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={boardScrollRef}
            className="flex-1 overflow-x-hidden overflow-y-hidden"
            onScroll={() => {
              if (topScrollRef.current && boardScrollRef.current) {
                topScrollRef.current.scrollLeft = boardScrollRef.current.scrollLeft;
              }
            }}
          >
          <div className="flex gap-4 p-4" style={{ minWidth: 'max-content' }}>
            {workflowSteps.map((step) => (
              <KanbanColumn
                key={step.id}
                step={step}
                tasks={localTasksByStatus[step.slug] || []}
                onTaskClick={handleTaskClick}
                onUpdateStep={canEdit ? handleUpdateStep : undefined}
                onDeleteStep={canEdit ? handleDeleteStep : undefined}
                canEdit={canEdit}
              />
            ))}

            {/* Add column button */}
            {canEdit && (
              <div className="flex w-[280px] min-w-[260px] flex-shrink-0 flex-col">
                {addingColumn ? (
                  <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-4 dark:border-blue-700 dark:bg-blue-900/10">
                    <input
                      ref={addInputRef}
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName(''); } }}
                      placeholder="Column name..."
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-blue-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={handleAddColumn}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingColumn(false); setNewColumnName(''); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-400 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-500 dark:border-gray-600 dark:hover:border-blue-600 dark:hover:bg-blue-900/10 dark:hover:text-blue-400"
                  >
                    <Plus size={16} /> Add column
                  </button>
                )}
              </div>
            )}
          </div>
          </div>
        </SortableContext>
        <DragOverlay>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          {activeStep ? <ColumnOverlay step={activeStep} taskCount={(localTasksByStatus[activeStep.slug] || []).length} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default TaskKanban;
