# BookSmart Roadmap

## Future Enhancements

### 1) Selective Annotation
- Give users more selectivity to annotate on a page being bookmarked.
- Allow marking which images or videos to summarize, store, etc.

### 2) Native Platform Integrations
- Special detection logic for key websites (LinkedIn, etc.) with native "save" features.
- API links to index and link saved articles within those platforms.
- Search over platform-specific subsets from within BookSmart.

### 3) Social & Sharing
- Easier sharing with other BookSmart users.
- Sharing capabilities with non-BookSmart users.

### 4) Infrastructure & UX
- [NEW] **Custom Domain**: Configure a "prettier URL" for the Manager app (e.g., manager.booksmart.com).
- **Search Intent**: Fine-tune the Gemini intent parsing for even more natural queries.
- **Historical Integrity**: Completed (Timestamps now preserved from browser).

### 5) AI Text-to-Speech (TTS) & Accessibility (Pro Feature)
- **Native Browser TTS (Free)**: Lightweight `WebSpeech` API integration for reading TL;DRs and summaries.
- **Neural AI Voices (Pro)**: OpenAI TTS (`nova`, `onyx`, `alloy`) and ElevenLabs integration for human-grade audio playback.
- **AI Daily Audio Briefings**: Generated 3-minute morning audio podcasts compiling the user's daily saved research.
- **Sticky Audio Mini-Player**: Bottom media player bar with variable speed controls (1.0x to 2.0x).

### 6) Conversational Voice & Task Agent (Multi-Turn Execution)
- **Multi-Turn Ordinal Reference Resolution**: Tracks active entity lists across voice/text turns (e.g. resolving "the second recipe" or "compare 1st and 2nd").
- **Agentic Function Calling**: Invokes backend tools to search library, extract DOM sections (ingredients, code blocks), and compare metadata.
- **Hands-Free Cooking / Research Mode**: Speech-to-Text and continuous voice wake for hands-free tasks.

### 7) Chrome Native AI Skills & On-Device Context Provisioning
- **Progressive Enhancement Wrapper**: Run on-device Gemini Nano tasks when flags are present, falling back to GCP cloud.
- **On-Device Embeddings (`ai.textEmbedding`)**: Vectorize user content locally in IndexedDB to enable zero-network, local semantic search.
- **Context Injection to Third-Party AI**: Automatically inject relevant, summarized BookSmart search snippets into active ChatGPT, Claude, or Google Doc sessions.
- **Offline Client Summarizer (`ai.summarizer`)**: Generate TL;DR summaries entirely client-side when working offline.

### 8) Contextual AI Skill Anchors (Dynamic Action Cards)
- **Content Classification**: Tag content types during ingestion (opinion, tutorial, research paper, recipe).
- **Devil's Advocate (Opposing View)**: Generate local counter-arguments to essays/articles to round out research.
- **Interactive Study Guides**: Generate retention quizzes or flashcard overlays on educational documents.
- **Deductive Code Auditor**: Review code snippets in bookmarked coding tutorials for bugs and vulnerabilities.
- **Persistence & Export**: Save generated skill cards directly to bookmark notes or export as shareable Markdown summaries.


