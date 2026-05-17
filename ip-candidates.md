# Intellectual Property & Research Candidates in Personal Knowledge RAG

This document outlines hard algorithmic problems within the BookSmart search ecosystem that present opportunities for novel intellectual property, patents, or academic publications.

## 1. Dynamic Knowledge Graph Maintenance & "Belief Resolution"
*   **The Hard Problem:** Standard RAG chunks text blindly. A user's bookmark library is a living, evolving corpus. If a user bookmarks an article in 2023 stating "React is best for X," and one in 2026 stating "HTMX replaces React for X," how does the system synthesize this without hallucinating or just concatenating contradictory chunks?
*   **Novel Algorithmic Solution:** An algorithm for **Incremental Temporal Knowledge Graph Merging**. Instead of just indexing chunks, the system actively extracts entity-relationship triples in the background. When new bookmarks contradict old ones, the algorithm detects "Concept Drift" and maps the evolution of a topic over time. 
*   **IP Potential:** A specific method for resolving contradictions in private, temporally dispersed datasets without requiring full LLM reprocessing of the entire corpus.

## 2. Time-Warped Vector Spaces (Temporal Semantic Search)
*   **The Hard Problem:** Vector databases encode meaning, but they are blind to the passage of time. If a user searches "state of the art in AI agents", a purely semantic search might return an incredibly relevant but completely outdated article from 2022 over a slightly less perfectly-matched article from yesterday. 
*   **Novel Algorithmic Solution:** A **Joint Spatio-Temporal Embedding Projection**. An algorithm that modifies the vector similarity distance metric (e.g., Cosine Similarity) by projecting a "temporal decay vector" that is dynamically weighted by the LLM's classification of the query's time-sensitivity.
*   **IP Potential:** A proprietary scoring algorithm that successfully fuses high-dimensional semantic embeddings with non-linear temporal decay curves specifically tuned for personal knowledge retrieval.

## 3. Dataset Coverage Confidence & Deterministic Escalation Routing
*   **The Hard Problem:** LLMs are notorious for hallucinating when they don't know the answer. In our "Auto-Escalate to Web" plan, how do you deterministically and mathematically prove that the user's local Qdrant database *lacks* the required information to answer a query, before wasting LLM tokens trying to answer it?
*   **Novel Algorithmic Solution:** A **Vector Space Density and Coverage Metric**. Before sending chunks to the LLM, an algorithm analyzes the local neighborhood of the query vector. It calculates a "coverage score" based on the density, variance, and entropy of the top-K retrieved chunks. If the mathematical coverage score is below a dynamic threshold, it routes directly to the Web Search tool.
*   **IP Potential:** A deterministic, pre-generation routing algorithm for Agentic RAG that drastically reduces hallucinations and compute costs by proving "dataset insufficiency" mathematically.

## 4. Ultra-Lightweight "Serendipity Routing" (Proactive Discovery)
*   **The Hard Problem:** We want the Chrome extension to proactively say, "This page you are reading relates to a bookmark from 3 years ago." Running a full embedding and Qdrant search on every single page the user visits is computationally unfeasible and a privacy nightmare.
*   **Novel Algorithmic Solution:** **Client-Side Semantic Bloom Filters or Quantized Projections**. An algorithm that creates highly compressed, quantized representations of the user's Qdrant database clusters that live locally in the Chrome extension. It performs rapid, low-compute approximate nearest neighbor (ANN) checks directly in the browser to trigger the "Serendipity Alert" only when a high-probability match occurs.
*   **IP Potential:** A privacy-preserving, edge-compute algorithm for continuous semantic background matching against massive personal knowledge bases.

## 5. Multi-Modal Contextual Sub-Graph Matching
*   **The Hard Problem:** Searching for "the diagram showing the microservice architecture" requires the system to understand not just the image itself, but the *context* of the text surrounding that image in the original document.
*   **Novel Algorithmic Solution:** A **Joint Vision-Text Anchor Graph**. When a PDF or page is parsed, the algorithm creates a localized graph linking the visual embedding of an image to the dense text embeddings of the paragraphs immediately preceding and following it. Retrieval requires a "sub-graph match" rather than a single vector match.
*   **IP Potential:** A novel indexing strategy for multi-modal RAG that preserves spatial and contextual relationships between text and images in unstructured documents.
