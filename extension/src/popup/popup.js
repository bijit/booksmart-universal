// BookSmart Popup Script
// This script handles the popup UI logic

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
const logoutBtn = document.getElementById('logoutBtn');

// API Configuration is now loaded from config.js
// API_BASE_URL is available globally

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('BookSmart popup loaded');

  // Check authentication status
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    showMainScreen();
    loadRecentBookmarks();
  } else {
    showLoginScreen();
  }

  // Set up event listeners
  setupEventListeners();
});

// Check if user is authenticated
async function checkAuth() {
  try {
    const authData = await chrome.storage.local.get(['auth_token', 'user']);
    return !!(authData.auth_token && authData.user);
  } catch (error) {
    console.error('Error checking auth:', error);
    return false;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Login form submission
  loginForm.addEventListener('submit', handleLogin);

  // Register form submission
  registerForm.addEventListener('submit', handleRegister);

  // Register link - show register screen
  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterScreen();
  });

  // Back to login link
  backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginScreen();
  });

  // Search input
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    // Show/hide clear button
    if (value) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch(value);
    }, 300); // Debounce 300ms
  });

  // Clear search button
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    loadRecentBookmarks(); // Reload all bookmarks
  });

  // Open Manager button
  openManagerBtn.addEventListener('click', () => {
    openManager();
  });

  // Import buttons
  importBtn.addEventListener('click', handleImport);
  importFromEmptyBtn.addEventListener('click', handleImport);

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Hide any previous errors
  loginError.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store auth data
      await chrome.storage.local.set({
        auth_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
        token_expires_at: data.session.expires_at
      });

      // Show main screen
      showMainScreen();
      loadRecentBookmarks();
    } else {
      // Show error
      showError(data.error || 'Login failed. Please try again.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please check your connection.');
  }
}

