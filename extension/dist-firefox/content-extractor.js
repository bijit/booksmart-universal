/**
 * Content Extractor for BookSmart
 *
 * This function runs in the context of the web page and extracts
 * the main content using Mozilla's Readability library.
 *
 * This will be injected into pages via chrome.scripting.executeScript
 * Note: Readability.js must be loaded first
 */

/**
 * Extract content from the current page
 * @returns {Object} Extracted content with title, textContent, excerpt, etc.
 */
function extractPageContent() {
  try {
    console.log('[BookSmart] Starting content extraction...');

    // Wait for document to be ready
    if (document.readyState !== 'complete') {
      console.log('[BookSmart] Document not ready, waiting...');
      return {
        success: false,
        error: 'Document not fully loaded'
      };
    }

    // Clone the document for Readability (it modifies the DOM)
    const documentClone = document.cloneNode(true);

    // Create Readability instance and parse
    const reader = new Readability(documentClone, {
      debug: false,
      maxElemsToParse: 0, // No limit
      nbTopCandidates: 5,
      charThreshold: 500, // Minimum content length
      classesToPreserve: [] // Don't preserve any special classes
    });

    const article = reader.parse();

    // Check if extraction succeeded
    if (!article || !article.textContent || article.textContent.length < 500) {
      console.log('[BookSmart] Readability extraction failed or insufficient content, falling back to simple extraction');

      // Fallback: simple extraction
      return extractSimple();
    }

    console.log('[BookSmart] Successfully extracted content using Readability');
    console.log(`[BookSmart] Title: ${article.title}`);
    console.log(`[BookSmart] Content length: ${article.textContent.length} characters`);

    return {
      success: true,
      method: 'readability',
      title: article.title || document.title,
      content: article.textContent,
      excerpt: article.excerpt || '',
      byline: article.byline || '',
      length: article.length || article.textContent.length,
      siteName: article.siteName || extractSiteName(),
      publishedTime: extractPublishedTime(),
      coverImage: extractCoverImage(),
      extractedImages: extractInPageImages()
    };

  } catch (error) {
    console.error('[BookSmart] Error during Readability extraction:', error);

    // Fallback to simple extraction
    return extractSimple();
  }
}

/**
 * Simple fallback extraction (if Readability fails)
 */
function extractSimple() {
  try {
    console.log('[BookSmart] Using simple extraction method');

    // Get visible text from body
    const content = document.body.innerText || document.body.textContent || '';

    // Get meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';

    // Combine for excerpt
    const excerpt = metaDescription || content.substring(0, 300);

    return {
      success: content.length > 100, // At least 100 characters
      method: 'simple',
      title: document.title,
      content: content,
      excerpt: excerpt,
      byline: null,
      length: content.length,
      siteName: extractSiteName(),
      publishedTime: extractPublishedTime(),
      coverImage: extractCoverImage(),
      extractedImages: extractInPageImages()
    };

  } catch (error) {
    console.error('[BookSmart] Error during simple extraction:', error);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract site name from meta tags or domain
 */
function extractSiteName() {
  // Try meta tags
  const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
  if (ogSiteName) return ogSiteName;

  const appName = document.querySelector('meta[name="application-name"]')?.content;
  if (appName) return appName;

  // Extract from domain
  try {
    const hostname = window.location.hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch (e) {
    return null;
  }
}

/**
 * Extract published time from meta tags
 */
function extractPublishedTime() {
  // Try various meta tags
  const publishedTime =
    document.querySelector('meta[property="article:published_time"]')?.content ||
    document.querySelector('meta[name="article:published_time"]')?.content ||
    document.querySelector('meta[property="og:published_time"]')?.content ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') ||
    null;

  return publishedTime;
}

/**
 * Extract the main cover image from meta tags
 */
function extractCoverImage() {
  const coverImage = 
    document.querySelector('meta[property="og:image"]')?.content ||
    document.querySelector('meta[name="twitter:image"]')?.content ||
    document.querySelector('meta[property="og:image:secure_url"]')?.content ||
    document.querySelector('link[rel="image_src"]')?.href ||
    null;
    
  // Resolve relative URLs to absolute
  if (coverImage && !coverImage.startsWith('http')) {
    try {
      return new URL(coverImage, window.location.href).href;
    } catch (e) {
      return null;
    }
  }
  return coverImage;
}

/**
 * Extract significant in-page images
 */
function extractInPageImages() {
  const images = [];
  const imgNodes = document.querySelectorAll('img');
  
  for (let i = 0; i < imgNodes.length; i++) {
    const img = imgNodes[i];
    // Skip tiny icons, tracking pixels, or empty sources
    if (img.src && img.src.startsWith('http') && img.width > 200 && img.height > 100) {
      images.push(img.src);
    }
    
    // Cap at 10 images to prevent massive payloads
    if (images.length >= 10) break;
  }
  
  // Deduplicate
  return [...new Set(images)];
}


// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractPageContent };
}
