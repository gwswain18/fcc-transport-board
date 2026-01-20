// Re-export shared types
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
  password_hash?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  primary_floor?: Floor;
  phone_number?: string;
  include_in_analytics: boolean;
  is_temp_account: boolean;
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
  user?: User;
}

export interface TransportRequest {
  id: number;
  origin_floor: Floor;
  room_number: string;
  destination: string;
  priority: Priority;
  notes?: string;
  status: RequestStatus;
  assignment_method: AssignmentMethod;
  created_by: number;
  assigned_to?: number;
  created_at: string;
  assigned_at?: string;
  accepted_at?: string;
  en_route_at?: string;
  with_patient_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  creator?: User;
  assignee?: User;
}

export interface StatusHistoryRecord {
  id: number;
  request_id: number;
  user_id: number;
  from_status: RequestStatus;
  to_status: RequestStatus;
  timestamp: string;
}

// Cycle time alert
export interface CycleTimeAlert {
  request_id: number;
  phase: string;
  current_seconds: number;
  avg_seconds: number;
  threshold_percentage: number;
  transporter_id: number;
}

// Floor room validation
export const FLOOR_ROOM_RANGES: Record<Floor, { min: number; max: number }> = {
  FCC1: { min: 100, max: 199 },
  FCC4: { min: 400, max: 499 },
  FCC5: { min: 500, max: 599 },
  FCC6: { min: 600, max: 699 },
};

export interface FloorRoomValidation {
  floor: Floor;
  room_number: string;
  is_valid: boolean;
  error?: string;
}

// Express augmentation
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: User;
}
