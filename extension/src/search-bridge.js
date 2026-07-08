/**
 * BookSmart Search Context Bridge
 * 
 * Intercepts search engine queries (Google, DuckDuckGo) and injects
 * a helpful widget containing relevant saved bookmarks from the user's library.
 */

(function () {
  // 1. Helper to extract search query from URL
  function getSearchQuery() {
    const url = window.location.href;
    const urlObj = new URL(url);
    
    // Google: ?q=query
    // DuckDuckGo: ?q=query
    if (urlObj.hostname.includes('google.') || urlObj.hostname.includes('duckduckgo.')) {
      return urlObj.searchParams.get('q');
    }
    return null;
  }

  // 2. Main execution block
  const searchQuery = getSearchQuery();
  if (!searchQuery || searchQuery.trim().length < 2) return;

  console.log('[BookSmart Co-Pilot] Intercepted search query:', searchQuery);

  // Send message to background script to query BookSmart library
  chrome.runtime.sendMessage(
    { type: 'BOOKSMART_SEARCH_PULSE', query: searchQuery },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[BookSmart Co-Pilot] Background query failed:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.results && response.results.length > 0) {
        injectCopilotWidget(response.results, searchQuery);
      } else {
        console.log('[BookSmart Co-Pilot] No matching bookmarks found in your library.');
      }
    }
  );

  // 3. Inject the Co-Pilot Sidebar Widget
  function injectCopilotWidget(bookmarks, query) {
    // Check if widget already exists
    if (document.getElementById('booksmart-copilot-root')) return;

    // Create mount point
    const rootContainer = document.createElement('div');
    rootContainer.id = 'booksmart-copilot-root';
    
    // Style the root container to overlay on the side
    Object.assign(rootContainer.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      width: '320px',
      maxHeight: 'calc(100vh - 120px)',
      zIndex: '10000',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
      borderRadius: '16px',
      overflow: 'hidden',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: 'translateX(340px)' // Start offscreen
    });

    document.body.appendChild(rootContainer);

    // Create Shadow DOM to fully isolate styles from target search engine CSS
    const shadow = rootContainer.attachShadow({ mode: 'open' });

    // CSS styling inside the shadow root (premium dark glassmorphism design)
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
      }
      .panel {
        background: rgba(28, 28, 30, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #f2f2f7;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 120px);
        border-radius: 16px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
        color: #0a84ff;
        margin: 0;
      }
      .header-logo {
        width: 16px;
        height: 16px;
      }
      .close-btn {
        background: none;
        border: none;
        color: #aeaeae;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
      }
      .close-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .content {
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .content::-webkit-scrollbar {
        width: 6px;
      }
      .content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .match-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 12px;
        transition: all 0.2s ease;
        text-decoration: none;
        color: inherit;
        display: block;
      }
      .match-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(10, 132, 255, 0.3);
        transform: translateY(-2px);
      }
      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .card-icon {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        background: #3a3a3c;
        flex-shrink: 0;
      }
      .card-type {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: #30d158;
        letter-spacing: 0.5px;
      }
      .card-title {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        margin: 0 0 6px 0;
        color: #ffffff;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .card-desc {
        font-size: 11.5px;
        color: #aeaeae;
        line-height: 1.4;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }
      .tag {
        font-size: 9.5px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: #bfbfc5;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .footer {
        padding: 10px 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.15);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .footer-btn {
        background: #0a84ff;
        border: none;
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s;
        text-decoration: none;
      }
      .footer-btn:hover {
        background: #0070e3;
      }
      .footer-info {
        font-size: 10px;
        color: #8e8e93;
      }
      /* Floating action trigger widget when sidebar closed */
      .trigger-btn {
        position: fixed;
        top: 80px;
        right: 20px;
        background: #0a84ff;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        width: 44px;
        height: 44px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10000;
        transition: transform 0.2s;
      }
      .trigger-btn:hover {
        transform: scale(1.08);
        background: #0070e3;
      }
      .trigger-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #30d158;
        color: #000000;
        font-size: 9.5px;
        font-weight: 700;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #1c1c1e;
      }
    `;

    shadow.appendChild(style);

    // Create Main Panel Element
    const panel = document.createElement('div');
    panel.className = 'panel';

    // Header Content
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <h3 class="header-title">
        <svg class="header-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
          <path d="M6 6h10"></path>
          <path d="M6 10h10"></path>
        </svg>
        BookSmart Library (${bookmarks.length})
      </h3>
      <button class="close-btn" id="close-copilot">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    panel.appendChild(header);

    // Scrollable List Content
    const listContent = document.createElement('div');
    listContent.className = 'content';

    bookmarks.slice(0, 5).forEach((bookmark) => {
      const card = document.createElement('a');
      card.className = 'match-card';
      card.href = bookmark.url;
      card.target = '_blank';

      // Safe description formatting
      const descText = bookmark.description || bookmark.content?.substring(0, 150) || 'No details available.';
      const faviconUrl = bookmark.favicon_url || `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`;
      
      const tagsMarkup = (bookmark.tags || [])
        .slice(0, 3)
        .map(tag => `<span class="tag">${tag}</span>`)
        .join('');

      card.innerHTML = `
        <div class="card-header">
          <img class="card-icon" src="${faviconUrl}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22></circle></svg>'">
          <span class="card-type" style="color: ${bookmark.content_type === 'document' ? '#ff9f0a' : bookmark.content_type === 'video' ? '#ff453a' : '#30d158'}">
            ${bookmark.content_type || 'webpage'}
          </span>
        </div>
        <h4 class="card-title">${bookmark.title || 'Untitled'}</h4>
        <p class="card-desc">${descText}</p>
        <div class="card-tags">${tagsMarkup}</div>
      `;

      listContent.appendChild(card);
    });

    panel.appendChild(listContent);

    // Footer Content
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
      <span class="footer-info">Grounding matches</span>
      <a class="footer-btn" href="https://booksmart-manager-920600341451.us-central1.run.app/?search=${encodeURIComponent(query)}" target="_blank">Open Library</a>
    `;
    panel.appendChild(footer);

    shadow.appendChild(panel);

    // Fade/Slide In Panel Animation
    setTimeout(() => {
      rootContainer.style.transform = 'translateX(0)';
    }, 100);

    // Close button click handler
    shadow.getElementById('close-copilot').addEventListener('click', () => {
      // Slide panel offscreen
      rootContainer.style.transform = 'translateX(340px)';
      
      // After transition, replace panel with a small floating bubble trigger
      setTimeout(() => {
        shadow.removeChild(panel);
        
        const trigger = document.createElement('div');
        trigger.className = 'trigger-btn';
        trigger.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
          </svg>
          <span class="trigger-badge">${bookmarks.length}</span>
        `;
        
        trigger.addEventListener('click', () => {
          shadow.removeChild(trigger);
          shadow.appendChild(panel);
          setTimeout(() => {
            rootContainer.style.transform = 'translateX(0)';
          }, 50);
        });

        shadow.appendChild(trigger);
      }, 300);
    });
  }
})();
