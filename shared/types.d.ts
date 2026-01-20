export type UserRole = 'transporter' | 'dispatcher' | 'supervisor' | 'manager';
export type TransporterStatus = 'available' | 'assigned' | 'accepted' | 'en_route' | 'with_patient' | 'on_break' | 'other' | 'offline';
export type Floor = 'FCC1' | 'FCC4' | 'FCC5' | 'FCC6';
export type Priority = 'routine' | 'stat';
export type RequestStatus = 'pending' | 'assigned' | 'accepted' | 'en_route' | 'with_patient' | 'complete' | 'cancelled';
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
    include_in_analytics: boolean;
    is_temp_account: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateUserInput {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    primary_floor?: Floor;
    phone_number?: string;
    include_in_analytics?: boolean;
}
export interface UpdateUserInput {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
    is_active?: boolean;
    primary_floor?: Floor;
    phone_number?: string;
    include_in_analytics?: boolean;
}
export interface TransporterStatusRecord {
    id: number;
    user_id: number;
    status: TransporterStatus;
    status_explanation?: string;
    on_break_since?: string;
    updated_at: string;
    user?: User;
    current_job?: TransportRequest;
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
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: User;
    message: string;
}
export interface CreateTransportRequest {
    origin_floor: Floor;
    room_number: string;
    destination: string;
    priority: Priority;
    notes?: string;
    assigned_to?: number;
    assignment_method?: AssignmentMethod;
}
export interface UpdateTransportRequest {
    status?: RequestStatus;
    assigned_to?: number;
    assignment_method?: AssignmentMethod;
}
export interface ReportFilters {
    start_date?: string;
    end_date?: string;
    shift_start?: string;
    shift_end?: string;
    floor?: Floor;
    transporter_id?: number;
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
export interface ShiftLog {
    id: number;
    user_id: number;
    shift_start: string;
    shift_end?: string;
    extension?: string;
    floor_assignment?: Floor;
    created_at: string;
    user?: User;
}
export interface StartShiftInput {
    extension?: string;
    floor_assignment?: Floor;
}
export interface EndShiftInput {
    reason?: string;
}
export interface CycleTimeAverage {
    id: number;
    phase: string;
    floor?: Floor;
    avg_seconds: number;
    sample_count: number;
    calculated_at: string;
}
export interface CycleTimeAlert {
    request_id: number;
    phase: string;
    current_seconds: number;
    avg_seconds: number;
    threshold_percentage: number;
    transporter_id: number;
}
export interface SystemConfig {
    key: string;
    value: string | number | boolean | object;
    updated_at: string;
}
export interface UserHeartbeat {
    user_id: number;
    last_heartbeat: string;
    socket_id?: string;
}
export interface AuditLog {
    id: number;
    user_id?: number;
    action: string;
    entity_type: string;
    entity_id?: number;
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
    user?: User;
}
export type AuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'assign' | 'status_change' | 'password_change' | 'password_reset' | 'shift_start' | 'shift_end' | 'override';
export interface ActiveDispatcher {
    id: number;
    user_id: number;
    is_primary: boolean;
    contact_info?: string;
    started_at: string;
    ended_at?: string;
    replaced_by?: number;
    user?: User;
}
export interface PasswordResetToken {
    id: number;
    user_id: number;
    token: string;
    expires_at: string;
    used_at?: string;
    created_at: string;
}
export interface ChangePasswordInput {
    current_password: string;
    new_password: string;
}
export interface ForgotPasswordInput {
    email: string;
}
export interface ResetPasswordInput {
    token: string;
    new_password: string;
}
export interface RecoverUsernameInput {
    email: string;
}
export interface OfflineAction {
    id: number;
    user_id?: number;
    action_type: string;
    payload: Record<string, unknown>;
    created_offline_at: string;
    processed_at?: string;
    status: 'pending' | 'processed' | 'failed';
    error_message?: string;
}
export interface OfflineSyncRequest {
    actions: Array<{
        action_type: string;
        payload: Record<string, unknown>;
        created_offline_at: string;
    }>;
}
export interface OfflineSyncResponse {
    processed: number;
    failed: number;
    errors: Array<{
        index: number;
        error: string;
    }>;
}
export interface AutoAssignResult {
    request_id: number;
    assigned_to: number;
    assignment_method: 'auto';
    reason: string;
}
export interface FloorRoomValidation {
    floor: Floor;
    room_number: string;
    is_valid: boolean;
    error?: string;
}
export declare const FLOOR_ROOM_RANGES: Record<Floor, {
    min: number;
    max: number;
}>;
export interface SocketEvents {
    transporter_status_changed: TransporterStatusRecord;
    request_created: TransportRequest;
    request_assigned: TransportRequest;
    request_status_changed: TransportRequest;
    request_cancelled: TransportRequest;
    alert_triggered: AlertData;
    cycle_time_alert: CycleTimeAlert;
    break_alert: {
        user_id: number;
        minutes_on_break: number;
    };
    transporter_offline: {
        user_id: number;
        last_heartbeat: string;
    };
    auto_assign_timeout: {
        request_id: number;
        old_assignee: number;
        new_assignee?: number;
    };
    dispatcher_changed: {
        dispatchers: ActiveDispatcher[];
    };
    shift_started: ShiftLog;
    shift_ended: ShiftLog;
    extension_updated: {
        user_id: number;
        extension: string;
    };
    help_requested: {
        user_id: number;
        request_id?: number;
        message?: string;
    };
}
export interface AlertData {
    request_id: number;
    type: 'pending_timeout' | 'stat_timeout' | 'acceptance_timeout';
    request: TransportRequest;
}
export interface HeartbeatPayload {
    timestamp: string;
}
export interface NotificationPreferences {
    browser_enabled: boolean;
    sound_enabled: boolean;
    sms_enabled: boolean;
}
export interface NotificationPayload {
    title: string;
    body: string;
    type: 'assignment' | 'alert' | 'status' | 'system';
    data?: Record<string, unknown>;
}
export interface FloorAnalytics {
    floor: Floor;
    total_requests: number;
    completed_requests: number;
    avg_response_time: number;
    avg_cycle_time: number;
    busiest_hour: number;
}
export interface StaffingMetrics {
    floor: Floor;
    assigned_transporters: number;
    available_transporters: number;
    requests_per_transporter: number;
}
export interface StatusOverrideInput {
    user_id: number;
    new_status: TransporterStatus;
    reason: string;
}
//# sourceMappingURL=types.d.ts.map