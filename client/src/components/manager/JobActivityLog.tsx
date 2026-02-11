import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Floor } from '../../types';

interface CompletedJob {
  id: number;
  origin_floor: string;
  room_number: string;
  destination: string;
  priority: string;
  notes: string | null;
  status: string;
  delay_reason: string | null;
  assignment_method: string | null;
  created_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  en_route_at: string | null;
  with_patient_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  pct_assigned_at: string | null;
  creator: { first_name: string; last_name: string } | null;
  assignee: { first_name: string; last_name: string } | null;
  reassignments: Array<{ from_name: string; to_name: string; timestamp: string }>;
  delays: Array<{ reason: string; custom_note?: string; phase?: string; created_at: string }>;
  cancelled_by: { first_name: string; last_name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  complete: { label: 'Complete', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  transferred_to_pct: { label: 'PCT', className: 'bg-purple-100 text-purple-700' },
};

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  stat: { label: 'STAT', className: 'bg-red-100 text-red-700 font-bold' },
  urgent: { label: 'Urgent', className: 'bg-orange-100 text-orange-700' },
  routine: { label: 'Routine', className: 'bg-gray-100 text-gray-600' },
};

function formatDateTime(ts: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(ts: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startTs: string | null, endTs: string | null): string {
  if (!startTs || !endTs) return '-';
  const diffMs = new Date(endTs).getTime() - new Date(startTs).getTime();
  const totalSeconds = Math.round(diffMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function PersonName({ person, status }: { person: { first_name: string; last_name: string } | null; status?: string }) {
  if (!person) {
    if (status === 'transferred_to_pct') return <span className="text-purple-600 font-medium">PCT</span>;
    return <span className="text-gray-400">Unassigned</span>;
  }
  return <span>{person.first_name} {person.last_name}</span>;
}

interface TimelineStepProps {
  label: string;
  time: string | null;
  duration?: string;
  isLast?: boolean;
  isCancelled?: boolean;
  isReassignment?: boolean;
  subtitle?: string;
}

function TimelineStep({ label, time, duration, isLast, isCancelled, isReassignment, subtitle }: TimelineStepProps) {
  const hasTime = !!time;
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 ${
          isCancelled ? 'bg-red-400' : isReassignment ? 'bg-orange-400' : hasTime ? 'bg-blue-500' : 'bg-gray-300'
        }`} />
        {!isLast && <div className={`w-0.5 h-8 ${
          isReassignment ? 'bg-orange-200' : hasTime ? 'bg-blue-200' : 'bg-gray-200'
        }`} />}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isReassignment ? 'text-orange-700' : 'text-gray-700'}`}>{label}</span>
          {duration && duration !== '-' && (
            <span className="text-xs text-gray-400">({duration})</span>
          )}
        </div>
        {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        <span className={`text-xs ${hasTime ? 'text-gray-500' : 'text-gray-300'}`}>
          {hasTime ? formatTime(time) : 'N/A'}
        </span>
      </div>
    </div>
  );
}

function TimelineSteps({ job }: { job: CompletedJob }) {
  // Build a list of all timeline events (phase steps + reassignments) sorted by time
  type TimelineEvent =
    | { type: 'phase'; label: string; time: string | null; duration?: string; isCancelled?: boolean; subtitle?: string }
    | { type: 'reassignment'; from_name: string; to_name: string; time: string };

  const events: TimelineEvent[] = [];

  // Phase steps with their timestamps
  const phases: Array<{ label: string; time: string | null; nextTime: string | null }> = [
    { label: 'Created', time: job.created_at, nextTime: job.assigned_at },
    { label: 'Assigned', time: job.assigned_at, nextTime: job.accepted_at },
    { label: 'Accepted', time: job.accepted_at, nextTime: job.en_route_at },
    { label: 'En Route', time: job.en_route_at, nextTime: job.with_patient_at },
    { label: 'With Patient', time: job.with_patient_at, nextTime: job.completed_at },
  ];

  for (const phase of phases) {
    events.push({
      type: 'phase',
      label: phase.label,
      time: phase.time,
      duration: formatDuration(phase.time, phase.nextTime),
    });
  }

  // Add reassignment events
  for (const r of job.reassignments) {
    events.push({
      type: 'reassignment',
      from_name: r.from_name,
      to_name: r.to_name,
      time: r.timestamp,
    });
  }

  // Add final step (cancelled or completed)
  if (job.status === 'cancelled') {
    const cancelledSubtitle = job.cancelled_by
      ? `by ${job.cancelled_by.first_name} ${job.cancelled_by.last_name}`
      : undefined;
    events.push({
      type: 'phase',
      label: 'Cancelled',
      time: job.cancelled_at,
      isCancelled: true,
      subtitle: cancelledSubtitle,
    });
  } else if (job.status === 'transferred_to_pct') {
    events.push({
      type: 'phase',
      label: 'Transferred to PCT',
      time: job.pct_assigned_at || job.completed_at,
    });
  } else {
    events.push({
      type: 'phase',
      label: 'Completed',
      time: job.completed_at,
    });
  }

  // Sort events: phase steps without time go in their natural order,
  // reassignments are inserted by timestamp between phase steps
  // We keep phases in order but insert reassignments at the right position
  const phaseEvents = events.filter(e => e.type === 'phase') as Array<TimelineEvent & { type: 'phase' }>;
  const reassignEvents = (events.filter(e => e.type === 'reassignment') as Array<TimelineEvent & { type: 'reassignment' }>)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Build merged timeline: insert reassignments after the last phase step that occurred before them
  const merged: TimelineEvent[] = [];
  let reassignIdx = 0;

  for (const phase of phaseEvents) {
    merged.push(phase);
    // Insert any reassignments that occurred after this phase but before the next
    while (reassignIdx < reassignEvents.length) {
      const r = reassignEvents[reassignIdx];
      const rTime = new Date(r.time).getTime();
      // Find the next phase with a time
      const nextPhaseIdx = phaseEvents.indexOf(phase) + 1;
      const nextPhase = nextPhaseIdx < phaseEvents.length ? phaseEvents[nextPhaseIdx] : null;
      const nextPhaseTime = nextPhase?.time ? new Date(nextPhase.time).getTime() : Infinity;

      if (phase.time && rTime >= new Date(phase.time).getTime() && rTime < nextPhaseTime) {
        merged.push(r);
        reassignIdx++;
      } else {
        break;
      }
    }
  }

  // Add any remaining reassignments at the end
  while (reassignIdx < reassignEvents.length) {
    merged.push(reassignEvents[reassignIdx]);
    reassignIdx++;
  }

  return (
    <>
      {merged.map((event, i) => {
        const isLast = i === merged.length - 1;
        if (event.type === 'reassignment') {
          return (
            <TimelineStep
              key={`reassign-${i}`}
              label={`Reassigned`}
              time={event.time}
              isReassignment
              subtitle={`${event.from_name} → ${event.to_name}`}
              isLast={isLast}
            />
          );
        }
        return (
          <TimelineStep
            key={`phase-${i}`}
            label={event.label}
            time={event.time}
            duration={event.duration}
            isCancelled={event.isCancelled}
            subtitle={event.subtitle}
            isLast={isLast}
          />
        );
      })}
    </>
  );
}

function JobCard({ job, expanded, onToggle }: { job: CompletedJob; expanded: boolean; onToggle: () => void }) {
  const statusBadge = STATUS_BADGES[job.status] || { label: job.status, className: 'bg-gray-100 text-gray-600' };
  const priorityBadge = PRIORITY_BADGES[job.priority] || { label: job.priority, className: 'bg-gray-100 text-gray-600' };

  const totalDuration = job.status === 'cancelled'
    ? formatDuration(job.created_at, job.cancelled_at)
    : formatDuration(job.created_at, job.completed_at);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      {/* Card header - always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        {/* Location */}
        <div className="flex-shrink-0 w-24">
          <span className="text-lg font-bold text-gray-900">
            {job.origin_floor}-{job.room_number}
          </span>
        </div>

        {/* Status & Priority */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${priorityBadge.className}`}>
            {priorityBadge.label}
          </span>
        </div>

        {/* Destination */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-600 truncate block">
            &rarr; {job.destination}
          </span>
        </div>

        {/* Assignee */}
        <div className="flex-shrink-0 text-sm text-gray-600 hidden sm:block">
          <PersonName person={job.assignee} status={job.status} />
        </div>

        {/* Duration */}
        <div className="flex-shrink-0 text-sm text-gray-500 hidden md:block w-20 text-right">
          {totalDuration}
        </div>

        {/* Date */}
        <div className="flex-shrink-0 text-xs text-gray-400 w-28 text-right hidden lg:block">
          {formatDateTime(job.created_at)}
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 text-gray-400">
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left column: Job info */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Job Details</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">Job ID:</span> <span className="font-medium">#{job.id}</span></div>
                <div><span className="text-gray-500">Created by:</span> <span className="font-medium"><PersonName person={job.creator} /></span></div>
                <div><span className="text-gray-500">Assigned to:</span> <span className="font-medium"><PersonName person={job.assignee} status={job.status} /></span></div>
                {job.assignment_method && (
                  <div><span className="text-gray-500">Assignment:</span> <span className="font-medium capitalize">{job.assignment_method.replace('_', ' ')}</span></div>
                )}
                {job.notes && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-gray-600">
                    <span className="font-medium">Notes:</span> {job.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Middle column: Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</h4>
              <div>
                <TimelineSteps job={job} />
              </div>
            </div>

            {/* Right column: Delays */}
            <div>
              {job.delays.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Delays</h4>
                  <div className="space-y-2">
                    {job.delays.map((d, i) => (
                      <div key={i} className="text-sm p-2 bg-red-50 rounded">
                        <div className="font-medium text-gray-700">{d.reason}</div>
                        {d.phase && <div className="text-xs text-gray-500">Phase: {d.phase}</div>}
                        {d.custom_note && <div className="text-xs text-gray-500 mt-0.5">{d.custom_note}</div>}
                        <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(d.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {job.delays.length === 0 && (
                <div className="text-sm text-gray-400 italic">No delays recorded</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobActivityLog() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    floor: '',
    search: '',
  });

  useEffect(() => {
    loadData(1);
  }, [filters]);

  const loadData = async (page: number) => {
    setLoading(true);
    const response = await api.getCompletedJobs({
      start_date: filters.start_date ? `${filters.start_date}T00:00:00Z` : undefined,
      end_date: filters.end_date ? `${filters.end_date}T23:59:59Z` : undefined,
      floor: filters.floor || undefined,
      search: filters.search || undefined,
      page,
      limit: 20,
    });

    if (response.data) {
      setJobs(response.data.jobs);
      setPagination(response.data.pagination);
    }
    setLoading(false);
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Floor</label>
            <select
              value={filters.floor}
              onChange={(e) => setFilters((prev) => ({ ...prev, floor: e.target.value }))}
              className="input"
            >
              <option value="">All Floors</option>
              {FLOORS.map((floor) => (
                <option key={floor} value={floor}>{floor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Room, name..."
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Job Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Completed Jobs
            {pagination.total > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({pagination.total} jobs)
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No completed jobs found</p>
        ) : (
          <>
            <div className="space-y-2">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => toggleExpand(job.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadData(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadData(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
