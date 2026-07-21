# Future Search & AI Experiences

This document outlines advanced, highly expressive search paradigms to unlock for premium users, building upon the conversational RAG and web escalation capabilities.

## 1. Cross-Document Synthesis & Reporting (The "Analyst")
Right now, search finds the *best single answer*. Synthesis would read *everything* the user has saved on a topic and generate a comprehensive report.
*   **User Query:** *"Summarize everything I've saved about 'Agentic AI frameworks' over the last year. Create a comparison table of the frameworks mentioned, and list the pros and cons of each based on my bookmarks."*
*   **How it works:** The system retrieves 20-30 documents, uses a map-reduce LLM approach to extract the relevant data from each, and synthesizes a structured, cited markdown report.

## 2. Multi-Modal "Visual" Search (The "Photographic Memory")
Since the app extracts images and PDFs, visual content can be indexed, not just text.
*   **User Query:** *"Find that infographic I saved that had a blue flowchart about machine learning."* or *"Show me all the architecture diagrams I've bookmarked."*
*   **How it works:** Using Gemini's multi-modal embedding models (like Vision), images within bookmarks are embedded into Qdrant. Users can search by describing what an image looked like, rather than just the text on the page.

## 3. Agentic Task Execution (The "Do-er")
Search shouldn't just retrieve information; it can act on it using Agentic workflows.
*   **User Query:** *"Find all the cooking recipes I bookmarked this month and generate a combined grocery shopping list."*
*   **User Query:** *"Look at all my saved job postings and draft a cover letter highlighting my skills in Python and React based on the common requirements in those links."*
*   **How it works:** The search becomes an "Agent." It retrieves the documents, extracts the structured data (ingredients, job requirements), and executes a specific generative task.

## 4. Proactive / Ambient Discovery (The "Co-Pilot")
Instead of waiting for the user to search, the app actively connects the dots as the user consumes information.
*   **Experience:** When the user saves a new article about "React Server Components," the Chrome extension immediately pops up: *"This builds on an article you saved 6 months ago, but contradicts the caching strategy mentioned in [Link]."*
*   **How it works:** Background workers constantly run semantic similarity checks between newly imported items and the existing Qdrant database, proactively identifying clusters, contradictions, or updates in the user's knowledge base.

## 5. Temporal & Relational Search (The "Time Traveler")
Sometimes users remember *when* or *how* they found something, rather than what it was.
*   **User Query:** *"What was that long article about economics I was reading the same week I bookmarked the Tesla earnings report?"*
*   **User Query:** *"How has the sentiment around 'remote work' changed in the articles I've saved between 2021 and 2025?"*
*   **How it works:** Combining vector search with strict metadata filtering (timestamps, reading duration, source domains) allows hybrid queries that rely heavily on the user's personal timeline.

## 6. Premium Vertical Search Profiles (Category-Specific RAG)
Allow premium users to filter and search their library using custom domain schemas. The system dynamically adjusts its parsing models, metadata tags, and UI rendering depending on the nature of the bookmarked page:
*   **✈️ Wanderlust Planner (Travel & Destinations):** Extracts cities/countries, prices, hotel details, and best-visit seasons. Renders bookmark cards with interactive maps, location summaries, and seasonal guidelines.
*   **🍽️ Epicurean's Journal (Dining & Gastronomy):** Extracts cuisine styles, dietary tags (vegan, gluten-free), reservation links, and ingredients. Displays pricing tiers, reservations call-to-actions, and interactive recipe checklists.
*   **🛒 Smart Shopper (Tech Specs & Product Deals):** Extracts model specs, pricing lists, coupon codes, and shipping rules. Enables query filters like *"laptop with 32GB RAM under $1000"* and highlights active price drops.
*   **🎓 Scholar's Desk (Academic & Research):** Extracts author details, publication years, methodologies, and hypotheses. Renders abstract digests on cards and supports exporting citations to APA, MLA, or BibTeX format.
*   **💻 Dev Stack (Code & Documentation):** Extracts code syntax blocks, APIs, and frameworks used. Renders syntax-highlighted boxes on cards with one-click clipboard copying.
*   **Implementation Strategy:** Gemini categorizes bookmarks on ingestion. Category keys are written as metadata tags in Qdrant for fast query filtering, and the React frontend renders customized cards dynamically.

## 7. Frontend Technological Alignment
To ensure instant load times (<100ms) for the Chrome extension popup while delivering a premium, highly animated search and navigation dashboard:
*   **Chrome Extension Popup:** Utilize **Svelte** (or lightweight vanilla JS). Svelte compiles down to minimal, zero-dependency JavaScript, eliminating framework runtime overhead and guaranteeing instant popup renders.
*   **Web Manager Dashboard:** Stick to **React/Next.js** paired with **Framer Motion** for physics-based, fluid micro-animations (e.g. card expansions, timeline transitions) and Tailwind CSS/Shadcn for design system consistency. This keeps the application SEO-friendly and extremely responsive.

## 8. The Context Engine & Chrome Extension Search Bridge

