/**
 * Text Chunking Utility
 *
 * Provides functions for splitting large text into overlapping chunks
 * for improved semantic search quality
 */

/**
 * Split text into overlapping chunks
 *
 * @param {string} text - The text to chunk
 * @param {number} chunkSize - Size of each chunk in characters (default: 2000)
 * @param {number} overlap - Number of overlapping characters between chunks (default: 200)
 * @returns {Array<Object>} Array of chunk objects with text and metadata
 */
export function createChunks(text, chunkSize = 2000, overlap = 200) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // If text is shorter than chunk size, return single chunk
  if (text.length <= chunkSize) {
    return [{
      text: text,
      index: 0,
      start: 0,
      end: text.length,
      total_chunks: 1
    }];
  }

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    // Calculate end position
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at sentence boundary if not at the end
    if (end < text.length) {
      // Look for sentence-ending punctuation in the last 20% of the chunk
      const searchStart = Math.max(start, end - Math.floor(chunkSize * 0.2));
      const searchText = text.substring(searchStart, end);
      const sentenceBreak = searchText.search(/[.!?]\s+/g);

      if (sentenceBreak !== -1) {
        // Adjust end to the sentence boundary
        end = searchStart + sentenceBreak + 1;
      }
    }

    // Extract chunk text
    const chunkText = text.substring(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        start: start,
        end: end,
        total_chunks: -1 // Will be set after all chunks are created
      });
      chunkIndex++;
    }

    // Move to next chunk with overlap
    start = end - overlap;

    // Prevent infinite loop
    if (start <= chunks[chunks.length - 1]?.start) {
      start = end;
    }
  }

  // Set total chunks count for all chunks
  chunks.forEach(chunk => {
    chunk.total_chunks = chunks.length;
  });

  return chunks;
}

/**
 * Create smart chunks that preserve document structure
 * Tries to split at paragraph boundaries first, then sentences
 *
 * @param {string} text - The text to chunk
 * @param {number} targetSize - Target size of each chunk (default: 2000)
 * @param {number} overlap - Number of overlapping characters (default: 200)
 * @returns {Array<Object>} Array of chunk objects
 */
export function createSmartChunks(text, targetSize = 2000, overlap = 200) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // If text is short, return single chunk
  if (text.length <= targetSize) {
    return [{
      text: text,
      index: 0,
      start: 0,
      end: text.length,
      total_chunks: 1
    }];
  }

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();

    if (!para) continue;

    // If adding this paragraph would exceed target size
    if (currentChunk.length + para.length > targetSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        start: currentStart,
        end: currentStart + currentChunk.length,
        total_chunks: -1
      });
      chunkIndex++;

      // Start new chunk with overlap from previous chunk
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.substring(currentChunk.length - overlap);
        currentChunk = overlapText + '\n\n' + para;
        currentStart = currentStart + currentChunk.length - overlap - para.length - 2;
      } else {
        currentChunk = para;
        currentStart = currentStart + currentChunk.length;
      }
    } else {
      // Add to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + para;
      } else {
        currentChunk = para;
      }
    }
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      start: currentStart,
      end: currentStart + currentChunk.length,
      total_chunks: -1
    });
  }

  // If we still have chunks that are too large, fall back to regular chunking
  const finalChunks = [];
  chunks.forEach(chunk => {
    if (chunk.text.length > targetSize * 1.5) {
      // Chunk is too large, split it further
      const subChunks = createChunks(chunk.text, targetSize, overlap);
      finalChunks.push(...subChunks);
    } else {
      finalChunks.push(chunk);
    }
  });

  // Update chunk indices and total count
  finalChunks.forEach((chunk, idx) => {
    chunk.index = idx;
    chunk.total_chunks = finalChunks.length;
  });

  return finalChunks;
}

/**
 * Combine chunk title with content for better context
 *
 * @param {string} title - Document title
 * @param {string} chunkText - Chunk text
 * @param {number} chunkIndex - Index of this chunk
 * @param {number} totalChunks - Total number of chunks
 * @returns {string} Combined text for embedding
 */
export function createChunkContext(title, chunkText, chunkIndex, totalChunks) {
  if (totalChunks === 1) {
    // Single chunk - just prepend title
    return `${title}\n\n${chunkText}`;
  }

  // Multiple chunks - add title and position info
  return `${title} (Part ${chunkIndex + 1} of ${totalChunks})\n\n${chunkText}`;
}
