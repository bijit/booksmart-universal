// BookSmart Popup Script
// This script handles the popup UI logic

import { MANAGER_URL } from '../config.js';

import { auth, bookmarks, search, importJobs } from '../utils/api.js';
import { getAuthData, saveAuthData, clearAuthData, STORAGE_KEYS } from '../utils/storage.js';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const registerForm = document.getElementById('registerForm');
const registerError = document.getElementById('registerError');
const registerLink = document.getElementById('registerLink');
const backToLoginLink = document.getElementById('backToLoginLink');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const bookmarksList = document.getElementById('bookmarksList');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const importProgressState = document.getElementById('importProgressState');
const openManagerBtn = document.getElementById('openManagerBtn');
const importBtn = document.getElementById('importBtn');
const importFromEmptyBtn = document.getElementById('importFromEmptyBtn');
const logoutBtn = document.getElementById('logoutBtnTop');
const syncFoldersBtn = document.getElementById('syncFoldersBtn');
const resultsTitle = document.getElementById('resultsTitle');
const deepSearchIndicator = document.getElementById('deepSearchIndicator');
const searchModeToggle = document.getElementById('searchModeToggle');
const instantSearchTab = document.getElementById('instantSearchTab');
const semanticSearchTab = document.getElementById('semanticSearchTab');

let allRecentBookmarks = []; // Cache for instant local search

const currentPageSection = document.getElementById('currentPageSection');
const currentPageTitle = document.getElementById('currentPageTitle');
const currentPageUrl = document.getElementById('currentPageUrl');
const currentPageFavicon = document.getElementById('currentPageFavicon');
const savePageBtn = document.getElementById('savePageBtn');
const relatedList = document.getElementById('relatedList');
const suggestedTagsContainer = document.getElementById('suggestedTagsContainer');
const suggestedTagsList = document.getElementById('suggestedTagsList');
const discoveryTagsContainer = document.getElementById('discoveryTagsContainer');
const discoveryTagsList = document.getElementById('discoveryTagsList');
const importConfirmModal = document.getElementById('importConfirmModal');
const importDeleteBtn = document.getElementById('importDeleteBtn');
const importAddBtn = document.getElementById('importAddBtn');
const importCancelBtn = document.getElementById('importCancelBtn');
const closeImportModal = document.getElementById('closeImportModal');
const importModalText = document.getElementById('importModalText');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('BookSmart popup loaded');

  // Handle favicon loading errors securely without inline onerror attributes
  currentPageFavicon.addEventListener('error', function() {
    this.style.display = 'none';
  });

  const authData = await getAuthData();
  const authenticated = !!(authData[STORAGE_KEYS.AUTH_TOKEN] && authData[STORAGE_KEYS.USER]);

  if (authenticated) {
    showMainScreen();
    initializeCurrentPageContext();
    loadRecentBookmarks();
  } else {
    showLoginScreen();
  }

  setupEventListeners();
});

// Set up event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
      // Open the manager app to handle Google OAuth
      browser.tabs.create({ url: `${MANAGER_URL}/login` });
    });
  }

  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterScreen();
  });

  backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginScreen();
  });

  let searchTimeout;
  let currentSearchMode = 'instant';

  function updateSearch() {
    const value = searchInput.value;
    if (value.trim()) {
      clearSearchBtn.classList.remove('hidden');
      searchModeToggle.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
      searchModeToggle.classList.add('hidden');
      deepSearchIndicator.classList.add('hidden');
      resultsTitle.classList.add('hidden');
      currentPageSection.classList.remove('hidden');
      displayBookmarks(allRecentBookmarks);
      return;
    }

    if (currentSearchMode === 'instant') {
      handleLocalSearch(value);
    } else {
      bookmarksList.innerHTML = '';
      hideEmpty();
      showLoading();

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        handleDeepSearch(value);
      }, 500);
    }
  }

  searchInput.addEventListener('input', updateSearch);

  instantSearchTab.addEventListener('click', () => {
    currentSearchMode = 'instant';
    instantSearchTab.classList.add('active');
    semanticSearchTab.classList.remove('active');
    updateSearch();
  });

  semanticSearchTab.addEventListener('click', () => {
    currentSearchMode = 'semantic';
    semanticSearchTab.classList.add('active');
    instantSearchTab.classList.remove('active');
    updateSearch();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentSearchMode === 'semantic') {
      clearTimeout(searchTimeout);
      handleDeepSearch(searchInput.value);
    }
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    searchModeToggle.classList.add('hidden');
    resultsTitle.classList.add('hidden');
    currentPageSection.classList.remove('hidden');
    loadRecentBookmarks();
  });

  openManagerBtn.addEventListener('click', () => openManager());
  importBtn.addEventListener('click', handleImport);
  if (importFromEmptyBtn) {
    importFromEmptyBtn.addEventListener('click', handleImport);
  }

  if (importCancelBtn) {
    importCancelBtn.addEventListener('click', () => {
      importConfirmModal.classList.add('hidden');
    });
  }
  if (closeImportModal) {
    closeImportModal.addEventListener('click', () => {
      importConfirmModal.classList.add('hidden');
    });
  }

  syncFoldersBtn.addEventListener('click', handleSyncFolders);
  logoutBtn.addEventListener('click', handleLogout);
  savePageBtn.addEventListener('click', handleSaveCurrentPage);

  // Initialize the auto-inbox toggle preference
  const autoInboxToggle = document.getElementById('autoInboxToggle');
  if (autoInboxToggle) {
    browser.storage.local.get(['autoInboxRoute']).then((result) => {
      autoInboxToggle.checked = !!result.autoInboxRoute;
    }).catch(err => console.error('Error getting autoInboxRoute pref:', err));

    autoInboxToggle.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      browser.storage.local.set({ autoInboxRoute: isChecked })
        .then(() => {
          console.log('[BookSmart] Auto-inbox preference updated:', isChecked);
          if (isChecked) {
            browser.runtime.sendMessage({ action: 'createInboxFolder' })
              .then(res => console.log('[BookSmart] Inbox folder check/creation triggered:', res))
              .catch(err => console.error('[BookSmart] Error sending createInboxFolder message:', err));
          }
        })
        .catch(err => console.error('Error saving autoInboxRoute pref:', err));
    });
  }
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  loginError.classList.add('hidden');

  try {
    const data = await auth.login(email, password);
    await saveAuthData(data);
    browser.runtime.sendMessage({ action: 'flushPendingBookmarks' });
    showMainScreen();
    loadRecentBookmarks();
  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || 'Login failed. Please try again.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const name = email.split('@')[0];
  registerError.classList.add('hidden');

  try {
    const data = await auth.register(name, email, password);
    await saveAuthData(data);
    browser.runtime.sendMessage({ action: 'flushPendingBookmarks' });
    showMainScreen();
    loadRecentBookmarks();
  } catch (error) {
    console.error('Registration error:', error);
    showRegisterError(error.message || 'Registration failed. Please try again.');
  }
}

