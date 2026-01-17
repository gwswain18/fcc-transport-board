import { SpecialNeed } from '../../types';
import { getSpecialNeedIcon, getSpecialNeedLabel } from '../../utils/formatters';

interface SpecialNeedsIconsProps {
  needs: SpecialNeed[];
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function SpecialNeedsIcons({
  needs,
  showLabels = false,
  size = 'md',
}: SpecialNeedsIconsProps) {
  if (needs.length === 0) return null;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {needs.map((need) => (
        <span
          key={need}
          className={`inline-flex items-center px-2 py-0.5 rounded bg-gray-100 ${sizeClasses[size]}`}
          title={getSpecialNeedLabel(need)}
        >
          <span className="mr-1">{getSpecialNeedIcon(need)}</span>
          {showLabels && (
            <span className="text-gray-700">{getSpecialNeedLabel(need)}</span>
          )}
        </span>
      ))}
    </div>
  );
}
