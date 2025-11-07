import React from 'react';
import { Workflow } from '../types';
import { ChevronDown } from 'lucide-react';
import TaskStatusBadge from './TaskStatusBadge';

interface WorkflowSelectorProps {
  workflows: Workflow[];
  selectedWorkflowId: number;
  currentStatus: string;
  onWorkflowChange: (workflowId: number) => void;
  onStatusChange: (status: string) => void;
  className?: string;
  disabled?: boolean;
}

const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  workflows,
  selectedWorkflowId,
  currentStatus,
  onWorkflowChange,
  onStatusChange,
  className = '',
  disabled = false,
}) => {
  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
  const [showWorkflowDropdown, setShowWorkflowDropdown] = React.useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = React.useState(false);

  if (!selectedWorkflow) {
    return <div className="text-red-500">Workflow non trouvé</div>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Workflow Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Workflow
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => !disabled && setShowWorkflowDropdown(!showWorkflowDropdown)}
            disabled={disabled}
            className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <span className="text-gray-900 dark:text-gray-100">{selectedWorkflow.name}</span>
            <ChevronDown size={18} className="text-gray-400" />
          </button>

          {showWorkflowDropdown && !disabled && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowWorkflowDropdown(false)}
              />
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {workflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => {
                      onWorkflowChange(workflow.id);
                      setShowWorkflowDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      workflow.id === selectedWorkflowId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{workflow.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {workflow.statuses.slice(0, 4).map(status => (
                        <span
                          key={status.key}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${status.color}20`,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      ))}
                      {workflow.statuses.length > 4 && (
                        <span className="text-xs text-gray-400">+{workflow.statuses.length - 4}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Statut
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => !disabled && setShowStatusDropdown(!showStatusDropdown)}
            disabled={disabled}
            className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <TaskStatusBadge status={currentStatus} workflowStatuses={selectedWorkflow.statuses} />
            <ChevronDown size={18} className="text-gray-400" />
          </button>

          {showStatusDropdown && !disabled && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStatusDropdown(false)}
              />
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                {selectedWorkflow.statuses.map(status => (
                  <button
                    key={status.key}
                    onClick={() => {
                      onStatusChange(status.key);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center ${
                      status.key === currentStatus ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <TaskStatusBadge status={status.key} workflowStatuses={selectedWorkflow.statuses} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Workflow preview */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Étapes du workflow :</div>
        <div className="flex flex-wrap gap-2">
          {selectedWorkflow.statuses.map(status => (
            <TaskStatusBadge
              key={status.key}
              status={status.key}
              workflowStatuses={selectedWorkflow.statuses}
              className={status.key === currentStatus ? 'ring-2 ring-blue-400' : 'opacity-60'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowSelector;