// Handle register form submission
async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  // Auto-generate name from email (e.g., "john@example.com" -> "john")
  const name = email.split('@')[0];

  // Hide any previous errors
  registerError.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Auto-login after successful registration
      await chrome.storage.local.set({
        auth_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
        token_expires_at: data.session.expires_at
      });

      // Show main screen
      showMainScreen();
      loadRecentBookmarks();
    } else {
      // Show error
      showRegisterError(data.message || 'Registration failed. Please try again.');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showRegisterError('Network error. Please check your connection.');
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Clear auth data
    await chrome.storage.local.remove(['auth_token', 'refresh_token', 'user', 'token_expires_at']);

    // Show login screen
    showLoginScreen();

    // Clear bookmarks list
    bookmarksList.innerHTML = '';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Load recent bookmarks
async function loadRecentBookmarks() {
  showLoading();

  try {
    const authData = await chrome.storage.local.get(['auth_token']);

    // Only fetch completed bookmarks (hide pending/failed/processing)
    const response = await fetch(`${API_BASE_URL}/bookmarks?limit=10&status=completed`, {
      headers: {
        'Authorization': `Bearer ${authData.auth_token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      displayBookmarks(data.bookmarks || []);
    } else {
      showError('Failed to load bookmarks');
    }
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showError('Network error');
  }
}

// Handle search
async function handleSearch(query) {
  if (!query.trim()) {
    // If search is empty, show recent bookmarks
    loadRecentBookmarks();
    return;
  }

  showLoading();

  try {
    const authData = await chrome.storage.local.get(['auth_token']);

    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.auth_token}`
      },
      body: JSON.stringify({
        query,
        limit: 10,
        searchType: 'hybrid'
      })
    });

    if (response.ok) {
      const data = await response.json();
      displayBookmarks(data.results || []);
    } else {
      showError('Search failed');
    }
  } catch (error) {
    console.error('Search error:', error);
    showError('Network error');
  }
}

// Display bookmarks in the list
function displayBookmarks(bookmarks) {
  hideLoading();

  if (bookmarks.length === 0) {
    showEmpty();
    return;
  }

  hideEmpty();

  bookmarksList.innerHTML = '';

  bookmarks.forEach(bookmark => {
    const card = createBookmarkCard(bookmark);
    bookmarksList.appendChild(card);
  });
}

// Create bookmark card element
function createBookmarkCard(bookmark) {
  const card = document.createElement('div');
  card.className = 'bookmark-card';
  card.dataset.id = bookmark.id;

  // Extract domain from URL
  let domain = '';
  try {
    domain = new URL(bookmark.url).hostname.replace('www.', '');
  } catch (e) {
    domain = bookmark.url;
  }

  // Format timestamp
  const timeAgo = getTimeAgo(bookmark.created_at);

  // Determine status
  const status = bookmark.processing_status || 'completed';
  const statusText = status === 'pending' ? 'Processing...' : '';

  // Format tags (show up to 5 tags)
  const tags = bookmark.tags && bookmark.tags.length > 0 ?
    bookmark.tags.slice(0, 5).map(tag =>
      `<span class="bookmark-tag">${escapeHtml(tag)}</span>`
    ).join('') : '';

  card.innerHTML = `
    <div class="bookmark-favicon">
      <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32"
           alt=""
           onerror="this.style.display='none'">
    </div>
    <div class="bookmark-content">
      <div class="bookmark-title">${escapeHtml(bookmark.title || bookmark.url)}</div>
      <div class="bookmark-url">${domain}</div>
      ${tags ? `<div class="bookmark-tags">${tags}</div>` : ''}
      <div class="bookmark-meta">
        <span class="bookmark-time">${timeAgo}</span>
        ${statusText ? `<span class="bookmark-status ${status}">${statusText}</span>` : ''}
      </div>
    </div>
  `;

  // Click to open bookmark
  card.addEventListener('click', () => {
    chrome.tabs.create({ url: bookmark.url });
  });

  return card;
}

// Helper: Get time ago string
function getTimeAgo(timestamp) {
  const now = Date.now();
  const created = new Date(timestamp).getTime();
  const diff = now - created;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open manager page with auto-login
async function openManager(path = '') {
  // Get the auth token from storage
  const result = await chrome.storage.local.get(['auth_token']);
  const token = result.auth_token;

  // Pass token as URL parameter for seamless login
  const url = token
    ? `https://booksmart-backend-production-fe49.up.railway.app${path}?token=${encodeURIComponent(token)}`
    : `https://booksmart-backend-production-fe49.up.railway.app${path}`;

  chrome.tabs.create({ url });
}

// UI State Management
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  registerScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
  // Clear any errors
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
}

function showRegisterScreen() {
  loginScreen.classList.add('hidden');
  registerScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
  // Clear any errors
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
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

// Import functionality
async function handleImport() {
  try {
    // Get all Chrome bookmarks
    const bookmarksTree = await chrome.bookmarks.getTree();

    // Flatten the bookmark tree into a list of URLs
    const bookmarks = flattenBookmarks(bookmarksTree);

    if (bookmarks.length === 0) {
      alert('No bookmarks found to import');
      return;
    }

    // Confirm with user
    const confirmed = confirm(`Import ${bookmarks.length} Chrome bookmarks to BookSmart?\n\nThis may take several minutes. You can close this popup and the import will continue in the background.`);

    if (!confirmed) {
      return;
    }

    // Show import progress
    showImportProgress();

    // Send bookmarks to backend in batches
    await importBookmarksBatch(bookmarks);

  } catch (error) {
    console.error('Import error:', error);
    alert('Failed to import bookmarks: ' + error.message);
    hideImportProgress();
  }
}

// Flatten Chrome bookmarks tree into array
function flattenBookmarks(nodes) {
  const bookmarks = [];

  function traverse(node) {
    if (node.url) {
      // This is a bookmark (has URL)
      bookmarks.push({
        url: node.url,
        title: node.title
      });
    }

    // Recursively traverse children
    if (node.children) {
      node.children.forEach(child => traverse(child));
    }
  }

  nodes.forEach(node => traverse(node));
  return bookmarks;
}

// Import bookmarks in batches
async function importBookmarksBatch(bookmarks) {
  try {
    const authData = await chrome.storage.local.get(['auth_token']);

    // Send all bookmarks in one batch to the backend
    // Backend will create them as "pending" and worker will process
    const response = await fetch(`${API_BASE_URL}/import/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.auth_token}`
      },
      body: JSON.stringify({
        bookmarks
      })
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.statusText}`);
    }

    const data = await response.json();
    const jobId = data.jobId;

    // Poll for progress
    await pollImportProgress(jobId, bookmarks.length);

  } catch (error) {
    console.error('Batch import error:', error);
    throw error;
  }
}

// Poll import progress
async function pollImportProgress(jobId, totalBookmarks) {
  const authData = await chrome.storage.local.get(['auth_token']);
  const pollInterval = 2000; // Poll every 2 seconds

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/import/${jobId}/status`, {
          headers: {
            'Authorization': `Bearer ${authData.auth_token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to get import status');
        }

        const status = await response.json();

        // Update progress UI
        updateImportProgress(status.processedBookmarks, totalBookmarks, status.progress);

        // Check if complete
        if (status.status === 'completed') {
          clearInterval(interval);
          hideImportProgress();

          // Show success message
          alert(`Import complete!\n\n${status.successfulBookmarks} bookmarks imported successfully.\n${status.failedBookmarks} failed.\n\nBookmarks are now being processed by AI. Check back in a few minutes.`);

          // Reload bookmarks
          loadRecentBookmarks();

          resolve();
        }
      } catch (error) {
        clearInterval(interval);
        hideImportProgress();
        reject(error);
      }
    }, pollInterval);
  });
}

// Show import progress UI
function showImportProgress() {
  bookmarksList.classList.add('hidden');
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  importProgressState.classList.remove('hidden');
}

// Hide import progress UI
function hideImportProgress() {
  importProgressState.classList.add('hidden');
  bookmarksList.classList.remove('hidden');
}

// Update import progress
function updateImportProgress(processed, total, percentage) {
  const progressText = document.getElementById('importProgressText');
  const progressFill = document.getElementById('importProgressFill');
  const progressDetails = document.getElementById('importProgressDetails');

  progressText.textContent = 'Importing bookmarks...';
  progressFill.style.width = `${percentage}%`;
  progressDetails.textContent = `${processed} / ${total} (${percentage}%)`;
}
