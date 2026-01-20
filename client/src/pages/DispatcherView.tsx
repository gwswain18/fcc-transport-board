import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import {
  Floor,
  TransportRequest,
  TransporterStatusRecord,
  CreateTransportRequestData,
  CycleTimeAlert as CycleTimeAlertType,
} from '../types';
import Header from '../components/common/Header';
import { TransporterStatusBadge } from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import ElapsedTimer from '../components/common/ElapsedTimer';
import Modal from '../components/common/Modal';
import AutoAssignButton from '../components/dispatcher/AutoAssignButton';
import ActiveDispatcherCard from '../components/dispatcher/ActiveDispatcherCard';
import BreakModal from '../components/dispatcher/BreakModal';
import CycleTimeAlert from '../components/common/CycleTimeAlert';
import AlertDismissalModal from '../components/common/AlertDismissalModal';

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const DESTINATIONS = ['Atrium', 'Radiology', 'Lab', 'OR', 'NICU', 'Other'];

// Map floor to expected first digit of room number
const FLOOR_DIGIT_MAP: Record<Floor, string> = {
  FCC1: '1',
  FCC4: '4',
  FCC5: '5',
  FCC6: '6',
};

type DismissalType = 'timeout' | 'break' | 'offline' | 'cycle';
interface PendingDismissal {
  type: DismissalType;
  id: number;
  details?: string;
}

