/**
 * Readability Service
 *
 * Handles content extraction from URLs using Mozilla's Readability.js
 * (The same engine used by Firefox Reader View)
 * This runs locally, completely privately, and avoids third-party APIs.
 */

import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Extract content from a URL using Readability
 *
 * @param {string} url - The URL to extract content from
 * @returns {Promise<Object>} Extracted content with title, description, and text
 */
export async function extractContent(url) {
  try {
    console.log(`[Readability] Extracting content from: ${url}`);

    // 1. Fetch the raw HTML
    // We disguise our request slightly as a standard browser to avoid basic bot blocks
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000 // 30 second timeout
    });

    const html = response.data;

    // 2. Parse HTML into a DOM tree using JSDOM
    const doc = new JSDOM(html, { url });

    // Extract metadata before Readability alters the DOM
    const metaDescription = extractMetaDescription(doc.window.document);
    const favicon = extractFavicon(doc.window.document, url);
    const coverImage = extractCoverImage(doc.window.document, url);
    const contentImages = extractContentImages(doc.window.document, url);

    // 3. Run Readability to extract clean article content
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      throw new Error('Readability found insufficient content on the page');
    }

    // Prepare the final result
    const result = {
      title: article.title || 'Untitled',
      description: article.excerpt || metaDescription || '',
      content: article.textContent.trim(), // We use raw text content instead of HTML for embedding
      url: url,
      favicon: favicon,
      cover_image: coverImage,
      extracted_images: contentImages,
      author: article.byline || null,
      site_name: article.siteName || null,
      published_date: article.publishedTime || null,
      reading_time: Math.ceil(article.textContent.split(/\s+/).length / 200), // Approx 200 wpm
      language: article.lang || null
    };

    console.log(`[Readability] Successfully extracted ${result.content.length} characters from ${url}`);

    return result;

  } catch (error) {
    console.error(`[Readability] Error extracting content from ${url}:`, error.message);

    if (error.response) {
      throw new Error(`Extraction error: HTTP ${error.response.status} - ${error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Content extraction timeout (30s)');
    } else {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }
}

/**
 * Extract meta description from the DOM
 */
function extractMetaDescription(document) {
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) return metaDesc.getAttribute('content');

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) return ogDesc.getAttribute('content');

  return null;
}

/**
 * Extract favicon URL from the DOM
 */
function extractFavicon(document, baseUrl) {
  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      let href = el.getAttribute('href');
      if (href) {
        // Resolve relative URLs to absolute
        try {
          return new URL(href, baseUrl).href;
        } catch (e) {
          return href;
        }
      }
    }
  }

  // Fallback to default favicon.ico
  try {
    return new URL('/favicon.ico', baseUrl).href;
  } catch (e) {
    return null;
  }
}

/**
 * Extract cover image (OG image or Twitter image)
 */
function extractCoverImage(document, baseUrl) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
    'link[rel="image_src"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content') || el.getAttribute('href');
      if (content) {
        try {
          return new URL(content, baseUrl).href;
        } catch (e) {
          return content;
        }
      }
    }
  }

  return null;
}

/**
 * Extract images from the content area
 */
function extractContentImages(document, baseUrl) {
  const images = [];
  const imgElements = Array.from(document.querySelectorAll('article img, main img, .content img, #content img'));
  
  // If no specific content container images, try all images
  const targetElements = imgElements.length > 0 ? imgElements : Array.from(document.querySelectorAll('img'));

  for (const img of targetElements) {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (src && !src.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        // Basic filtering for tiny icons/tracking pixels
        const width = parseInt(img.getAttribute('width') || '0');
        const height = parseInt(img.getAttribute('height') || '0');
        
        if (!images.includes(absoluteUrl) && (width === 0 || width > 100)) {
          images.push(absoluteUrl);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
    if (images.length >= 10) break; // Limit to 10 images
  }

  return images;
}
