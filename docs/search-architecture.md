# BookSmart Search Architecture

This document describes the current search methodology for the BookSmart Manager, from the user's input to the final results.

## Search Pipeline Flow

### 1. Frontend Trigger (`manager/src/store/useBookmarkStore.js`)
*   **Debounce**: User input is debounced (300-500ms).
*   **Action**: Calls `POST /api/search` with the current query and active filters (tags, folders).

### 2. Intent Parsing & Logic (`backend/src/services/search.service.js`)
*   **AI Intent Extraction**: For queries longer than 3 words, the system uses **Gemini** to extract structured filters (e.g., "from last month") from natural language.
*   **Vector Generation**: The query is sent to **Gemini/OpenAI** to generate a semantic embedding (vector).

### 3. Hybrid Retrieval
*   **Semantic Retrieval**: Queries **Qdrant** for chunks of content matching the vector.
*   **Keyword Scoring (BM25)**: Matches exact keywords within the semantic results to boost relevance.
*   **De-duplication**: Results are aggregated by their parent `bookmark_id` (since one bookmark has multiple chunks).

### 4. Advanced Post-Processing
*   **LLM Reranking**: The top 10 results are sent to Gemini to be re-evaluated and sorted for maximum precision.
*   **RAG Generation**: Gemini generates a direct answer/summary based on the retrieved bookmarks.

---

## Performance Bottlenecks

| Step | Component | Typical Latency | Impact |
| :--- | :--- | :--- | :--- |
| **Intent Parsing** | Gemini LLM | 1.0 - 2.0s | High |
| **Embedding** | Gemini API | 0.5 - 1.0s | Medium |
| **Vector Search** | Qdrant | 0.1 - 0.3s | Low |
| **Reranking** | Gemini LLM | 2.0 - 4.0s | **Critical** |
| **RAG Answer** | Gemini LLM | 2.0 - 3.0s | **Critical** |

---

## Future Optimization Roadmap

1.  **Fast-Track Path**: Skip LLM Intent Parsing and Reranking for queries < 3 words.
2.  **Parallel Execution**: Fire the Vector search and Intent Parsing simultaneously.
3.  **Local "First-Response"**: Implement a simple client-side search on the currently loaded bookmarks for immediate feedback.
4.  **Deep Search Toggle**: Move Reranking and RAG generation behind an explicit "Deep Search" button.
