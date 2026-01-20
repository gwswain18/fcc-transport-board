import { Priority } from '../../types';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md' | 'lg';
}

export default function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const isStat = priority === 'stat';

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold text-white ${
        isStat ? 'bg-red-500 animate-pulse' : 'bg-primary'
      } ${sizeClasses[size]}`}
    >
      {isStat ? 'STAT' : 'Routine'}
    </span>
  );
}
