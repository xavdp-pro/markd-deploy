import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, Clock, Flag, Tag, User, X, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Task, TaskTag, TaskAssignee, WorkflowStep } from '../types';
import UserMultiSelect from './UserMultiSelect';
import TagSelector from './TagSelector';

interface TaskMetadataPanelProps {
  task: Task;
  canEdit: boolean;
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
  className?: string;
  onCollapse?: () => void;
  workflowSteps?: WorkflowStep[];
}

const DEFAULT_STATUS_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode }> = [
  { value: 'todo', label: 'To do', icon: <Circle size={14} /> },
  { value: 'doing', label: 'In progress', icon: <ArrowUpCircle size={14} /> },
  { value: 'done', label: 'Done', icon: <CheckCircle2 size={14} /> },
];

const STEP_ICON_MAP: Record<string, React.ReactNode> = {
  todo: <Circle size={14} />,
  'in-progress': <ArrowUpCircle size={14} />,
  doing: <ArrowUpCircle size={14} />,
  done: <CheckCircle2 size={14} />,
};

const PRIORITY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string; color: string; icon: React.ReactNode }> = [
  { value: 'low', label: 'Low', color: 'text-gray-600 dark:text-gray-400', icon: <ArrowDownCircle size={14} className="text-blue-500" /> },
  { value: 'medium', label: 'Medium', color: 'text-amber-600 dark:text-amber-400', icon: <MinusCircle size={14} className="text-amber-500" /> },
  { value: 'high', label: 'High', color: 'text-red-600 dark:text-red-400', icon: <AlertCircle size={14} className="text-red-500" /> },
];

