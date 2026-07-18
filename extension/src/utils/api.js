/**
 * BookSmart API Utility
 * Handles all network requests to the backend
 */

import '../config.js';
const API_BASE_URL = globalThis.API_BASE_URL;

let activeRefreshPromise = null;

/**
 * Self-healing token check for extension API client.
 * Ensures the token is always valid before any network call.
 */
async function checkAndRefreshTokenInApi() {
  try {
    const { auth_token, refresh_token, token_expires_at } = await browser.storage.local.get([
      'auth_token',
      'refresh_token',
      'token_expires_at'
    ]);

    if (!refresh_token) return auth_token;

    let expiresAt = token_expires_at || 0;
    if (expiresAt && expiresAt < 10000000000) {
      expiresAt = expiresAt * 1000;
    }

    // Parse expiration from JWT payload if missing in storage
    if (!expiresAt && auth_token) {
      try {
        const payload = JSON.parse(atob(auth_token.split('.')[1]));
        if (payload.exp) expiresAt = payload.exp * 1000;
      } catch (e) {}
    }

    // Refresh if expired or expiring within 5 minutes
    if (!expiresAt || expiresAt - Date.now() < 300000) {
      if (activeRefreshPromise) {
        console.log('[API Client] Refresh already in progress, waiting...');
        return activeRefreshPromise;
      }

      activeRefreshPromise = (async () => {
        try {
          console.log('[API Client] Token expired or expiring soon, refreshing in background...');
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.session?.access_token) {
              const newExpiresAt = data.session.expires_at
                ? (data.session.expires_at < 10000000000 ? data.session.expires_at * 1000 : data.session.expires_at)
                : 0;

              await browser.storage.local.set({
                'auth_token': data.session.access_token,
                'refresh_token': data.session.refresh_token,
                'token_expires_at': newExpiresAt
              });
              console.log('[API Client] Token refreshed successfully.');
              return data.session.access_token;
            }
          }
          console.warn('[API Client] Token refresh failed.');
          return auth_token;
        } catch (err) {
          console.error('[API Client] Error refreshing token via fetch:', err);
          return auth_token;
        } finally {
          activeRefreshPromise = null;
        }
      })();

      return activeRefreshPromise;
    }
    return auth_token;
  } catch (error) {
    console.error('[API Client] Error refreshing token:', error);
    return null;
  }
}

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
    const token = await checkAndRefreshTokenInApi();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
    }),

  syncFoldersBatch: (updates) =>
    apiClient('/bookmarks/folders/sync-batch', {
      method: 'POST',
      body: JSON.stringify({ updates })
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
