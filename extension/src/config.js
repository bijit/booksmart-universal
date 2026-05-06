// BookSmart Configuration
// API Configuration
// IMPORTANT: Update this URL when deploying to production
// Local development: http://localhost:3000/api
// GCP production: https://booksmart-backend-urznzrq37a-uc.a.run.app/api

// Using globalThis works in both popup (window) and service worker contexts
globalThis.API_BASE_URL = 'https://booksmart-backend-urznzrq37a-uc.a.run.app/api';

// For ES modules (popup.js)
export const API_BASE_URL = globalThis.API_BASE_URL;
export const MANAGER_URL = 'http://localhost:5173'; // Update this once manager is deployed
