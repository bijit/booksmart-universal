# Week 3 Implementation Plan - Chrome Extension

**Status:** Ready to Start
**Estimated Time:** 9-13 hours (5 sessions × 2-3 hours each)
**Goal:** Build minimalist Chrome extension with native bookmark integration

---

## Session 1: Extension Foundation (2-3 hours)

### Objectives
- Set up extension directory structure
- Create Manifest V3 configuration
- Build basic popup interface
- Implement service worker skeleton
- Test extension loads in Chrome

### Tasks

#### 1.1 Create Directory Structure
```bash
cd /home/kniyogi/projects/booksmart_v1.0
mkdir -p extension/src/{background,popup,auth,utils,icons}
mkdir -p extension/public
```

#### 1.2 Create manifest.json
**File:** `extension/public/manifest.json`

**Content:**
- Manifest V3 configuration
- Permissions: bookmarks, storage, notifications
- Background service worker
- Action (popup)
- Icons (16, 48, 128)
- Host permissions for API

#### 1.3 Create Package.json
**File:** `extension/package.json`

**Content:**
- Project metadata
- Build scripts
- Dependencies: none (vanilla JS for speed)

#### 1.4 Create Background Service Worker
**File:** `extension/src/background/background.js`

**Content:**
- Extension lifecycle events
- Chrome bookmarks listener (skeleton)
- API client (skeleton)
- Badge management (skeleton)

#### 1.5 Create Basic Popup
**File:** `extension/src/popup/popup.html`

**Content:**
- Login screen (initial state)
- Search bar (hidden until logged in)
- Recent bookmarks container (hidden)
- "Open Manager" button
- Clean, minimal HTML structure

**File:** `extension/src/popup/popup.css`

**Content:**
- Light theme colors
- Minimalist design
- 400px × 600px dimensions
- Flexbox layout
- Smooth transitions

**File:** `extension/src/popup/popup.js`

**Content:**
- Check auth status on load
- Show login or bookmarks view
- Event listeners (skeleton)

#### 1.6 Create Extension Icons
**Files:**
- `extension/src/icons/icon16.png`
- `extension/src/icons/icon48.png`
- `extension/src/icons/icon128.png`