async function handleLogout() {
  await clearAuthData();
  showLoginScreen();
  bookmarksList.innerHTML = '';
}

// Bookmark Handlers
async function loadRecentBookmarks() {
  showLoading();
  resultsTitle.classList.add('hidden');
  currentPageSection.classList.remove('hidden');

  try {
    const params = { limit: 100, status: 'completed' };
    const data = await bookmarks.list(params);
    allRecentBookmarks = data.bookmarks || [];
    displayBookmarks(allRecentBookmarks);
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    if (error.status === 401) {
      await handleLogout();
    } else {
      showError('Failed to load bookmarks');
    }
  }
}

// Instant Local Search
function handleLocalSearch(query) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    displayBookmarks(allRecentBookmarks);
    return;
  }

  const matches = allRecentBookmarks.filter(b => 
    (b.title || '').toLowerCase().includes(trimmedQuery) ||
    (b.description || '').toLowerCase().includes(trimmedQuery) ||
    (b.notes || '').toLowerCase().includes(trimmedQuery) ||
    (b.site_name || '').toLowerCase().includes(trimmedQuery) ||
    (b.author || '').toLowerCase().includes(trimmedQuery) ||
    (b.tags || []).some(t => t.toLowerCase().includes(trimmedQuery))
  );

  resultsTitle.classList.remove('hidden');
  currentPageSection.classList.add('hidden');
  displayBookmarks(matches, true);
}

// Deep Semantic Search
async function handleDeepSearch(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  deepSearchIndicator.classList.remove('hidden');

  try {
    const options = { 
      query: trimmedQuery,
      searchType: 'hybrid',
      generateAnswer: false // Disable AI answer overview generation for speed
    };
    const data = await search.query(options);

    displayBookmarks(data.results || [], true);
  } catch (error) {
    console.error('Deep search error:', error);
    if (error.status === 401) {
      await handleLogout();
    }
  } finally {
    deepSearchIndicator.classList.add('hidden');
  }
}

// UI Rendering
function displayBookmarks(bookmarks, isSearch = false) {
  hideLoading();
  if (bookmarks.length === 0) {
    showEmpty(isSearch);
    return;
  }
  hideEmpty();
  bookmarksList.innerHTML = '';

  if (isSearch) {
    // Flat list for search results (relevance order matters)
    bookmarks.forEach(bookmark => {
      bookmarksList.appendChild(createBookmarkCard(bookmark));
    });
    return;
  }

  // Group by relative date for the recent view
  const groups = groupByDate(bookmarks);
  groups.forEach(({ label, items }) => {
    const header = document.createElement('div');
    header.className = 'timeline-group-header';
    header.textContent = label;
    bookmarksList.appendChild(header);

    items.forEach(bookmark => {
      bookmarksList.appendChild(createBookmarkCard(bookmark));
    });
  });
}

