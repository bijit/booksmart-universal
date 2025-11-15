/**
 * Google Gemini AI Service
 *
 * Handles content summarization and embedding generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local if not already loaded
if (!process.env.GOOGLE_AI_API_KEY) {
  config({ path: resolve(__dirname, '../../../.env.local') });
}

// Validate API key
if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

/**
 * Generate a concise title and description from content using Gemini
 *
 * @param {string} content - The extracted content to summarize
 * @param {string} url - The source URL
 * @returns {Promise<Object>} Generated title and description
 */
export async function summarizeContent(content, url) {
  try {
    console.log(`[Gemini] Summarizing content (${content.length} chars)...`);

    // Use Gemini 2.5 Flash for fast summarization
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Truncate content if too long (Gemini has token limits)
    const truncatedContent = content.substring(0, 8000);

    const prompt = `You are a helpful assistant that creates concise summaries for bookmarks.

Given the following webpage content, generate:
1. A SHORT, descriptive title (max 80 characters)
2. A brief description/summary (max 200 characters)
3. 3-5 relevant tags (lowercase, hyphenated keywords like "machine-learning", "web-development", "data-science")

The title should be clear and informative. The description should capture the main topic or purpose.
Tags should be specific, searchable keywords that describe the content's main topics and themes.

URL: ${url}

Content:
${truncatedContent}

Respond in JSON format:
{
  "title": "your generated title here",
  "description": "your generated description here",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response as JSON');
    }

    const summary = JSON.parse(jsonMatch[0]);

    // Validate response
    if (!summary.title || !summary.description) {
      throw new Error('Gemini response missing title or description');
    }

    // Enforce length limits
    summary.title = summary.title.substring(0, 80);
    summary.description = summary.description.substring(0, 200);

    // Process tags
    if (Array.isArray(summary.tags)) {
      // Clean and validate tags
      summary.tags = summary.tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.toLowerCase().trim())
        .slice(0, 5); // Max 5 tags
    } else {
      summary.tags = [];
    }

    console.log(`[Gemini] Successfully generated summary: "${summary.title}" with ${summary.tags.length} tags`);

    return summary;

  } catch (error) {
    console.error('[Gemini] Error summarizing content:', error.message);
    throw new Error(`Gemini summarization failed: ${error.message}`);
  }
}

/**
 * Generate embeddings (vector) from text using Google text-embedding-004
 *
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<number[]>} 768-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  try {
    console.log(`[Embeddings] Generating vector for ${text.length} chars...`);

    // Use text-embedding-004 model (768 dimensions)
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Truncate text if too long
    const truncatedText = text.substring(0, 10000);

    const result = await model.embedContent(truncatedText);
    const embedding = result.embedding;

    if (!embedding || !embedding.values || !Array.isArray(embedding.values)) {
      throw new Error('Invalid embedding response from Google API');
    }

    const vector = embedding.values;

    // Validate vector dimensions (should be 768 for text-embedding-004)
    if (vector.length !== 768) {
      throw new Error(`Expected 768-dimensional vector, got ${vector.length}`);
    }

    console.log(`[Embeddings] Successfully generated ${vector.length}D vector`);

    return vector;

  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Process content: summarize AND generate embedding
 * This is the main function used by the worker
 *
 * @param {string} content - The extracted content
 * @param {string} url - The source URL
 * @returns {Promise<Object>} Summary and embedding
 */
export async function processContent(content, url) {
  try {
    console.log(`[Gemini] Processing content for: ${url}`);

    // Run summarization and embedding in parallel for speed
    const [summary, embedding] = await Promise.all([
      summarizeContent(content, url),
      generateEmbedding(content)
    ]);

    return {
      title: summary.title,
      description: summary.description,
      tags: summary.tags,
      embedding: embedding
    };

  } catch (error) {
    console.error('[Gemini] Error processing content:', error.message);
    throw error;
  }
}

/**
 * Generate summary and tags from URL + title only (fallback when content extraction fails)
 *
 * @param {string} url - The bookmark URL
 * @param {string} title - The bookmark title (from Chrome)
 * @returns {Promise<Object>} Summary with title, description, and tags
 */
export async function summarizeFromMetadata(url, title) {
  try {
    console.log(`[Gemini] Generating summary from metadata only for: ${url}`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a helpful assistant that creates summaries for bookmarks based on limited information.

Given only the URL and title of a webpage, generate:
1. An improved title (max 80 characters) - make it more descriptive if possible
2. A brief description/summary (max 200 characters) - infer what the page is likely about
3. 3-5 relevant tags (lowercase, hyphenated keywords)

URL: ${url}
Title: ${title || 'No title provided'}

Respond in JSON format:
{
  "title": "your generated title here",
  "description": "your inferred description here",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response as JSON');
    }

    const summary = JSON.parse(jsonMatch[0]);

    // Validate response
    if (!summary.title || !summary.description) {
      throw new Error('Gemini response missing title or description');
    }

    // Enforce length limits
    summary.title = summary.title.substring(0, 80);
    summary.description = summary.description.substring(0, 200);

    // Process tags
    if (Array.isArray(summary.tags)) {
      summary.tags = summary.tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.toLowerCase().trim())
        .slice(0, 5);
    } else {
      summary.tags = [];
    }

    console.log(`[Gemini] Generated metadata-only summary: "${summary.title}" with ${summary.tags.length} tags`);

    return summary;

  } catch (error) {
    console.error('[Gemini] Error generating metadata summary:', error.message);
    throw new Error(`Gemini metadata summarization failed: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple text chunks in batch
 * This is more efficient than calling generateEmbedding multiple times
 *
 * @param {Array<string>} texts - Array of text chunks to embed
 * @returns {Promise<Array<number[]>>} Array of 768-dimensional embedding vectors
 */
export async function generateBatchEmbeddings(texts) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts must be a non-empty array');
    }

    console.log(`[Embeddings] Generating vectors for ${texts.length} chunks in batch...`);

    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Process all chunks in parallel for maximum speed
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const truncatedText = text.substring(0, 10000);
        const result = await model.embedContent(truncatedText);

        if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
          throw new Error('Invalid embedding response from Google API');
        }

        return result.embedding.values;
      })
    );

    // Validate all vectors
    embeddings.forEach((vector, index) => {
      if (vector.length !== 768) {
        throw new Error(`Expected 768-dimensional vector for chunk ${index}, got ${vector.length}`);
      }
    });

    console.log(`[Embeddings] Successfully generated ${embeddings.length} vectors (768D each)`);

    return embeddings;

  } catch (error) {
    console.error('[Embeddings] Error generating batch embeddings:', error.message);
    throw new Error(`Batch embedding generation failed: ${error.message}`);
  }
}

