import './lib/browser-polyfill.js';
// BookSmart Background Service Worker
// This script runs in the background and listens to browser bookmark events

import './config.js';
import { bookmarks, auth } from './utils/api.js';
import { getAuthData, saveAuthData, STORAGE_KEYS } from './utils/storage.js';
import { showNotification } from './utils/notifications.js';

// 👉 TEMP: clear all extension‑local storage on every reload (debug helper)
//chrome.storage.local.clear(() => console.log('✅ Extension storage cleared (debug)'));

const API_BASE_URL = globalThis.API_BASE_URL;

/**
 * Detect browser type
 */
async function getBrowserInfo() {
  const userAgent = navigator.userAgent;

  // Check for Brave
  if (navigator.brave && await navigator.brave.isBrave()) {
    return 'Brave';
  }

  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome/')) return 'Chrome';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  return 'Browser';
}


// Extension Installation
browser.runtime.onInstalled.addListener((details) => {
  console.log('BookSmart extension installed:', details.reason);

  if (details.reason === 'install') {
    console.log('Welcome to BookSmart!');
    browser.action.setBadgeText({ text: '' });
    browser.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  }
});

// ── Auth sync: primary path ─────────────────────────────────────────────────
// The manager web app calls chrome.runtime.sendMessage() right after login.
// This fires reliably with no race conditions against replaceState().
browser.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  if (message?.type !== 'BOOKSMART_AUTH_SYNC') return;

  const { token, refreshToken, email, name } = message;
  if (!token) { sendResponse({ ok: false, error: 'no token' }); return; }

  try {
    await browser.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: token,
      [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken || null,
      [STORAGE_KEYS.USER]: { email, name }
    });
    console.log('[BookSmart] Auth synced from manager via onMessageExternal ✅');
    updateBadgeCount();
    sendResponse({ ok: true });
  } catch (e) {
    console.error('[BookSmart] onMessageExternal auth sync failed:', e);
    sendResponse({ ok: false, error: e.message });
  }
});

function getTokenExpiry(token) {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : 0;
  } catch (e) {
    return 0;
  }
}

// ── Auth sync: fallback tab-watcher ──────────────────────────────────────────
// Catches cases where the manager page loads while the extension is already open
// (e.g., hard-reload of the manager tab when already logged in).
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url && tab.url.includes(globalThis.MANAGER_URL)) {
    try {
      // Wait briefly for React to finish initialising & writing to localStorage
      await new Promise(r => setTimeout(r, 1200));
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: () => ({
          token: localStorage.getItem('authToken'),
          refreshToken: localStorage.getItem('refreshToken'),
          email: localStorage.getItem('userEmail') || null,
          name: localStorage.getItem('userName') || null
        })
      });

      if (results?.[0]?.result?.token) {
        const { token, refreshToken, email, name } = results[0].result;
        const currentAuth = await getAuthData();
        const currentToken = currentAuth[STORAGE_KEYS.AUTH_TOKEN];

        const tabExpiry = getTokenExpiry(token);
        const currentExpiry = getTokenExpiry(currentToken);

        if (tabExpiry > currentExpiry) {
          console.log('[BookSmart] Tab has a newer token. Syncing tab -> extension.');
          await browser.storage.local.set({
            [STORAGE_KEYS.AUTH_TOKEN]: token,
            [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken,
            [STORAGE_KEYS.USER]: { email, name }
          });
          updateBadgeCount();
        } else if (currentExpiry > tabExpiry) {
          console.log('[BookSmart] Extension has a newer token. Syncing extension -> tab.');
          await browser.scripting.executeScript({
            target: { tabId },
            func: (extToken, extRefreshToken) => {
              if (extToken) localStorage.setItem('authToken', extToken);
              if (extRefreshToken) localStorage.setItem('refreshToken', extRefreshToken);
              window.dispatchEvent(new Event('storage'));
            },
            args: [currentToken, currentAuth[STORAGE_KEYS.REFRESH_TOKEN]]
          });
        }
      }
    } catch (e) {
      console.error('[BookSmart] Tab-watcher auth sync error:', e);
    }
  }
});


