/**
 * Google Gemini AI Service
 *
 * Handles content summarization and embedding generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

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

The title should be clear and informative. The description should capture the main topic or purpose.

URL: ${url}

Content:
${truncatedContent}

Respond in JSON format:
{
  "title": "your generated title here",
  "description": "your generated description here"
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

    console.log(`[Gemini] Successfully generated summary: "${summary.title}"`);

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
      embedding: embedding
    };

  } catch (error) {
    console.error('[Gemini] Error processing content:', error.message);
    throw error;
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
