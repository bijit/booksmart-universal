/**
 * Document Service
 * 
 * Handles text extraction from non-HTML documents (PDF, Word, etc.)
 */

import axios from 'axios';
import { createRequire } from 'module';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const require = createRequire(import.meta.url);
const mammothModule = require('mammoth');
const mammoth = mammothModule.default || mammothModule;

/**
 * Extract content from a document URL
 * 
 * @param {string} url - The URL of the document
 * @returns {Promise<Object>} Extracted content
 */
export async function extractDocumentContent(url) {
  try {
    console.log(`[DocumentService] Extracting content from: ${url}`);

    // 1. Determine file type
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    
    // 2. Fetch the file as a buffer
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024, // 20MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || '';

    let result = {
      url,
      title: path.basename(new URL(url).pathname) || 'Untitled Document',
      content: '',
      method: 'unknown',
      success: false
    };

    // 3. Route to correct parser
    if (extension === '.pdf' || contentType.includes('pdf')) {
      result = await parsePdf(buffer, result);
    } else if (extension === '.docx' || contentType.includes('officedocument.wordprocessingml')) {
      result = await parseDocx(buffer, result);
    } else {
      throw new Error(`Unsupported document type: ${extension || contentType}`);
    }

    if (result.success) {
      console.log(`[DocumentService] Successfully extracted ${result.content.length} characters`);
    }

    return result;

  } catch (error) {
    console.error(`[DocumentService] Error extracting from ${url}:`, error.message);
    throw error;
  }
}

/**
 * Parse PDF buffer
 */
async function parsePdf(buffer, result) {
  try {
    const parser = new PDFParse({ data: buffer });
    const textData = await parser.getText();
    
    // Attempt to grab metadata
    let metadata = {};
    let pages = 0;
    try {
      const infoData = await parser.getInfo();
      metadata = infoData.info || {};
      pages = infoData.total || 0;
    } catch (e) {
      console.warn('[DocumentService] Could not extract PDF metadata', e.message);
    }
    
    await parser.destroy();
    
    return {
      ...result,
      success: true,
      method: 'pdf-parse',
      content: textData.text ? textData.text.trim() : '',
      metadata: metadata,
      info: metadata,
      pages: pages
    };
  } catch (error) {
    console.error('[DocumentService] PDF parsing failed:', error.message);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

/**
 * Parse Word (.docx) buffer
 */
async function parseDocx(buffer, result) {
  try {
    const data = await mammoth.extractRawText({ buffer });
    
    return {
      ...result,
      success: true,
      method: 'mammoth',
      content: data.value.trim(),
      warnings: data.warnings
    };
  } catch (error) {
    console.error('[DocumentService] Word parsing failed:', error.message);
    throw new Error(`Word parsing failed: ${error.message}`);
  }
}

/**
 * Check if a URL points to a supported document
 */
export function isSupportedDocument(url) {
  if (!url) return false;
  const supportedExtensions = ['.pdf', '.docx'];
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    // Check if it ends with .pdf/.docx OR if it clearly indicates a pdf in the path (like arXiv)
    return supportedExtensions.some(ext => pathname.endsWith(ext)) || pathname.includes('/pdf/');
  } catch (e) {
    return false;
  }
}
