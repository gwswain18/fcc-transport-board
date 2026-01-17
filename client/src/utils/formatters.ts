import { formatDistanceToNow, differenceInMinutes, format } from 'date-fns';
import { TransporterStatus, RequestStatus, SpecialNeed, Priority } from '../types';

export const formatElapsedTime = (dateString: string): string => {
  return formatDistanceToNow(new Date(dateString), { addSuffix: false });
};

export const getElapsedMinutes = (dateString: string): number => {
  return differenceInMinutes(new Date(), new Date(dateString));
};

export const formatDateTime = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy h:mm a');
};

export const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

export const formatTime = (dateString: string): string => {
  return format(new Date(dateString), 'h:mm a');
};

export const getStatusColor = (status: TransporterStatus): string => {
  const colors: Record<TransporterStatus, string> = {
    available: 'bg-green-500',
    assigned: 'bg-blue-500',
    accepted: 'bg-blue-600',
    en_route: 'bg-purple-500',
    with_patient: 'bg-orange-500',
    on_break: 'bg-yellow-500',
    off_unit: 'bg-gray-500',
    offline: 'bg-gray-400',
  };
  return colors[status] || 'bg-gray-400';
};

export const getStatusLabel = (status: TransporterStatus): string => {
  const labels: Record<TransporterStatus, string> = {
    available: 'Available',
    assigned: 'Assigned',
    accepted: 'Accepted',
    en_route: 'En Route',
    with_patient: 'With Patient',
    on_break: 'On Break',
    off_unit: 'Off Unit',
    offline: 'Offline',
  };
  return labels[status] || status;
};

export const getRequestStatusColor = (status: RequestStatus): string => {
  const colors: Record<RequestStatus, string> = {
    pending: 'bg-yellow-500',
    assigned: 'bg-blue-500',
    accepted: 'bg-blue-600',
    en_route: 'bg-purple-500',
    with_patient: 'bg-orange-500',
    complete: 'bg-green-500',
    cancelled: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-400';
};

export const getRequestStatusLabel = (status: RequestStatus): string => {
  const labels: Record<RequestStatus, string> = {
    pending: 'Pending',
    assigned: 'Assigned',
    accepted: 'Accepted',
    en_route: 'En Route',
    with_patient: 'With Patient',
    complete: 'Complete',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
};

export const getPriorityColor = (priority: Priority): string => {
  return priority === 'stat' ? 'bg-red-500' : 'bg-blue-500';
};

export const getSpecialNeedIcon = (need: SpecialNeed): string => {
  const icons: Record<SpecialNeed, string> = {
    wheelchair: '♿',
    o2: 'O₂',
    iv_pump: '💉',
    other: '⚠️',
  };
  return icons[need] || '?';
};

export const getSpecialNeedLabel = (need: SpecialNeed): string => {
  const labels: Record<SpecialNeed, string> = {
    wheelchair: 'Wheelchair',
    o2: 'Oxygen',
    iv_pump: 'IV Pump',
    other: 'Other',
  };
  return labels[need] || need;
};

export const getElapsedTimeColor = (minutes: number): string => {
  if (minutes < 5) return 'text-green-600';
  if (minutes < 10) return 'text-yellow-600';
  return 'text-red-600';
};

export const formatMinutes = (minutes: number): string => {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};
