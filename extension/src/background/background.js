// BookSmart Background Service Worker
// This script runs in the background and listens to browser bookmark events

import '../config.js';
import { bookmarks, auth } from '../utils/api.js';
import { getAuthData, saveAuthData, STORAGE_KEYS } from '../utils/storage.js';
import { showNotification } from '../utils/notifications.js';

const API_BASE_URL = globalThis.API_BASE_URL;

// Extension Installation
browser.runtime.onInstalled.addListener((details) => {
  console.log('BookSmart extension installed:', details.reason);

  if (details.reason === 'install') {
    console.log('Welcome to BookSmart!');
    browser.action.setBadgeText({ text: '' });
    browser.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  }
});

// Listen to new bookmarks being created
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('New bookmark created:', bookmark);
  if (bookmark.url) {
    await handleNewBookmark(bookmark);
  }
});

// Listen to bookmarks being removed
browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('Bookmark removed:', id, removeInfo);
  if (removeInfo.node && removeInfo.node.url) {
    await handleDeletedBookmark(removeInfo.node.url);
  }
});

// Extract content from active tab
async function extractContentFromActiveTab() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    console.log(`[BookSmart] Extracting content from tab: ${tab.title}`);

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js']
    });

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-extractor.js']
    });

    const extractionResults = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        if (typeof extractPageContent === 'function') {
          return extractPageContent();
        } else {
          return { success: false, error: 'extractPageContent not defined' };
        }
      }
    });

    if (extractionResults && extractionResults[0] && extractionResults[0].result) {
      return extractionResults[0].result;
    }
    return null;
  } catch (error) {
    console.error('[BookSmart] Error extracting content from tab:', error);
    return null;
  }
}

// Handle new bookmark
async function handleNewBookmark(bookmark) {
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) {
      console.log('User not authenticated, skipping bookmark sync');
      return;
    }

    const extracted = await extractContentFromActiveTab();

    const bookmarkData = {
      url: bookmark.url,
      title: bookmark.title || null
    };

    if (extracted && extracted.success) {
      bookmarkData.extractedContent = extracted.content;
      bookmarkData.extractedTitle = extracted.title;
      bookmarkData.extractedExcerpt = extracted.excerpt;
      bookmarkData.extractedMethod = extracted.method;
      bookmarkData.extractedLength = extracted.length;
      console.log(`[BookSmart] Including extracted content (${extracted.length} chars)`);
    }

    const result = await bookmarks.create(bookmarkData);
    console.log('Bookmark saved to BookSmart:', result.bookmark);
    showNotification('Bookmark saved!', `"${bookmark.title || bookmark.url}" is being processed.`);
    updateBadgeCount();
  } catch (error) {
    console.error('Error handling new bookmark:', error);
    if (error.status === 401) {
      console.log('Auth token expired or invalid');
    } else {
      showNotification('Bookmark failed', error.message || 'Could not save bookmark.', 'error');
    }
  }
}

// Handle deleted bookmark
async function handleDeletedBookmark(url) {
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) return;

    const searchData = await bookmarks.list({ url });
    if (searchData.bookmarks && searchData.bookmarks.length > 0) {
      const bookmarkId = searchData.bookmarks[0].id;
      await bookmarks.delete(bookmarkId);
      console.log('Bookmark deleted from BookSmart:', bookmarkId);
      showNotification('Bookmark deleted', 'Removed from BookSmart');
      updateBadgeCount();
    }
  } catch (error) {
    console.error('Error handling deleted bookmark:', error);
  }
}

// Update badge count
async function updateBadgeCount() {
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) {
      browser.action.setBadgeText({ text: '' });
      return;
    }

    const data = await bookmarks.list({ status: 'pending', limit: 0 });
    const pendingCount = data.total || 0;

    if (pendingCount > 0) {
      browser.action.setBadgeText({ text: String(pendingCount) });
      browser.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    } else {
      browser.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge count:', error);
  }
}

// Periodic update
setInterval(updateBadgeCount, 30000);
updateBadgeCount();

// Message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    updateBadgeCount();
    sendResponse({ success: true });
  }

  if (message.action === 'checkAuth') {
    getAuthData().then(data => {
      sendResponse({ authenticated: !!data[STORAGE_KEYS.AUTH_TOKEN] });
    });
    return true;
  }
});

// Token refresh logic
setInterval(async () => {
  try {
    const authData = await getAuthData();
    const refreshToken = authData[STORAGE_KEYS.REFRESH_TOKEN];
    const expiresAt = authData[STORAGE_KEYS.TOKEN_EXPIRES_AT] || 0;

    if (!refreshToken) return;

    if (expiresAt - Date.now() < 3600000) { // < 1 hour
      console.log('Token expiring soon, refreshing...');
      const data = await auth.refresh(refreshToken);
      await saveAuthData(data);
      console.log('Token refreshed successfully');
    }
  } catch (error) {
    console.error('Error in token refresh:', error);
  }
}, 300000);

console.log('BookSmart background service worker initialized');
