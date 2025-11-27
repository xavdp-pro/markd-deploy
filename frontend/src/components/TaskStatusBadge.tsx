import React from 'react';
import { TaskStatus } from '../types';

interface TaskStatusBadgeProps {
  status: string;
  workflowStatuses?: TaskStatus[];
  className?: string;
}

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, workflowStatuses = [], className = '' }) => {
  const statusDef = workflowStatuses.find(s => s.key === status) || {
    key: status,
    label: status,
    color: '#6b7280', // gray-500
    type: 'todo'
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${statusDef.color}20`,
        color: statusDef.color,
      }}
    >
      {statusDef.label}
    </span>
  );
};

export default TaskStatusBadge;