const selfModifiedUrls = new Set();

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
  } catch (e) {
    return url.toLowerCase().trim();
  }
}

function addSelfModifiedUrl(url) {
  selfModifiedUrls.add(normalizeUrl(url));
}

function hasSelfModifiedUrl(url) {
  return selfModifiedUrls.has(normalizeUrl(url));
}

function deleteSelfModifiedUrl(url) {
  selfModifiedUrls.delete(normalizeUrl(url));
}


/**
 * Get or create the dedicated "BookSmart Inbox" folder natively
 */
async function getOrCreateInboxFolder() {
  try {
    const results = await browser.bookmarks.search({ title: 'BookSmart Inbox' });
    const folder = results.find(item => !item.url);
    if (folder) {
      return folder.id;
    }

    const tree = await browser.bookmarks.getTree();
    const root = tree[0];
    let parentId = '1'; // Default parent (Bookmarks Bar)

    if (root && root.children) {
      const bookmarksBar = root.children.find(child => child.title.toLowerCase().includes('bar') || child.id === '1');
      if (bookmarksBar) {
        parentId = bookmarksBar.id;
      } else if (root.children[0]) {
        parentId = root.children[0].id;
      }
    }

    const newFolder = await browser.bookmarks.create({
      parentId: parentId,
      title: 'BookSmart Inbox'
    });
    console.log('[BookSmart] Created dedicated "BookSmart Inbox" folder:', newFolder);
    return newFolder.id;
  } catch (error) {
    console.error('[BookSmart] Error creating "BookSmart Inbox" folder:', error);
    return null;
  }
}

// Listen to new bookmarks being created
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('New bookmark created:', bookmark);
  if (!bookmark.url) return;

  // Skip bookmarks that WE just created to avoid double-syncing
  if (hasSelfModifiedUrl(bookmark.url)) {
    deleteSelfModifiedUrl(bookmark.url);
    console.log('[BookSmart] Skipping self-created bookmark (already in BookSmart):', bookmark.url);
    return;
  }

  let finalBookmark = bookmark;
  try {
    const { autoInboxRoute } = await browser.storage.local.get('autoInboxRoute');
    if (autoInboxRoute) {
      const inboxFolderId = await getOrCreateInboxFolder();
      if (inboxFolderId && bookmark.parentId !== inboxFolderId) {
        console.log(`[BookSmart] Auto-routing native bookmark to Inbox folder...`);
        addSelfModifiedUrl(bookmark.url);
        const movedBookmark = await browser.bookmarks.move(bookmark.id, { parentId: inboxFolderId });
        finalBookmark = { ...bookmark, ...movedBookmark };
      }
    }
  } catch (err) {
    console.error('[BookSmart] Error in auto-inbox routing:', err);
  }

  await handleNewBookmark(finalBookmark);
});

// Listen to bookmarks being removed
browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('Bookmark removed:', id, removeInfo);
  if (removeInfo.node && removeInfo.node.url) {
    await handleDeletedBookmark(removeInfo.node.url);
  }
});

// Listen to bookmarks being moved
browser.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  console.log('Bookmark moved:', id, moveInfo);
  const [bookmark] = await browser.bookmarks.get(id);
  if (bookmark && bookmark.url) {
    if (hasSelfModifiedUrl(bookmark.url)) {
      deleteSelfModifiedUrl(bookmark.url);
      console.log('[BookSmart] Skipping self-moved bookmark:', bookmark.url);
      return;
    }
    await handleBookmarkUpdate(bookmark);
  }
});

// Listen to bookmarks being changed (renamed)
browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('Bookmark changed:', id, changeInfo);
  const [bookmark] = await browser.bookmarks.get(id);
  if (bookmark && bookmark.url) {
    if (hasSelfModifiedUrl(bookmark.url)) {
      deleteSelfModifiedUrl(bookmark.url);
      console.log('[BookSmart] Skipping self-renamed bookmark:', bookmark.url);
      return;
    }
    await handleBookmarkUpdate(bookmark);
  }
});

