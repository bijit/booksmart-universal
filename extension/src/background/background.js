// BookSmart Background Service Worker
// This script runs in the background and listens to Chrome bookmark events

// Import configuration
import { API_BASE_URL } from '../config.js';

// Extension Installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('BookSmart extension installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('Welcome to BookSmart!');

    // Set default badge
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  }
});

// Listen to new bookmarks being created
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('New bookmark created:', bookmark);

  // Only process if it has a URL (folders don't have URLs)
  if (bookmark.url) {
    await handleNewBookmark(bookmark);
  }
});

// Listen to bookmarks being removed - sync deletion to backend
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('Bookmark removed:', id, removeInfo);

  // Only process if it has a URL (folders don't have URLs)
  if (removeInfo.node && removeInfo.node.url) {
    await handleDeletedBookmark(removeInfo.node.url);
  }
});

// Handle new bookmark
async function handleNewBookmark(bookmark) {
  try {
    // Check if user is authenticated
    const authData = await chrome.storage.local.get(['auth_token']);

    if (!authData.auth_token) {
      console.log('User not authenticated, skipping bookmark sync');
      return;
    }

    // Send bookmark to backend
    const response = await fetch(`${API_BASE_URL}/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.auth_token}`
      },
      body: JSON.stringify({
        url: bookmark.url,
        title: bookmark.title || null
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Bookmark saved to BookSmart:', data.bookmark);

      // Show success notification
      showNotification('Bookmark saved!', `"${bookmark.title || bookmark.url}" is being processed.`);

      // Update badge count
      updateBadgeCount();
    } else {
      const error = await response.json();
      console.error('Failed to save bookmark:', error);

      // Show error notification
      showNotification('Bookmark failed', 'Could not save bookmark. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error handling new bookmark:', error);

    // Retry logic could be added here
    showNotification('Network error', 'Could not connect to BookSmart server.', 'error');
  }
}

// Handle deleted bookmark
async function handleDeletedBookmark(url) {
  try {
    // Check if user is authenticated
    const authData = await chrome.storage.local.get(['auth_token']);

    if (!authData.auth_token) {
      console.log('User not authenticated, skipping bookmark deletion sync');
      return;
    }

    // Find bookmark by URL
    const searchResponse = await fetch(`${API_BASE_URL}/bookmarks?url=${encodeURIComponent(url)}`, {
      headers: {
        'Authorization': `Bearer ${authData.auth_token}`
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();

      // If bookmark exists in our backend, delete it
      if (searchData.bookmarks && searchData.bookmarks.length > 0) {
        const bookmarkId = searchData.bookmarks[0].id;

        // Delete bookmark from backend
        const deleteResponse = await fetch(`${API_BASE_URL}/bookmarks/${bookmarkId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authData.auth_token}`
          }
        });

        if (deleteResponse.ok) {
          console.log('Bookmark deleted from BookSmart:', bookmarkId);

          // Show success notification
          showNotification('Bookmark deleted', 'Removed from BookSmart');

          // Update badge count
          updateBadgeCount();
        } else {
          console.error('Failed to delete bookmark from backend');
        }
      } else {
        console.log('Bookmark not found in BookSmart, nothing to delete');
      }
    }
  } catch (error) {
    console.error('Error handling deleted bookmark:', error);
  }
}

// Update badge count with pending bookmarks
async function updateBadgeCount() {
  try {
    const authData = await chrome.storage.local.get(['auth_token']);

    if (!authData.auth_token) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    // Fetch pending bookmarks count
    const response = await fetch(`${API_BASE_URL}/bookmarks?status=pending&limit=0`, {
      headers: {
        'Authorization': `Bearer ${authData.auth_token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const pendingCount = data.total || 0;

      if (pendingCount > 0) {
        chrome.action.setBadgeText({ text: String(pendingCount) });
        chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' }); // Orange for pending
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (error) {
    console.error('Error updating badge count:', error);
  }
}

// Periodic badge update (every 30 seconds)
setInterval(() => {
  updateBadgeCount();
}, 30000);

// Update badge on extension startup
updateBadgeCount();

// Show notification
function showNotification(title, message, type = 'success') {
  const iconPath = type === 'error' ? 'icons/icon48.png' : 'icons/icon48.png';

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconPath,
    title: title,
    message: message,
    priority: 1
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    updateBadgeCount();
    sendResponse({ success: true });
  }

  if (message.action === 'checkAuth') {
    chrome.storage.local.get(['auth_token']).then(data => {
      sendResponse({ authenticated: !!data.auth_token });
    });
    return true; // Keep channel open for async response
  }
});

// Token refresh logic (check every 5 minutes)
setInterval(async () => {
  try {
    const authData = await chrome.storage.local.get(['refresh_token', 'token_expires_at']);

    if (!authData.refresh_token) {
      return;
    }

    // Check if token expires in next hour
    const now = Date.now();
    const expiresAt = authData.token_expires_at || 0;

    if (expiresAt - now < 3600000) { // Less than 1 hour
      console.log('Token expiring soon, refreshing...');

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: authData.refresh_token
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Update stored tokens
        await chrome.storage.local.set({
          auth_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          token_expires_at: data.session.expires_at
        });

        console.log('Token refreshed successfully');
      } else {
        console.error('Token refresh failed');
      }
    }
  } catch (error) {
    console.error('Error in token refresh:', error);
  }
}, 300000); // Every 5 minutes

console.log('BookSmart background service worker initialized');
