import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../utils/api';
import { TransporterStatus, RequestStatus } from '../types';
import { TransporterStatusBadge } from '../components/common/StatusBadge';
import PriorityBadge from '../components/common/PriorityBadge';
import ElapsedTimer from '../components/common/ElapsedTimer';
import Modal from '../components/common/Modal';
import Header from '../components/common/Header';
import OtherStatusModal from '../components/common/OtherStatusModal';
import ShiftStartModal from '../components/transporter/ShiftStartModal';
import ShiftEndModal from '../components/transporter/ShiftEndModal';
import CycleTimeAlert from '../components/common/CycleTimeAlert';
import MuteToggle from '../components/common/MuteToggle';
import { Floor } from '../types';

export default function TransporterView() {
  const { user, activeShift, setActiveShift, logout } = useAuth();
  const { transporterStatuses, requests, cycleTimeAlerts, dismissCycleAlert, refreshData, requestHelp } = useSocket();
  const navigate = useNavigate();
  const [queueOpen, setQueueOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [showShiftStartModal, setShowShiftStartModal] = useState(false);
  const [showShiftEndModal, setShowShiftEndModal] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(false);

  const myStatus = transporterStatuses.find((s) => s.user_id === user?.id);
  const currentJob = requests.find(
    (r) =>
      r.assigned_to === user?.id &&
      !['complete', 'cancelled', 'pending'].includes(r.status)
  );
  const pendingJobs = requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => {
      if (a.priority === 'stat' && b.priority !== 'stat') return -1;
      if (a.priority !== 'stat' && b.priority === 'stat') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  // Get cycle time alert for current job
  const currentJobAlert = currentJob
    ? cycleTimeAlerts.find((a) => a.request_id === currentJob.id)
    : null;

  const phaseLabels: Record<string, string> = {
    pending: 'Pending',
    assigned: 'Response',
    accepted: 'En Route',
    en_route: 'Pickup',
    with_patient: 'Transport',
  };

  const handleStatusChange = async (status: TransporterStatus, explanation?: string) => {
    setLoading(true);
    setError(null);
    const response = await api.updateStatus(status, explanation);
    if (response.error) {
      setError(response.error);
      setLoading(false);
      return;
    }
    await refreshData();
    setLoading(false);
  };

  const handleOtherStatus = () => {
    setShowOtherModal(true);
  };

  const handleOtherConfirm = async (explanation: string) => {
    setShowOtherModal(false);
    await handleStatusChange('other', explanation);
  };

  const handleJobAction = async () => {
    if (!currentJob) return;

    const nextStatus: Record<RequestStatus, RequestStatus> = {
      assigned: 'accepted',
      accepted: 'en_route',
      en_route: 'with_patient',
      with_patient: 'complete',
      pending: 'pending',
      complete: 'complete',
      cancelled: 'cancelled',
      transferred_to_pct: 'transferred_to_pct',
    };

    const targetStatus = nextStatus[currentJob.status];

    // If completing and there's an alert but no reason yet, prompt for one
    if (targetStatus === 'complete' && currentJobAlert && !currentJob.delay_reason) {
      setPendingCompletion(true);
      setShowDelayModal(true);
      return;
    }

    setLoading(true);
    await api.updateRequest(currentJob.id, { status: targetStatus });
    await refreshData();
    setLoading(false);
  };

  const handleDelayNoteSave = async () => {
    if (!currentJob) return;

    setLoading(true);
    if (delayReason.trim()) {
      await api.updateRequest(currentJob.id, { delay_reason: delayReason.trim() });
    }

    if (pendingCompletion) {
      await api.updateRequest(currentJob.id, { status: 'complete' });
      setPendingCompletion(false);
    }

    setShowDelayModal(false);
    setDelayReason('');
    await refreshData();
    setLoading(false);
  };

  const handleDelayNoteSkip = async () => {
    if (!currentJob) return;

    setShowDelayModal(false);
    setDelayReason('');

    if (pendingCompletion) {
      setLoading(true);
      await api.updateRequest(currentJob.id, { status: 'complete' });
      setPendingCompletion(false);
      await refreshData();
      setLoading(false);
    }
  };

  const handleClaimJob = async (jobId: number) => {
    setLoading(true);
    await api.claimRequest(jobId);
    await refreshData();
    setQueueOpen(false);
    setLoading(false);
  };

  const handleStartShift = async (data: { extension?: string; floor_assignment?: Floor }) => {
    setShiftLoading(true);
    const response = await api.startShift(data);
    setShiftLoading(false);

    if (response.data?.shift) {
      setActiveShift(response.data.shift);
      setShowShiftStartModal(false);
    }
  };

  const handleEndShift = async () => {
    setShiftLoading(true);
    await api.endShift();
    await logout();
    setShiftLoading(false);
    navigate('/login');
  };

  const handleRequestHelp = () => {
    requestHelp(currentJob?.id, 'Transporter needs assistance');
  };

  const getActionButtonText = (): string => {
    if (!currentJob) return '';
    const texts: Record<RequestStatus, string> = {
      assigned: 'Accept',
      accepted: 'En Route',
      en_route: 'With Patient',
      with_patient: 'Complete',
      pending: '',
      complete: '',
      transferred_to_pct: '',
      cancelled: '',
    };
    return texts[currentJob.status] || '';
  };

  const getStatusButtonClass = (status: TransporterStatus): string => {
    const base = 'flex-1 py-4 rounded-xl font-bold text-lg transition-all';
    const active = myStatus?.status === status;

    if (status === 'available') {
      return `${base} ${
        active ? 'bg-green-500 text-white shadow-lg' : 'bg-green-100 text-green-700'
      }`;
    }
    if (status === 'on_break') {
      return `${base} ${
        active ? 'bg-yellow-500 text-white shadow-lg' : 'bg-yellow-100 text-yellow-700'
      }`;
    }
    return `${base} ${
      active ? 'bg-gray-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700'
    }`;
  };

  const quickDelayReasons = [
    'Patient not ready',
    'Elevator delay',
    'Waiting for equipment',
    'Staff coordination',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* Shift Info */}
        {activeShift && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-700">
                <span className="font-medium">Shift started:</span>{' '}
                {new Date(activeShift.shift_start).toLocaleTimeString()}
              </p>
              {activeShift.extension && (
                <p className="text-sm text-primary">
                  Extension: <span className="font-medium">{activeShift.extension}</span>
                </p>
              )}
              {activeShift.floor_assignment && (
                <p className="text-sm text-primary">
                  Floor: <span className="font-medium">{activeShift.floor_assignment}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => setShowShiftEndModal(true)}
              className="text-sm text-primary-700 hover:text-primary-700 underline"
            >
              End Shift
            </button>
          </div>
        )}

        {/* No active shift prompt */}
        {!activeShift && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-2">
              You haven't started your shift yet.
            </p>
            <button
              onClick={() => setShowShiftStartModal(true)}
              className="btn-primary text-sm"
            >
              Start Shift
            </button>
          </div>
        )}

        {/* Sound Settings */}
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Notification Sounds</span>
            <MuteToggle showLabel />
          </div>
        </div>

        {/* Cycle Time Alert Indicator for Current Job */}
        {currentJobAlert && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 animate-pulse-subtle">
            <p className="text-yellow-800 font-medium text-sm">
              This job is taking longer than usual ({phaseLabels[currentJobAlert.phase]} phase)
            </p>
            <button
              onClick={() => setShowDelayModal(true)}
              className="mt-2 text-sm bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-3 py-1 rounded"
            >
              Add Delay Note
            </button>
          </div>
        )}

        {/* Cycle Time Alerts (for dismissed alerts visibility) */}
        {cycleTimeAlerts
          .filter((a) => currentJob && a.request_id === currentJob.id)
          .map((alert) => (
            <CycleTimeAlert
              key={alert.request_id}
              alert={alert}
              request={currentJob}
              onDismiss={dismissCycleAlert}
            />
          ))}

        {/* Current Status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Current Status</span>
            {myStatus && <TransporterStatusBadge status={myStatus.status} size="lg" />}
          </div>

          {/* Show explanation if status is 'other' */}
          {myStatus?.status === 'other' && myStatus.status_explanation && (
            <p className="text-sm text-gray-500 mb-4 italic">
              Reason: {myStatus.status_explanation}
            </p>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {!currentJob && (
            <div className="flex gap-3">
              <button
                onClick={() => handleStatusChange('available')}
                disabled={loading}
                className={getStatusButtonClass('available')}
              >
                Available
              </button>
              <button
                onClick={() => handleStatusChange('on_break')}
                disabled={loading}
                className={getStatusButtonClass('on_break')}
              >
                On Break
              </button>
              <button
                onClick={handleOtherStatus}
                disabled={loading}
                className={getStatusButtonClass('other')}
              >
                Other
              </button>
            </div>
          )}
        </div>

        {/* Current Job Card */}
        {currentJob ? (
          <div className={`card border-2 ${currentJobAlert ? 'border-yellow-400 animate-pulse-subtle' : 'border-primary-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Current Job</h2>
              <PriorityBadge priority={currentJob.priority} size="lg" />
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">
                  {currentJob.origin_floor} - {currentJob.room_number}
                </p>
                <p className="text-xl text-gray-600 mt-2">{currentJob.destination}</p>
              </div>

              {currentJob.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">{currentJob.notes}</p>
                </div>
              )}

              {/* Show if delay reason already provided */}
              {currentJob.delay_reason && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Delay note:</span> {currentJob.delay_reason}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-gray-600">
                <span>Elapsed:</span>
                <ElapsedTimer startTime={currentJob.created_at} className="text-xl" />
              </div>

              <button
                onClick={handleJobAction}
                disabled={loading}
                className="w-full py-4 bg-primary text-white text-xl font-bold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : getActionButtonText()}
              </button>

              {/* Add Note Button (always visible) */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDelayModal(true)}
                  className="flex-1 py-2 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-lg"
                >
                  + Add Note
                </button>
                <button
                  onClick={handleRequestHelp}
                  className="flex-1 py-2 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-lg"
                >
                  Request Help
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card bg-gray-100 text-center py-8">
            <p className="text-gray-500 text-lg">No active job</p>
            <p className="text-gray-400 text-sm mt-1">
              Claim a job from the queue or wait for assignment
            </p>
          </div>
        )}

        {/* Queue Button */}
        {!currentJob && myStatus?.status === 'available' && (
          <button
            onClick={() => setQueueOpen(true)}
            className="w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <span>View Queue</span>
            {pendingJobs.length > 0 && (
              <span className="bg-white text-indigo-600 px-2 py-0.5 rounded-full text-sm">
                {pendingJobs.length}
              </span>
            )}
          </button>
        )}
      </main>

      {/* Queue Modal */}
      <Modal isOpen={queueOpen} onClose={() => setQueueOpen(false)} title="Job Queue" size="lg">
        {pendingJobs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No pending jobs</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingJobs.map((job) => (
              <div
                key={job.id}
                className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <PriorityBadge priority={job.priority} size="sm" />
                    <span className="font-bold text-gray-900">
                      {job.origin_floor} - {job.room_number}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{job.destination}</p>
                </div>
                <button
                  onClick={() => handleClaimJob(job.id)}
                  disabled={loading}
                  className="btn-primary"
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delay Note Modal */}
      <Modal
        isOpen={showDelayModal}
        onClose={() => {
          if (!pendingCompletion) {
            setShowDelayModal(false);
            setDelayReason('');
          }
        }}
        title="Delay Note"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {pendingCompletion
              ? 'Please explain the delay (optional but helpful):'
              : 'Add a note explaining any delays:'}
          </p>

          <div className="flex flex-wrap gap-2">
            {quickDelayReasons.map((reason) => (
              <button
                key={reason}
                onClick={() => setDelayReason(reason)}
                className={`text-sm px-3 py-1 rounded ${
                  delayReason === reason
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="Or enter custom reason..."
            className="input w-full"
          />

          <div className="flex gap-2">
            <button
              onClick={handleDelayNoteSave}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Saving...' : pendingCompletion ? 'Save & Complete' : 'Save Note'}
            </button>
            <button
              onClick={handleDelayNoteSkip}
              disabled={loading}
              className="btn-secondary"
            >
              Skip
            </button>
          </div>
        </div>
      </Modal>

      {/* Other Status Modal */}
      <OtherStatusModal
        isOpen={showOtherModal}
        onClose={() => setShowOtherModal(false)}
        onConfirm={handleOtherConfirm}
      />

      {/* Shift Modals */}
      <ShiftStartModal
        isOpen={showShiftStartModal}
        onClose={() => setShowShiftStartModal(false)}
        onStart={handleStartShift}
        loading={shiftLoading}
      />

      <ShiftEndModal
        isOpen={showShiftEndModal}
        onClose={() => setShowShiftEndModal(false)}
        onConfirm={handleEndShift}
        loading={shiftLoading}
      />
    </div>
  );
}