**Design:**
- Simple bookmark icon
- Light blue color (#3B82F6)
- Professional, clean look

#### 1.7 Create Build Script
**File:** `extension/build.sh`

**Content:**
- Copy files to `extension/dist/`
- Prepare for loading in Chrome

#### 1.8 Load Extension in Chrome
- Go to `chrome://extensions/`
- Enable Developer Mode
- Click "Load unpacked"
- Select `extension/dist/` folder
- Verify icon appears in toolbar
- Click icon, verify popup opens

### Deliverables
✅ Extension directory structure created
✅ manifest.json configured
✅ Basic popup UI (login screen)
✅ Background service worker skeleton
✅ Extension loads in Chrome
✅ Icon visible in toolbar

### Testing
- [ ] Extension loads without errors
- [ ] Popup opens when clicking icon
- [ ] No console errors in service worker
- [ ] Icon displays correctly

---

## Session 2: Authentication (2-3 hours)

### Objectives
- Implement login flow
- Store auth tokens securely
- Handle token refresh
- Implement logout
- Show authenticated state in popup

### Tasks

#### 2.1 Create Auth Utilities
**File:** `extension/src/utils/storage.js`

**Functions:**
- `saveAuthData(token, refreshToken, user)` - Store in chrome.storage.local
- `getAuthData()` - Retrieve auth data
- `clearAuthData()` - Remove auth data (logout)
- `isAuthenticated()` - Check if user logged in

**File:** `extension/src/utils/api.js`

**Functions:**
- `apiClient(endpoint, options)` - Fetch wrapper with auth
- `login(email, password)` - Call POST /api/auth/login
- `refreshToken()` - Call POST /api/auth/refresh
- `getCurrentUser()` - Call GET /api/auth/me

#### 2.2 Create Login Screen
**File:** `extension/src/auth/login.html`

**Content:**
- Simple login form (email + password)
- "Register" link (opens manager)
- "Login" button
- Error message display

**File:** `extension/src/auth/login.js`

**Content:**
- Form submission handler
- Call backend API
- Store tokens
- Redirect to popup main view
- Show errors

#### 2.3 Update Popup for Auth
**File:** `extension/src/popup/popup.js`

**Updates:**
- Check auth status on load
- If not authenticated → show login screen
- If authenticated → show bookmarks view
- Add logout button
- Handle token expiration

#### 2.4 Implement Token Refresh
**File:** `extension/src/background/background.js`

**Add:**
- Check token expiration on extension start
- Auto-refresh if token expires in < 1 hour
- Update stored token
- Emit event to popup (if open)

#### 2.5 Test Authentication Flow

**Test Cases:**
1. Open extension → See login screen
2. Enter valid credentials → Login succeeds → See bookmarks view
3. Close extension → Reopen → Still logged in
4. Logout → Login screen appears
5. Invalid credentials → Error message shows
6. Token expiration → Auto-refresh works

### Deliverables
✅ Login/logout functionality
✅ Secure token storage
✅ Auto token refresh
✅ Authenticated popup state
✅ Error handling

### Testing
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error
- [ ] Token persists across extension reloads
- [ ] Token auto-refreshes before expiration
- [ ] Logout clears all auth data
- [ ] Popup shows correct state (logged in/out)

---

## Session 3: Bookmark Listening (2-3 hours)

### Objectives
- Listen to Chrome bookmark events
- Send new bookmarks to backend
- Handle API errors with retry
- Update badge count
- Show notifications

### Tasks

#### 3.1 Add Bookmark Listener
**File:** `extension/src/background/background.js`

**Add:**
```javascript
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  await handleNewBookmark(bookmark);
});
```

#### 3.2 Implement handleNewBookmark
**Function:** `handleNewBookmark(bookmark)`

**Logic:**
1. Check if authenticated (get token)
2. If not authenticated → ignore (user must login first)
3. Extract URL and title from bookmark object
4. Call API: POST /api/bookmarks { url, title }
5. If success → show notification, update badge
6. If error → retry (max 3 times), show error notification

#### 3.3 Implement API Client for Bookmarks
**File:** `extension/src/utils/api.js`

**Add Functions:**
- `createBookmark(url, title)` - POST /api/bookmarks
- `getBookmarks(params)` - GET /api/bookmarks
- `searchBookmarks(query)` - POST /api/search
- `getPendingCount()` - GET /api/bookmarks?status=pending&limit=0

#### 3.4 Implement Badge Management
**File:** `extension/src/utils/badge.js`

**Functions:**
- `updateBadgeCount()` - Fetch pending count, update badge
- `incrementBadge()` - +1 to current badge
- `clearBadge()` - Remove badge text

**Background Task:**
- Poll every 30 seconds to update badge count
- Update after creating new bookmark

#### 3.5 Implement Notifications
**File:** `extension/src/utils/notifications.js`

**Functions:**
- `showSuccess(message)` - Show success notification
- `showError(message)` - Show error notification

**Notifications:**
- "Bookmark saved!" - When bookmark sent successfully
- "Bookmark failed to save" - When API call fails
- "Processing..." - Optional: when bookmark is processing

#### 3.6 Implement Retry Logic
**File:** `extension/src/utils/retry.js`

**Function:** `retryWithBackoff(fn, maxRetries = 3)`

**Logic:**
- Attempt 1: immediate
- Attempt 2: wait 2 seconds
- Attempt 3: wait 5 seconds
- If all fail → throw error

#### 3.7 Test Bookmark Capture

**Test Cases:**
1. User not logged in → bookmark not sent
2. User logged in → click star → bookmark sent
3. API succeeds → notification shown, badge updates
4. API fails → retry logic kicks in
5. Network offline → graceful error
6. Create 5 bookmarks → badge shows "5"

### Deliverables
✅ Chrome bookmark listener working
✅ New bookmarks sent to backend
✅ Retry logic for failures
✅ Badge shows pending count
✅ Success/error notifications
✅ Handles edge cases

### Testing
- [ ] Creating Chrome bookmark triggers API call
- [ ] API call includes correct URL and title
- [ ] Success shows notification
- [ ] Badge count updates correctly
- [ ] Retry logic works on API failure
- [ ] Works with authentication
- [ ] Handles network errors gracefully

---

## Session 4: Popup UI (2-3 hours)

### Objectives
- Design beautiful minimalist popup
- Display recent bookmarks
- Implement search functionality
- Add "Open Manager" button
- Handle loading states

### Tasks

#### 4.1 Design Popup Layout
**File:** `extension/src/popup/popup.html`

**Structure:**
```html
<div class="container">
  <!-- Header -->
  <div class="header">
    <input type="text" id="searchInput" placeholder="🔍 Search bookmarks..." />
  </div>

  <!-- Recent Bookmarks -->
  <div class="bookmarks-list" id="bookmarksList">
    <!-- Bookmark items loaded via JS -->
  </div>

  <!-- Footer -->
  <div class="footer">
    <button id="openManagerBtn">Open Manager</button>
    <button id="settingsBtn">Settings</button>
  </div>

  <!-- Loading State -->
  <div class="loading" id="loading">Loading...</div>

  <!-- Empty State -->
  <div class="empty" id="empty">No bookmarks yet. Click the star to save!</div>
</div>
```

#### 4.2 Style Popup (Light Theme)
**File:** `extension/src/popup/popup.css`

**Design System:**
- **Background:** #FFFFFF (white)
- **Text:** #1F2937 (dark gray)
- **Border:** #E5E7EB (light gray)
- **Accent:** #3B82F6 (blue)
- **Hover:** #F3F4F6 (very light gray)

**Components:**
- Search bar: Rounded, clean, focus state
- Bookmark cards: Minimal, hover effect, click to open
- Buttons: Flat design, hover animations
- Loading: Subtle spinner
- Scrollbar: Custom, minimal

#### 4.3 Implement Bookmark Display
**File:** `extension/src/popup/popup.js`

**Function:** `loadRecentBookmarks()`

**Logic:**
1. Fetch recent bookmarks: GET /api/bookmarks?limit=10&sort=created_at:desc
2. Render bookmark cards
3. Add click handlers (open URL in new tab)
4. Show loading state while fetching
5. Show empty state if no bookmarks

**Bookmark Card HTML:**
```html
<div class="bookmark-card" data-id="uuid">
  <div class="bookmark-favicon">
    <img src="favicon_url" alt="">
  </div>
  <div class="bookmark-content">
    <div class="bookmark-title">Article Title</div>
    <div class="bookmark-url">example.com</div>
    <div class="bookmark-meta">
      <span class="bookmark-time">2 mins ago</span>
      <span class="bookmark-status pending">Processing...</span>
    </div>
  </div>
</div>
```

#### 4.4 Implement Search
**File:** `extension/src/popup/popup.js`

**Function:** `handleSearch(query)`

**Logic:**
1. User types in search input
2. Debounce (300ms delay)
3. If query empty → show recent bookmarks
4. If query present → call API: POST /api/search
5. Render search results
6. Highlight matching text

#### 4.5 Implement "Open Manager" Button
**File:** `extension/src/popup/popup.js`

**Function:** `openManager()`

**Logic:**
```javascript
chrome.tabs.create({ url: 'http://localhost:5173' });
```

Opens manager page in new tab.

#### 4.6 Add Settings Button (Optional)
**Function:** `openSettings()`

**Logic:**
- Opens settings page (simple HTML page)
- Shows: Email, logout button, API endpoint

#### 4.7 Handle Edge Cases
- **No internet:** Show cached bookmarks, "Offline" message
- **API error:** Show error message, retry button
- **No bookmarks:** Show empty state with helpful text
- **Processing status:** Show "Processing..." for pending bookmarks

#### 4.8 Polish UI
- Smooth animations (fade in/out, slide)
- Loading skeletons (while fetching)
- Hover states (cards, buttons)
- Focus states (search input)
- Responsive design (if needed)

#### 4.9 Test Popup Functionality

**Test Cases:**
1. Open popup → See recent bookmarks (10 max)
2. Click bookmark → Opens URL in new tab
3. Search "javascript" → See filtered results
4. Search returns 0 results → Show empty state
5. Click "Open Manager" → Manager opens
6. Logout button → Clears auth, shows login
7. Loading states appear correctly
8. Empty state shows when no bookmarks

### Deliverables
✅ Beautiful minimalist popup UI
✅ Recent bookmarks display
✅ Search functionality
✅ "Open Manager" button
✅ Loading and empty states
✅ Smooth animations
✅ Responsive to user actions

### Testing
- [ ] Popup opens with recent bookmarks
- [ ] Search works (instant results)
- [ ] Click bookmark opens URL
- [ ] "Open Manager" opens manager page
- [ ] Loading states work correctly
- [ ] Empty states show when appropriate
- [ ] UI is responsive and smooth
- [ ] No console errors

---

## Session 5: Polish & Testing (1-2 hours)

### Objectives
- Test on multiple websites
- Handle edge cases
- Optimize performance
- Fix bugs
- Package for production

### Tasks

#### 5.1 Comprehensive Testing

**Test on 20+ Different Websites:**
- Wikipedia
- GitHub
- YouTube
- Medium
- Reddit
- Stack Overflow
- News sites (CNN, BBC)
- Blogs (personal blogs)
- Social media (Twitter, LinkedIn)
- E-commerce (Amazon)
- Documentation sites (MDN, React docs)

**Test Scenarios:**
1. Bookmark each site using star button
2. Verify API call succeeds
3. Check bookmark appears in popup
4. Search for bookmark
5. Delete bookmark
6. Check badge count accuracy

#### 5.2 Edge Case Handling

**Test Edge Cases:**
1. **Very long URLs** (> 2000 chars) - Truncate or handle gracefully
2. **Special characters in URLs** - Encode properly
3. **URLs without title** - Use URL as fallback
4. **Duplicate bookmarks** - Show error or ignore
5. **Offline mode** - Show cached bookmarks, queue API calls
6. **API rate limiting** - Handle 429 errors, show message
7. **Token expiration mid-session** - Auto-refresh and retry
8. **Network errors** - Retry, show error message
9. **Invalid URLs** - Validate before sending
10. **Chrome bookmarks deleted** - Optionally sync delete

#### 5.3 Performance Optimization

**Optimize:**
1. **Lazy load images** - Defer favicon loading
2. **Cache bookmarks** - Store in chrome.storage.local (5-minute cache)
3. **Debounce search** - 300ms delay
4. **Minimize API calls** - Batch requests where possible
5. **Compress icons** - Optimize PNG sizes
6. **Minify code** - Remove comments, whitespace (production)

#### 5.4 Error Handling

**Add Error Boundaries:**
1. API errors → Show user-friendly message
2. Network errors → Show "Check connection" message
3. Auth errors → Redirect to login
4. Unexpected errors → Log to console, show generic message

**Implement:**
- Try-catch blocks around all async functions
- Fallbacks for missing data
- User-friendly error messages
- Retry buttons where appropriate

#### 5.5 Bug Fixes

**Common Bugs to Check:**
1. Badge count not updating
2. Popup not showing bookmarks after login
3. Search not working for certain queries
4. Token not refreshing properly
5. Notifications not appearing
6. Manager button not opening page
7. Logout not clearing data

#### 5.6 Code Cleanup

**Clean Up:**
1. Remove console.log statements
2. Add JSDoc comments
3. Remove unused code
4. Organize imports
5. Format code consistently
6. Add error handling

#### 5.7 Create Production Build

**Build Script:**
```bash
#!/bin/bash
# build.sh

# Clean dist folder
rm -rf dist/
mkdir -p dist/

# Copy files
cp -r src/* dist/
cp public/manifest.json dist/

# Copy icons
cp -r src/icons dist/

# Create ZIP for Chrome Web Store
cd dist/
zip -r ../booksmart-extension.zip *
cd ..

echo "Build complete! Extension ready at dist/"
echo "ZIP file ready: booksmart-extension.zip"
```

#### 5.8 Final Testing Checklist

**Complete User Flow:**
- [ ] Install extension from scratch
- [ ] Login with new account
- [ ] Save 10+ bookmarks from different sites
- [ ] Search for bookmarks (semantic search)
- [ ] Click bookmarks to open
- [ ] Check badge count accuracy
- [ ] Open manager page
- [ ] Logout
- [ ] Login again (verify persistence)
- [ ] Delete bookmarks
- [ ] Verify all features work

#### 5.9 Documentation

**Create:**
1. **README.md** - Installation and usage instructions
2. **CONTRIBUTING.md** - Development setup
3. **CHANGELOG.md** - Version history

### Deliverables
✅ Extension tested on 20+ websites
✅ All edge cases handled
✅ Performance optimized
✅ Bugs fixed
✅ Production build ready
✅ Documentation complete

### Testing
- [ ] Works on all major website types
- [ ] Handles all edge cases gracefully
- [ ] No console errors
- [ ] Fast and responsive
- [ ] Ready for Chrome Web Store submission

---

## Week 3 Completion Checklist

### Core Functionality
- [ ] Extension loads in Chrome without errors
- [ ] User can login and stay authenticated
- [ ] Native Chrome bookmark (star) saves to BookSmart
- [ ] Popup shows recent bookmarks (10 max)
- [ ] Search bar works (semantic search)
- [ ] Badge shows pending count
- [ ] "Open Manager" button works
- [ ] Notifications show on save success/failure

### User Experience
- [ ] UI is minimalist and clean (light theme)
- [ ] Loading states work correctly
- [ ] Empty states show when no bookmarks
- [ ] Error messages are user-friendly
- [ ] Smooth animations and transitions
- [ ] Responsive to user actions (< 100ms)

### Technical Quality
- [ ] No console errors
- [ ] Handles network failures gracefully
- [ ] Token refresh works automatically
- [ ] Retry logic handles API failures
- [ ] Code is clean and well-organized
- [ ] Extension is packaged and ready

### Testing
- [ ] Tested on 20+ different websites
- [ ] All edge cases handled
- [ ] Complete user flow tested
- [ ] Performance is acceptable
- [ ] No critical bugs

---

## File Structure (Final)

```
extension/
├── public/
│   └── manifest.json                 # Manifest V3 config
├── src/
│   ├── background/
│   │   └── background.js             # Service worker
│   ├── popup/
│   │   ├── popup.html                # Popup UI
│   │   ├── popup.css                 # Light theme styles
│   │   └── popup.js                  # Popup logic
│   ├── auth/
│   │   ├── login.html                # Login screen
│   │   └── login.js                  # Auth logic
│   ├── utils/
│   │   ├── api.js                    # API client
│   │   ├── storage.js                # Chrome storage
│   │   ├── badge.js                  # Badge management
│   │   ├── notifications.js          # Notifications
│   │   └── retry.js                  # Retry logic
│   └── icons/
│       ├── icon16.png                # 16×16
│       ├── icon48.png                # 48×48
│       └── icon128.png               # 128×128
├── dist/                             # Build output (gitignored)
├── build.sh                          # Build script
├── package.json                      # Package config
└── README.md                         # Documentation
```

---

## Success Metrics

**Week 3 Complete When:**

1. ✅ Extension is fully functional
2. ✅ All core features work
3. ✅ User flow is smooth and intuitive
4. ✅ No critical bugs
5. ✅ Ready for Week 4 (Manager UI)

**Key Performance Indicators:**
- Bookmark save: < 100ms (backend handles processing)
- Popup open: < 50ms
- Search results: < 500ms
- Zero console errors
- Works on 95%+ of websites

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Chrome API changes | High | Use stable APIs, follow Manifest V3 guidelines |
| Authentication issues | Medium | Robust token refresh, error handling |
| Badge count sync | Low | Poll every 30s, update on events |
| Popup performance | Low | Lazy loading, caching, debouncing |
| Extension size | Low | Vanilla JS (no frameworks), optimize assets |

---

## Next Steps After Week 3

**Week 4: Manager UI**
- Build React web application
- Full bookmark management interface
- Advanced search and filtering
- Bulk import feature
- User settings and preferences

**Estimated:** 9-13 hours (5 sessions)

---

**Ready to start Week 3 Session 1!** 🚀

Let me know when you want to begin, and we'll build the extension foundation together.
