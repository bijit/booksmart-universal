/**
 * Crawl4AI Service
 *
 * Handles content extraction from URLs using self-hosted Crawl4AI service
 */

import axios from 'axios';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../../../.env.local') });

const CRAWL4AI_API_URL = process.env.CRAWL4AI_API_URL || 'http://localhost:11235';
const CRAWL4AI_API_TOKEN = process.env.CRAWL4AI_API_TOKEN;

/**
 * Extract content from a URL using Crawl4AI API
 *
 * @param {string} url - The URL to extract content from
 * @returns {Promise<Object>} Extracted content with title, description, and text
 */
export async function extractContent(url) {
  try {
    console.log(`[Crawl4AI] Extracting content from: ${url}`);

    const headers = {
      'Content-Type': 'application/json'
    };

    if (CRAWL4AI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${CRAWL4AI_API_TOKEN}`;
    }

    // Crawl4AI /crawl endpoint
    // We request markdown as the output format
    const response = await axios.post(`${CRAWL4AI_API_URL}/crawl`, {
      urls: [url],
      priority: 10,
      browser_config: {
        headless: true
      },
      crawler_run_config: {
        output_format: 'markdown',
        fit_markdown: true
      }
    }, {
      headers,
      timeout: 60000 // Crawling can take time, 60s timeout
    });

    // Crawl4AI response structure: { results: [{ success, markdown, metadata, ... }] }
    const resultData = response.data.results?.[0];

    if (!resultData || !resultData.success) {
      throw new Error(resultData?.error || 'Extraction failed');
    }

    // Extract relevant fields
    const result = {
      title: String(resultData.metadata?.title || resultData.title || 'Untitled'),
      description: String(resultData.metadata?.description || resultData.description || ''),
      content: String(resultData.markdown || resultData.text || resultData.content || ''),
      url: resultData.url || url,
      favicon: resultData.metadata?.favicon || null,
      author: resultData.metadata?.author || null,
      publishedTime: resultData.metadata?.publishedTime || null,
      siteName: resultData.metadata?.siteName || null
    };

    // Validate extracted content
    if (!result.content || result.content.trim().length < 50) {
      console.warn(`[Crawl4AI] Warning: Low content volume extracted (${result.content?.length || 0} chars)`);
    }

    console.log(`[Crawl4AI] Successfully extracted ${result.content.length} characters from ${url}`);

    return result;

  } catch (error) {
    console.warn(`[Crawl4AI] Error extracting content from ${url}, falling back to Jina:`, error.message);

    try {
      // Import Jina dynamically to avoid circular dependencies
      const { extractContent: jinaExtract } = await import('./jina.service.js');
      console.log(`[Crawl4AI] Falling back to Jina Reader for: ${url}`);
      return await jinaExtract(url);
    } catch (jinaError) {
      console.error(`[Crawl4AI] Both Crawl4AI and Jina failed for ${url}:`, jinaError.message);
      if (error.response) {
        throw new Error(`Crawl4AI API error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Content extraction timeout (60s)');
      } else {
        throw new Error(`Content extraction failed: ${error.message}`);
      }
    }
  }
}

/**
 * Test Crawl4AI service
 */
export async function testCrawl4AIService() {
  try {
    console.log('[Crawl4AI] Testing service...');
    const result = await extractContent('https://example.com');
    console.log('[Crawl4AI] Test successful:', {
      title: result.title,
      contentLength: result.content.length
    });
    return true;
  } catch (error) {
    console.error('[Crawl4AI] Test failed:', error.message);
    return false;
  }
}
