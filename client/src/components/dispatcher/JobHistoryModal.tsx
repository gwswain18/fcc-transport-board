import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../utils/api';
import { TransportRequest } from '../../types';

interface StatusHistoryEntry {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  user: { first_name: string; last_name: string } | null;
}

interface DelayEntry {
  id: number;
  reason: string;
  custom_note?: string;
  phase?: string;
  created_at: string;
  user: { first_name: string; last_name: string } | null;
}

interface JobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  accepted: 'Accepted',
  en_route: 'En Route',
  with_patient: 'With Patient',
  complete: 'Completed',
  cancelled: 'Cancelled',
  transferred_to_pct: 'Transferred to PCT',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-purple-100 text-purple-800',
  with_patient: 'bg-pink-100 text-pink-800',
  complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  transferred_to_pct: 'bg-orange-100 text-orange-800',
};

export default function JobHistoryModal({ isOpen, onClose, requestId }: JobHistoryModalProps) {
  const [request, setRequest] = useState<TransportRequest | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [delays, setDelays] = useState<DelayEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && requestId) {
      loadHistory(requestId);
    }
  }, [isOpen, requestId]);

  const loadHistory = async (id: number) => {
    setLoading(true);
    const response = await api.getRequestHistory(id);
    if (response.data) {
      setRequest(response.data.request);
      setStatusHistory(response.data.status_history);
      setDelays(response.data.delays);
    }
    setLoading(false);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Job History" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : request ? (
        <div className="space-y-6">
          {/* Job Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-gray-900">
                {request.origin_floor} - {request.room_number}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[request.status] || 'bg-gray-100 text-gray-800'}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
            <p className="text-sm text-gray-600">{request.destination}</p>
            {request.notes && (
              <p className="text-sm text-gray-500 mt-1 italic">{request.notes}</p>
            )}
            {request.creator && (
              <p className="text-xs text-gray-400 mt-2">
                Created by {request.creator.first_name} {request.creator.last_name} at {formatTime(request.created_at)}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h4>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {statusHistory.map((entry, i) => (
                  <div key={entry.id} className="relative flex gap-4 items-start">
                    <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === statusHistory.length - 1
                        ? 'bg-primary text-white'
                        : 'bg-gray-300 text-white'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[entry.to_status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[entry.to_status] || entry.to_status}
                        </span>
                        {entry.from_status && (
                          <span className="text-xs text-gray-400">
                            from {STATUS_LABELS[entry.from_status] || entry.from_status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{formatTime(entry.changed_at)}</span>
                        {entry.user && (
                          <span className="text-xs text-gray-400">
                            by {entry.user.first_name} {entry.user.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delays */}
          {delays.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Delays</h4>
              <div className="space-y-2">
                {delays.map((delay) => (
                  <div key={delay.id} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">{delay.reason}</p>
                    {delay.custom_note && (
                      <p className="text-xs text-yellow-600 mt-1">{delay.custom_note}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{formatTime(delay.created_at)}</span>
                      {delay.phase && (
                        <span className="text-xs text-gray-400">Phase: {delay.phase}</span>
                      )}
                      {delay.user && (
                        <span className="text-xs text-gray-400">
                          by {delay.user.first_name} {delay.user.last_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No data available</p>
      )}
    </Modal>
  );
}