export default function DispatcherView() {
  const { user } = useAuth();
  const {
    transporterStatuses,
    requests,
    alerts,
    cycleTimeAlerts,
    breakAlerts,
    offlineAlerts,
    activeDispatchers,
    requireExplanation,
    dismissAlert,
    dismissCycleAlert,
    dismissBreakAlert,
    dismissOfflineAlert,
    refreshData,
  } = useSocket();
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransportRequest | null>(null);
  const [showOtherDestination, setShowOtherDestination] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);
  const [dismissalModal, setDismissalModal] = useState<PendingDismissal | null>(null);

  // Find current user's dispatcher status
  const myDispatcherStatus = activeDispatchers.find((d) => d.user_id === user?.id);
  const isPrimaryDispatcher = myDispatcherStatus?.is_primary || false;

  const [formData, setFormData] = useState<CreateTransportRequestData>({
    origin_floor: 'FCC4',
    room_number: '',
    destination: 'Atrium',
    priority: 'routine',
    notes: '',
  });

  const availableTransporters = transporterStatuses.filter(
    (t) => t.status === 'available'
  );

  const activeRequests = requests.filter(
    (r) => !['complete', 'cancelled'].includes(r.status)
  );

  const pendingRequests = activeRequests.filter((r) => r.status === 'pending');
  const assignedRequests = activeRequests.filter((r) => r.status === 'assigned');
  const inProgressRequests = activeRequests.filter((r) =>
    ['accepted', 'en_route', 'with_patient'].includes(r.status)
  );

  const validateRoomNumber = (floor: Floor, room: string): boolean => {
    // Get the first digit of the room number
    const match = room.match(/^(\d)/);
    if (!match) return true; // Allow non-numeric rooms (letters only)
    const firstDigit = match[1];
    const expectedDigit = FLOOR_DIGIT_MAP[floor];
    return firstDigit === expectedDigit;
  };

  const handleRoomChange = (room: string) => {
    setFormData((prev) => ({ ...prev, room_number: room }));
    if (room && !validateRoomNumber(formData.origin_floor, room)) {
      const expectedDigit = FLOOR_DIGIT_MAP[formData.origin_floor];
      setRoomError(`Room should start with ${expectedDigit} for ${formData.origin_floor}`);
    } else {
      setRoomError('');
    }
  };

  const handleFloorChange = (floor: Floor) => {
    setFormData((prev) => ({ ...prev, origin_floor: floor }));
    if (formData.room_number && !validateRoomNumber(floor, formData.room_number)) {
      const expectedDigit = FLOOR_DIGIT_MAP[floor];
      setRoomError(`Room should start with ${expectedDigit} for ${floor}`);
    } else {
      setRoomError('');
    }
  };

  const handleCreateRequest = async (assignTo?: number, autoAssign?: boolean) => {
    if (!formData.room_number) return;
    setLoading(true);

    await api.createRequest({
      ...formData,
      assigned_to: assignTo,
      auto_assign: autoAssign,
    });

    setFormData({
      origin_floor: 'FCC4',
      room_number: '',
      destination: 'Atrium',
      priority: 'routine',
      notes: '',
    });
    setShowOtherDestination(false);
    setRoomError('');
    await refreshData();
    setLoading(false);
  };

  const handleAssignRequest = async (requestId: number, transporterId: number) => {
    // Find the request to check its status
    const request = requests.find(r => r.id === requestId);
    const inProgressStatuses = ['accepted', 'en_route', 'with_patient'];

    if (request && inProgressStatuses.includes(request.status)) {
      const confirmed = confirm(
        `This request is currently in progress (${request.status.replace('_', ' ')}). ` +
        `The current transporter (${request.assignee?.first_name} ${request.assignee?.last_name}) ` +
        `will be removed from this job. Are you sure you want to reassign?`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    await api.updateRequest(requestId, { assigned_to: transporterId });
    await refreshData();
    setAssignModalOpen(false);
    setSelectedRequest(null);
    setLoading(false);
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    setLoading(true);
    await api.cancelRequest(requestId);
    await refreshData();
    setLoading(false);
  };

  const openAssignModal = (request: TransportRequest) => {
    setSelectedRequest(request);
    setAssignModalOpen(true);
  };

  const handleTakeBreak = async (reliefUserId?: number, reliefText?: string) => {
    setBreakLoading(true);
    const response = await api.dispatcherTakeBreak(reliefUserId, reliefText);
    setBreakLoading(false);
    if (!response.error) {
      setShowBreakModal(false);
      await refreshData();
    }
  };

  const handleReturnFromBreak = async (asPrimary?: boolean) => {
    setLoading(true);
    await api.dispatcherReturn(asPrimary);
    await refreshData();
    setLoading(false);
  };

  const handleSetPrimary = async () => {
    setLoading(true);
    await api.setPrimaryDispatcher();
    await refreshData();
    setLoading(false);
  };

  const handleAssignToPCT = async (requestId: number) => {
    const request = requests.find(r => r.id === requestId);
    const inProgressStatuses = ['accepted', 'en_route', 'with_patient'];

    let confirmMessage = 'Transfer this request to PCT? The request will auto-close after the configured time.';

    if (request && inProgressStatuses.includes(request.status)) {
      confirmMessage = `This request is currently in progress (${request.status.replace('_', ' ')}). ` +
        `The current transporter (${request.assignee?.first_name} ${request.assignee?.last_name}) ` +
        `will be removed from this job. Transfer to PCT?`;
    }

    if (!confirm(confirmMessage)) return;
    setLoading(true);
    await api.assignToPCT(requestId);
    await refreshData();
    setLoading(false);
  };

  const handleDismissTimeoutAlert = (requestId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'timeout', id: requestId, details });
    } else {
      dismissAlert(requestId);
    }
  };

  const handleDismissBreakAlert = (userId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'break', id: userId, details });
    } else {
      dismissBreakAlert(userId);
    }
  };

  const handleDismissOfflineAlert = (userId: number, details?: string) => {
    if (requireExplanation) {
      setDismissalModal({ type: 'offline', id: userId, details });
    } else {
      dismissOfflineAlert(userId);
    }
  };

  const handleDismissalConfirm = (explanation: string) => {
    if (!dismissalModal) return;
    switch (dismissalModal.type) {
      case 'timeout':
        dismissAlert(dismissalModal.id, explanation);
        break;
      case 'break':
        dismissBreakAlert(dismissalModal.id, explanation);
        break;
      case 'offline':
        dismissOfflineAlert(dismissalModal.id, explanation);
        break;
      case 'cycle':
        dismissCycleAlert(dismissalModal.id, explanation);
        break;
    }
    setDismissalModal(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-red-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">ALERT:</span>
              <span>
                {alerts.length} request(s) waiting too long
              </span>
            </div>
            <div className="flex gap-2">
              {alerts.slice(0, 3).map((alert) => (
                <button
                  key={alert.request_id}
                  onClick={() => handleDismissTimeoutAlert(
                    alert.request_id,
                    `${alert.type} - ${alert.request.origin_floor}-${alert.request.room_number}`
                  )}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                >
                  {alert.request.origin_floor}-{alert.request.room_number} (Dismiss)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Break Alerts */}
      {breakAlerts.length > 0 && (
        <div className="bg-yellow-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">BREAK ALERT:</span>
              <span>
                {breakAlerts.map((a) => `${a.first_name} ${a.last_name} (${a.minutes_on_break} min)`).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              {breakAlerts.map((alert) => (
                <button
                  key={alert.user_id}
                  onClick={() => handleDismissBreakAlert(
                    alert.user_id,
                    `${alert.first_name} ${alert.last_name} on break for ${alert.minutes_on_break} min`
                  )}
                  className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
                >
                  Dismiss
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Offline Alerts */}
      {offlineAlerts.length > 0 && (
        <div className="bg-gray-700 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold">OFFLINE:</span>
              <span>
                {offlineAlerts.map((a) => `${a.first_name} ${a.last_name}`).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              {offlineAlerts.map((alert) => (
                <button
                  key={alert.user_id}
                  onClick={() => handleDismissOfflineAlert(
                    alert.user_id,
                    `${alert.first_name} ${alert.last_name} went offline`
                  )}
                  className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm"
                >
                  Dismiss
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4">
        {/* Cycle Time Alerts */}
        {cycleTimeAlerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {cycleTimeAlerts.map((alert) => (
              <CycleTimeAlert
                key={alert.request_id}
                alert={alert}
                request={requests.find(r => r.id === alert.request_id)}
                onDismiss={dismissCycleAlert}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Transporters */}
          <div className="col-span-3 space-y-4">
            {/* Active Dispatchers Card */}
            <ActiveDispatcherCard
              dispatchers={activeDispatchers}
              currentUserId={user?.id}
              onTakeBreak={() => setShowBreakModal(true)}
              onReturnFromBreak={handleReturnFromBreak}
              onSetPrimary={handleSetPrimary}
            />

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Transporters</h2>
              <div className="space-y-2">
                {transporterStatuses.map((transporter) => (
                  <TransporterCard
                    key={transporter.id}
                    transporter={transporter}
                    onClick={() => {
                      if (transporter.status === 'available' && formData.room_number) {
                        handleCreateRequest(transporter.user_id);
                      }
                    }}
                  />
                ))}
                {transporterStatuses.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No transporters online</p>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel - Active Jobs */}
          <div className="col-span-5 space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Jobs</h2>

              {/* Pending */}
              {pendingRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-yellow-600 mb-2">
                    Pending ({pendingRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onAssign={() => openAssignModal(request)}
                        onCancel={() => handleCancelRequest(request.id)}
                        onAssignToPCT={() => handleAssignToPCT(request.id)}
                        showAutoAssign
                        cycleTimeAlert={cycleTimeAlerts.find(a => a.request_id === request.id)}
                        onDismissAlert={dismissCycleAlert}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned */}
              {assignedRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-primary mb-2">
                    Assigned ({assignedRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {assignedRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onAssign={() => openAssignModal(request)}
                        onCancel={() => handleCancelRequest(request.id)}
                        cycleTimeAlert={cycleTimeAlerts.find(a => a.request_id === request.id)}
                        onDismissAlert={dismissCycleAlert}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress */}
              {inProgressRequests.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-purple-600 mb-2">
                    In Progress ({inProgressRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {inProgressRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onAssign={() => openAssignModal(request)}
                        onCancel={() => handleCancelRequest(request.id)}
                        onAssignToPCT={() => handleAssignToPCT(request.id)}
                        cycleTimeAlert={cycleTimeAlerts.find(a => a.request_id === request.id)}
                        onDismissAlert={dismissCycleAlert}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeRequests.length === 0 && (
                <p className="text-gray-500 text-center py-8">No active requests</p>
              )}
            </div>
          </div>

          {/* Right Panel - Create Request Form */}
          <div className="col-span-4">
            <div className="card sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New Request</h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Floor</label>
                  <select
                    value={formData.origin_floor}
                    onChange={(e) => handleFloorChange(e.target.value as Floor)}
                    className="input"
                  >
                    {FLOORS.map((floor) => (
                      <option key={floor} value={floor}>
                        {floor}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Room Number</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={(e) => handleRoomChange(e.target.value)}
                    className={`input ${roomError ? 'border-yellow-500' : ''}`}
                    placeholder="e.g., 412"
                  />
                  {roomError && (
                    <p className="text-yellow-600 text-sm mt-1">{roomError}</p>
                  )}
                </div>

                <div>
                  <label className="label">Destination</label>
                  <select
                    value={showOtherDestination ? 'Other' : formData.destination}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        setShowOtherDestination(true);
                        setFormData((prev) => ({ ...prev, destination: '' }));
                      } else {
                        setShowOtherDestination(false);
                        setFormData((prev) => ({ ...prev, destination: e.target.value }));
                      }
                    }}
                    className="input"
                  >
                    {DESTINATIONS.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest}
                      </option>
                    ))}
                  </select>
                  {showOtherDestination && (
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, destination: e.target.value }))
                      }
                      className="input mt-2"
                      placeholder="Enter destination"
                    />
                  )}
                </div>

                <div>
                  <label className="label">Priority</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, priority: 'routine' }))
                      }
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        formData.priority === 'routine'
                          ? 'bg-primary text-white'
                          : 'bg-primary-50 text-primary'
                      }`}
                    >
                      Routine
                    </button>
                    <button
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, priority: 'stat' }))
                      }
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        formData.priority === 'stat'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      STAT
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="input"
                    rows={2}
                    placeholder="Additional instructions..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleCreateRequest()}
                    disabled={!formData.room_number || loading}
                    className="flex-1 btn-secondary"
                  >
                    Post to Queue
                  </button>
                  <button
                    onClick={() => handleCreateRequest(undefined, true)}
                    disabled={!formData.room_number || loading || availableTransporters.length === 0}
                    className="flex-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 py-2 px-4"
                  >
                    Auto-Assign
                  </button>
                </div>
                {availableTransporters.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCreateRequest(parseInt(e.target.value));
                      }
                    }}
                    disabled={!formData.room_number || loading}
                    className="w-full input"
                    defaultValue=""
                  >
                    <option value="">Manual Assign to...</option>
                    {availableTransporters.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.user?.first_name} {t.user?.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedRequest(null);
        }}
        title="Assign Request"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <PriorityBadge priority={selectedRequest.priority} />
                <span className="font-bold">
                  {selectedRequest.origin_floor} - {selectedRequest.room_number}
                </span>
              </div>
              <p className="text-gray-600">{selectedRequest.destination}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Available Transporters</h4>
                <AutoAssignButton
                  requestId={selectedRequest.id}
                  onAssigned={() => {
                    setAssignModalOpen(false);
                    setSelectedRequest(null);
                    refreshData();
                  }}
                />
              </div>
              {availableTransporters.length === 0 ? (
                <p className="text-gray-500">No transporters available</p>
              ) : (
                <div className="space-y-2">
                  {availableTransporters.map((t) => (
                    <button
                      key={t.user_id}
                      onClick={() => handleAssignRequest(selectedRequest.id, t.user_id)}
                      disabled={loading}
                      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>{t.user?.first_name} {t.user?.last_name}</span>
                        {t.shift?.extension && (
                          <span className="text-xs text-gray-500">Ext: {t.shift.extension}</span>
                        )}
                      </div>
                      {t.user?.primary_floor && (
                        <span className="text-xs text-gray-400">Primary: {t.user.primary_floor}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Break Modal */}
      <BreakModal
        isOpen={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        onConfirm={handleTakeBreak}
        loading={breakLoading}
        isPrimary={isPrimaryDispatcher}
      />

      {/* Alert Dismissal Modal */}
      <AlertDismissalModal
        isOpen={!!dismissalModal}
        onClose={() => setDismissalModal(null)}
        onConfirm={handleDismissalConfirm}
        alertType={dismissalModal?.type}
        alertDetails={dismissalModal?.details}
      />
    </div>
  );
}

function TransporterCard({
  transporter,
  onClick,
}: {
  transporter: TransporterStatusRecord;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border ${
        transporter.status === 'available'
          ? 'border-green-200 bg-green-50 cursor-pointer hover:bg-green-100'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">
          {transporter.user?.first_name} {transporter.user?.last_name}
        </span>
        <TransporterStatusBadge status={transporter.status} size="sm" />
      </div>
      {transporter.shift?.extension && (
        <p className="text-xs text-gray-500 mt-1">Ext: {transporter.shift.extension}</p>
      )}
      {transporter.status === 'other' && transporter.status_explanation && (
        <p className="text-xs text-gray-500 mt-1 italic">{transporter.status_explanation}</p>
      )}
      {transporter.current_job && (
        <p className="text-sm text-gray-600 mt-1">
          {transporter.current_job.origin_floor}-{transporter.current_job.room_number}
        </p>
      )}
    </div>
  );
}

function RequestCard({
  request,
  onAssign,
  onCancel,
  onAssignToPCT,
  showAutoAssign,
  cycleTimeAlert,
  onDismissAlert,
}: {
  request: TransportRequest;
  onAssign?: () => void;
  onCancel?: () => void;
  onAssignToPCT?: () => void;
  showAutoAssign?: boolean;
  cycleTimeAlert?: CycleTimeAlertType;
  onDismissAlert?: (requestId: number, reason?: string) => void;
}) {
  const isPCTTransfer = request.status === 'transferred_to_pct';
  const hasAlert = !!cycleTimeAlert;

  return (
    <div className={`rounded-lg p-3 ${
      isPCTTransfer
        ? 'bg-orange-50 border border-orange-200'
        : hasAlert
          ? 'bg-yellow-50 border-2 border-yellow-400 animate-pulse-subtle'
          : 'bg-gray-50'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={request.priority} size="sm" />
          <span className="font-bold text-gray-900">
            {request.origin_floor} - {request.room_number}
          </span>
          {isPCTTransfer && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
              PCT
            </span>
          )}
        </div>
        <ElapsedTimer startTime={request.created_at} />
      </div>

      <p className="text-sm text-gray-600 mb-2">{request.destination}</p>

      {request.assignee && (
        <p className="text-sm text-primary mb-2">
          Assigned to: {request.assignee.first_name} {request.assignee.last_name}
        </p>
      )}

      {request.assignment_method === 'auto' && (
        <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mb-2">
          Auto-assigned
        </span>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {onAssign && !isPCTTransfer && (
          <button onClick={onAssign} className="btn-primary text-sm py-1">
            {request.assignee ? 'Reassign' : 'Assign'}
          </button>
        )}
        {showAutoAssign && !request.assignee && !isPCTTransfer && (
          <AutoAssignButton requestId={request.id} />
        )}
        {onAssignToPCT && !isPCTTransfer && (
          <button
            onClick={onAssignToPCT}
            className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1 rounded text-sm font-medium"
          >
            To PCT
          </button>
        )}
        {hasAlert && onDismissAlert && (
          <button
            onClick={() => {
              if (request.delay_reason) {
                onDismissAlert(request.id, `Transporter provided: ${request.delay_reason}`);
              } else {
                const reason = prompt('Reason for dismissing alert:');
                if (reason) onDismissAlert(request.id, reason);
              }
            }}
            className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-3 py-1 rounded text-sm font-medium"
          >
            {request.delay_reason ? 'Acknowledge' : 'Dismiss Alert'}
          </button>
        )}
        {onCancel && !isPCTTransfer && (
          <button onClick={onCancel} className="btn-danger text-sm py-1">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
