import React from 'react';

interface TaskTypeIconProps {
  icon?: string;
  color?: string;
  name: string;
  size?: string;
  className?: string;
}

const TaskTypeIcon: React.FC<TaskTypeIconProps> = ({
  icon,
  color = '#6b7280',
  name,
  size = 'text-base',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center ${size} ${className}`}
      style={{ color }}
      title={name}
    >
      {icon || '📋'}
    </span>
  );
};

export default TaskTypeIcon;

