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

// Note: Environment variables are loaded in index.js

// Initialize Gemini API safely
export let genAI;

if (process.env.GOOGLE_AI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    console.log('✅ Gemini AI initialized');
  } catch (err) {
    console.error('❌ Gemini AI failed to initialize:', err.message);
  }
} else {
  console.warn('⚠️ GOOGLE_AI_API_KEY not found');
}

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
    if (!genAI) {
      throw new Error('Gemini AI is not initialized. Check your GOOGLE_AI_API_KEY.');
    }

    // Using the stable and available gemini-embedding-001 model
    const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });

    const result = await model.embedContent({
      content: { parts: [{ text: text.substring(0, 10000) }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 3072
    });

    if (!result.embedding || !result.embedding.values) {
      throw new Error('Invalid embedding response from Gemini');
    }

    const vector = result.embedding.values;
    console.log(`[Embeddings] Successfully generated ${vector.length}D vector`);
    return vector;

  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

// Helper to ensure database compatibility
function padTo3072(values) {
  if (values.length === 3072) return values;
  const padded = new Array(3072).fill(0);
  for (let i = 0; i < Math.min(values.length, 3072); i++) padded[i] = values[i];
  return padded;
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
    if (!genAI) {
      throw new Error('Gemini AI is not initialized. Check your GOOGLE_AI_API_KEY.');
    }

    const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });

    // Process all chunks in parallel for maximum speed
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const truncatedText = text.substring(0, 10000);
        const result = await model.embedContent({
          content: { parts: [{ text: truncatedText }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 3072
        });

        if (!result.embedding || !result.embedding.values || !Array.isArray(result.embedding.values)) {
          throw new Error('Invalid batch embedding response from Gemini');
        }

        return result.embedding.values;
      })
    );

    console.log(`[Embeddings] Successfully generated ${embeddings.length} vectors`);
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
 * Generate a RAG-based answer from search results
 * 
 * @param {string} query - The user's search query
 * @param {Array} results - The top search results with text content
 * @returns {Promise<Object>} The generated answer and citations
 */
export async function generateSearchAnswer(query, results) {
  try {
    if (!results || results.length === 0) return null;

    console.log(`[Gemini] Generating RAG answer for query: "${query}" using ${results.length} sources`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare context from results
    // We use the first few matches to keep context clean
    const sources = results.slice(0, 5).map((r, i) => ({
      id: r.id,
      index: i + 1,
      title: r.title || 'Untitled Source',
      content: r.text || r.description || ''
    }));

    const context = sources.map(s => `[Source ${s.index}]: ${s.title}\n${s.content}`).join('\n\n');

    const prompt = `You are a helpful assistant for "BookSmart", an AI-powered bookmark manager.
Your task is to provide a concise "AI Overview" answer to the user's query based ONLY on the provided bookmark snippets.

Query: "${query}"

Context from user's bookmarks:
${context}

Instructions:
1. Provide a clear, direct answer in 2-4 sentences if possible.
2. If the bookmarks don't contain enough information to answer the query, say so politely.
3. Use markdown for formatting (bolding key terms).
4. CITATIONS ARE MANDATORY: Use [1], [2], etc. to cite information from the specific sources.
5. Keep the tone professional but helpful.

Respond with a JSON object:
{
  "answer": "The generated text with [1] citations...",
  "sources": [
    {"index": 1, "id": "uuid", "title": "Source Title"},
    ...
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback if AI didn't return clean JSON
      return {
        answer: text,
        sources: sources.map(s => ({ index: s.index, id: s.id, title: s.title }))
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      answer: parsed.answer,
      sources: parsed.sources || sources.map(s => ({ index: s.index, id: s.id, title: s.title }))
    };

  } catch (error) {
    console.error('[Gemini] Error generating search answer:', error.message);
    return null;
  }
}

/**
 * Suggest tags for a new page based on title and snippet
 * 
 * @param {string} title - Page title
 * @param {string} content - Snippet of page content
 * @returns {Promise<Array>} List of suggested tags
 */
export async function suggestTags(title, content = '') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `You are a professional librarian for "BookSmart". 
Suggest 3-5 concise, professional tags for this page.

Title: ${title}
Context: ${content.substring(0, 500)}

Respond with ONLY a JSON array of strings.
Example: ["Technology", "AI", "Research"]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return ["General"];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[Gemini] Error suggesting tags:', error.message);
    return ["General"];
  }
}

/**
 * Generate a deep, structured summary for a long-form article or paper
 * 
 * @param {string} content - The full extracted content
 * @param {string} title - The original title
 * @returns {Promise<Object>} Structured summary object
 */
export async function generateDeepSummary(content, title) {
  try {
    console.log(`[Gemini] Generating deep summary for: "${title}" (${content.length} chars)`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Truncate to a reasonable limit for summarization (e.g., 30,000 characters)
    const truncatedContent = content.substring(0, 30000);

    const prompt = `You are an expert content analyzer. Provide a deep, structured summary of the following content.
    
    Original Title: ${title}
    
    Content:
    ${truncatedContent}
    
    Format your response as a JSON object with the following structure:
    {
      "tldr": "A 1-2 sentence high-level summary of the core message.",
      "key_takeaways": [
        "A list of 3-5 specific, actionable, or insightful points learned from the content.",
        "Each point should be a complete sentence."
      ],
      "analysis": "A brief (2-3 sentence) analysis of the content's significance, target audience, or unique perspective.",
      "reading_time_minutes": 5,
      "category": "The most appropriate category (e.g. Technology, Business, Science, Health, etc.)"
    }
    
    Ensure the tone is professional yet accessible. Do not include any text outside the JSON block.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini deep summary response as JSON');
    }

    const summary = JSON.parse(jsonMatch[0]);
    console.log(`[Gemini] Deep summary generated successfully for: "${title}"`);

    return summary;

  } catch (error) {
    console.error('[Gemini] Error generating deep summary:', error.message);
    throw new Error(`Deep summarization failed: ${error.message}`);
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

/**
 * Generate a refined web search query based on an AI overview
 * 
 * @param {string} originalQuery - The user's original search query
 * @param {string} overview - The AI overview generated from bookmarks
 * @returns {Promise<string>} A refined search query for the web
 */
export async function generateWebSearchQuery(originalQuery, overview) {
  try {
    if (!genAI) {
      throw new Error('Gemini AI is not initialized');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a research assistant for "BookSmart". 
A user has performed a search in their personal bookmarks and received an AI overview. 
Now, the user wants to expand their research to the wider web to find NEW information NOT covered in the overview.

Original User Query: "${originalQuery}"
AI Overview of existing bookmarks:
"${overview}"

Your task is to generate ONE single, highly-effective web search query (e.g. for Google) that:
1. Targets gaps or missing details in the current overview.
2. Expands on the original query with more professional, technical, or scientific terms if appropriate.
3. Is optimized for finding fresh, authoritative, and relevant material on the web.

Respond with ONLY the search query string. No quotes, no explanations, no prefix.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().replace(/^["']|["']$/g, '');
    
    console.log(`[Gemini] Generated refined web search query: "${text}"`);
    return text;
  } catch (error) {
    console.error('[Gemini] Error generating web search query:', error.message);
    return originalQuery; // Fallback to original query
  }
}
