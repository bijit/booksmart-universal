/**
 * Text Matching Utilities
 *
 * Provides BM25 scoring and text matching algorithms with stemming support
 */

import natural from 'natural';

// Initialize Porter Stemmer for English
const stemmer = natural.PorterStemmer;
const tokenizer = new natural.WordTokenizer();

/**
 * Tokenize and stem text
 *
 * @param {string} text - Text to tokenize and stem
 * @returns {Array<string>} Array of stemmed tokens
 */
export function tokenizeAndStem(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Tokenize
  const tokens = tokenizer.tokenize(text.toLowerCase());

  // Stem each token
  return tokens.map(token => stemmer.stem(token));
}

/**
 * Calculate BM25 score for a document given a query
 *
 * BM25 is a ranking function used by search engines to estimate the relevance
 * of documents to a given search query.
 *
 * @param {Array<string>} queryTerms - Stemmed query terms
 * @param {Array<string>} docTerms - Stemmed document terms
 * @param {number} avgDocLength - Average document length in corpus
 * @param {Object} idfScores - IDF scores for each term
 * @param {number} k1 - Term frequency saturation parameter (default: 1.5)
 * @param {number} b - Length normalization parameter (default: 0.75)
 * @returns {number} BM25 score
 */
export function calculateBM25(queryTerms, docTerms, avgDocLength, idfScores = {}, k1 = 1.5, b = 0.75) {
  if (!queryTerms || queryTerms.length === 0 || !docTerms || docTerms.length === 0) {
    return 0;
  }

  // Count term frequencies in document
  const termFreqs = {};
  for (const term of docTerms) {
    termFreqs[term] = (termFreqs[term] || 0) + 1;
  }

  const docLength = docTerms.length;
  let score = 0;

  // Calculate BM25 score for each query term
  for (const qTerm of queryTerms) {
    const tf = termFreqs[qTerm] || 0;

    if (tf === 0) continue;

    // IDF score (use provided or estimate)
    const idf = idfScores[qTerm] || 1.0;

    // BM25 formula
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));

    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Simple BM25 scorer for small document collections
 * Estimates IDF from the current document set
 *
 * @param {string} query - Search query
 * @param {Array<Object>} documents - Array of documents with title and description
 * @returns {Array<Object>} Documents with BM25 scores
 */
export function scoreBM25(query, documents) {
  if (!query || !documents || documents.length === 0) {
    return documents.map(doc => ({ ...doc, bm25_score: 0 }));
  }

  // Tokenize and stem query
  const queryTerms = tokenizeAndStem(query);

  if (queryTerms.length === 0) {
    return documents.map(doc => ({ ...doc, bm25_score: 0 }));
  }

  // Tokenize and stem all documents
  const processedDocs = documents.map(doc => {
    const titleTerms = tokenizeAndStem(doc.title || '');
    const descTerms = tokenizeAndStem(doc.description || '');
    const notesTerms = tokenizeAndStem(doc.notes || '');
    const authorTerms = tokenizeAndStem(doc.author || '');
    const siteTerms = tokenizeAndStem(doc.site_name || '');
    const tagsTerms = (doc.tags || []).flatMap(tag => tokenizeAndStem(tag));
    
    const allTerms = [...titleTerms, ...descTerms, ...notesTerms, ...authorTerms, ...siteTerms, ...tagsTerms];

    return {
      ...doc,
      _terms: allTerms,
      _titleTerms: titleTerms,
      _descTerms: descTerms
    };
  });

  // Calculate average document length
  const totalTerms = processedDocs.reduce((sum, doc) => sum + doc._terms.length, 0);
  const avgDocLength = totalTerms / processedDocs.length;

  // Calculate IDF scores for query terms
  const N = processedDocs.length;
  const idfScores = {};

  for (const qTerm of queryTerms) {
    // Count documents containing this term
    const docsWithTerm = processedDocs.filter(doc => doc._terms.includes(qTerm)).length;

    // IDF formula: log((N - df + 0.5) / (df + 0.5) + 1)
    idfScores[qTerm] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
  }

  // Calculate BM25 score for each document
  const scoredDocs = processedDocs.map(doc => {
    const bm25Score = calculateBM25(queryTerms, doc._terms, avgDocLength, idfScores);

    // Clean up temporary fields
    delete doc._terms;
    delete doc._titleTerms;
    delete doc._descTerms;

    return {
      ...doc,
      bm25_score: bm25Score
    };
  });

  return scoredDocs;
}

/**
 * Enhanced text matching with stemming
 * Returns a score based on how many query terms match the document
 *
 * @param {string} query - Search query
 * @param {string} title - Document title
 * @param {string} description - Document description
 * @returns {number} Match score (0-1)
 */
export function enhancedTextMatch(query, bookmark = {}) {
  const { title = '', description = '', notes = '', author = '', site_name = '', tags = [] } = bookmark;
  
  const queryTerms = tokenizeAndStem(query);
  const titleTerms = tokenizeAndStem(title);
  const descTerms = tokenizeAndStem(description);
  const notesTerms = tokenizeAndStem(notes);
  const authorTerms = tokenizeAndStem(author);
  const siteTerms = tokenizeAndStem(site_name);
  const tagsTerms = tags.flatMap(tag => tokenizeAndStem(tag));

  if (queryTerms.length === 0) {
    return 0;
  }

  let score = 0;
  let matchedTerms = 0;

  for (const qTerm of queryTerms) {
    let termMatched = false;

    // Check title (higher weight)
    if (titleTerms.includes(qTerm)) {
      score += 0.4;
      termMatched = true;
    }

    // Check description (medium weight)
    if (descTerms.includes(qTerm)) {
      score += 0.2;
      termMatched = true;
    }

    // Check notes (medium-high weight since user wrote them)
    if (notesTerms.includes(qTerm)) {
      score += 0.3;
      termMatched = true;
    }

    // Check tags (high weight)
    if (tagsTerms.includes(qTerm)) {
      score += 0.4;
      termMatched = true;
    }

    // Check metadata (lower weight)
    if (authorTerms.includes(qTerm) || siteTerms.includes(qTerm)) {
      score += 0.15;
      termMatched = true;
    }

    if (termMatched) {
      matchedTerms++;
    }
  }

  // Bonus for matching all query terms
  if (matchedTerms === queryTerms.length && queryTerms.length > 1) {
    score += 0.2;
  }

  // Normalize to 0-1 range
  return Math.min(score, 1.0);
}

/**
 * Fuzzy string matching using Levenshtein distance
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, 1 = identical)
 */
export function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0;

  const distance = natural.LevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1;

  return 1 - (distance / maxLength);
}
