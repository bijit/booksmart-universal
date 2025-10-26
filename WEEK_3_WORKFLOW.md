# Week 3 - Chrome Extension Workflow

**Goal:** Build minimalist Chrome extension that integrates with native Chrome bookmarking

**Design:** Light theme, search button, recent bookmarks, link to manager

---

## Complete User Workflow

### 1. User Sees Interesting Page

User is browsing the web and finds something they want to save.

### 2. User Clicks Star Button (Native Chrome)

**User Action:** Clicks the star icon in Chrome's address bar (or presses Ctrl+D)

**Chrome's Action:**
- Shows native bookmark dialog
- User confirms (adds to Chrome bookmarks)
- Chrome saves bookmark to browser

### 3. Extension Detects New Bookmark (Automatic)

**Extension Listens:** `chrome.bookmarks.onCreated` event fires

**Extension Service Worker:**
```javascript
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  // New bookmark detected!
  // Send to BookSmart backend
  sendToBookSmart(bookmark.url, bookmark.title);
});
```

### 4. Extension Sends to Backend (Immediate)

**API Call:** `POST /api/bookmarks`

**Request:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title" // from Chrome
}
```

**Backend Response (< 100ms):**
```json
{
  "bookmark": {
    "id": "uuid",
    "url": "https://example.com/article",
    "title": "Article Title",
    "processing_status": "pending",  // ← Not processed yet!
    "created_at": "2025-10-26T10:00:00Z"
  }
}
```

**Extension Updates Badge:** Shows "1" (1 bookmark pending)

### 5. Background Worker Processes (Automatic, ~10 seconds)

**Backend Worker (Already Built!):**
```javascript
// Worker polls every 5 seconds
// Picks up pending bookmark

// Step 1: Jina AI Content Extraction (~4 seconds)
const content = await extractContent(url);

// Step 2: Gemini AI Processing (~4 seconds, parallel)
const { title, description, embedding } = await processContent(content, url);

// Step 3: Store in Qdrant (~0.5 seconds)
const pointId = await storeInQdrant({ embedding, title, description, ... });

// Step 4: Update Supabase
await updateBookmark(id, {
  processing_status: "completed",
  qdrant_point_id: pointId,
  ai_title: title,
  ai_description: description
});
```

**Extension Badge Updates:** "1" → "" (processing complete)

### 6. User Can Search Anytime

**Option A: Extension Popup**
- User clicks extension icon
- Sees recent bookmarks
- Can search with search bar
- Results powered by semantic AI

**Option B: Manager UI**
- User clicks "Open Manager" in popup
- Full web interface opens
- Advanced search, filtering, editing

---

## Extension Components

### 1. Manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "BookSmart",
  "version": "1.0.0",
  "description": "AI-powered bookmark management with semantic search",

  "permissions": [
    "bookmarks",     // Listen to bookmark events
    "storage",       // Store auth token
    "notifications"  // Show save confirmations
  ],

  "host_permissions": [
    "http://localhost:3000/*",  // Dev API
    "https://api.booksmart.app/*"  // Prod API
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 2. Background Service Worker (background.js)

**Responsibilities:**
- Listen to Chrome bookmark events
- Send bookmarks to backend API
- Manage authentication tokens
- Update badge count
- Handle notifications

**Key Functions:**
```javascript
// Listen to new bookmarks
chrome.bookmarks.onCreated.addListener(handleNewBookmark);

// Listen to deleted bookmarks (optional sync)
chrome.bookmarks.onRemoved.addListener(handleDeletedBookmark);

// Send bookmark to backend
async function sendToBookSmart(url, title) {
  const token = await getAuthToken();

  const response = await fetch('http://localhost:3000/api/bookmarks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ url, title })
  });

  if (response.ok) {
    // Success! Update badge
    updateBadge(+1);
    showNotification('Bookmark saved!');
  }
}

