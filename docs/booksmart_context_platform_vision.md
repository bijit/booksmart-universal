# BookSmart: Strategic Vision — The Trusted Personal Context Layer

> **Status:** Strategic Research & Planning Document
> **Author:** Product & Engineering
> **Date:** July 2026

---

## The Big Idea

> *"BookSmart becomes the trusted, user-owned context layer for personal AI — capturing what you do online, storing it securely, and making it available (with your explicit consent) to any AI app you choose."*

This positions BookSmart not as a bookmark manager, but as **personal AI infrastructure** — the equivalent of what Plaid did for banking data, but for personal online context.

---

## 1. The Problem We Are Solving

Every AI app today — Claude, ChatGPT, Notion AI, Perplexity — starts from zero context about *you*. They don't know:
- What you've been reading and researching for the past 6 months
- Which topics you care about and why
- What decisions you've made and the rationale behind them
- What your knowledge gaps are

The result: AI apps are powerful but **impersonal**. They answer generic questions well, but fail at becoming true personal assistants because they have no persistent, trusted understanding of you.

**The root cause:** There is no neutral, user-owned "context store" that AI apps can plug into. Every app tries to build its own isolated silo, with no user control, no interoperability, and no trust.

---

## 2. The BookSmart Vision: Context as a Service (CaaS)

BookSmart becomes the **trusted personal context orchestration layer** with three distinct functions:

### 2.1 Capture
The Chrome Extension (already built) continues to be the primary capture mechanism:
- Web pages read, time spent, scroll depth
- Content saved, highlighted, annotated
- Search queries that led to saves
- Tags, folders, and organizational intent

**Future capture channels:**
- PDF & document uploads
- Email digests (opt-in)
- Calendar context (meeting subjects, notes)
- Clipboard-based capture (text copied from the web)

### 2.2 Store (The Context Vault)
All captured context is stored in a **user-owned, encrypted Context Vault**:
- End-to-end encrypted at rest
- User holds the master key (or key escrow with explicit consent)
- Structured as a layered knowledge graph (temporal, relational, semantic)
- Each context item has provenance metadata: *when, where, why* it was captured

### 2.3 Serve (The Context API)
A governed API layer that allows third-party AI apps to *request* context from the vault:
- Apps declare what they need and why (scoped requests)
- User sees a consent screen (like OAuth) and approves/denies access
- Access is time-bound, revocable, and fully audited
- Context is served in a structured, model-agnostic format (JSON-LD / MCP-compatible)

---

## 3. The Competitive & Conceptual Landscape

### What Exists Today

| Project | Philosophy | Gap vs. BookSmart Vision |
| :--- | :--- | :--- |
| **Solid Project (Tim Berners-Lee / Inrupt)** | Decentralized personal data "pods" on the web | Academic/developer-focused; no AI-native context capture; no browser extension |
| **Mem0** | Hybrid memory layer for LLM personalization | Developer tool, not user-facing; no capture mechanism; no cross-app consent model |
| **Zep / Graphiti** | Temporal knowledge graph for AI agents | Backend infrastructure; requires dev integration; not end-user controlled |
| **Humane / Rabbit r1** | AI-first devices with personal context | Hardware-dependent; closed ecosystem; no third-party API |
| **Apple Intelligence** | On-device personal context for Apple apps | Closed ecosystem; no third-party access; limited to Apple apps |
| **ChatGPT Memory** | Chat history memory within OpenAI | Closed silo; OpenAI-owned; not portable; no user consent for third parties |

### The Gap
**No one has built a user-facing, browser-integrated, consent-governed, AI-context store that third-party apps can plug into.** This is the whitespace BookSmart can own.

---

## 4. Technical Architecture

