// API base URL
const API_BASE_URL = '/api';

// Generic API request handler
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    // Handle session expiry or unauthorized access
    if (response.status === 401) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Dashboard API
export const dashboardApi = {
  getStats: async (filters?: {
    apiNumber?: string;
    customerEmail?: string;
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
    last15MinsOnly?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/stats${queryString ? `?${queryString}` : ''}`);
  },

  getResponseTimes: async (filters?: {
    apiNumber?: string;
    customerEmail?: string;
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
    last15MinsOnly?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/response-times${queryString ? `?${queryString}` : ''}`);
  },

  getSuccessRates: async (filters?: {
    customerEmail?: string;
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
    last15MinsOnly?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/success-rates${queryString ? `?${queryString}` : ''}`);
  },

  getLiveTraffic: async (minutes: number = 30, serverIdentifier?: string, customerEmail?: string) => {
    const params = new URLSearchParams();
    params.append('minutes', String(minutes));
    if (serverIdentifier) params.append('serverIdentifier', serverIdentifier);
    if (customerEmail) params.append('customerEmail', customerEmail);
    return apiRequest(`/dashboard/live-traffic?${params.toString()}`);
  },

  getApiDetails: async (filters?: {
    page?: number;
    limit?: number;
    apiNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/api-details${queryString ? `?${queryString}` : ''}`);
  },

  getApiList: async () => {
    return apiRequest('/dashboard/api-list');
  },

  getCustomerLogs: async (username: string) => {
    return apiRequest(`/dashboard/customer-logs/${encodeURIComponent(username)}`);
  },

  getTopSuccessApis: async (filters?: {
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/top-success-apis${queryString ? `?${queryString}` : ''}`);
  },

  getTopErrorApis: async (filters?: {
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/top-error-apis${queryString ? `?${queryString}` : ''}`);
  },

  getApiSuccessRateHistory: async (filters?: {
    apiNumber?: string;
    hours?: number;
    dateFrom?: string;
    dateTo?: string;
    serverIdentifier?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }
    const queryString = params.toString();
    return apiRequest(`/dashboard/api-success-history${queryString ? `?${queryString}` : ''}`);
  },
};

// Server Health API
export const serverHealthApi = {
  getAllServers: async () => {
    return apiRequest('/server-health');
  },

  getServerByIp: async (ip: string) => {
    return apiRequest(`/server-health/${ip}`);
  },

  updateServerHealth: async (data: {
    serverIp: string;
    cpuUtilization: number;
    ramUsage: number;
    diskSpace: number;
    networkTraffic: number;
    uptime: string;
  }) => {
    return apiRequest('/server-health/update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  initializeServerHealth: async () => {
    return apiRequest('/server-health/initialize', {
      method: 'POST',
    });
  },
};
