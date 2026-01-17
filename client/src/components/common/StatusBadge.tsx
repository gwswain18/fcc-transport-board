import { TransporterStatus, RequestStatus } from '../../types';
import {
  getStatusColor,
  getStatusLabel,
  getRequestStatusColor,
  getRequestStatusLabel,
} from '../../utils/formatters';

interface TransporterStatusBadgeProps {
  status: TransporterStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function TransporterStatusBadge({
  status,
  size = 'md',
}: TransporterStatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${getStatusColor(
        status
      )} ${sizeClasses[size]}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

interface RequestStatusBadgeProps {
  status: RequestStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function RequestStatusBadge({
  status,
  size = 'md',
}: RequestStatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${getRequestStatusColor(
        status
      )} ${sizeClasses[size]}`}
    >
      {getRequestStatusLabel(status)}
    </span>
  );
}
