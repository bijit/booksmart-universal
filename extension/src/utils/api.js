/**
 * BookSmart API Utility
 * Handles all network requests to the backend
 */

import '../config.js';
const API_BASE_URL = globalThis.API_BASE_URL;

/**
 * Generic API client with auth support
 */
async function apiClient(endpoint, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers
  };

  if (auth) {
    const { auth_token } = await chrome.storage.local.get(['auth_token']);
    if (auth_token) {
      headers['Authorization'] = `Bearer ${auth_token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: response.statusText };
    }
    
    const error = new Error(errorData.error || errorData.message || 'API request failed');
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return await response.json();
}

/**
 * Authentication API
 */
export const auth = {
  login: (email, password) => 
    apiClient('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password })
    }),
    
  register: (name, email, password) =>
    apiClient('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ name, email, password })
    }),
    
  refresh: (refreshToken) =>
    apiClient('/auth/refresh', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refresh_token: refreshToken })
    }),
    
  me: () => apiClient('/auth/me')
};

/**
 * Bookmarks API
 */
export const bookmarks = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return apiClient(`/bookmarks?${searchParams.toString()}`);
  },
  
  get: (id) => apiClient(`/bookmarks/${id}`),
  
  create: (data) => 
    apiClient('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  update: (id, updates) =>
    apiClient(`/bookmarks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
    
  delete: (id) =>
    apiClient(`/bookmarks/${id}`, {
      method: 'DELETE'
    }),
    
  deleteAll: () =>
    apiClient('/bookmarks/all', {
      method: 'DELETE'
    }),
    
  analyze: (data) =>
    apiClient('/bookmarks/analyze', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

/**
 * Search API
 */
export const search = {
  query: (data) =>
    apiClient('/search', {
      method: 'POST',
      body: JSON.stringify({
        limit: 100,
        searchType: 'hybrid',
        ...data
      })
    })
};

/**
 * Import API
 */
export const importJobs = {
  batch: (bookmarks) =>
    apiClient('/import/batch', {
      method: 'POST',
      body: JSON.stringify({ bookmarks })
    }),
    
  getStatus: (jobId) => apiClient(`/import/${jobId}/status`)
};
