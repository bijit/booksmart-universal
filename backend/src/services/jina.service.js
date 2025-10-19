/**
 * Jina AI Service
 *
 * Handles content extraction from URLs using Jina Reader API
 */

import axios from 'axios';

const JINA_READER_BASE_URL = 'https://r.jina.ai';

/**
 * Extract content from a URL using Jina Reader API
 *
 * @param {string} url - The URL to extract content from
 * @returns {Promise<Object>} Extracted content with title, description, and text
 */
export async function extractContent(url) {
  try {
    // Jina Reader API: prepend r.jina.ai/ to any URL
    const jinaUrl = `${JINA_READER_BASE_URL}/${url}`;

    console.log(`[Jina] Extracting content from: ${url}`);

    const response = await axios.get(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      },
      timeout: 30000 // 30 second timeout
    });

    const responseData = response.data;

    // Jina wraps response in {code, status, data} structure
    const data = responseData.data || responseData;

    // Extract relevant fields from Jina response
    const result = {
      title: data.title || extractTitleFromContent(data.content) || 'Untitled',
      description: data.description || extractDescription(data.content) || '',
      content: data.content || data.text || '',
      url: data.url || url,
      favicon: data.favicon || null,
      author: data.author || null,
      publishedTime: data.publishedTime || null,
      siteName: data.siteName || null
    };

    // Validate extracted content
    if (!result.content || result.content.trim().length < 50) {
      throw new Error('Insufficient content extracted from URL');
    }

    console.log(`[Jina] Successfully extracted ${result.content.length} characters from ${url}`);

    return result;

  } catch (error) {
    console.error(`[Jina] Error extracting content from ${url}:`, error.message);

    if (error.response) {
      // Jina API returned an error
      throw new Error(`Jina API error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      // Timeout
      throw new Error('Content extraction timeout (30s)');
    } else {
      // Network or other error
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }
}

/**
 * Extract title from content if not provided
 * Takes first heading or first line
 */
function extractTitleFromContent(content) {
  if (!content) return null;

  // Try to find first heading (# or ##)
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Try first line (up to 100 chars)
  const firstLine = content.split('\n')[0];
  if (firstLine && firstLine.length > 0) {
    return firstLine.substring(0, 100).trim();
  }

  return null;
}

/**
 * Extract description from content if not provided
 * Takes first paragraph or first 200 characters
 */
function extractDescription(content) {
  if (!content) return null;

  // Remove headings
  const withoutHeadings = content.replace(/^#+\s+.+$/gm, '');

  // Get first paragraph
  const paragraphs = withoutHeadings.split('\n\n').filter(p => p.trim().length > 0);
  if (paragraphs.length > 0) {
    const firstParagraph = paragraphs[0].trim();
    // Limit to 200 characters
    return firstParagraph.substring(0, 200) + (firstParagraph.length > 200 ? '...' : '');
  }

  // Fallback: first 200 characters
  return content.substring(0, 200).trim() + (content.length > 200 ? '...' : '');
}

/**
 * Test Jina service with a sample URL
 */
export async function testJinaService() {
  try {
    console.log('[Jina] Testing service...');
    const result = await extractContent('https://example.com');
    console.log('[Jina] Test successful:', {
      title: result.title,
      contentLength: result.content.length,
      hasDescription: !!result.description
    });
    return true;
  } catch (error) {
    console.error('[Jina] Test failed:', error.message);
    return false;
  }
}
