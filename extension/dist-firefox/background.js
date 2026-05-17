import './lib/browser-polyfill.js';
// BookSmart Background Service Worker
// This script runs in the background and listens to browser bookmark events

import './config.js';
import { bookmarks, auth } from './utils/api.js';
import { getAuthData, saveAuthData, STORAGE_KEYS } from './utils/storage.js';
import { showNotification } from './utils/notifications.js';

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

// ── Dedup guard ──────────────────────────────────────────────────────────────
// When we mirror a BookSmart save back to Chrome, it fires onCreated, which
// would create a duplicate in BookSmart. We track URLs we just mirrored and
// skip them in the onCreated handler.
const selfCreatedUrls = new Set();

// Listen to new bookmarks being created
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('New bookmark created:', bookmark);
  if (!bookmark.url) return;

  // Skip bookmarks that WE just created to avoid double-syncing
  if (selfCreatedUrls.has(bookmark.url)) {
    selfCreatedUrls.delete(bookmark.url);
    console.log('[BookSmart] Skipping self-created bookmark (already in BookSmart):', bookmark.url);
    return;
  }

  await handleNewBookmark(bookmark);
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
    await handleBookmarkUpdate(bookmark);
  }
});

// Listen to bookmarks being changed (renamed)
browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('Bookmark changed:', id, changeInfo);
  const [bookmark] = await browser.bookmarks.get(id);
  if (bookmark && bookmark.url) {
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
 * Registers the URL in selfCreatedUrls first to suppress the onCreated event.
 */
async function mirrorBookmarkToChrome(url, title, folderPath) {
  try {
    // Check if Chrome already has this bookmark to avoid duplicates
    const existing = await browser.bookmarks.search({ url });
    if (existing && existing.length > 0) {
      console.log('[BookSmart] Chrome already has this bookmark, skipping mirror:', url);
      return;
    }

    // Register as self-created BEFORE calling browser.bookmarks.create
    // so the onCreated handler knows to skip it
    selfCreatedUrls.add(url);

    // Resolve the folder (create if needed)
    const parentId = folderPath
      ? await findOrCreateChromeFolder(folderPath)
      : undefined; // undefined → Chrome places it in default location

    const createParams = { title, url };
    if (parentId) createParams.parentId = parentId;

    await browser.bookmarks.create(createParams);
    console.log('[BookSmart] Mirrored bookmark to Chrome:', url, folderPath || '(no folder)');

    // Safety: clean up the guard entry after 5 seconds in case onCreated fires slowly
    setTimeout(() => selfCreatedUrls.delete(url), 5000);
  } catch (e) {
    // If creation failed, remove the guard so we don't permanently suppress future saves
    selfCreatedUrls.delete(url);
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