// Poll for processing status (optional)
async function checkPendingBookmarks() {
  // GET /api/bookmarks?status=pending
  // Update badge count
}
```

### 3. Popup UI (popup.html + popup.js)

**Design: Minimalist Light Theme**

**Layout:**
```
┌─────────────────────────────────┐
│  🔍 [Search bookmarks...]       │ ← Search bar
├─────────────────────────────────┤
│  Recent Bookmarks               │
│                                 │
│  📄 Article Title               │ ← Recent bookmark 1
│     example.com • 2 mins ago    │
│                                 │
│  📄 Another Article             │ ← Recent bookmark 2
│     site.com • 5 mins ago       │
│                                 │
│  📄 Third Article               │ ← Recent bookmark 3
│     blog.com • 1 hour ago       │
│                                 │
├─────────────────────────────────┤
│  [Open Manager] [Settings]      │ ← Actions
└─────────────────────────────────┘
```

**Dimensions:** 400px wide × 600px tall

**Features:**
- Search bar (instant search as you type)
- 5-10 recent bookmarks
- Click bookmark → opens URL
- "Open Manager" button → opens full web UI
- Badge shows pending count
- Minimal, clean, fast

**Color Scheme (Light):**
- Background: `#FFFFFF`
- Text: `#1F2937` (dark gray)
- Border: `#E5E7EB` (light gray)
- Accent: `#3B82F6` (blue)
- Hover: `#F3F4F6` (very light gray)

### 4. Authentication Flow

**First Time User:**
```
1. User installs extension
2. Clicks extension icon
3. Sees "Login Required" screen
4. Clicks "Login with Email" button
5. Opens new tab: http://localhost:3000/auth/login (manager page)
6. User logs in
7. Manager page sends token to extension via chrome.runtime.sendMessage
8. Extension stores token in chrome.storage.local
9. Extension now authenticated!
```

**Returning User:**
- Token stored in chrome.storage.local
- Extension automatically authenticated
- Token refreshed when expired (using refresh_token)

### 5. Manager UI Integration

**Manager has "Import All Bookmarks" button:**

When clicked:
```javascript
// Get ALL Chrome bookmarks
chrome.bookmarks.getTree((bookmarkTree) => {
  const allUrls = extractAllUrls(bookmarkTree);

  // Batch send to backend
  POST /api/bookmarks/bulk
  {
    "bookmarks": [
      { "url": "https://...", "title": "..." },
      { "url": "https://...", "title": "..." },
      // ... thousands more
    ]
  }
});
```

**Backend creates all as "pending"**, worker processes them one by one.

---

## What We're NOT Building (Simplified)

❌ **Real-time bidirectional sync** - Only Chrome → BookSmart (one-way)
❌ **Chrome bookmark folder structure** - We use tags instead
❌ **Automatic sync of ALL bookmarks on install** - User must click "Import" in manager
❌ **Chrome bookmark modifications** - We don't sync title/tag changes back to Chrome
❌ **Context menu "Save to BookSmart"** - User just uses native star (simpler!)
❌ **Keyboard shortcuts** - Native Ctrl+D works (no need to add another)

---

## API Endpoints We'll Use

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Bookmarks
- `POST /api/bookmarks` - Create single bookmark (extension uses this!)
- `GET /api/bookmarks` - List bookmarks (popup + manager)
- `GET /api/bookmarks?status=pending` - Get pending count (for badge)
- `GET /api/bookmarks/:id` - Get single bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark

### Search
- `POST /api/search` - Semantic/hybrid search (popup + manager)
- `GET /api/search/tags` - Tag-based search

### Future (Week 4)
- `POST /api/bookmarks/bulk` - Bulk import (manager "Import All" button)

---

## Week 3 Implementation Plan

### Session 1: Extension Foundation (2-3 hours)

**Tasks:**
1. Create `extension/` directory structure
2. Create manifest.json (V3)
3. Create basic popup.html (login screen)
4. Create background.js (service worker)
5. Create icons (16px, 48px, 128px)
6. Load extension in Chrome (test it appears)

**Deliverable:** Extension loads in Chrome, icon appears in toolbar

### Session 2: Authentication (2-3 hours)

**Tasks:**
1. Create login UI in popup
2. Implement login flow (open manager in new tab)
3. Receive token from manager page
4. Store token in chrome.storage.local
5. Add token refresh logic
6. Add logout button

**Deliverable:** User can login and stay authenticated

### Session 3: Bookmark Listening (2-3 hours)

**Tasks:**
1. Add bookmark permission to manifest
2. Listen to `chrome.bookmarks.onCreated`
3. Send new bookmarks to backend API
4. Handle API errors (retry logic)
5. Show notification on success
6. Update badge with pending count

**Deliverable:** Creating Chrome bookmark automatically sends to BookSmart

### Session 4: Popup UI (2-3 hours)

