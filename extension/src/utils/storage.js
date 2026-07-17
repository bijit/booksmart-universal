/**
 * BookSmart Storage Utility
 * Handles all interactions with chrome.storage.local
 */

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  TOKEN_EXPIRES_AT: 'token_expires_at'
};

/**
 * Save authentication data to storage
 */
export async function saveAuthData(data) {
  try {
    const current = await browser.storage.local.get([STORAGE_KEYS.USER]);
    // Supabase returns expires_at in seconds. Convert to milliseconds.
    const expiresAt = data.session.expires_at
      ? (data.session.expires_at < 10000000000 ? data.session.expires_at * 1000 : data.session.expires_at)
      : 0;

    const storageData = {
      [STORAGE_KEYS.AUTH_TOKEN]: data.session.access_token,
      [STORAGE_KEYS.REFRESH_TOKEN]: data.session.refresh_token,
      [STORAGE_KEYS.USER]: data.user || current[STORAGE_KEYS.USER] || null,
      [STORAGE_KEYS.TOKEN_EXPIRES_AT]: expiresAt
    };
    await browser.storage.local.set(storageData);
    console.log('[Storage] Auth data saved successfully');
    return true;
  } catch (error) {
    console.error('[Storage] Error saving auth data:', error);
    return false;
  }
}

/**
 * Get authentication data from storage
 */
export async function getAuthData() {
  try {
    const keys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.TOKEN_EXPIRES_AT
    ];
    return await browser.storage.local.get(keys);
  } catch (error) {
    console.error('[Storage] Error getting auth data:', error);
    return {};
  }
}

/**
 * Clear authentication data (logout)
 */
export async function clearAuthData() {
  try {
    const keys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.TOKEN_EXPIRES_AT
    ];
    await browser.storage.local.remove(keys);
    console.log('[Storage] Auth data cleared');
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing auth data:', error);
    return false;
  }
}

/**
 * Clear all data from local storage (including auth and any other stored items)
 */
export async function clearAllData() {
  try {
    await browser.storage.local.clear();
    console.log('[Storage] All local storage cleared');
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing all data:', error);
    return false;
  }
}


/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const data = await getAuthData();
  return !!(data[STORAGE_KEYS.AUTH_TOKEN] && data[STORAGE_KEYS.USER]);
}

/**
 * Generic set helper
 */
export async function setStorageItem(key, value) {
  try {
    await browser.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error(`[Storage] Error setting item ${key}:`, error);
    return false;
  }
}

/**
 * Generic get helper
 */
export async function getStorageItem(key) {
  try {
    const result = await browser.storage.local.get([key]);
    return result[key];
  } catch (error) {
    console.error(`[Storage] Error getting item ${key}:`, error);
    return null;
  }
}
