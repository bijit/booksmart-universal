# BookSmart Product Roadmap & Architecture

## Core Philosophy: Privacy-First Freemium
The application will follow a tiered model that balances user privacy and high-performance cloud features.

### Tier 1: Local-First (FREE)
**Objective:** A completely private, client-side only experience with no external data transmission.
- **Content Extraction:** Native `Readability.js` running in the extension.
- **AI Processing:** Uses Chrome's built-in **Gemini Nano** (`window.ai`) for:
    - Automatic tagging based on page content.
    - Folder suggestions for new bookmarks.
    - Multi-bookmark summarization.
- **Search:** Local semantic and full-text search using **Orama** or **Transformers.js** stored in `IndexedDB`.
- **Privacy:** 100% on-device. Zero server costs for the developer.

### Tier 2: Cloud Sync & Power Features (PREMIUM)
**Objective:** Seamless access across devices and high-scale processing using the GCP backend.
- **Cross-Device Sync:** Syncing bookmarks and search indices via **Supabase**.
- **Global Search:** Access to the full vector database (**Qdrant**) via a web interface or mobile app.
- **Bulk Operations:** 
    - Automated crawling and indexing of legacy bookmark exports (thousands of links).
    - Advanced deduplication and merging of multiple bookmark folders.
- **Advanced AI:** Access to larger models (Gemini Pro) for deep research and complex queries that exceed local hardware capabilities.

## Technical Tasks to Explore
1. **Local AI Integration:** Prototype `chrome.aiOriginTrial` or the `LanguageModel` API.
2. **Local Vector Store:** Experiment with `Orama` for browser-based vector similarity search.
3. **Hybrid Sync Logic:** Develop a "local-to-cloud" sync engine that keeps local performance but pushes updates to Supabase.