// Helper to get recursive folder path
async function getFolderPath(folderId) {
  try {
    if (!folderId || folderId === '0' || folderId === '1') return '';

    const [folder] = await browser.bookmarks.get(folderId);
    if (!folder) return '';

    const parentPath = await getFolderPath(folder.parentId);
    // Skip root-level virtual folders if needed
    if (!folder.parentId || folder.parentId === '0' || folder.parentId === '1') {
      return folder.title;
    }

    return parentPath ? `${parentPath} > ${folder.title}` : folder.title;
  } catch (error) {
    return '';
  }
}


// Extract content from active tab
async function extractContentFromActiveTab(expectedUrl) {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) return null;

    // Safety check: Prevent background syncs (e.g. from mobile) from extracting the wrong page
    if (expectedUrl) {
      try {
        const tabUrl = new URL(tab.url);
        const targetUrl = new URL(expectedUrl);
        // Compare hostname and pathname to be safe (ignoring query params/hashes which might differ slightly)
        if (tabUrl.hostname !== targetUrl.hostname || tabUrl.pathname !== targetUrl.pathname) {
          console.log(`[BookSmart] URL mismatch detected. Bookmark sync from background. Skipping local extraction.`);
          return null;
        }
      } catch (e) {
        // Fallback to basic string match if URL parsing fails
        if (!tab.url.includes(expectedUrl) && !expectedUrl.includes(tab.url)) {
          console.log(`[BookSmart] String URL mismatch detected. Skipping local extraction.`);
          return null;
        }
      }
    }


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
      func: function () {
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

    const extracted = await extractContentFromActiveTab(bookmark.url);

    const folderPath = await getFolderPath(bookmark.parentId);

    const bookmarkData = {
      url: bookmark.url,
      title: bookmark.title || null,
      folder_id: bookmark.parentId,
      folder_path: folderPath,
      browser: await getBrowserInfo()
    };


    if (extracted && extracted.success) {
      bookmarkData.extractedContent = extracted.content;
      bookmarkData.extractedTitle = extracted.title;
      bookmarkData.extractedExcerpt = extracted.excerpt;
      bookmarkData.extractedMethod = extracted.method;
      bookmarkData.extractedLength = extracted.length;

      // Visual Bookmarks addition
      if (extracted.coverImage) bookmarkData.cover_image = extracted.coverImage;
      if (extracted.extractedImages && extracted.extractedImages.length > 0) bookmarkData.extracted_images = extracted.extractedImages;

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

// Handle bookmark updates (move/rename)
async function handleBookmarkUpdate(bookmark) {
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) return;

    const folderPath = await getFolderPath(bookmark.parentId);

    // Find the bookmark in our DB by URL
    const searchData = await bookmarks.list({ url: bookmark.url });
    if (searchData.bookmarks && searchData.bookmarks.length > 0) {
      const dbBookmark = searchData.bookmarks[0];
      await bookmarks.update(dbBookmark.id, {
        title: bookmark.title,
        folder_id: bookmark.parentId,
        folder_path: folderPath,
        browser: await getBrowserInfo()
      });

      console.log('[BookSmart] Bookmark hierarchy updated:', bookmark.url);
    }
  } catch (error) {
    console.error('Error updating bookmark hierarchy:', error);
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

  if (message.action === 'syncFolders') {
    handleFullFolderSync().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.action === 'mirrorToChrome') {
    mirrorBookmarkToChrome(message.url, message.title, message.folderPath)
      .then(() => sendResponse({ success: true }))
      .catch(e => {
        console.warn('[BookSmart] mirrorToChrome failed:', e.message);
        sendResponse({ success: false, error: e.message });
      });
    return true; // keep channel open for async response
  }

  if (message.action === 'updateChromeBookmark') {
    updateMirroredChromeBookmark(message.url, message.title, message.folderPath)
      .then(() => sendResponse({ success: true }))
      .catch(e => {
        console.warn('[BookSmart] updateChromeBookmark failed:', e.message);
        sendResponse({ success: false, error: e.message });
      });
    return true;
  }

  if (message.action === 'createInboxFolder') {
    getOrCreateInboxFolder().then(folderId => {
      sendResponse({ success: true, folderId });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// ── Chrome bookmark mirroring ─────────────────────────────────────────────────

/**
 * Walk Chrome's bookmark tree and find the folder node whose path matches
 * the given "Parent > Child > Grandchild" path string.
 * If any segment is missing it will be created, so the full path always exists.
 *
 * Returns the Chrome folder node id.
 */
async function findOrCreateChromeFolder(folderPath) {
  if (!folderPath) return undefined;

  const segments = folderPath.split('>').map(s => s.trim()).filter(Boolean);
  if (!segments.length) return undefined;

  // Start from Chrome's bookmark-bar and Other Bookmarks roots (ids '1' and '2')
  const tree = await browser.bookmarks.getTree();
  const roots = tree[0]?.children || [];

  // Recursive search: find a child node with the given title under parentId
  async function findOrCreate(parentId, title) {
    const children = await browser.bookmarks.getChildren(parentId);
    const existing = children.find(
      c => !c.url && c.title.toLowerCase() === title.toLowerCase()
    );
    if (existing) return existing.id;
    // Create the missing folder
    const created = await browser.bookmarks.create({ parentId, title });
    console.log(`[BookSmart] Created Chrome folder: "${title}" under ${parentId}`);
    return created.id;
  }

  // Try to find the first segment under each root, then descend
  let currentId = null;
  for (const root of roots) {
    if (!root.children) continue;
    const firstMatch = root.children.find(
      c => !c.url && c.title.toLowerCase() === segments[0].toLowerCase()
    );
    if (firstMatch) {
      currentId = firstMatch.id;
      break;
    }
  }

  // If the top-level segment wasn't found, create it under Other Bookmarks (id '2')
  if (!currentId) {
    currentId = await findOrCreate('2', segments[0]);
  }

  // Descend through remaining segments
  for (let i = 1; i < segments.length; i++) {
    currentId = await findOrCreate(currentId, segments[i]);
  }

  return currentId;
}

/**
 * Create a Chrome native bookmark for a URL that was saved via BookSmart.
 * Registers the URL in selfModifiedUrls first to suppress the onCreated event.
 */
async function mirrorBookmarkToChrome(url, title, folderPath) {
  try {
    // Check if Chrome already has this bookmark to avoid duplicates
    const existing = await browser.bookmarks.search({ url });
    if (existing && existing.length > 0) {
      console.log('[BookSmart] Chrome already has this bookmark, skipping mirror:', url);
      return;
    }

    addSelfModifiedUrl(url);

    // Resolve the folder (create if needed)
    const parentId = folderPath
      ? await findOrCreateChromeFolder(folderPath)
      : undefined; // undefined → Chrome places it in default location

    const createParams = { title, url };
    if (parentId) createParams.parentId = parentId;

    await browser.bookmarks.create(createParams);
    console.log('[BookSmart] Mirrored bookmark to Chrome:', url, folderPath || '(no folder)');

    setTimeout(() => deleteSelfModifiedUrl(url), 5000);
  } catch (e) {
    deleteSelfModifiedUrl(url);
    throw e;
  }
}

/**
 * Update an existing Chrome bookmark (title and folder) based on BookSmart edits.
 */
async function updateMirroredChromeBookmark(url, title, folderPath) {
  try {
    const existing = await browser.bookmarks.search({ url });
    if (!existing || existing.length === 0) return;

    addSelfModifiedUrl(url);

    const parentId = folderPath ? await findOrCreateChromeFolder(folderPath) : undefined;

    // Update all matching Chrome bookmarks
    for (const bookmark of existing) {
      if (title && bookmark.title !== title) {
        await browser.bookmarks.update(bookmark.id, { title });
      }
      if (parentId && bookmark.parentId !== parentId) {
        await browser.bookmarks.move(bookmark.id, { parentId });
      }
    }

    console.log('[BookSmart] Updated Chrome bookmark:', url);
    setTimeout(() => deleteSelfModifiedUrl(url), 5000);
  } catch (e) {
    deleteSelfModifiedUrl(url);
    throw e;
  }
}

async function handleFullFolderSync() {
  console.log('[BookSmart] Starting full folder hierarchy sync...');
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) throw new Error('Not authenticated');

    // Get all browser bookmarks
    const tree = await browser.bookmarks.getTree();
    const allBookmarks = [];

    function traverse(node) {
      if (node.url) {
        allBookmarks.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    }
    tree.forEach(traverse);

    console.log(`[BookSmart] Found ${allBookmarks.length} browser bookmarks to sync`);

    // Show progress badge
    browser.action.setBadgeText({ text: '...' });
    browser.action.setBadgeBackgroundColor({ color: '#3B82F6' });

    let updatedCount = 0;

    for (const bookmark of allBookmarks) {
      const folderPath = await getFolderPath(bookmark.parentId);

      // Check if we have this bookmark in our DB
      const searchData = await bookmarks.list({ url: bookmark.url });
      if (searchData.bookmarks && searchData.bookmarks.length > 0) {
        const dbBookmark = searchData.bookmarks[0];
        // Only update if metadata is missing or different
        if (!dbBookmark.folder_path || dbBookmark.folder_path !== folderPath) {
          await bookmarks.update(dbBookmark.id, {
            folder_id: bookmark.parentId,
            folder_path: folderPath,
            browser: await getBrowserInfo()
          });

          updatedCount++;
        }
      }
    }

    console.log(`[BookSmart] Full sync complete. Updated ${updatedCount} bookmarks.`);

    // Send notification when done
    showNotification(
      'Sync Complete',
      `Your folder hierarchy is now up to date. Updated ${updatedCount} bookmarks.`,
      'success'
    );

    // Clear progress badge
    browser.action.setBadgeText({ text: '' });

    return { success: true, updatedCount };
  } catch (error) {
    console.error('[BookSmart] Full sync failed:', error);
    browser.action.setBadgeText({ text: 'ERR' });
    browser.action.setBadgeBackgroundColor({ color: '#EF4444' });
    throw error;
  }
}


// Sync new tokens to any active manager tabs
async function syncTokenToManagerTabs(token, refreshToken) {
  try {
    const tabs = await browser.tabs.query({});
    const managerTabs = tabs.filter(t => t.url && t.url.includes(globalThis.MANAGER_URL));

    for (const tab of managerTabs) {
      console.log(`[BookSmart] Syncing new token to active manager tab ${tab.id}`);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (t, rt) => {
          if (t) localStorage.setItem('authToken', t);
          if (rt) localStorage.setItem('refreshToken', rt);
          window.dispatchEvent(new Event('storage'));
        },
        args: [token, refreshToken]
      });
    }
  } catch (e) {
    console.error('[BookSmart] Error syncing token to manager tabs:', e);
  }
}

// Token refresh logic using persistent browser alarms
async function checkAndRefreshToken() {
  try {
    const authData = await getAuthData();
    const token = authData[STORAGE_KEYS.AUTH_TOKEN];
    const refreshToken = authData[STORAGE_KEYS.REFRESH_TOKEN];
    let expiresAt = authData[STORAGE_KEYS.TOKEN_EXPIRES_AT] || 0;

    if (!refreshToken) return;

    // Fallback: If expiresAt is missing but we have a token, parse the expiration directly from JWT payload
    if (!expiresAt && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp) {
          expiresAt = payload.exp * 1000;
        }
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }
    }

    // Refresh if within 45 minutes of expiry (or if no expiration was found to be safe)
    if (!expiresAt || expiresAt - Date.now() < 2700000) {
      console.log('Token expiring soon, refreshing in background service worker...');
      const data = await auth.refresh(refreshToken);
      await saveAuthData(data);
      console.log('Token refreshed successfully');

      // Propagate new token to all open manager tabs
      if (data.session?.access_token) {
        await syncTokenToManagerTabs(data.session.access_token, data.session.refresh_token);
      }
    }
  } catch (error) {
    console.error('Error in token refresh:', error);
  }
}

// Create the alarm
browser.alarms.create('token-refresh-alarm', { periodInMinutes: 5 });

// Listen for the alarm
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'token-refresh-alarm') {
    console.log('[Background] Alarm triggered: Running token refresh check...');
    await checkAndRefreshToken();
  }
});

// Run once immediately on startup
checkAndRefreshToken();

console.log('BookSmart background service worker initialized');