### 4.1 The Three-Layer Stack

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                  │
│  BookSmart Manager Dashboard + Chrome Extension          │
│  (Capture, Review, Manage Permissions, Audit Log)        │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  CONTEXT VAULT LAYER                     │
│  Encrypted personal context store per user              │
│  ├── Vector Index (Qdrant) — semantic search            │
│  ├── Temporal Knowledge Graph (Graphiti/Zep) — "when"   │
│  └── Relational Metadata (Supabase/Postgres) — "why"    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  CONTEXT API LAYER                       │
│  OAuth 2.0 / OpenID Connect — governed access           │
│  ├── /context/search — semantic search over user vault  │
│  ├── /context/topics — user's interest graph            │
│  ├── /context/timeline — temporal activity              │
│  └── /context/export — portable data export (JSON-LD)   │
│                                                          │
│  MCP Server — plug-in compatible with Claude, GPT, etc. │
└─────────────────────────────────────────────────────────┘
```

### 4.2 The Consent Model (OAuth-Inspired)

Third-party apps go through a flow modeled on OAuth 2.0:

1. **App Registration**: Developer registers their app with BookSmart, declares the context scopes they need (e.g., `context:topics:read`, `context:timeline:read:30d`)
2. **User Authorization**: User sees a consent screen in BookSmart — exactly what the app is requesting and why
3. **Scoped Token**: BookSmart issues a time-bound, revocable access token scoped to exactly what was approved
4. **Audit Trail**: Every API call is logged and visible in the user's BookSmart dashboard under "Third-Party Access"
5. **Revocation**: User can revoke any app's access at any time with one click

### 4.3 Context Scopes (Proposed)

| Scope | What It Grants |
| :--- | :--- |
| `context:topics:read` | User's top interest topics and their weights |
| `context:search:read` | Semantic search over the user's vault |
| `context:timeline:read:{days}` | Activity timeline for last N days |
| `context:bookmarks:read` | Specific saved bookmarks with metadata |
| `context:summary:read` | AI-generated summary of user's knowledge in an area |
| `context:export` | Full portable export (for data portability compliance) |

### 4.4 MCP Server Integration
BookSmart exposes a **Model Context Protocol (MCP) server** so that any MCP-compatible AI client (Claude Desktop, custom agents, etc.) can connect to BookSmart as a context provider with zero custom integration work.

**Security hardening for MCP:**
- Request-level authorization on every tool call (not just connection-time)
- Fail-closed: deny access by default
- No static client IDs — per-session dynamic token issuance
- Full I/O validation — all tool arguments treated as untrusted

---

## 5. The Trust Model

Trust is the core product differentiator. The architecture is designed to make trust *verifiable*, not just claimed:

| Trust Pillar | How We Implement It |
| :--- | :--- |
| **Encryption** | AES-256 encryption at rest; TLS in transit; user-controlled key option |
| **Data Sovereignty** | User can self-host the Context Vault on their own infrastructure (future) |
| **Transparency** | Full audit log of every access, by whom, when, and what they saw |
| **Consent** | Explicit, granular, revocable consent — no blanket permissions |
| **Portability** | Full data export at any time in open formats (JSON-LD, Markdown) |
| **Minimization** | We never capture more than the user explicitly enables |
| **No Training** | User context is never used to train any AI model without explicit opt-in |

---

## 6. Monetization Model

This architecture opens up multiple revenue streams:

| Tier | Target | Pricing | Offering |
| :--- | :--- | :--- | :--- |
| **Free** | Individual users | $0 | 1,000 context items; 1 third-party app connection; basic search |
| **Personal Pro** | Power users | $8/month | Unlimited context; unlimited connections; advanced analytics; priority AI |
| **Developer** | App builders | $49/month | API access; up to 100 monthly active users of their app; webhooks |
| **Platform** | Enterprises / AI labs | Custom | White-label vault; bulk user licensing; SLA; enterprise consent flows |

---

## 7. Guiding Principle: User-First, Then Platform

> **The user must be the first and best consumer of their own context data.**

Before BookSmart becomes a platform for third-party apps, it must first become indispensable to the user themselves. There is a clear and deliberate two-stage philosophy:

**Stage 1 — Personal Context Browser (The Vault for Me):**
The user has a rich, secure, beautifully designed interface to browse, search, and understand *their own* captured context. They can:
- See what the system has captured about them over time
- Search semantically across everything ("what do I know about LLMs?", "what did I save last month about startups?")
- Explore their interest graph — what topics they return to most
- View timelines of their reading and research activity
- Understand the full picture of their digital knowledge footprint

This stage has no sharing, no APIs, no third parties. It is about building *trust through value*: the user has to find their Context Vault genuinely useful and trustworthy for themselves before they would ever consider granting anyone else access to it.

**Stage 2 — Context as a Platform (The Vault for Apps):**
Only once Stage 1 is solid does BookSmart layer in the permissioning and API infrastructure that enables third-party apps to request access to a user's context, subject to explicit, revocable, scoped consent.

This sequencing is both philosophically correct (user sovereignty first) and product-strategically sound (users who trust the vault become advocates who bring apps to it).

---

## 8. Phased Roadmap

### Phase 1: Foundation (Now — Alpha) ✅ In Progress
*Core capture and search pipeline*
- ✅ Chrome Extension (context capture)
- ✅ Manager Dashboard (review & search)
- ✅ Qdrant vector search
- ✅ Supabase user management
- 🔲 Context Vault encryption hardening

### Phase 1.5: Personal Context Browser (Next — Pre-Platform) 🎯 Priority
*Give users a world-class interface to explore their own context.*
This is the most important phase before any third-party sharing is introduced.
- 🔲 **Context Timeline View** — chronological activity stream of what was captured and when
- 🔲 **Topic / Interest Graph** — visualise what subjects the user engages with most
- 🔲 **Semantic Search UX** — rich, natural language search over the full context vault ("what do I know about X?")
- 🔲 **Context Item Detail View** — for each saved item: full metadata, AI summary, related items, and capture rationale
- 🔲 **"Forgotten Knowledge" Surfacing** — proactively resurface items the user saved long ago that are relevant now
- 🔲 **Export & Data Portability** — user can download their full vault at any time in open formats
- 🔲 **Privacy Dashboard** — user sees exactly what data is stored and can selectively delete

### Phase 2: Context API (Post-Alpha, ~Q3 2026)
*Unlock third-party access — only after Phase 1.5 is solid.*
- 🔲 OAuth 2.0 authorization server (context token issuance)
- 🔲 `/context/*` REST API endpoints
- 🔲 Consent management UI (in-dashboard)
- 🔲 Full access audit log visible to users
- 🔲 Developer portal + API key management

### Phase 3: MCP Server & Graph Layer (Q4 2026)
- 🔲 BookSmart MCP Server (compatible with Claude, GPT, custom agents)
- 🔲 Temporal Knowledge Graph integration (Zep/Graphiti)
- 🔲 Topic graph & interest mapping
- 🔲 "Why I saved this" episodic memory

### Phase 4: Ecosystem & Platform (2027)
- 🔲 Developer marketplace (third-party apps listed & reviewed)
- 🔲 Self-hosting option for Context Vault
- 🔲 Federated identity (connect Solid pods)
- 🔲 Mobile capture agent (iOS/Android)

---

## 9. Key Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **User trust / data breach** | Encryption-first architecture; security audits; transparent breach policy |
| **Regulatory (GDPR, CCPA, EU AI Act)** | Privacy-by-design; full export & delete; explicit consent logs |
| **Big Tech replication** | Network effects (the more context, the better the service); open API moat; trust brand |
| **Developer adoption** | MCP compatibility means zero integration work for AI app builders |
| **Scope creep** | Stay laser-focused on context capture + API; resist becoming a full AI app |

---

## 10. The Differentiated Positioning

> **BookSmart is not a bookmark manager.**
> 
> **BookSmart is your Personal Context Operating System** — the layer that knows what you know, why you care about it, and can share that understanding (with your permission) with any AI that works for you.

The key insight: **the user, not the AI company, should own their context.** We are the infrastructure that makes that possible.

---

## References
- [Solid Project](https://solidproject.org) — Tim Berners-Lee's personal data pod initiative
- [Model Context Protocol](https://modelcontextprotocol.io) — Anthropic's open standard for AI-to-tool integration
- [Zep / Graphiti](https://github.com/getzep/graphiti) — Temporal knowledge graph for AI memory
- [Mem0](https://mem0.ai) — Production memory layer for LLM applications
- [OWASP Agentic AI Guidelines](https://owasp.org) — Security guidance for MCP and agentic systems
- [EU AI Act Summary](https://artificialintelligenceact.eu) — Regulatory landscape for AI data handling