function groupByDate(bookmarks) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  const buckets = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };

  bookmarks.forEach(b => {
    const d = new Date(b.created_at);
    if (d >= today) buckets['Today'].push(b);
    else if (d >= yesterday) buckets['Yesterday'].push(b);
    else if (d >= weekAgo) buckets['This Week'].push(b);
    else buckets['Older'].push(b);
  });

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function createBookmarkCard(bookmark) {
  const card = document.createElement('div');
  card.className = 'bookmark-card';

  let domain = '';
  try {
    domain = new URL(bookmark.url).hostname.replace('www.', '');
  } catch (e) {
    domain = bookmark.url;
  }

  const timeAgo = getTimeAgo(bookmark.created_at);
  const status = bookmark.processing_status || 'completed';
  const statusText = status === 'pending' ? 'Processing...' : '';
  const tags = bookmark.tags?.slice(0, 5).map(tag =>
    `<span class="bookmark-tag">${escapeHtml(tag)}</span>`
  ).join('') || '';

  const siteName = bookmark.site_name || domain;
  const author = bookmark.author || '';
  const notes = bookmark.notes || '';

  card.innerHTML = `
    <div class="bookmark-favicon">
      <img src="${bookmark.favicon_url || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`}" alt="" class="card-favicon">
    </div>
    <div class="bookmark-content">
      <div class="bookmark-title">${escapeHtml(bookmark.title || bookmark.url)}</div>
      <div class="bookmark-url">
        <span class="bookmark-site">${escapeHtml(siteName)}</span>
        ${author ? `<span class="bookmark-author">${escapeHtml(author)}</span>` : ''}
      </div>
      ${tags ? `<div class="bookmark-tags">${tags}</div>` : ''}
      <div class="bookmark-meta">
        <span class="bookmark-time">${timeAgo}</span>
        ${statusText ? `<span class="bookmark-status ${status}">${statusText}</span>` : ''}
      </div>
      <div class="bookmark-notes-section">
        <div class="notes-label">Personal Notes</div>
        <textarea class="notes-textarea" placeholder="Add some notes...">${escapeHtml(notes)}</textarea>
        <div class="notes-status">Saved</div>
      </div>
    </div>
  `;

  // Handle fallback favicon loading securely
  const faviconImg = card.querySelector('.card-favicon');
  faviconImg.addEventListener('error', function() {
    this.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  });

  // Prevent card click when clicking notes or metadata
  const notesTextarea = card.querySelector('.notes-textarea');
  const notesStatus = card.querySelector('.notes-status');
  
  notesTextarea.addEventListener('click', (e) => e.stopPropagation());
  
  let saveTimeout;
  notesTextarea.addEventListener('input', (e) => {
    e.stopPropagation();
    const newNotes = e.target.value;
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await bookmarks.update(bookmark.id, { notes: newNotes });
        notesStatus.classList.add('visible');
        setTimeout(() => notesStatus.classList.remove('visible'), 2000);
        
        // Update local cache
        const cached = allRecentBookmarks.find(b => b.id === bookmark.id);
        if (cached) cached.notes = newNotes;
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
    }, 1000);
  });

  card.addEventListener('click', () => {
    browser.tabs.create({ url: bookmark.url });
  });

  return card;
}

// Helpers
function getTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


async function openManager(path = '') {

  const authData = await getAuthData();
  const token = authData[STORAGE_KEYS.AUTH_TOKEN];
  const url = token ? `${MANAGER_URL}${path}?token=${encodeURIComponent(token)}` : `${MANAGER_URL}${path}`;
  browser.tabs.create({ url });
}

// UI States
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  registerScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
}
function showRegisterScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
}
function showMainScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}
function showLoading() {
  loadingState.classList.remove('hidden');
  bookmarksList.classList.add('hidden');
  emptyState.classList.add('hidden');
}
function hideLoading() {
  loadingState.classList.add('hidden');
  bookmarksList.classList.remove('hidden');
}
function showEmpty(isSearch = false) {
  emptyState.classList.remove('hidden');
  bookmarksList.classList.add('hidden');
  
  if (isSearch) {
    if (importFromEmptyBtn) importFromEmptyBtn.classList.add('hidden');
    const emptyText = emptyState.querySelector('p');
    if (emptyText) emptyText.textContent = 'No matching bookmarks found.';
  } else {
    if (importFromEmptyBtn) importFromEmptyBtn.classList.remove('hidden');
    const emptyText = emptyState.querySelector('p');
    if (emptyText) emptyText.textContent = 'No bookmarks found.';
  }
}
function hideEmpty() {
  emptyState.classList.add('hidden');
  bookmarksList.classList.remove('hidden');
}
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
  hideLoading();
}
function showRegisterError(message) {
  registerError.textContent = message;
  registerError.classList.remove('hidden');
}

// Import logic
async function handleImport() {
  try {
    const data = await bookmarks.list({ limit: 1 });
    const existingCount = data.pagination?.total || 0;

    const tree = await browser.bookmarks.getTree();
    const flattened = [];
    
    const traverse = (node, currentPath = '') => {
      if (node.url) {
        flattened.push({ 
          url: node.url, 
          title: node.title,
          created_at: node.dateAdded ? new Date(node.dateAdded).toISOString() : new Date().toISOString(),
          folder_path: currentPath || null,
          folder_id: node.parentId || null
        });
      } else if (node.children) {
        let newPath = currentPath;
        if (node.title && node.id !== '0') {
           newPath = currentPath ? `${currentPath} > ${node.title}` : node.title;
        }
        node.children.forEach(child => traverse(child, newPath));
      }
    };
    
    tree.forEach(child => traverse(child, ''));

    if (flattened.length === 0) return alert('No bookmarks found');

    if (existingCount > 0) {
      // Show custom modal instead of scary confirm()
      importModalText.innerHTML = `You have <strong>${existingCount}</strong> bookmarks in your library. <br><br>Would you like to <strong>Delete & Re-import</strong> everything, or simply <strong>Add</strong> these new ${flattened.length} bookmarks to your existing collection?`;
      importConfirmModal.classList.remove('hidden');

      // Set up one-time listeners for this specific import session
      const executeImport = async (shouldDelete) => {
        importConfirmModal.classList.add('hidden');
        showImportProgress();
        
        if (shouldDelete) {
          document.getElementById('importProgressText').textContent = 'Deleting existing bookmarks...';
          await bookmarks.deleteAll();
        }

        const batchResult = await importJobs.batch(flattened);
        await pollImportProgress(batchResult.jobId, flattened.length);
      };

      // Clean up previous listeners if any (using replaceWith to reset)
      const newDeleteBtn = importDeleteBtn.cloneNode(true);
      const newAddBtn = importAddBtn.cloneNode(true);
      importDeleteBtn.replaceWith(newDeleteBtn);
      importAddBtn.replaceWith(newAddBtn);
      
      newDeleteBtn.addEventListener('click', () => {
        if (confirm("Are you absolutely sure you want to delete all existing bookmarks? This action is permanent and cannot be undone.")) {
          executeImport(true);
        }
      });
      newAddBtn.addEventListener('click', () => executeImport(false));

    } else {
      // No existing bookmarks, just confirm simple import
      if (confirm(`Import ${flattened.length} bookmarks?`)) {
        showImportProgress();
        const batchResult = await importJobs.batch(flattened);
        await pollImportProgress(batchResult.jobId, flattened.length);
      }
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('Import failed: ' + error.message);
    hideImportProgress();
    importConfirmModal.classList.add('hidden');
  }
}

async function pollImportProgress(jobId, total) {
  const interval = setInterval(async () => {
    try {
      const status = await importJobs.getStatus(jobId);
      updateImportProgress(status.processedBookmarks, total, status.progress);
      if (status.status === 'completed') {
        clearInterval(interval);
        hideImportProgress();
        alert('Import complete!');
        loadRecentBookmarks();
      }
    } catch (error) {
      clearInterval(interval);
      hideImportProgress();
      console.error('Poll error:', error);
    }
  }, 2000);
}

function showImportProgress() {
  bookmarksList.classList.add('hidden');
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  importProgressState.classList.remove('hidden');
}
function hideImportProgress() {
  importProgressState.classList.add('hidden');
  bookmarksList.classList.remove('hidden');
}
function updateImportProgress(processed, total, percentage) {
  document.getElementById('importProgressFill').style.width = `${percentage}%`;
  document.getElementById('importProgressDetails').textContent = `${processed} / ${total} (${percentage}%)`;
}

// Current Page Intelligence
let currentTabData = null;

// Folder Picker State
let allFolderPaths = [];
let selectedFolderPath = null;
let folderDropdownVisible = false;
let existingBookmarkId = null;

// Folder Picker DOM refs (populated after DOMContentLoaded)
let folderSearchInput, folderDropdown, folderDropdownList, folderCreateOption, folderCreateLabel, selectedFolderChip, selectedFolderName, clearFolderBtn;

async function initializeCurrentPageContext() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      currentPageSection.classList.add('hidden');
      return;
    }

    // Clean up URL if it's a PDF opened via a Chrome extension (like Adobe Acrobat)
    let cleanUrl = tab.url;
    if (cleanUrl.startsWith('chrome-extension://') && cleanUrl.includes('/http')) {
      const httpIndex = cleanUrl.indexOf('http');
      cleanUrl = cleanUrl.substring(httpIndex);
    }

    currentTabData = { ...tab, url: cleanUrl };
    currentPageTitle.value = tab.title;
    currentPageUrl.textContent = new URL(cleanUrl).hostname;
    currentPageFavicon.src = `https://www.google.com/s2/favicons?domain=${new URL(cleanUrl).hostname}&sz=32`;

    // Initialise folder picker
    initFolderPickerRefs();
    loadFolderPaths();

    // Check if already bookmarked
    const data = await bookmarks.list({ url: cleanUrl });
    const isBookmarked = data.bookmarks && data.bookmarks.length > 0;

    if (isBookmarked) {
      const dbBookmark = data.bookmarks[0];
      existingBookmarkId = dbBookmark.id;

      // Pre-fill fields for editing
      if (dbBookmark.title) currentPageTitle.value = dbBookmark.title;
      if (dbBookmark.folder_path) selectFolder(dbBookmark.folder_path);

      // Change button text
      savePageBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        Update Bookmark
      `;

      // Still show the folder info row as a handy link to the bookmark manager
      const folderInfoRow = document.getElementById('folderInfoRow');
      const savedFolderPath = document.getElementById('savedFolderPath');
      const seeInFolderBtn = document.getElementById('seeInFolderBtn');
      
      if (folderInfoRow && savedFolderPath && seeInFolderBtn) {
        savedFolderPath.textContent = dbBookmark.folder_path || 'Other Bookmarks';
        folderInfoRow.classList.remove('hidden');
        
        seeInFolderBtn.addEventListener('click', () => {
          const folderQuery = dbBookmark.folder_path 
            ? `?folder=${encodeURIComponent(dbBookmark.folder_path)}`
            : '';
          const url = `chrome://bookmarks/${folderQuery}`;
          browser.tabs.create({ url });
        });
      }
    } else {
      // Find related content to show "At your fingertips"
      findRelatedContent(tab.title);
      // Brand new analysis for discovery tags
      analyzePageContent(tab);
    }
  } catch (error) {
    console.error('Error initializing page context:', error);
  }
}