/**
 * Process content with chunking: summarize AND generate embeddings for chunks
 * This is the new main function used by the worker for better search quality
 *
 * @param {string} content - The extracted content
 * @param {string} url - The source URL
 * @param {string} title - The bookmark title (optional)
 * @returns {Promise<Object>} Summary and chunk embeddings
 */
export async function processContentWithChunking(content, url, title = '') {
  try {
    console.log(`[Gemini] Processing content with chunking for: ${url}`);

    // Import chunking utilities
    const { createSmartChunks, createChunkContext } = await import('../utils/text-chunking.js');

    // Run summarization in parallel with chunk creation
    const [summary] = await Promise.all([
      summarizeContent(content, url)
    ]);

    // Create smart chunks (paragraph-aware)
    const chunks = createSmartChunks(content, 2000, 200);

    console.log(`[Gemini] Created ${chunks.length} chunks for embedding`);

    // Create context-aware text for each chunk
    const chunkTexts = chunks.map(chunk =>
      createChunkContext(title || summary.title, chunk.text, chunk.index, chunk.total_chunks)
    );

    // Generate embeddings for all chunks in batch
    const embeddings = await generateBatchEmbeddings(chunkTexts);

    // Combine chunks with their embeddings
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index]
    }));

    return {
      title: summary.title,
      description: summary.description,
      tags: summary.tags,
      chunks: chunksWithEmbeddings  // Array of chunks with embeddings
    };

  } catch (error) {
    console.error('[Gemini] Error processing content with chunking:', error.message);
    throw error;
  }
}

/**
 * Rerank search results using LLM-based relevance scoring
 * This is more accurate than pure vector similarity for the top results
 *
 * @param {string} query - User's search query
 * @param {Array<Object>} results - Top search results to rerank (typically 10-20)
 * @returns {Promise<Array>} Reranked results with relevance scores
 */
export async function rerankResults(query, results) {
  try {
    if (!results || results.length === 0) {
      return results;
    }

    if (results.length === 1) {
      // No need to rerank a single result
      return results.map(r => ({ ...r, rerank_score: 1.0 }));
    }

    console.log(`[Gemini] Reranking ${results.length} results for query: "${query}"`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare results for reranking (use titles and descriptions)
    const resultsForReranking = results.map((r, idx) => ({
      index: idx,
      title: r.title || 'Untitled',
      description: (r.description || '').substring(0, 300) // Limit description length
    }));

    const prompt = `You are a search relevance expert. Given a search query and a list of bookmarks, score each bookmark's relevance to the query on a scale of 0-10.

Query: "${query}"

Bookmarks:
${resultsForReranking.map((r, i) => `${i + 1}. ${r.title}\n   ${r.description}`).join('\n\n')}

Respond with ONLY a JSON array of relevance scores (0-10) in the same order as the bookmarks. Higher scores mean more relevant.
Example: [8, 5, 9, 3, 7]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\d,\s]+\]/);
    if (!jsonMatch) {
      console.error('[Gemini] Failed to parse reranking scores, using original order');
      return results.map(r => ({ ...r, rerank_score: r.score }));
    }

    const scores = JSON.parse(jsonMatch[0]);

    // Validate scores array length
    if (scores.length !== results.length) {
      console.error(`[Gemini] Score count mismatch (${scores.length} vs ${results.length}), using original order`);
      return results.map(r => ({ ...r, rerank_score: r.score }));
    }

    // Attach rerank scores to results
    const rerankedResults = results.map((result, idx) => ({
      ...result,
      rerank_score: scores[idx] / 10.0 // Normalize to 0-1
    }));

    // Sort by rerank score
    rerankedResults.sort((a, b) => b.rerank_score - a.rerank_score);

    console.log(`[Gemini] Reranking complete. Top result: "${rerankedResults[0].title}" (score: ${rerankedResults[0].rerank_score})`);

    return rerankedResults;

  } catch (error) {
    console.error('[Gemini] Error reranking results:', error.message);
    // Return original results on error
    return results.map(r => ({ ...r, rerank_score: r.score }));
  }
}

/**
 * Test Gemini service
 */
export async function testGeminiService() {
  try {
    console.log('[Gemini] Testing service...');

    const testContent = `Artificial Intelligence (AI) is transforming the way we work and live.
    Machine learning algorithms can now process vast amounts of data and make predictions
    with remarkable accuracy. This technology is being applied across industries, from
    healthcare to finance to transportation.`;

    const result = await processContent(testContent, 'https://example.com/ai-article');

    console.log('[Gemini] Test successful:', {
      title: result.title,
      descriptionLength: result.description.length,
      embeddingDimensions: result.embedding.length
    });

    return true;
  } catch (error) {
    console.error('[Gemini] Test failed:', error.message);
    return false;
  }
}