// Custom dropdown select with arrow key navigation
const MetadataSelect: React.FC<{
  value: string;
  options: Array<{ value: string; label: string; icon?: React.ReactNode; dot?: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}> = ({ value, options, onChange, disabled, placeholder = 'Select...' }) => {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset focus index when opening
  useEffect(() => {
    if (open) {
      const idx = options.findIndex(o => o.value === value);
      setFocusIdx(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIdx < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[focusIdx]) (items[focusIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIdx(prev => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIdx(prev => (prev - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < options.length) {
          onChange(options[focusIdx].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [open, focusIdx, options, onChange, disabled]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
          open
            ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900'
            : 'border-gray-200 dark:border-gray-700'
        } bg-gray-50 dark:bg-gray-800 ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
        }`}
        tabIndex={disabled ? -1 : 0}
      >
        {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
        {selectedOption?.dot && <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${selectedOption.dot}`} />}
        <span className={`flex-1 truncate ${selectedOption ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isFocused = idx === focusIdx;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setOpen(false); }}
                onMouseEnter={() => setFocusIdx(idx)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  isFocused
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                } ${isSelected ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                {option.dot && <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${option.dot}`} />}
                <span className="flex-1 text-left">{option.label}</span>
                {isSelected && <Check size={14} className="flex-shrink-0 text-blue-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const formatDateForInput = (value?: string | null) => {
  if (!value) return '';
  return value.split('T')[0] ?? '';
};

// Custom calendar date picker matching Kanban style
const MetadataDatePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}> = ({ value, onChange, onClear, disabled }) => {
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
    <div ref={containerRef} className="relative group">
      <button
        type="button"
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
          isOpen
            ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900'
            : 'border-gray-200 dark:border-gray-700'
        } bg-gray-50 dark:bg-gray-800 ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer'
        }`}
      >
        <Calendar size={14} className="flex-shrink-0 text-gray-400" />
        <span className={`flex-1 truncate ${displayValue ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
          {displayValue || 'Select date...'}
        </span>
        {value && !disabled && (
          <span
            onClick={(e) => { e.stopPropagation(); onClear?.(); }}
            className="rounded-full p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">

          {/* ── YEARS VIEW ── */}
          {pickerView === 'years' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setYearRangeStart(y => y - 12)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {yearRangeStart} – {yearRangeStart + 11}
                </span>
                <button type="button" onClick={() => setYearRangeStart(y => y + 12)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(y => (
                  <button
                    type="button"
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
                <button type="button" onClick={() => setViewYear(y => y - 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setPickerView('years'); }}
                  className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {viewYear}
                </button>
                <button type="button" onClick={() => setViewYear(y => y + 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((m, i) => (
                  <button
                    type="button"
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
                <button type="button" onClick={prevMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPickerView('months')}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {monthNames[viewMonth]}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setPickerView('years'); }}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {viewYear}
                  </button>
                </div>
                <button type="button" onClick={nextMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
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
                      type="button"
                      key={dateStr}
                      onClick={() => selectDay(day)}
                      className={`h-8 w-full rounded text-xs font-medium transition-colors ${
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
                  type="button"
                  onClick={() => { onChange(todayStr); setIsOpen(false); }}
                  className="w-full rounded-md py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
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

const TaskMetadataPanel: React.FC<TaskMetadataPanelProps> = ({
  task,
  canEdit,
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
  className,
  onCollapse,
  workflowSteps,
}) => {
  // Build status options from workflow steps or fall back to defaults
  const statusOptions = workflowSteps && workflowSteps.length > 0
    ? workflowSteps.map(step => ({
        value: step.slug,
        label: step.name,
        icon: STEP_ICON_MAP[step.slug] || <Circle size={14} />,
      }))
    : DEFAULT_STATUS_OPTIONS;

  const handleStatusClick = (status: string) => {
    if (!canEdit || !onStatusChange) return;
    onStatusChange(status);
  };

  const handlePriorityClick = (priority: 'low' | 'medium' | 'high') => {
    if (!canEdit || !onPriorityChange) return;
    onPriorityChange(priority);
  };

  const handleDueDatePick = (dateStr: string) => {
    if (!canEdit || !onDueDateChange) return;
    if (!dateStr) {
      onDueDateChange(null);
      return;
    }
    try {
      const iso = new Date(`${dateStr}T00:00:00`).toISOString();
      onDueDateChange(iso);
    } catch (error) {
      console.error('Invalid due date value', error);
    }
  };

  const selectedUserIds = assignees.map((assignee) => assignee.user_id);

  const handleAssigneeSelectionChange = (userIds: number[], responsible?: number) => {
    onAssigneesChange?.(userIds, responsible);
  };

  const containerClass =
    `flex h-full flex-col gap-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm ` +
    `dark:border-gray-800 dark:bg-gray-900 ${className ? className : ''}`;

  return (
    <div className={containerClass}>
      {/* Status Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            <Clock size={12} />
            Status
          </span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
              title="Hide metadata"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>
        <MetadataSelect
          value={task.status || ''}
          options={statusOptions}
          onChange={handleStatusClick}
          disabled={!canEdit}
          placeholder="Select status..."
        />
      </section>

      {/* Priority Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Flag size={12} />
          Priority
        </span>
        <MetadataSelect
          value={task.priority || ''}
          options={PRIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label, icon: o.icon }))}
          onChange={(v) => handlePriorityClick(v as 'low' | 'medium' | 'high')}
          disabled={!canEdit}
          placeholder="Select priority..."
        />
      </section>

      {/* Due Date Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Calendar size={12} />
          Due date
        </span>
        <MetadataDatePicker
          value={formatDateForInput(task.due_date)}
          onChange={handleDueDatePick}
          onClear={() => onDueDateChange?.(null)}
          disabled={!canEdit}
        />
      </section>

      {/* Assignment Section */}
      <section>
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <User size={12} />
          Assignation
        </span>
        <UserMultiSelect
          selectedUserIds={selectedUserIds}
          responsibleUserId={responsibleId ?? undefined}
          onSelectionChange={handleAssigneeSelectionChange}
          workspaceId={workspaceId}
          className={canEdit ? '' : 'pointer-events-none opacity-60'}
        />
      </section>

      {/* Tags Section */}
      <section className="flex-1">
        <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          <Tag size={12} />
          Tags
        </span>
        <TagSelector
          tags={tags}
          suggestions={availableTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          readOnly={!canEdit}
        />
      </section>
    </div>
  );
};

export default TaskMetadataPanel;

