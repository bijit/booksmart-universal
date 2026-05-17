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

let allRecentBookmarks = []; // Cache for instant local search

const aiOverviewSection = document.getElementById('aiOverviewSection');
const aiAnswer = document.getElementById('aiAnswer');
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
const localAiHelp = document.getElementById('localAiHelp');
const localAiHelpToggle = document.getElementById('localAiHelpToggle');
const localAiHelpContent = document.getElementById('localAiHelpContent');
const tagFilterContainer = document.getElementById('tagFilterContainer');
const tagFilterList = document.getElementById('tagFilterList');
const importConfirmModal = document.getElementById('importConfirmModal');
const importDeleteBtn = document.getElementById('importDeleteBtn');
const importAddBtn = document.getElementById('importAddBtn');
const importCancelBtn = document.getElementById('importCancelBtn');
const closeImportModal = document.getElementById('closeImportModal');
const importModalText = document.getElementById('importModalText');

let selectedFilterTags = [];

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

  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterScreen();
  });

  backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginScreen();
  });

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    if (value) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
      deepSearchIndicator.classList.add('hidden');
    }

    // 1. Instant Local Search
    handleLocalSearch(value);

    // 2. Debounced Deep Search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleDeepSearch(value);
    }, 600);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    selectedFilterTags = [];
    renderTagFilterRow([]); // Reset pills
    loadRecentBookmarks();
  });

  openManagerBtn.addEventListener('click', () => openManager());
  importBtn.addEventListener('click', handleImport);
  if (importFromEmptyBtn) {
    importFromEmptyBtn.addEventListener('click', handleImport);
  }

  syncFoldersBtn.addEventListener('click', handleSyncFolders);
  logoutBtn.addEventListener('click', handleLogout);
  savePageBtn.addEventListener('click', handleSaveCurrentPage);

  localAiHelpToggle.addEventListener('click', () => {
    const isOpen = !localAiHelpContent.classList.contains('hidden');
    localAiHelpContent.classList.toggle('hidden', isOpen);
    localAiHelpToggle.classList.toggle('open', !isOpen);
  });
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
  aiOverviewSection.classList.add('hidden');
  currentPageSection.classList.remove('hidden');

  try {
    const params = { limit: 100, status: 'completed' };
    if (selectedFilterTags.length > 0) {
      params.tags = selectedFilterTags;
    }
    
    const data = await bookmarks.list(params);
    allRecentBookmarks = data.bookmarks || [];
    displayBookmarks(allRecentBookmarks);
    
    // Update tag filter row if not currently filtering (to show available tags)
    if (selectedFilterTags.length === 0) {
      renderTagFilterRow(data.bookmarks || []);
    } else {
      renderTagFilterRow(); // Just re-render active states
    }
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
    const options = { query: trimmedQuery };
    if (selectedFilterTags.length > 0) {
      options.tags = selectedFilterTags;
    }
    
    const data = await search.query(options);

    // Handle AI Answer
    if (data.answer) {
      aiAnswer.innerHTML = data.answer.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      aiOverviewSection.classList.remove('hidden');
    } else {
      aiOverviewSection.classList.add('hidden');
    }

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

// Tag Filtering UI
let availableTags = [];

function renderTagFilterRow(bookmarks = null) {
  if (bookmarks) {
    // Extract top tags from bookmarks
    const counts = {};
    bookmarks.forEach(b => {
      b.tags?.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    availableTags = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(entry => entry[0]);
  }

  if (availableTags.length === 0 && selectedFilterTags.length === 0) {
    tagFilterContainer.classList.add('hidden');
    return;
  }

  tagFilterContainer.classList.remove('hidden');
  tagFilterList.innerHTML = '';

  // Combine available and selected (ensure selected are always visible)
  const tagsToShow = [...new Set([...selectedFilterTags, ...availableTags])];

  tagsToShow.forEach(tag => {
    const pill = document.createElement('div');
    pill.className = `tag-pill ${selectedFilterTags.includes(tag) ? 'active' : ''}`;
    pill.textContent = tag;
    pill.addEventListener('click', () => toggleFilterTag(tag));
    tagFilterList.appendChild(pill);
  });
}

function toggleFilterTag(tag) {
  if (selectedFilterTags.includes(tag)) {
    selectedFilterTags = selectedFilterTags.filter(t => t !== tag);
  } else {
    selectedFilterTags.push(tag);
  }
  
  renderTagFilterRow();
  
  if (searchInput.value.trim()) {
    handleSearch(searchInput.value);
  } else {
    loadRecentBookmarks();
  }
}

// UI Rendering
function displayBookmarks(bookmarks, isSearch = false) {
  hideLoading();
  if (bookmarks.length === 0) {
    showEmpty();
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
function showEmpty() {
  emptyState.classList.remove('hidden');
  bookmarksList.classList.add('hidden');
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
           newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
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
      
      newDeleteBtn.addEventListener('click', () => executeImport(true));
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

async function initializeCurrentPageContext() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      currentPageSection.classList.add('hidden');
      return;
    }

    currentTabData = tab;
    currentPageTitle.value = tab.title;
    currentPageUrl.textContent = new URL(tab.url).hostname;
    currentPageFavicon.src = `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`;

    // Check if already bookmarked
    const data = await bookmarks.list({ url: tab.url });
    const isBookmarked = data.bookmarks && data.bookmarks.length > 0;

    if (isBookmarked) {
      updateSaveBtnToSaved();
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
    // 1. Try Local AI (Gemini Nano) first
    const localTags = await tryLocalAiAnalysis(tab);
    if (localTags && localTags.length > 0) {
      displayDiscoveryTags(localTags, 'Local AI');
      return;
    }

    // 2. Fallback to Cloud AI
    console.log('Local AI not available, falling back to Cloud...');
    localAiHelp.classList.remove('hidden');

    const data = await bookmarks.analyze({ title: tab.title });
    if (data.tags && data.tags.length > 0) {
      displayDiscoveryTags(data.tags, 'Cloud AI');
    }
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

async function tryLocalAiAnalysis(tab) {
  try {
    // Check if the experimental prompt API exists
    if (!window.ai || !window.ai.languageModel) return null;

    const capabilities = await window.ai.languageModel.capabilities();
    if (capabilities.available === 'no') return null;

    const session = await window.ai.languageModel.create();
    const prompt = `Suggest 3 unique tags for this webpage title: "${tab.title}". Return only the tags separated by commas.`;

    const response = await session.prompt(prompt);
    session.destroy();

    return response.split(',').map(t => t.trim()).filter(t => t.length > 0);
  } catch (e) {
    console.log('Local AI check failed:', e);
    return null;
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
    await bookmarks.create({
      url: currentTabData.url,
      title: currentPageTitle.value.trim() || currentTabData.title,
      tags: allTags
    });

    updateSaveBtnToSaved();
    // Refresh the list to show the new bookmark
    loadRecentBookmarks();
  } catch (error) {
    console.error('Error saving bookmark:', error);
    savePageBtn.disabled = false;
    savePageBtn.textContent = 'Retry Save';
  }
}

function updateSaveBtnToSaved() {
  savePageBtn.disabled = true;
  savePageBtn.className = 'btn btn-secondary btn-sm';
  savePageBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    Saved to Library
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
