// BookSmart Configuration
// API Configuration
// IMPORTANT: Update this URL when deploying to production
// Local development: http://localhost:3000/api
// GCP production: https://booksmart-backend-920600341451.us-central1.run.app/api

// Using globalThis works in both popup (window) and service worker contexts
globalThis.API_BASE_URL = 'https://booksmart-backend-920600341451.us-central1.run.app/api';

// For ES modules (popup.js)
export const API_BASE_URL = globalThis.API_BASE_URL;
export const MANAGER_URL = 'https://booksmart-manager-urznzrq37a-uc.a.run.app';
