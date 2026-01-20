const API_BASE = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'An error occurred' };
    }

    return { data };
  } catch (error) {
    return { error: 'Network error' };
  }
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ user: import('../types').User; activeShift?: import('../types').ShiftLog; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: import('../types').User; activeShift?: import('../types').ShiftLog }>('/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>(`/auth/reset-password/${token}`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),

  recoverUsername: (email: string) =>
    request<{ message: string }>('/auth/recover-username', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  heartbeat: () => request<{ message: string; timestamp: string }>('/auth/heartbeat', { method: 'POST' }),

  // Users
  getUsers: () => request<{ users: import('../types').User[] }>('/users'),

  getTransporters: () => request<{ transporters: import('../types').User[] }>('/users/transporters'),

  createUser: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
    primary_floor?: string;
    phone_number?: string;
    include_in_analytics?: boolean;
  }) =>
    request<{ user: import('../types').User; message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (
    id: number,
    data: Partial<{
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      is_active: boolean;
      primary_floor: string;
      phone_number: string;
      include_in_analytics: boolean;
    }>
  ) =>
    request<{ user: import('../types').User; message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetUserPassword: (id: number, password: string) =>
    request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),

  // Transporter Status
  getStatuses: () =>
    request<{ statuses: import('../types').TransporterStatusRecord[] }>('/status'),

  updateStatus: (status: import('../types').TransporterStatus, explanation?: string) =>
    request<{ status: import('../types').TransporterStatusRecord; message: string }>(
      '/status',
      {
        method: 'PUT',
        body: JSON.stringify({ status, explanation }),
      }
    ),

  overrideStatus: (userId: number, new_status: string, reason: string) =>
    request<{ status: import('../types').TransporterStatusRecord; message: string }>(
      `/status/${userId}/override`,
      {
        method: 'PUT',
        body: JSON.stringify({ new_status, reason }),
      }
    ),

  // Transport Requests
  getRequests: (params?: {
    status?: string;
    floor?: string;
    assigned_to?: number;
    include_complete?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{ requests: import('../types').TransportRequest[] }>(
      `/requests${query ? `?${query}` : ''}`
    );
  },

  createRequest: (data: import('../types').CreateTransportRequestData) =>
    request<{ request: import('../types').TransportRequest; message: string }>(
      '/requests',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  updateRequest: (id: number, data: { status?: string; assigned_to?: number }) =>
    request<{ request: import('../types').TransportRequest; message: string }>(
      `/requests/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  cancelRequest: (id: number) =>
    request<{ request: import('../types').TransportRequest; message: string }>(
      `/requests/${id}/cancel`,
      { method: 'PUT' }
    ),

  claimRequest: (id: number) =>
    request<{ request: import('../types').TransportRequest; message: string }>(
      `/requests/${id}/claim`,
      { method: 'PUT' }
    ),

  autoAssignRequest: (id: number) =>
    request<{ request: import('../types').TransportRequest; assigned_to: number; reason: string; message: string }>(
      `/requests/${id}/auto-assign`,
      { method: 'POST' }
    ),

  assignToPCT: (id: number) =>
    request<{ request: import('../types').TransportRequest; message: string }>(
      `/requests/${id}/assign-pct`,
      { method: 'PUT' }
    ),

  // Shifts
  startShift: (data?: { extension?: string; floor_assignment?: string }) =>
    request<{ shift: import('../types').ShiftLog; message: string }>('/shifts/start', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  endShift: () =>
    request<{ shift: import('../types').ShiftLog; message: string }>('/shifts/end', {
      method: 'PUT',
    }),

  updateExtension: (extension: string) =>
    request<{ shift: import('../types').ShiftLog; message: string }>('/shifts/extension', {
      method: 'PUT',
      body: JSON.stringify({ extension }),
    }),

  getCurrentShift: () =>
    request<{ shift: import('../types').ShiftLog | null }>('/shifts/current'),

  // Dispatchers
  getActiveDispatchers: () =>
    request<{ dispatchers: import('../types').ActiveDispatcher[] }>('/dispatchers/active'),

  setPrimaryDispatcher: (contact_info?: string) =>
    request<{ message: string }>('/dispatchers/set-primary', {
      method: 'POST',
      body: JSON.stringify({ contact_info }),
    }),

  registerAsDispatcher: (contact_info?: string) =>
    request<{ message: string }>('/dispatchers/register', {
      method: 'POST',
      body: JSON.stringify({ contact_info }),
    }),

  dispatcherTakeBreak: (replacement_user_id?: number, relief_info?: string) =>
    request<{ message: string }>('/dispatchers/take-break', {
      method: 'POST',
      body: JSON.stringify({ replacement_user_id, relief_info }),
    }),

  dispatcherReturn: (as_primary?: boolean) =>
    request<{ message: string }>('/dispatchers/return', {
      method: 'POST',
      body: JSON.stringify({ as_primary }),
    }),

  getAvailableDispatchers: () =>
    request<{ dispatchers: Array<{ id: number; first_name: string; last_name: string; dispatcher_id?: number; is_primary?: boolean }> }>('/dispatchers/available'),

  // Config
  getConfig: () =>
    request<{ config: Record<string, unknown> }>('/config'),

  getConfigByKey: (key: string) =>
    request<{ key: string; value: unknown }>(`/config/${key}`),

  updateConfig: (key: string, value: unknown) =>
    request<{ message: string }>(`/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // Reports
  getReportSummary: (params?: {
    start_date?: string;
    end_date?: string;
    shift_start?: string;
    shift_end?: string;
    floor?: string;
    transporter_id?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{ summary: import('../types').ReportSummary }>(
      `/reports/summary${query ? `?${query}` : ''}`
    );
  },

  getReportByTransporter: (params?: {
    start_date?: string;
    end_date?: string;
    floor?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{ transporters: import('../types').TransporterStats[] }>(
      `/reports/by-transporter${query ? `?${query}` : ''}`
    );
  },

  getJobsByHour: (params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{ data: { hour: number; count: number }[] }>(
      `/reports/by-hour${query ? `?${query}` : ''}`
    );
  },

  getJobsByFloor: (params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{ data: { floor: string; count: number }[] }>(
      `/reports/by-floor${query ? `?${query}` : ''}`
    );
  },

  getStaffingByFloor: (params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{
      staffing: Array<{
        floor: import('../types').Floor;
        active_transporters: number;
        available_transporters: number;
        busy_transporters: number;
        on_break_transporters: number;
      }>;
    }>(`/reports/staffing-by-floor${query ? `?${query}` : ''}`);
  },

  getFloorAnalysis: (params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request<{
      floors: Array<{
        floor: import('../types').Floor;
        total_requests: number;
        avg_response_time: number;
        avg_pickup_time: number;
        avg_transport_time: number;
        avg_cycle_time: number;
        pct_transferred: number;
        cancelled_count: number;
      }>;
    }>(`/reports/floor-analysis${query ? `?${query}` : ''}`);
  },

  exportData: (params?: {
    start_date?: string;
    end_date?: string;
    floor?: string;
    transporter_id?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    window.location.href = `${API_BASE}/reports/export${query ? `?${query}` : ''}`;
  },

  // Offline sync
  syncOfflineActions: (actions: Array<{ action_type: string; payload: unknown; created_offline_at: string }>) =>
    request<{ processed: number; failed: number; errors: Array<{ index: number; error: string }> }>('/offline/sync', {
      method: 'POST',
      body: JSON.stringify({ actions }),
    }),
};
