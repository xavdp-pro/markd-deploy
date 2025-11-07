import React from 'react';
import { WorkflowStatus } from '../types';

interface TaskStatusBadgeProps {
  status: string;
  workflowStatuses: WorkflowStatus[];
  onClick?: () => void;
  className?: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, workflowStatuses, onClick, className = '' }) => {
  const statusConfig = workflowStatuses.find(s => s.key === status);
  
  if (!statusConfig) {
    return (
      <span className={`px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 ${className}`}>
        {status}
      </span>
    );
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      '#6b7280': 'bg-gray-200 text-gray-800 hover:bg-gray-300',
      '#3b82f6': 'bg-blue-200 text-blue-800 hover:bg-blue-300',
      '#10b981': 'bg-green-200 text-green-800 hover:bg-green-300',
      '#f59e0b': 'bg-orange-200 text-orange-800 hover:bg-orange-300',
      '#ef4444': 'bg-red-200 text-red-800 hover:bg-red-300',
      '#8b5cf6': 'bg-purple-200 text-purple-800 hover:bg-purple-300',
    };
    return colorMap[color] || 'bg-gray-200 text-gray-700 hover:bg-gray-300';
  };

  const colorClasses = getColorClasses(statusConfig.color);

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${colorClasses} ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {statusConfig.label}
    </span>
  );
};

export default TaskStatusBadge;

