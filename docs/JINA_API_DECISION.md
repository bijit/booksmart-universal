# Jina AI: MCP Server vs Direct API - Technical Decision

**Date:** October 12, 2025
**Decision:** Use Direct Jina Reader API
**Status:** ✅ Finalized

---

## Question

Should we use the Jina AI MCP (Model Context Protocol) server at `https://mcp.jina.ai/sse` or make direct API calls to `https://r.jina.ai/`?

---

## Decision: Use Direct Jina Reader API

**We will use direct HTTP calls to the Jina Reader API, NOT the MCP server.**

---

## What is Jina MCP Server?

The Jina AI MCP server is a **remote service** designed for **AI assistants** (like Claude Desktop, Cursor IDE, LM Studio) to access Jina's services during user conversations.

**It's intended for:**
- ✅ AI assistants that need web access during chats
- ✅ IDE plugins that search while coding
- ✅ Conversational agents
- ✅ Interactive AI tools

**NOT intended for:**
- ❌ Backend services processing data
- ❌ Background workers
- ❌ Automated batch jobs
- ❌ Production APIs

---

## Comparison

| Aspect | Direct Jina Reader API | Jina MCP Server |
|--------|----------------------|-----------------|
| **Purpose** | Web content extraction | AI assistant integration |
| **Target Users** | Backend developers | AI assistant users |
| **Use Case** | Production services | Interactive AI tools |
| **Protocol** | Simple HTTP GET | MCP over SSE |
| **Integration** | 3 lines of code | Requires MCP SDK |
| **Latency** | 1 network hop | 2+ network hops |
| **Complexity** | Very simple | Added abstraction layer |
| **Overhead** | None | Protocol translation |
| **Dependencies** | axios only | MCP SDK + client |
| **Performance** | Fast | Slower (extra hop) |
| **Our Fit** | **Perfect ✅** | Wrong tool ❌ |

---

## Code Comparison

### Option A: Direct API (Our Choice) ✅

```javascript
// backend/services/extraction/jinaExtractor.js
import axios from 'axios';

class JinaExtractor {
  async extract(url) {
    const response = await axios.get(`https://r.jina.ai/${url}`, {
      headers: {
        'Authorization': `Bearer ${process.env.JINA_API_KEY}` // optional
      },
      timeout: 15000
    });

    return {
      title: this.extractTitle(response.data),
      text: this.extractContent(response.data),
      success: true
    };
  }
}
```

**Lines of code:** ~20
**Dependencies:** axios
**Complexity:** Very low
**Performance:** Direct, fast

---

### Option B: MCP Server (NOT Using) ❌

```javascript
// Would require MCP SDK
import { createMCPClient } from '@modelcontextprotocol/sdk';

class JinaMCPExtractor {
  constructor() {
    this.client = createMCPClient({
      url: 'https://mcp.jina.ai/sse',
      headers: {
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      }
    });
  }

  async extract(url) {
    // Need to understand MCP protocol
    const result = await this.client.callTool('read_url', {
      url: url
    });

    return {
      title: result.title,
      text: result.content,
      success: true
    };
  }
}
```

**Lines of code:** ~30+
**Dependencies:** MCP SDK + axios
**Complexity:** Higher (new protocol to learn)
**Performance:** Slower (extra hop through MCP server)

---

## Architecture Flow

### Direct API (Our Approach)
```
Background Worker
    ↓ (HTTPS GET)
Jina Reader API (r.jina.ai)
    ↓
Response (markdown)
```

**Hops:** 1
**Latency:** ~500-1000ms

---

### MCP Server (NOT Using)
```
Background Worker
    ↓ (MCP protocol over SSE)
MCP Client SDK
    ↓ (HTTPS)
Jina MCP Server (mcp.jina.ai)
    ↓ (HTTPS)
Jina Reader API (r.jina.ai)
    ↓
