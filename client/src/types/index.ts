export type UserRole = 'transporter' | 'dispatcher' | 'supervisor' | 'manager';

// Changed 'off_unit' to 'other' per feature #4
export type TransporterStatus =
  | 'available'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'with_patient'
  | 'on_break'
  | 'other'
  | 'offline';

export type Floor = 'FCC1' | 'FCC4' | 'FCC5' | 'FCC6';

export type Priority = 'routine' | 'stat';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'with_patient'
  | 'complete'
  | 'cancelled'
  | 'transferred_to_pct';

export type AssignmentMethod = 'manual' | 'claim' | 'auto';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  primary_floor?: Floor;
  phone_number?: string;
  include_in_analytics?: boolean;
  is_temp_account?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransporterStatusRecord {
  id: number;
  user_id: number;
  status: TransporterStatus;
  status_explanation?: string;
  on_break_since?: string;
  updated_at: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    primary_floor?: Floor;
    phone_number?: string;
  };
  current_job?: {
    id: number;
    origin_floor: Floor;
    room_number: string;
    status: RequestStatus;
    priority?: Priority;
    assigned_at?: string;
    accepted_at?: string;
    en_route_at?: string;
    with_patient_at?: string;
  } | null;
  shift?: {
    extension?: string;
    floor_assignment?: Floor;
  } | null;
}

export interface TransportRequest {
  id: number;
  origin_floor: Floor;
  room_number: string;
  destination: string;
  priority: Priority;
  notes?: string;
  status: RequestStatus;
  assignment_method?: AssignmentMethod;
  created_by: number;
  assigned_to?: number;
  created_at: string;
  assigned_at?: string;
  accepted_at?: string;
  en_route_at?: string;
  with_patient_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  delay_reason?: string;
  creator?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  assignee?: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  last_modifier?: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
}

export interface CreateTransportRequestData {
  origin_floor: Floor;
  room_number: string;
  destination: string;
  priority: Priority;
  notes?: string;
  assigned_to?: number;
  auto_assign?: boolean;
}

export interface ReportSummary {
  total_completed: number;
  total_cancelled: number;
  total_pct: number;
  avg_response_time_minutes: number;
  avg_pickup_time_minutes: number;
  avg_transport_time_minutes: number;
  avg_cycle_time_minutes: number;
  timeout_rate: number;
}

export interface TransporterStats {
  user_id: number;
  first_name: string;
  last_name: string;
  jobs_completed: number;
  avg_pickup_time_minutes: number;
  avg_transport_time_minutes: number;
  idle_time_minutes: number;
}

export interface AlertData {
  request_id: number;
  type: 'pending_timeout' | 'stat_timeout' | 'acceptance_timeout';
  request: TransportRequest;
}

// Shift tracking
export interface ShiftLog {
  id: number;
  user_id: number;
  shift_start: string;
  shift_end?: string;
  extension?: string;
  floor_assignment?: Floor;
  created_at: string;
}

// Cycle time alerts
export interface CycleTimeAlert {
  request_id: number;
  phase: string;
  current_seconds: number;
  avg_seconds: number;
  threshold_percentage: number;
  transporter_id: number;
}

// Active dispatcher
export interface ActiveDispatcher {
  id: number;
  user_id: number;
  is_primary: boolean;
  on_break?: boolean;
  contact_info?: string;
  started_at: string;
  user?: User;
}

// Break alert
export interface BreakAlert {
  user_id: number;
  minutes_on_break: number;
  first_name?: string;
  last_name?: string;
}

// Transporter offline event
export interface TransporterOffline {
  user_id: number;
  last_heartbeat: string;
  first_name?: string;
  last_name?: string;
}

// Alert timing configuration (minutes)
export interface AlertTiming {
  pending_timeout_minutes: number;
  stat_timeout_minutes: number;
  acceptance_timeout_minutes: number;
  break_alert_minutes: number;
  offline_alert_minutes: number;
}

// Job removed notification (cancel/reassign)
export interface JobRemovedNotification {
  request_id: number;
  action: 'cancelled' | 'reassigned';
  actor_name: string;
  job_summary: string;
}

// Alert settings
export interface AlertSettings {
  master_enabled: boolean;
  alerts: {
    pending_timeout: boolean;
    stat_timeout: boolean;
    acceptance_timeout: boolean;
    break_alert: boolean;
    offline_alert: boolean;
    cycle_time_alert: boolean;
  };
  timing?: AlertTiming;
  require_explanation_on_dismiss: boolean;
}
