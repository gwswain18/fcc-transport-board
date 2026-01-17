// Re-export shared types
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
  password_hash?: string;
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
  user?: User;
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

// Express augmentation
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: User;
}