async function findRelatedContent(title) {
  try {
    // Search library for things related to the current title
    const data = await search.query({ query: title, limit: 5 });
    const results = data.results || [];

    if (results.length > 0) {
      // Extract unique tags from related content
      const tags = new Set();
      results.forEach(item => {
        if (item.tags) {
          item.tags.forEach(tag => tags.add(tag));
        }
      });

      if (tags.size > 0) {
        suggestedTagsList.innerHTML = '';
        Array.from(tags).slice(0, 8).forEach(tag => {
          const pill = document.createElement('span');
          pill.className = 'suggested-tag';
          pill.textContent = tag;
          suggestedTagsList.appendChild(pill);
        });
        suggestedTagsContainer.classList.remove('hidden');
      } else {
        suggestedTagsContainer.classList.add('hidden');
      }

      relatedList.innerHTML = '';
      results.slice(0, 3).forEach(item => {
        const link = document.createElement('a');
        link.href = item.url;
        link.className = 'related-item';
        link.textContent = item.title;
        link.title = item.title;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          browser.tabs.create({ url: item.url });
        });
        relatedList.appendChild(link);
      });
      relatedContent.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error finding related content:', error);
  }
}

async function analyzePageContent(tab) {
  try {
    // Use Cloud AI for tag suggestions
    const data = await bookmarks.analyze({ title: tab.title });
    if (data.tags && data.tags.length > 0) {
      displayDiscoveryTags(data.tags, 'Cloud AI');
    }
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

function displayDiscoveryTags(tags, source) {
  discoveryTagsList.innerHTML = '';
  tags.slice(0, 5).forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'suggested-tag';
    pill.style.background = '#F0FDF4';
    pill.style.color = '#166534';
    pill.style.borderColor = '#BBF7D0';
    pill.textContent = tag;
    discoveryTagsList.appendChild(pill);
  });
  discoveryTagsContainer.classList.remove('hidden');
  console.log(`[Discovery] Tags generated via ${source}`);
}

