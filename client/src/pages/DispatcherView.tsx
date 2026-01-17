import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';
import {
  Floor,
  SpecialNeed,
  TransportRequest,
  TransporterStatusRecord,
  CreateTransportRequestData,
} from '../types';
import Header from '../components/common/Header';
import { TransporterStatusBadge } from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import ElapsedTimer from '../components/common/ElapsedTimer';
import SpecialNeedsIcons from '../components/common/SpecialNeedsIcons';
import Modal from '../components/common/Modal';

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const DESTINATIONS = ['Atrium', 'Radiology', 'Lab', 'OR', 'NICU', 'Other'];

export default function DispatcherView() {
  const { transporterStatuses, requests, alerts, dismissAlert, refreshData } = useSocket();
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransportRequest | null>(null);
  const [showOtherDestination, setShowOtherDestination] = useState(false);

  const [formData, setFormData] = useState<CreateTransportRequestData>({
    origin_floor: 'FCC4',
    room_number: '',
    patient_initials: '',
    destination: 'Atrium',
    priority: 'routine',
    special_needs: [],
    special_needs_notes: '',
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

  const handleCreateRequest = async (assignTo?: number) => {
    if (!formData.room_number) return;
    setLoading(true);

    await api.createRequest({
      ...formData,
      assigned_to: assignTo,
    });

    setFormData({
      origin_floor: 'FCC4',
      room_number: '',
      patient_initials: '',
      destination: 'Atrium',
      priority: 'routine',
      special_needs: [],
      special_needs_notes: '',
      notes: '',
    });
    setShowOtherDestination(false);
    await refreshData();
    setLoading(false);
  };

  const handleAssignRequest = async (requestId: number, transporterId: number) => {
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

  const toggleSpecialNeed = (need: SpecialNeed) => {
    setFormData((prev) => ({
      ...prev,
      special_needs: prev.special_needs.includes(need)
        ? prev.special_needs.filter((n) => n !== need)
        : [...prev.special_needs, need],
    }));
  };

  const openAssignModal = (request: TransportRequest) => {
    setSelectedRequest(request);
    setAssignModalOpen(true);
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
                  onClick={() => dismissAlert(alert.request_id)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                >
                  {alert.request.origin_floor}-{alert.request.room_number} (Dismiss)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Transporters */}
          <div className="col-span-3 space-y-4">
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
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Assigned */}
              {assignedRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-blue-600 mb-2">
                    Assigned ({assignedRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {assignedRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onAssign={() => openAssignModal(request)}
                        onCancel={() => handleCancelRequest(request.id)}
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
                        onCancel={() => handleCancelRequest(request.id)}
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        origin_floor: e.target.value as Floor,
                      }))
                    }
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
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, room_number: e.target.value }))
                    }
                    className="input"
                    placeholder="e.g., 412"
                  />
                </div>

                <div>
                  <label className="label">Patient Initials (optional)</label>
                  <input
                    type="text"
                    value={formData.patient_initials}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        patient_initials: e.target.value.slice(0, 3).toUpperCase(),
                      }))
                    }
                    className="input"
                    placeholder="e.g., JD"
                    maxLength={3}
                  />
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
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-700'
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
                  <label className="label">Special Needs</label>
                  <div className="flex flex-wrap gap-2">
                    {(['wheelchair', 'o2', 'iv_pump', 'other'] as SpecialNeed[]).map(
                      (need) => (
                        <button
                          key={need}
                          onClick={() => toggleSpecialNeed(need)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            formData.special_needs.includes(need)
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {need === 'wheelchair' && 'Wheelchair'}
                          {need === 'o2' && 'O2'}
                          {need === 'iv_pump' && 'IV Pump'}
                          {need === 'other' && 'Other'}
                        </button>
                      )
                    )}
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
                  {availableTransporters.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleCreateRequest(parseInt(e.target.value));
                        }
                      }}
                      disabled={!formData.room_number || loading}
                      className="flex-1 input"
                      defaultValue=""
                    >
                      <option value="">Assign to...</option>
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
              <h4 className="font-medium mb-2">Available Transporters</h4>
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
                      {t.user?.first_name} {t.user?.last_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
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
}: {
  request: TransportRequest;
  onAssign?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={request.priority} size="sm" />
          <span className="font-bold text-gray-900">
            {request.origin_floor} - {request.room_number}
          </span>
        </div>
        <ElapsedTimer startTime={request.created_at} />
      </div>

      <p className="text-sm text-gray-600 mb-2">{request.destination}</p>

      {request.assignee && (
        <p className="text-sm text-blue-600 mb-2">
          Assigned to: {request.assignee.first_name} {request.assignee.last_name}
        </p>
      )}

      <SpecialNeedsIcons needs={request.special_needs} size="sm" />

      <div className="flex gap-2 mt-3">
        {onAssign && (
          <button onClick={onAssign} className="btn-primary text-sm py-1">
            {request.assignee ? 'Reassign' : 'Assign'}
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} className="btn-danger text-sm py-1">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