Response (through 2 layers)
```

**Hops:** 3
**Latency:** ~1000-2000ms (slower)

---

## Feature Parity

Everything the MCP server provides is available via direct API:

| Feature | Direct API | MCP Server | Winner |
|---------|-----------|------------|--------|
| Read URL | `r.jina.ai/{url}` | `read_url` tool | Tie |
| Search Web | `s.jina.ai/` | `search_web` tool | Tie |
| Image Search | Direct endpoint | `search_images` tool | Tie |
| No API key | Works | Works | Tie |
| Rate Limits | 1000/day free | 1000/day free | Tie |
| Markdown output | ✅ Yes | ✅ Yes | Tie |
| PDF extraction | ✅ Yes | ✅ Yes | Tie |
| Simplicity | ✅ **Very simple** | ❌ Complex | **Direct API** ✅ |
| Performance | ✅ **Fast** | ❌ Slower | **Direct API** ✅ |

---

## When WOULD You Use MCP Server?

You would use the MCP server if you're building:

1. **AI Assistant (like Claude Desktop)**
   - User chats with AI
   - AI needs to read web pages during conversation
   - MCP provides standardized tool interface

2. **IDE Plugin (like Cursor)**
   - Developer writes code
   - AI assistant needs to search docs
   - MCP integrates with IDE

3. **Conversational Agent**
   - Interactive chatbot
   - Needs real-time web access
   - MCP handles the protocol

4. **AI Development Tool**
   - Building tools for other AIs
   - Need standardized interface
   - MCP is the standard

---

## Our Use Case

We're building:
- ✅ Background worker processing bookmarks
- ✅ Automated content extraction pipeline
- ✅ Production backend service
- ✅ Batch processing system

**This is NOT an AI assistant use case.**

Therefore, **Direct API is the right choice.**

---

## Technical Advantages of Direct API

### 1. Simplicity
```javascript
// Direct API: Just use axios
import axios from 'axios';
const result = await axios.get(`https://r.jina.ai/${url}`);
```

### 2. No Extra Dependencies
```json
// package.json
{
  "dependencies": {
    "axios": "^1.6.0"  // That's it!
  }
}
```

### 3. Better Error Handling
```javascript
// Direct control over HTTP errors
try {
  const response = await axios.get(url);
} catch (error) {
  if (error.response.status === 429) {
    // Handle rate limit
  } else if (error.response.status === 403) {
    // Handle forbidden
  }
}
```

### 4. No Protocol Learning Curve
- Team doesn't need to learn MCP
- Standard HTTP/REST API
- Well-understood patterns
- Easy to debug

### 5. Performance
- One network hop instead of three
- No protocol translation overhead
- Direct connection to Jina
- Faster response times

---

## Cost Analysis

Both options have the same cost:
- Free tier: 1,000 requests/day
- Paid tier: $0.0002 per request

**No cost difference between direct API and MCP.**

---

## Future Flexibility

If we later decide we need MCP features:
- ✅ Can easily add MCP alongside direct API
- ✅ Direct API code doesn't prevent MCP usage
- ✅ Can use both if needed

But we almost certainly won't need MCP for our backend service.

---

## Implementation Plan

### Week 3: Jina Integration

**Day 1-2: Direct API Implementation**

```javascript
// backend/services/extraction/jinaExtractor.js
export class JinaExtractor {
  constructor() {
    this.baseUrl = 'https://r.jina.ai';
    this.apiKey = process.env.JINA_API_KEY; // optional
  }

  async extract(url) {
    const headers = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await axios.get(`${this.baseUrl}/${url}`, {
      headers,
      timeout: 15000
    });

    return this.parseResponse(response.data);
  }

  parseResponse(data) {
    // Handle both string (markdown) and object responses
    if (typeof data === 'string') {
      return {
        title: this.extractTitleFromMarkdown(data),
        text: data,
        format: 'markdown'
      };
    }

    return {
      title: data.title || 'Untitled',
      text: data.content || data.text || '',
      format: 'json'
    };
  }
}
```

**Testing:**
```javascript
// backend/services/extraction/jinaExtractor.test.js
describe('JinaExtractor', () => {
  test('extracts content from URL', async () => {
    const extractor = new JinaExtractor();
    const result = await extractor.extract('https://example.com');

    expect(result.title).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });
});
```

**Estimated time:** 4-6 hours
**Complexity:** Low
**Risk:** Very low

---

## Conclusion

**Use Direct Jina Reader API because:**

1. ✅ **Simpler** - 3 lines vs 30 lines of code
2. ✅ **Faster** - One network hop vs three
3. ✅ **More appropriate** - Backend service, not AI assistant
4. ✅ **No extra dependencies** - Just axios
5. ✅ **Better performance** - Direct connection
6. ✅ **Easier to debug** - Standard HTTP
7. ✅ **No learning curve** - Team knows HTTP/REST
8. ✅ **Same features** - Everything MCP offers
9. ✅ **Same cost** - No price difference
10. ✅ **Production-ready** - Used by thousands of apps

**The MCP server is the wrong tool for our use case.**

---

## References

- Jina Reader API: https://jina.ai/reader/
- Jina MCP Server: https://github.com/jina-ai/MCP
- Official endpoint: `https://r.jina.ai/{url}`
- MCP endpoint: `https://mcp.jina.ai/sse` (not using)

---

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2025-10-12 | Use Direct API | Simpler, faster, more appropriate for backend |
| 2025-10-12 | NOT using MCP | Wrong tool for automated batch processing |

---

**Status:** ✅ Decision Finalized
**Implementation:** Week 3, Day 1-2
**Estimated Effort:** 4-6 hours
**Risk Level:** Very Low

---

_This decision is final and will not be revisited unless requirements change dramatically._
