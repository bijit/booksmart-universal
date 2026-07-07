/**
 * BookSmart Content Bridge
 * 
 * Injected on matching Manager domains to automatically communicate the 
 * Extension ID to the web application, bypassing manual setup.
 */

// 1. Broadcast the extension ID immediately when the script loads
try {
  const extensionId = chrome.runtime.id;
  window.postMessage({
    type: 'BOOKSMART_EXTENSION_INSTALLED',
    extensionId: extensionId
  }, '*');
  console.log('[BookSmart Bridge] Broadcasted extension ID:', extensionId);
} catch (error) {
  console.error('[BookSmart Bridge] Error broadcasting extension ID:', error);
}

// 2. Listen for ping requests from the manager page
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  if (event.data?.type === 'BOOKSMART_PING_EXTENSION') {
    try {
      const extensionId = chrome.runtime.id;
      window.postMessage({
        type: 'BOOKSMART_EXTENSION_INSTALLED',
        extensionId: extensionId
      }, '*');
      console.log('[BookSmart Bridge] Responded to ping with ID:', extensionId);
    } catch (error) {
      console.error('[BookSmart Bridge] Error responding to ping:', error);
    }
  }
});
