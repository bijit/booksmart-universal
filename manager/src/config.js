// API Configuration
const rawBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
// Ensure the URL ends with /api if it doesn't already, but only if it's an absolute URL
export const API_BASE_URL = rawBaseUrl 
  ? (rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`)
  : '/api';
