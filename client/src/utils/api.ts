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
    request<{ user: import('../types').User; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: import('../types').User }>('/auth/me'),

  // Users
  getUsers: () => request<{ users: import('../types').User[] }>('/users'),

  createUser: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
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
    }>
  ) =>
    request<{ user: import('../types').User; message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetPassword: (id: number, password: string) =>
    request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),

  // Transporter Status
  getStatuses: () =>
    request<{ statuses: import('../types').TransporterStatusRecord[] }>('/status'),

  updateStatus: (status: import('../types').TransporterStatus) =>
    request<{ status: import('../types').TransporterStatusRecord; message: string }>(
      '/status',
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
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
};
