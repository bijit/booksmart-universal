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
