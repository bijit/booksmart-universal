# Loading BookSmart Extension in Chrome

## Prerequisites

✅ Backend server running at `http://localhost:3000`
✅ Extension built in `extension/dist/` folder

---

## Steps to Load Extension

### 1. Open Chrome Extensions Page

In Chrome, go to:
```
chrome://extensions/
```

Or: Menu (⋮) → Extensions → Manage Extensions

### 2. Enable Developer Mode

- Look for the **"Developer mode"** toggle in the top-right corner
- Click it to enable (should turn blue)

### 3. Load Unpacked Extension

- Click the **"Load unpacked"** button (top-left)
- Navigate to your project folder:
  ```
  /home/kniyogi/projects/booksmart_v1.0/extension/dist
  ```
- Select the `dist` folder and click "Select Folder"

### 4. Verify Extension Loaded

You should see:
- ✅ "BookSmart" extension card in the extensions page
- ✅ BookSmart icon in your Chrome toolbar (top-right, next to address bar)
- ✅ No errors in the extension card

---

## Testing the Extension

### Test 1: Open Popup

1. Click the BookSmart icon in your toolbar
2. You should see the login screen
3. Verify:
   - ✅ Clean white interface loads
   - ✅ Email and password fields visible
   - ✅ No console errors (right-click popup → Inspect)

### Test 2: Login

1. In the popup, enter your test credentials:
   - Email: (your test account email)
   - Password: (your test account password)

2. Click "Login"
3. If successful:
   - ✅ Login screen disappears
   - ✅ Main screen appears with search bar
   - ✅ "No bookmarks yet" message shows

### Test 3: Save a Bookmark

1. Navigate to any website (e.g., https://en.wikipedia.org/wiki/Artificial_intelligence)
2. Click the **star icon** in your address bar (or press Ctrl+D)
3. Confirm the bookmark in Chrome's dialog
4. You should see:
   - ✅ Notification: "Bookmark saved!"
   - ✅ Badge on extension icon showing "1" (pending)

5. Wait 10-15 seconds
6. Badge should disappear (processing complete)

### Test 4: View Bookmarks

1. Click the BookSmart extension icon
2. You should see:
   - ✅ Your saved bookmark appears in the list
   - ✅ Title, domain, and timestamp displayed
   - ✅ Click the bookmark card → Opens URL in new tab

### Test 5: Search

1. In the popup search bar, type a query (e.g., "artificial intelligence")
2. Wait 300ms (debounce delay)
3. You should see:
   - ✅ Search results appear
   - ✅ Relevant bookmarks shown

---

## Troubleshooting

### Extension Won't Load

**Error:** "Manifest version 2 is deprecated"
- ✅ **Fixed**: We're using Manifest V3

**Error:** "Failed to load extension"
- Check that you selected the `dist` folder (not `extension` or `src`)
- Verify all files exist in `dist/`:
  ```bash
  ls -la extension/dist/
  # Should show: manifest.json, background.js, popup.html, popup.css, popup.js, icons/
  ```

### Popup Won't Open

1. Check extension icon is visible in toolbar
2. If not visible, click the puzzle piece icon → Pin BookSmart
3. Right-click extension icon → Inspect popup → Check for errors

### Login Fails

1. Verify backend is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check network tab in popup inspector (right-click popup → Inspect → Network)
3. Look for failed API calls to `http://localhost:3000/api/auth/login`

### Bookmark Not Saved

1. Check you're logged in (click extension icon → should see main screen, not login)
2. Check backend logs for errors
3. Verify bookmark has URL (folders don't sync)
4. Check background service worker console:
   - Go to `chrome://extensions/`
   - Find BookSmart extension
   - Click "service worker" link
   - Check console for errors

### Badge Not Updating

1. Badge updates every 30 seconds automatically
2. Manually refresh: Close and reopen popup
3. Check background service worker console for errors

---

## Development Workflow

### Making Changes

1. Edit files in `extension/src/`
2. Run build script:
   ```bash
   cd extension
   ./build.sh
   ```

3. Reload extension in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh icon on BookSmart card
   - Or: Remove and re-add the extension

### Viewing Logs

**Popup logs:**
- Right-click popup → Inspect → Console

**Background worker logs:**
- Go to `chrome://extensions/`
- Find BookSmart → Click "service worker"
- Console tab shows background logs

**Backend logs:**
- Check terminal where `npm run dev` is running

---

## Next Steps

### Session 1 Complete! ✅

You've successfully:
- ✅ Created extension structure
- ✅ Built manifest.json (V3)
- ✅ Created popup UI (minimalist light theme)
- ✅ Created background service worker
- ✅ Generated extension icons
- ✅ Built and loaded extension in Chrome

### Session 2: Authentication (Next)

- Improve login/logout flow
- Add token refresh logic
- Handle auth errors
- Test edge cases

---

## Quick Commands Reference

```bash
# Start backend
cd /home/kniyogi/projects/booksmart_v1.0/backend
npm run dev

# Build extension
cd /home/kniyogi/projects/booksmart_v1.0/extension
./build.sh

# Check backend health
curl http://localhost:3000/api/health

# View backend logs
# (Check terminal where npm run dev is running)
```

---

**Extension Location:**
```
/home/kniyogi/projects/booksmart_v1.0/extension/dist/
```

**Load this folder in Chrome at `chrome://extensions/` with Developer Mode enabled.**

Good luck! 🚀