This feature transforms the user's private bookmark database into an active, context-generating launcher for open-web searches. 

### A. UX & Interaction Model
1. **Google/Search Engine Interception:** The Chrome extension runs content scripts on main search engines (Google, Bing, DuckDuckGo, arXiv). When it detects a search query input, it sends a message containing the query to the background service worker.
2. **Local Cache / Fast Vector Query:** The service worker runs a quick ANN (Approximate Nearest Neighbor) check or hits the fast search API of the backend to see if the user's database contains relevant bookmarks.
3. **In-Page Widget & Chrome Side Panel:** If relevant matches are found, the extension injects a subtle Booksmart pill or expands the Chrome Side Panel. 
   * **Shadow DOM Isolation:** To prevent Google/arXiv's complex stylesheets from overriding the widget styles, widgets are injected into a Shadow DOM container.
   * **Svelte-based Side Panel:** A Svelte-based side panel launches dynamically, listing matching bookmarks and letting the user check/uncheck bookmarks to toggle their inclusion in the search context.
4. **Execution:** Clicking the button compiles a context-guided web query, redirects the search page (or updates the query input), and highlights semantic overlaps.

### B. Technical Architecture & Data Flow
1. **Content Script Query Capture:** Detects the page URL (e.g. `google.com/search?q=...`) or captures form inputs, extracting the raw string `original_query`.
2. **Background Context Fetching:** Send `original_query` to `background.js` via `chrome.runtime.sendMessage`. The service worker makes an authenticated `POST` request to the backend endpoint `/api/search/context-bridge` with `{ query: original_query }`.
3. **Backend Synthesizer:**
   * Retrieves the top 3-5 relevant bookmark chunks from Qdrant using hybrid vector search.
   * Feeds the query + chunks to Gemini with a structured prompt.
   * **Prompt Structure & Output Schema:**
     ```javascript
     const prompt = `
     You are a web search query architect. A user is searching the web for: "${originalQuery}".
     They have the following context saved in their Booksmart library:
     ${JSON.stringify(retrievedChunks)}

     Generate a JSON object containing:
     1. "refinedWebQuery": A query optimized with Google advanced search operators (OR, site:, filetype:) utilizing terms from their context, targeting GAPS in their library.
     2. "negativeKeywords": Terms/domains to exclude (e.g. -site:alreadybookmarked.com).
     3. "llmGroundingContext": A 2-sentence summary of what they already know, formatted to paste into AI tools.
     `;
     ```
4. **Injection/Redirect:** The background worker updates the active tab URL with the advanced query parameter (e.g., `window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(data.refinedWebQuery)`), forcing a Google search reload with highly refined search terms.
5. **Conversational Grounding:** If the user is on ChatGPT or Gemini web clients, the extension content script intercepts the textarea/prompt box and injects a clipboard-ready context block: *"I am researching [query]. Here is what I already know from my library: [brief synthesized list of papers/concepts]. Find new information that builds on this."*

## 9. Conversational & Multi-Turn Natural Language Query Capture (AI Search Trails)

This feature empowers BookSmart to capture conversational, multi-turn, natural language search sessions from modern search and AI web applications (Google Search / AI Overviews, ChatGPT, Claude, Perplexity, and Gemini).

### A. Core Concept & Value Proposition
Today, user intent is fragmented across AI platforms—OpenAI has ChatGPT logs, Google has Search History, and Anthropic has Claude history. BookSmart acts as a **neutral, unified context aggregator** by capturing these multi-turn interactions directly from the browser tab and storing them in the user's encrypted Context Vault.

Instead of just saving a destination URL (e.g., `github.com/facebook/memlab`), BookSmart captures the **problem-solving journey** leading up to it:
* **Turn 1:** *"What causes memory leaks in Node service workers?"*
* **Turn 2:** *"How to take a V8 heap snapshot programmatically?"*
* **Turn 3:** *"Compare memlab vs clinic.js"*
* **Saved Bookmark:** `https://github.com/facebook/memlab`

Six months later, when reviewing the bookmark, BookSmart shows: *"Saved while researching Node service worker memory leaks across Google & Perplexity on July 20th."*

### B. Capture Mechanisms in Chrome Extension
Content scripts utilize three non-intrusive, zero-overhead browser hooks:
1. **URL Parameter Parsing:** Extracts `?q=...` parameters from Google, Bing, and DuckDuckGo instantly on page load.
2. **DOM Event Listeners:** Attaches to `submit` events and `Enter` keypresses on search bars and chat textareas.
3. **MutationObservers for AI Chat Interfaces:** Listens for DOM mutations on ChatGPT (`chatgpt.com`), Claude (`claude.ai`), and Perplexity (`perplexity.ai`) to capture multi-turn prompt & response node pairs.

### C. Data Schema & Encryption
Search threads are structured as `ContextThread` records containing query chains, platform origins, timestamps, and associated bookmark IDs. payloads are encrypted client-side using **AES-256-GCM** before being dispatched to the database, ensuring zero-knowledge privacy.

