import './lib/browser-polyfill.js';
// BookSmart Background Service Worker
// This script runs in the background and listens to browser bookmark events

import './config.js';
import { bookmarks, auth, search } from './utils/api.js';
import { getAuthData, saveAuthData, clearAuthData, STORAGE_KEYS } from './utils/storage.js';
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
browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === 'BOOKSMART_AUTH_LOGOUT') {
    clearAuthData()
      .then(() => {
        console.log('[BookSmart] Auth cleared from manager via onMessageExternal (Logout) ✅');
        updateBadgeCount();
        sendResponse({ ok: true });
      })
      .catch((e) => {
        console.error('[BookSmart] onMessageExternal logout failed:', e);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // Keep channel open for async response
  }

  if (message?.type === 'BOOKSMART_GET_AUTH') {
    getAuthData()
      .then((authData) => {
        sendResponse({
          ok: true,
          token: authData[STORAGE_KEYS.AUTH_TOKEN] || null,
          refreshToken: authData[STORAGE_KEYS.REFRESH_TOKEN] || null,
          user: authData[STORAGE_KEYS.USER] || null,
          expiresAt: authData[STORAGE_KEYS.TOKEN_EXPIRES_AT] || null
        });
      })
      .catch((e) => {
        console.error('[BookSmart] onMessageExternal get auth failed:', e);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // Keep channel open
  }

  if (message?.type === 'BOOKSMART_REFRESH_AUTH') {
    checkAndRefreshToken()
      .then(async () => {
        const authData = await getAuthData();
        sendResponse({
          ok: true,
          token: authData[STORAGE_KEYS.AUTH_TOKEN] || null,
          refreshToken: authData[STORAGE_KEYS.REFRESH_TOKEN] || null,
          user: authData[STORAGE_KEYS.USER] || null,
          expiresAt: authData[STORAGE_KEYS.TOKEN_EXPIRES_AT] || null
        });
      })
      .catch((e) => {
        console.error('[BookSmart] onMessageExternal refresh auth failed:', e);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // Keep channel open
  }

  if (message?.type === 'BOOKSMART_AUTH_SYNC') {
    const { token, refreshToken, email, name } = message;
    if (!token) { sendResponse({ ok: false, error: 'no token' }); return; }

    const expiresAt = getTokenExpiry(token);

    browser.storage.local.set({
      [STORAGE_KEYS.AUTH_TOKEN]: token,
      [STORAGE_KEYS.REFRESH_TOKEN]: refreshToken || null,
      [STORAGE_KEYS.USER]: { email, name },
      [STORAGE_KEYS.TOKEN_EXPIRES_AT]: expiresAt
    })
      .then(() => {
        console.log('[BookSmart] Auth synced from manager via onMessageExternal ✅');
        updateBadgeCount();
        flushPendingBookmarks();
        sendResponse({ ok: true });
      })
      .catch((e) => {
        console.error('[BookSmart] onMessageExternal auth sync failed:', e);
        sendResponse({ ok: false, error: e.message });
      });
    return true; // Keep channel open
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
        const currentEmail = currentAuth[STORAGE_KEYS.USER]?.email;

        // Skip automatic sync if users differ to prevent session hijacking
        if (currentEmail && email && currentEmail !== email) {
          console.log(`[BookSmart] Skipping tab->extension sync: tab user (${email}) differs from extension user (${currentEmail}).`);
          return;
        }

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
          // Only push down to tab if the emails match or tab is empty
          if (!email || email === currentEmail) {
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

  // Sync Protection: check if the bookmarked URL is open in any browser tab
  try {
    const tabs = await browser.tabs.query({});
    const isUrlOpen = tabs.some(tab => {
      if (!tab.url) return false;
      // Strip trailing slashes for loose comparison
      const cleanTabUrl = tab.url.replace(/\/$/, '');
      const cleanBookmarkUrl = bookmark.url.replace(/\/$/, '');
      return cleanTabUrl === cleanBookmarkUrl;
    });

    if (!isUrlOpen) {
      console.log('[BookSmart] Ignoring background bookmark creation event (likely triggered by Chrome Sync):', bookmark.url);
      return;
    }
  } catch (tabError) {
    console.warn('[BookSmart] Error querying tabs for sync validation, proceeding:', tabError.message);
  }

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
  if (!removeInfo.node || !removeInfo.node.url) return;

  // Sync Protection: check if the bookmarked URL is open in any browser tab
  try {
    const tabs = await browser.tabs.query({});
    const isUrlOpen = tabs.some(tab => {
      if (!tab.url) return false;
      const cleanTabUrl = tab.url.replace(/\/$/, '');
      const cleanBookmarkUrl = removeInfo.node.url.replace(/\/$/, '');
      return cleanTabUrl === cleanBookmarkUrl;
    });

    if (!isUrlOpen) {
      console.log('[BookSmart] Ignoring background bookmark removal event (likely triggered by Chrome Sync):', removeInfo.node.url);
      return;
    }
  } catch (tabError) {
    console.warn('[BookSmart] Error querying tabs for sync validation on delete, proceeding:', tabError.message);
  }

  await handleDeletedBookmark(removeInfo.node.url);
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
      console.log('[BookSmart] User not authenticated. Queueing bookmark for offline sync...');
      const extracted = await extractContentFromActiveTab(bookmark.url);
      const folderPath = await getFolderPath(bookmark.parentId);

      const bookmarkData = {
        url: bookmark.url,
        title: bookmark.title || null,
        folder_id: bookmark.parentId,
        folder_path: folderPath,
        browser: await getBrowserInfo(),
        created_at: new Date(bookmark.dateAdded || Date.now()).toISOString()
      };

      if (extracted && extracted.success) {
        bookmarkData.extractedContent = extracted.content;
        bookmarkData.extractedTitle = extracted.title;
        bookmarkData.extractedExcerpt = extracted.excerpt;
        bookmarkData.extractedMethod = extracted.method;
        bookmarkData.extractedLength = extracted.length;
        if (extracted.coverImage) bookmarkData.cover_image = extracted.coverImage;
        if (extracted.extractedImages && extracted.extractedImages.length > 0) {
          bookmarkData.extracted_images = extracted.extractedImages;
        }
      }

      const { pending_sync_bookmarks = [] } = await browser.storage.local.get(['pending_sync_bookmarks']);
      pending_sync_bookmarks.push(bookmarkData);
      await browser.storage.local.set({ pending_sync_bookmarks });
      console.log('[BookSmart] Bookmark queued successfully:', bookmark.url);
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
  if (message.type === 'BOOKSMART_SEARCH_PULSE') {
    search.query({ query: message.query, limit: 5 })
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        console.warn('[BookSmart] Search bridge query failed:', error.message);
        sendResponse({ results: [] });
      });
    return true; // Keep channel open for async response
  }

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

  if (message.action === 'flushPendingBookmarks') {
    flushPendingBookmarks()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
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

    // Fetch all bookmarks from BookSmart in paginated chunks
    const dbBookmarks = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      console.log(`[BookSmart] Sync: Fetching database bookmarks chunk offset=${offset}`);
      const data = await bookmarks.list({ limit, offset });
      if (!data.bookmarks || data.bookmarks.length === 0) break;
      dbBookmarks.push(...data.bookmarks);
      if (data.bookmarks.length < limit) break;
      offset += limit;
    }
    console.log(`[BookSmart] Fetched ${dbBookmarks.length} total bookmarks from database`);

    // Map by URL for fast local lookups
    const dbUrlMap = new Map();
    for (const bm of dbBookmarks) {
      if (bm.url) {
        dbUrlMap.set(bm.url, bm);
      }
    }

    const updatesNeeded = [];
    for (const bookmark of allBookmarks) {
      const folderPath = await getFolderPath(bookmark.parentId);
      const dbBookmark = dbUrlMap.get(bookmark.url);
      
      if (dbBookmark) {
        // Normalize folder paths (empty string vs null)
        const normalizedDbPath = dbBookmark.folder_path || '';
        const normalizedFolderPath = folderPath || '';
        
        if (normalizedDbPath !== normalizedFolderPath || dbBookmark.folder_id !== bookmark.parentId) {
          updatesNeeded.push({
            id: dbBookmark.id,
            folder_id: bookmark.parentId,
            folder_path: folderPath || null
          });
        }
      }
    }

    let updatedCount = 0;
    if (updatesNeeded.length > 0) {
      console.log(`[BookSmart] Sending ${updatesNeeded.length} folder updates to batch endpoint...`);
      const syncResult = await bookmarks.syncFoldersBatch(updatesNeeded);
      if (syncResult && syncResult.success) {
        updatedCount = syncResult.updatedCount || updatesNeeded.length;
      } else {
        throw new Error(syncResult?.error || 'Batch sync failed on server');
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

    // Get current extension user email
    const currentAuth = await getAuthData();
    const extEmail = currentAuth[STORAGE_KEYS.USER]?.email || null;

    for (const tab of managerTabs) {
      console.log(`[BookSmart] Syncing new token to active manager tab ${tab.id}`);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (t, rt, expectedEmail) => {
          const tabEmail = localStorage.getItem('userEmail');
          // Only sync if the tab has no logged-in email, or if it matches the extension email
          if (!tabEmail || tabEmail === expectedEmail) {
            if (t) localStorage.setItem('authToken', t);
            if (rt) localStorage.setItem('refreshToken', rt);
            window.dispatchEvent(new Event('storage'));
          } else {
            console.log(`[BookSmart] Refusing to overwrite tab credentials: tab user (${tabEmail}) differs from extension user (${expectedEmail})`);
          }
        },
        args: [token, refreshToken, extEmail]
      });
    }
  } catch (e) {
    console.error('[BookSmart] Error syncing token to manager tabs:', e);
  }
}

let activeBackgroundRefreshPromise = null;

// Token refresh logic using persistent browser alarms
async function checkAndRefreshToken() {
  if (activeBackgroundRefreshPromise) {
    console.log('[Background] Token refresh already in progress, waiting...');
    return activeBackgroundRefreshPromise;
  }

  activeBackgroundRefreshPromise = (async () => {
    try {
      const authData = await getAuthData();
      let token = authData[STORAGE_KEYS.AUTH_TOKEN];
      const refreshToken = authData[STORAGE_KEYS.REFRESH_TOKEN];
      let expiresAt = authData[STORAGE_KEYS.TOKEN_EXPIRES_AT] || 0;

      if (!refreshToken) return null;

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

      // Normalize expiresAt to milliseconds if it was saved in seconds
      if (expiresAt && expiresAt < 10000000000) {
        expiresAt = expiresAt * 1000;
      }

      // Refresh if within 45 minutes of expiry (or if no expiration was found to be safe)
      if (!expiresAt || expiresAt - Date.now() < 2700000) {
        console.log('Token expiring soon, refreshing in background service worker...');
        const data = await auth.refresh(refreshToken);
        await saveAuthData(data);
        console.log('Token refreshed successfully');

        // Propagate new token to all open manager tabs
        if (data.session?.access_token) {
          token = data.session.access_token;
          await syncTokenToManagerTabs(data.session.access_token, data.session.refresh_token);
        }
      }

      // Proactively flush any offline queued bookmarks if we are authenticated
      if (token) {
        flushPendingBookmarks();
      }

      return token;
    } catch (error) {
      console.error('Error in token refresh:', error);
      return null;
    } finally {
      activeBackgroundRefreshPromise = null;
    }
  })();

  return activeBackgroundRefreshPromise;
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

// Flush offline queued bookmarks to the backend database
async function flushPendingBookmarks() {
  try {
    const authData = await getAuthData();
    if (!authData[STORAGE_KEYS.AUTH_TOKEN]) return;

    const { pending_sync_bookmarks = [] } = await browser.storage.local.get(['pending_sync_bookmarks']);
    if (pending_sync_bookmarks.length === 0) return;

    console.log(`[BookSmart] Syncing ${pending_sync_bookmarks.length} offline queued bookmarks to backend...`);
    
    const remaining = [];
    let isSessionDead = false;

    for (const bookmarkData of pending_sync_bookmarks) {
      if (isSessionDead) {
        remaining.push(bookmarkData);
        continue;
      }

      try {
        await bookmarks.create(bookmarkData);
      } catch (err) {
        console.error(`[BookSmart] Failed to sync queued bookmark ${bookmarkData.url}:`, err);
        if (err.status === 401) {
          isSessionDead = true;
          remaining.push(bookmarkData);
        }
        // Discard duplicates or format validation errors to prevent queue deadlocks
      }
    }

    if (remaining.length > 0) {
      await browser.storage.local.set({ pending_sync_bookmarks: remaining });
    } else {
      await browser.storage.local.remove(['pending_sync_bookmarks']);
      console.log('[BookSmart] All offline queued bookmarks synced successfully.');
    }
  } catch (error) {
    console.error('[BookSmart] Error flushing pending bookmarks:', error);
  }
}