**Tasks:**
1. Design popup HTML/CSS (minimalist light theme)
2. Fetch recent bookmarks from API
3. Display 5-10 recent bookmarks
4. Add search bar (instant search)
5. Add "Open Manager" button
6. Handle loading states

**Deliverable:** Beautiful, functional popup showing recent bookmarks

### Session 5: Polish & Testing (1-2 hours)

**Tasks:**
1. Test on 20+ different websites
2. Handle edge cases (long URLs, special characters)
3. Optimize performance (lazy loading, caching)
4. Add error handling (API down, network issues)
5. Package extension for production

**Deliverable:** Production-ready Chrome extension

---

## Technical Details

### Chrome Bookmark Event Structure

```javascript
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('New bookmark created:', bookmark);
  // {
  //   id: "1234",
  //   title: "Example Page",
  //   url: "https://example.com",
  //   dateAdded: 1635789012345
  // }
});
```

### Storage Structure (chrome.storage.local)

```javascript
{
  "auth_token": "jwt_access_token",
  "refresh_token": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token_expires_at": 1635789012345
}
```

### Badge Update Logic

```javascript
async function updateBadgeCount() {
  // Fetch pending bookmarks count
  const response = await fetch('/api/bookmarks?status=pending', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const { total } = await response.json();

  if (total > 0) {
    chrome.action.setBadgeText({ text: String(total) });
    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Update badge every 30 seconds
setInterval(updateBadgeCount, 30000);
```

---

## Success Criteria

By end of Week 3, we should have:

✅ **Extension installed in Chrome**
✅ **User can login via manager page**
✅ **Clicking star (Ctrl+D) automatically saves to BookSmart**
✅ **Popup shows recent bookmarks**
✅ **Search bar works (semantic search)**
✅ **Badge shows pending count**
✅ **"Open Manager" button works**
✅ **Extension handles errors gracefully**

---

## User Experience Flow (Complete)

```
Day 1: Install Extension
│
├─> Click extension icon
├─> See "Login Required"
├─> Click "Login" → Opens manager page
├─> Login with email/password
├─> Manager sends token to extension
└─> Extension authenticated ✅

Day 1+: Using BookSmart
│
├─> Browse web normally
├─> See interesting article
├─> Click star in address bar (Ctrl+D)
│   └─> Chrome saves bookmark
│   └─> Extension detects new bookmark
│   └─> Extension sends to BookSmart API
│   └─> Backend saves as "pending" (instant!)
│   └─> Badge shows "1"
│
├─> 10 seconds later...
│   └─> Background worker processes bookmark
│   └─> Jina extracts content
│   └─> Gemini creates summary + tags
│   └─> Qdrant stores with vector
│   └─> Status → "completed"
│   └─> Badge clears
│
├─> Later: Want to find that article
├─> Click extension icon
├─> Type "machine learning" in search
│   └─> Semantic search finds relevant bookmarks
│   └─> Even if they don't contain exact words!
│
└─> Click bookmark → Opens in new tab ✅
```

---

## Key Advantages of This Approach

1. **Zero Friction** - User uses native Chrome bookmark button they already know
2. **No Learning Curve** - Star button is familiar, no new behavior to learn
3. **Fast** - Bookmark saved instantly (< 100ms)
4. **Reliable** - Background processing with retry logic
5. **Smart** - AI processes everything automatically
6. **Minimal UI** - Popup is clean, fast, focused
7. **Optional Import** - User decides when to import existing bookmarks

---

## Files to Create

```
extension/
├── manifest.json                 # Extension configuration
├── background.js                 # Service worker (bookmark listener)
├── popup/
│   ├── popup.html               # Popup UI
│   ├── popup.css                # Minimalist light theme
│   └── popup.js                 # Popup logic
├── auth/
│   ├── login.html               # Login screen
│   └── login.js                 # Auth logic
├── icons/
│   ├── icon16.png               # Toolbar icon (16×16)
│   ├── icon48.png               # Extension manager (48×48)
│   └── icon128.png              # Chrome Web Store (128×128)
└── utils/
    ├── api.js                   # API client (fetch wrapper)
    ├── storage.js               # Chrome storage helpers
    └── notifications.js         # Notification helpers
```

---

## Next Steps

Ready to start Week 3 Session 1:

1. Create `extension/` directory structure
2. Write manifest.json
3. Create basic popup.html
4. Create background.js skeleton
5. Generate extension icons
6. Load extension in Chrome and test

Let me know when you're ready to begin! 🚀