## 10. BookSmart Grounded Search & Context Workbench (BYOK)

This premium feature transforms BookSmart from a search/reading memory vault into a **Context Workbench**—assembling past research, knowledge gaps, and bookmarked insights to ground new AI searches using the user's own API keys (OpenAI, Anthropic, Perplexity, Gemini, Local LLMs) at zero markup cost.

### A. Bring Your Own Key (BYOK) Security Architecture
* **Client-Side Storage**: Users input raw API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, etc.) which are encrypted locally using AES-256-GCM via the Web Crypto API.
* **Direct Proxy Execution**: LLM/Search API requests are dispatched directly from the client extension/browser to provider endpoints, ensuring API keys never touch BookSmart backend servers.

### B. Context Orchestration & Prompt Construction Engine
Before executing a new query across any selected LLM, BookSmart runs a 3-step pipeline:
1. **Memory Retrieval**: Runs hybrid vector + temporal search across the user's vault to pull top 5-10 relevant bookmarks, notes, and past search threads.
2. **Context Inspector ("Glass Box" Privacy)**: Displays a transparent UI drawer showing the exact chunks of personal context attached, allowing users to uncheck unwanted items.
3. **Grounded Prompt Assembly**: Injects background context, user knowledge state, and specific knowledge gaps into a structured system prompt, preventing the AI from repeating basic concepts the user already understands.

### C. Execution Modes & Supported Providers
* **Mode A (Manager Dashboard Workbench)**: A unified search & chat interface inside BookSmart with a model dropdown selector (`GPT-4o`, `Claude 3.5 Sonnet`, `Perplexity Sonar`, `Gemini 1.5 Pro`, `Local Llama 3 via Ollama`) and a side-by-side bookmark citation panel.
* **Mode B (Native Interface Assistant)**: Injects an *"Attach BookSmart Context"* button into `chatgpt.com`, `perplexity.ai`, and `google.com` to prepend optimal vault context with one click.

## 11. AI Text-to-Speech (TTS) & Daily Audio Briefings (Accessibility & Commute Mode)

This feature adds high-fidelity audio capabilities to BookSmart, transforming saved bookmarks, AI summaries, and research trails into a hands-free auditory experience for users on their commutes, exercising, or managing reading difficulties (dyslexia, ADHD, eye strain).

### A. Dual-Tier Implementation
* **Tier 1: Free Browser Native TTS (Web Speech API)**: Uses `window.speechSynthesis` for zero-cost, offline, instant playback of TL;DRs and summaries in the dashboard and extension.
* **Tier 2: Pro Neural AI Voices (OpenAI TTS & ElevenLabs)**: Uses OpenAI `tts-1` (`nova`, `onyx`, `alloy`) or ElevenLabs for hyper-realistic human voice playback, variable speeds (1.0x - 2.0x), and audio streaming.

### B. Pro Feature: "AI Daily Audio Briefing"
Synthesizes the user's daily saved bookmarks and research trails into a 3-minute personalized audio digest:
*"Good morning! Here is your 3-minute BookSmart Audio Briefing. Today you saved 3 papers on hybrid search and 1 update on React 19..."*

### C. UX Controls
* **Mini-Player Bar**: Sticky audio controls at the bottom of the Manager app with scrubber, playback speed selector, and bookmark citations.
* **Extension Background Audio**: Background service worker audio playback allowing users to listen to summaries while browsing other tabs.

## 12. Chat with BookSmart: Conversational Voice & Task Agent (Multi-Turn Epistemic Memory)

This feature enables an interactive conversational copilot (spoken or written) that maintains state across multi-turn queries, allowing users to give ordinal and relational commands over their library (e.g. *"Find 3 butter chicken recipes" -> "Read the ingredients for the second one" -> "Which has better reviews out of the 1st and 2nd?"*).

### A. Technical Pillars
1. **Conversational Entity Reference Resolution**: Maintains session memory linking ordinal references ("item 1", "the 2nd recipe") to active `bookmark_id`s in current context.
2. **Agentic Tool Use & Function Calling**: LLM invokes structured API tools:
   * `search_library(query, category)`
   * `extract_section(bookmark_id, section_type)` (e.g., ingredients, code blocks, citations, methodology)
   * `compare_metadata(bookmark_ids, criteria)` (ratings, dates, prices)
3. **Speech-to-Speech Streaming (Hands-Free Mode)**: Web Speech API / OpenAI Whisper (STT) combined with OpenAI TTS / Web Speech for continuous hands-free interaction.

### B. High-Value Use Cases
* **🍳 Hands-Free Cooking Assistant**: *"Read step 3,"* *"Substitute heavy cream,"* *"Read ingredient list for recipe #2."*
* **🔬 Research & Literature Review**: *"Find 3 papers on Qdrant,"* *"Read methodology for paper #1,"* *"Which was published most recently?"*
* **🛒 Spec & Product Comparisons**: *"Find the 3 bookmarked laptops,"* *"Which one has 32GB RAM under $1,200?"*