// ─── Folder Picker Logic ─────────────────────────────────────────────────────

function initFolderPickerRefs() {
  folderSearchInput  = document.getElementById('folderSearchInput');
  folderDropdown     = document.getElementById('folderDropdown');
  folderDropdownList = document.getElementById('folderDropdownList');
  folderCreateOption = document.getElementById('folderCreateOption');
  folderCreateLabel  = document.getElementById('folderCreateLabel');
  selectedFolderChip = document.getElementById('selectedFolderChip');
  selectedFolderName = document.getElementById('selectedFolderName');
  clearFolderBtn     = document.getElementById('clearFolderBtn');
  const addSubfolderBtn = document.getElementById('addSubfolderBtn');

  if (!folderSearchInput) return; // not on this popup view

  folderSearchInput.addEventListener('focus', () => {
    showFolderDropdown(folderSearchInput.value);
  });

  folderSearchInput.addEventListener('input', () => {
    showFolderDropdown(folderSearchInput.value);
  });

  // Keyboard navigation
  folderSearchInput.addEventListener('keydown', (e) => {
    const items = folderDropdown.querySelectorAll('.folder-dropdown-item, .folder-create-option:not(.hidden)');
    const active = folderDropdown.querySelector('.active');
    let idx = Array.from(items).indexOf(active);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < items.length - 1) {
        active?.classList.remove('active');
        items[idx + 1].classList.add('active');
        items[idx + 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        active?.classList.remove('active');
        items[idx - 1].classList.add('active');
        items[idx - 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) active.click();
    } else if (e.key === 'Escape') {
      hideFolderDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.folder-input-wrapper')) hideFolderDropdown();
  });

  clearFolderBtn.addEventListener('click', () => {
    selectedFolderPath = null;
    selectedFolderChip.classList.add('hidden');
    folderSearchInput.value = '';
    folderSearchInput.classList.remove('hidden');
    folderSearchInput.focus();
  });

  // Subfolder shortcut: pre-fill input with "CurrentFolder > " so user just types the name
  addSubfolderBtn.addEventListener('click', () => {
    const parentPath = selectedFolderPath;
    // Reset the selection and show the input pre-filled
    selectedFolderPath = null;
    selectedFolderChip.classList.add('hidden');
    folderSearchInput.classList.remove('hidden');
    folderSearchInput.value = `${parentPath} > `;
    folderSearchInput.focus();
    // Position cursor at the end
    folderSearchInput.setSelectionRange(folderSearchInput.value.length, folderSearchInput.value.length);
    // Open dropdown — will show "Create folder '...'" once user types a name
    showFolderDropdown(folderSearchInput.value);
  });
}

async function loadFolderPaths() {
  try {
    // ── Source 1: BookSmart backend (folders already in our DB) ───────────────
    let dbFolders = [];
    try {
      const { auth_token: token } = await browser.storage.local.get(['auth_token']);
      if (token) {
        const API_URL = globalThis.API_BASE_URL;
        const res = await fetch(`${API_URL}/bookmarks/folders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          dbFolders = data.folders || [];
        }
      }
    } catch (e) {
      console.warn('[FolderPicker] Could not load folders from backend:', e.message);
    }

    // ── Source 2: Chrome's live bookmark tree ─────────────────────────────────
    let chromeFolders = [];
    try {
      const tree = await browser.bookmarks.getTree();

      // Recursively walk the tree; skip virtual root nodes (id 0/1/'root')
      // and collect folder paths using the same "Parent > Child" format
      // as background.js getFolderPath().
      function walk(node, parentPath) {
        // A node with children and no URL is a folder
        if (node.children) {
          const skipIds = new Set(['0', '1', 'root']);
          const isVirtualRoot = skipIds.has(String(node.id)) || !node.title;

          const myPath = isVirtualRoot
            ? parentPath
            : (parentPath ? `${parentPath} > ${node.title}` : node.title);

          if (!isVirtualRoot && myPath) {
            chromeFolders.push(myPath);
          }

          for (const child of node.children) {
            walk(child, myPath);
          }
        }
      }

      for (const root of tree) {
        walk(root, '');
      }
    } catch (e) {
      console.warn('[FolderPicker] Could not read Chrome bookmark tree:', e.message);
    }

    // ── Merge, deduplicate, sort ───────────────────────────────────────────────
    const merged = [...new Set([...dbFolders, ...chromeFolders])].sort();
    allFolderPaths = merged;

    console.log(`[FolderPicker] Loaded ${allFolderPaths.length} folders (${dbFolders.length} from DB, ${chromeFolders.length} from Chrome)`);
    
    // Show recently-used folders
    await showRecentFolders();

    // Generate pre-save folder recommendations based on tab title + URL
    if (currentTabData && currentTabData.title && allFolderPaths.length > 0) {
      generateFolderRecommendations(currentTabData.title, currentTabData.url);
    }
  } catch (e) {
    console.warn('[FolderPicker] Could not load folders:', e.message);
  }
}

// Common English stop words to skip during token matching
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','through','during','is','are','was',
  'were','be','been','being','have','has','had','do','does','did','will',
  'would','could','should','may','might','can','not','no','nor','so',
  'yet','both','either','neither','this','that','these','those','its',
  'it','he','she','they','we','you','i','my','your','his','her','their',
  'our','all','more','most','other','some','such','than','too','very',
  'just','how','what','which','who','when','where','why','www','http',
  'https','com','org','net','io','co','html','htm','php','asp'
]);

/**
 * Extract meaningful tokens from a page title and URL for folder matching.
 * Filters stop words and short tokens (<= 2 chars).
 */
function extractPageTokens(pageTitle, pageUrl) {
  const titleTokens = (pageTitle || '')
    .toLowerCase()
    .split(/[\s\-\_\.\,\:\;\/\\\|\(\)\[\]\{\}\+\=\&\%\#\@\!\?]+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

  let urlTokens = [];
  try {
    const parsed = new URL(pageUrl || '');
    // Extract hostname segments (e.g. "github" from "github.com")
    const hostTokens = parsed.hostname
      .replace(/^www\./, '')
      .split(/[\.\_\-]+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));
    // Extract path segments
    const pathTokens = parsed.pathname
      .split(/[\/_\-\.]+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t.toLowerCase()))
      .map(t => t.toLowerCase());
    urlTokens = [...hostTokens, ...pathTokens];
  } catch (_) { /* ignore invalid URLs */ }

  // Deduplicate; URL tokens are those not already in the title set
  const titleSet = new Set(titleTokens);
  const urlOnly = urlTokens.filter(t => !titleSet.has(t));

  return { titleTokens, urlTokens: urlOnly, allTokens: [...titleTokens, ...urlOnly] };
}

/**
 * Word-boundary check: true if `str` contains `token` as a whole word
 * (preceded/followed by a non-alphanumeric character or string boundary).
 */
function containsWholeWord(str, token) {
  const escaped = token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(str);
}

/**
 * Generate Suggested Folders using improved token + URL similarity scoring.
 * @param {string} pageTitle - Current tab title
 * @param {string} [pageUrl]  - Current tab URL (optional but improves results)
 */
function generateFolderRecommendations(pageTitle, pageUrl) {
  const container = document.getElementById('suggestedFoldersContainer');
  const list = document.getElementById('suggestedFoldersList');
  if (!container || !list) return;

  const { titleTokens, urlTokens, allTokens } = extractPageTokens(pageTitle, pageUrl);

  if (allTokens.length === 0) {
    container.classList.add('hidden');
    return;
  }

  const scoredFolders = allFolderPaths.map(path => {
    const pathLower = path.toLowerCase();
    const pathSegments = pathLower.split(' > ');
    const leafSegment = pathSegments[pathSegments.length - 1];

    let score = 0;

    titleTokens.forEach(token => {
      // +25 whole-word match in leaf folder name
      if (containsWholeWord(leafSegment, token)) score += 25;
      // +15 substring match in leaf folder name
      else if (leafSegment.includes(token)) score += 15;
      // +8 whole-word match anywhere in path
      if (containsWholeWord(pathLower, token)) score += 8;
      // +5 substring match anywhere in path
      else if (pathLower.includes(token)) score += 5;
    });

    urlTokens.forEach(token => {
      // URL tokens get a bonus since domain/path are strong signals
      if (containsWholeWord(leafSegment, token)) score += 20;
      else if (leafSegment.includes(token)) score += 12;
      if (containsWholeWord(pathLower, token)) score += 7;
      else if (pathLower.includes(token)) score += 4;
    });

    return { path, score };
  });

  // Exclude folders already shown in the Recent section to avoid duplicates
  const recentPaths = _recentFolderState.recentPaths;
  const recommendations = scoredFolders
    .filter(x => x.score > 0 && !recentPaths.includes(x.path))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (recommendations.length > 0) {
    list.innerHTML = '';
    const folderIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    recommendations.forEach(({ path }) => {
      const pill = document.createElement('div');
      pill.className = 'suggested-folder-pill';
      const segments = path.split(' > ');
      const displayTitle = segments[segments.length - 1];
      pill.innerHTML = `${folderIcon}<span title="${path}">${displayTitle}</span>`;
      pill.addEventListener('click', () => selectFolder(path));
      list.appendChild(pill);
    });
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

// ─── Recent Folders ───────────────────────────────────────────────────────────

/** In-memory cache so showRecentFolders does not need to hit storage twice */
const _recentFolderState = { recentPaths: [] };

/**
 * Render the last N folders the user actually saved to, above the
 * Recommended section. Uses amber-tint pills to differentiate visually.
 */
async function showRecentFolders() {
  const container = document.getElementById('recentFoldersContainer');
  const list = document.getElementById('recentFoldersList');
  if (!container || !list) return;

  try {
    const { recent_folders = [] } = await browser.storage.local.get('recent_folders');
    _recentFolderState.recentPaths = recent_folders;

    if (recent_folders.length === 0) {
      container.classList.add('hidden');
      return;
    }

    list.innerHTML = '';
    const clockIcon = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    recent_folders.forEach(path => {
      const pill = document.createElement('div');
      pill.className = 'recent-folder-pill';
      const segments = path.split(' > ');
      const displayTitle = segments[segments.length - 1];
      pill.innerHTML = `${clockIcon}<span title="${path}">${displayTitle}</span>`;
      pill.addEventListener('click', () => selectFolder(path));
      list.appendChild(pill);
    });
    container.classList.remove('hidden');
  } catch (e) {
    console.warn('[FolderPicker] Could not load recent folders:', e.message);
    container.classList.add('hidden');
  }
}

/**
 * Persist a folder path to the top of the recent-folders list (max 3 entries).
 * Call this after a successful bookmark save/update.
 */
async function recordRecentFolder(path) {
  if (!path) return;
  try {
    const { recent_folders = [] } = await browser.storage.local.get('recent_folders');
    const updated = [path, ...recent_folders.filter(f => f !== path)].slice(0, 3);
    await browser.storage.local.set({ recent_folders: updated });
  } catch (e) {
    console.warn('[FolderPicker] Could not record recent folder:', e.message);
  }
}

function showFolderDropdown(query = '') {
  if (!folderDropdownList) return;
  folderDropdown.classList.remove('hidden');
  folderDropdownVisible = true;

  const q = query.trim();
  const ql = q.toLowerCase();

  // ── Fuzzy scorer ──────────────────────────────────────────────────────────
  // Split query into tokens; a folder matches if ALL tokens appear somewhere
  // in the path (any segment, any order).  Higher score = better match.
  const tokens = ql.split(/\s+/).filter(Boolean);

  function score(path) {
    const pl = path.toLowerCase();
    if (!tokens.length) return 1; // empty query → everything matches

    // All tokens must appear somewhere in the path
    if (!tokens.every(t => pl.includes(t))) return 0;

    let s = 1;
    // Bonus: path starts with the raw query
    if (pl.startsWith(ql)) s += 100;
    // Bonus: path contains the full query as a contiguous substring
    if (pl.includes(ql)) s += 50;
    // Bonus: tokens appear in the same left-to-right order
    let lastIdx = -1;
    let inOrder = true;
    for (const t of tokens) {
      const idx = pl.indexOf(t, lastIdx + 1);
      if (idx <= lastIdx) { inOrder = false; break; }
      lastIdx = idx;
    }
    if (inOrder) s += 20;
    // Bonus: last path segment matches well
    const lastSegment = pl.split(/[/\\>]/).filter(Boolean).pop() || pl;
    if (tokens.every(t => lastSegment.includes(t))) s += 10;

    return s;
  }
  // ──────────────────────────────────────────────────────────────────────────

  const scored = allFolderPaths
    .map(path => ({ path, s: score(path) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);

  folderDropdownList.innerHTML = '';

  const folderIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

  scored.forEach(({ path }) => {
    const item = document.createElement('div');
    item.className = 'folder-dropdown-item';
    item.innerHTML = `${folderIcon}<span>${path}</span>`;
    item.addEventListener('click', () => selectFolder(path));
    folderDropdownList.appendChild(item);
  });

  // Show "Create" option only if the query has no exact match
  const exactMatch = allFolderPaths.some(p => p.toLowerCase() === ql);
  if (q && !exactMatch) {
    folderCreateLabel.textContent = `Create folder "${q}"`;
    folderCreateOption.classList.remove('hidden');
    folderCreateOption.onclick = () => selectFolder(q);
  } else {
    folderCreateOption.classList.add('hidden');
  }
}

function hideFolderDropdown() {
  folderDropdown?.classList.add('hidden');
  folderDropdownVisible = false;
}

function selectFolder(path) {
  selectedFolderPath = path;
  folderSearchInput.classList.add('hidden');
  folderSearchInput.value = '';
  selectedFolderName.textContent = path;
  selectedFolderChip.classList.remove('hidden');
  
  if (existingBookmarkId) {
    selectedFolderChip.classList.add('existing-bookmark');
  } else {
    selectedFolderChip.classList.remove('existing-bookmark');
  }
  
  hideFolderDropdown();
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
          console.log(`[BookSmart] URL mismatch detected. Skipping local extraction.`);
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

// ─── Save Handler ─────────────────────────────────────────────────────────────

async function handleSaveCurrentPage() {
  if (!currentTabData) return;

  savePageBtn.disabled = true;
  savePageBtn.textContent = 'Saving...';

  // Get both library suggestions and discovery suggestions
  const libraryTags = Array.from(suggestedTagsList.querySelectorAll('.suggested-tag'))
    .map(el => el.textContent);
  const discoveryTags = Array.from(discoveryTagsList.querySelectorAll('.suggested-tag'))
    .map(el => el.textContent);

  const allTags = Array.from(new Set([...libraryTags, ...discoveryTags]));

  try {
    const title = currentPageTitle.value.trim() || currentTabData.title;
    
    // Extract content from current tab!
    const extracted = await extractContentFromActiveTab(currentTabData.url);

    const bookmarkData = {
      url: currentTabData.url,
      title,
      tags: allTags,
      folder_path: selectedFolderPath || null
    };

    if (extracted && extracted.success) {
      bookmarkData.extractedContent = extracted.content;
      bookmarkData.extractedTitle = extracted.title;
      bookmarkData.extractedExcerpt = extracted.excerpt;
      bookmarkData.extractedMethod = extracted.method;
      bookmarkData.extractedLength = extracted.length;

      if (extracted.coverImage) bookmarkData.cover_image = extracted.coverImage;
      if (extracted.extractedImages && extracted.extractedImages.length > 0) bookmarkData.extracted_images = extracted.extractedImages;

      console.log(`[BookSmart] Popup including extracted content (${extracted.length} chars)`);
    }

    if (existingBookmarkId) {
      // Update existing bookmark
      await bookmarks.update(existingBookmarkId, bookmarkData);

      // Mirror update to Chrome
      browser.runtime.sendMessage({
        action: 'updateChromeBookmark',
        url: currentTabData.url,
        title,
        folderPath: selectedFolderPath || null
      }).catch(e => console.warn('[BookSmart] Could not mirror update to Chrome:', e.message));

      // Record folder so it appears in 'Recent' next time
      if (selectedFolderPath) await recordRecentFolder(selectedFolderPath);

      updateSaveBtnToSaved('Updated!');
    } else {
      // Create new bookmark
      await bookmarks.create(bookmarkData);

      // Mirror the save back to Chrome's native bookmark manager
      browser.runtime.sendMessage({
        action: 'mirrorToChrome',
        url: currentTabData.url,
        title,
        folderPath: selectedFolderPath || null
      }).catch(e => console.warn('[BookSmart] Could not mirror to Chrome:', e.message));

      // Record folder so it appears in 'Recent' next time
      if (selectedFolderPath) await recordRecentFolder(selectedFolderPath);

      updateSaveBtnToSaved('Saved to Library');
    }

    // Refresh the list to show the new bookmark
    loadRecentBookmarks();
  } catch (error) {
    console.error('Error saving bookmark:', error);
    savePageBtn.disabled = false;
    savePageBtn.textContent = 'Retry Save';
  }
}

function updateSaveBtnToSaved(text = 'Saved to Library') {
  savePageBtn.disabled = true;
  savePageBtn.className = 'btn btn-secondary btn-sm';
  savePageBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    ${text}
  `;
  relatedContent.classList.add('hidden');
}

// Handle Folder Hierarchy Sync
async function handleSyncFolders() {
  try {
    const originalText = syncFoldersBtn.innerHTML;
    syncFoldersBtn.disabled = true;
    syncFoldersBtn.innerHTML = 'Syncing...';
    
    const response = await browser.runtime.sendMessage({ action: 'syncFolders' });
    
    if (response && response.success) {
      alert(`Folder hierarchy sync complete! Updated ${response.updatedCount} bookmarks.`);
    } else {
      alert(`Sync failed: ${response?.error || 'Unknown error'}`);
    }
    
    syncFoldersBtn.disabled = false;
    syncFoldersBtn.innerHTML = originalText;
  } catch (error) {
    console.error('Error syncing folders:', error);
    alert('Sync failed. Please try again.');
    syncFoldersBtn.disabled = false;
    syncFoldersBtn.innerHTML = 'Sync Folders';
  }
}
