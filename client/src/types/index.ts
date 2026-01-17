export type UserRole = 'transporter' | 'dispatcher' | 'supervisor' | 'manager';

export type TransporterStatus =
  | 'available'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'with_patient'
  | 'on_break'
  | 'off_unit'
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
  | 'cancelled';

export type SpecialNeed = 'wheelchair' | 'o2' | 'iv_pump' | 'other';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransporterStatusRecord {
  id: number;
  user_id: number;
  status: TransporterStatus;
  updated_at: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
  };
  current_job?: {
    id: number;
    origin_floor: Floor;
    room_number: string;
    status: RequestStatus;
  } | null;
}

export interface TransportRequest {
  id: number;
  origin_floor: Floor;
  room_number: string;
  patient_initials?: string;
  destination: string;
  priority: Priority;
  special_needs: SpecialNeed[];
  special_needs_notes?: string;
  notes?: string;
  status: RequestStatus;
  created_by: number;
  assigned_to?: number;
  created_at: string;
  assigned_at?: string;
  accepted_at?: string;
  en_route_at?: string;
  with_patient_at?: string;
  completed_at?: string;
  cancelled_at?: string;
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
}

export interface CreateTransportRequestData {
  origin_floor: Floor;
  room_number: string;
  patient_initials?: string;
  destination: string;
  priority: Priority;
  special_needs: SpecialNeed[];
  special_needs_notes?: string;
  notes?: string;
  assigned_to?: number;
}

export interface ReportSummary {
  total_completed: number;
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
