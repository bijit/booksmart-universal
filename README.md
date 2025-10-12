# BookSmart - AI-Powered Bookmark Management

**Version:** 1.0.0
**Status:** In Development

BookSmart is an intelligent Chrome extension that transforms bookmark management through AI-powered content understanding and semantic search. Never lose a bookmark again - search by concept, not just keywords.

---

## Features

- **AI Summaries**: Automatic summarization using Google Gemini Flash
- **Semantic Search**: Find bookmarks by meaning, not just keywords
- **Hybrid Search**: Combines vector similarity (60%) and full-text search (40%)
- **Background Processing**: Never wait - bookmarks are processed asynchronously
- **Image Analysis**: Analyzes and extracts text from image-centric pages
- **Bulk Import**: Import thousands of existing Chrome bookmarks
- **Multiple Views**: Card, List, and Folder views
- **Privacy First**: Content extracted locally when possible

---

## Architecture

### Tech Stack

**Frontend:**
- Chrome Extension (Manifest V3)
- React 18 + Tailwind CSS
- IndexedDB for local caching

**Backend:**
- Node.js on Vercel Functions
- Qdrant Cloud (vector database)
- Supabase (PostgreSQL + Auth)

**AI Services:**
- Google Gemini Flash (summarization & vision)
- Google Text Embeddings (768-dimensional vectors)
- Jina AI Reader (content extraction)

**Cost:** $0/month for MVP (free tiers for all services)

---

## Project Structure

```
booksmart_v1.0/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── services/     # Business logic
│   │   ├── routes/       # API endpoints
│   │   └── middleware/   # Auth, validation, etc.
│   ├── scripts/          # Setup scripts
│   └── migrations/       # Database migrations
│
├── extension/            # Chrome extension
│   ├── src/
│   │   ├── background/   # Service worker
│   │   ├── content/      # Content scripts
│   │   └── popup/        # Extension popup UI
│   └── public/           # Icons, manifest
│
├── manager/              # React manager page
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       └── hooks/        # Custom hooks
│
└── shared/               # Shared code/types
    ├── types/            # TypeScript definitions
    └── constants/        # Shared constants
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/booksmart.git
cd booksmart_v1.0
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces (backend, extension, manager).

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your API keys:

**Required Services:**
- **Qdrant Cloud**: https://cloud.qdrant.io/ (free tier: 1GB)
- **Supabase**: https://supabase.com/ (free tier: 500MB)
- **Google AI Studio**: https://makersuite.google.com/app/apikey
- **Google OAuth**: https://console.cloud.google.com/apis/credentials
- **Jina AI** (optional): https://jina.ai/

### 4. Initialize Databases

```bash
# Create Qdrant collection
npm run setup:qdrant

# Run Supabase migrations
npm run setup:supabase
```

### 5. Start Development

```bash
# Start all services
npm run dev

# Or start individually:
npm run dev:backend    # Backend API (port 3000)
npm run dev:manager    # Manager page (port 5173)
npm run dev:extension  # Extension (watch mode)
```

### 6. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder
5. Extension icon should appear in toolbar

---

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific workspace
npm run test:backend
npm run test:extension
npm run test:manager
```

### Building for Production

```bash
# Build all projects
npm run build

# Build individually
npm run build:backend
npm run build:extension
npm run build:manager
```

### Code Quality

```bash
# Lint all code
npm run lint

# Format all code
npm run format
```

---

## Key Design Decisions

### Content Extraction Strategy

**Primary Method: Jina AI Reader**
- Fast and reliable extraction
- Handles JavaScript-rendered sites
- Free tier: 1,000 requests/day
- Fallback to Puppeteer for edge cases

### Data Storage Split

**Qdrant (Vector Database):**
- All bookmark content and vectors
- Semantic search
- Tags and metadata

**Supabase (PostgreSQL):**
- User authentication
- Bookmark references
- Search history
- User preferences

### Processing Flow

1. User bookmarks page → Instant save (no wait!)
2. Background worker polls for pending bookmarks
3. Extract content via Jina AI
4. Generate summary with Gemini Flash
5. Create vector embedding
6. Store in Qdrant + update Supabase

---

## API Endpoints

```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login with Google OAuth
POST   /api/bookmarks              # Create bookmark
GET    /api/bookmarks              # Get user's bookmarks
GET    /api/bookmarks/:id          # Get specific bookmark
DELETE /api/bookmarks/:id          # Delete bookmark
PATCH  /api/bookmarks/:id          # Update bookmark
GET    /api/search                 # Hybrid search
POST   /api/bookmarks/import       # Bulk import
GET    /api/health                 # Health check
```

---

## Database Schemas

### Supabase Tables

```sql
-- Bookmarks reference table
bookmarks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  url TEXT NOT NULL,
  title TEXT,
  processing_status TEXT,
  extraction_method TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Search history
search_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  query TEXT,
  results_count INTEGER,
  created_at TIMESTAMP
)

-- User preferences
user_preferences (
  user_id UUID PRIMARY KEY,
  default_view TEXT,
  settings JSONB
)
```

### Qdrant Collection

```javascript
{
  id: "bookmark-uuid",
  vector: [768-dimensional array],
  payload: {
    user_id: "user-id",
    url: "https://...",
    title: "Page Title",
    summary: "AI-generated summary",
    content: "Extracted text",
    tags: ["tag1", "tag2"],
    created_at: "timestamp"
  }
}
```

---

## Timeline

**Week 1:** Environment setup
**Week 2:** Backend API core
**Week 3:** AI processing pipeline (Jina + Gemini)
**Week 4:** Search implementation
**Week 5:** Chrome extension core
**Week 6:** Extension popup UI
**Week 7:** Manager page (React)
**Week 8:** Import tool
**Week 9:** Testing & QA
**Week 10:** Deployment & launch

---

## Contributing

This is currently a solo project, but contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
test: Add tests
chore: Maintenance tasks
refactor: Code refactoring
```

---

## Deployment

### Backend API

```bash
# Deploy to Vercel
cd backend
vercel --prod
```

### Manager Page

```bash
# Deploy to Vercel
cd manager
vercel --prod
```

### Chrome Extension

1. Build extension: `npm run build:extension`
2. Zip the `extension/dist` folder
3. Upload to Chrome Web Store Developer Dashboard

---

## Cost Analysis

**Free Tier Capacity (MVP):**
- Qdrant: 500K vectors (~500K bookmarks)
- Supabase: 500MB database
- Vercel: 100GB bandwidth/month
- Jina AI: 1,000 requests/day (paid: $0.0002/request)
- Gemini: Pay-per-use (~$0.00003/bookmark)

**When you'll pay:**
- After 2,500+ active users
- Estimated cost: $80/month for 5,000 users

---

## Troubleshooting

### Content Extraction Fails

- Check Jina AI rate limits
- Verify URL is accessible
- Check JINA_API_KEY in .env.local

### Search Returns No Results

- Verify Qdrant collection exists
- Check QDRANT_API_KEY is correct
- Ensure bookmarks are processed (status: 'completed')

### Extension Not Working

- Check manifest.json is valid
- Verify API_BASE_URL in extension config
- Check Chrome console for errors

---

## Documentation

- [API Documentation](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Guide](docs/USER_GUIDE.md)

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Contact

For questions or issues, please open an issue on GitHub.

---

## Acknowledgments

- Mozilla Readability for content extraction
- Jina AI for reliable web content extraction
- Qdrant for vector database
- Supabase for backend infrastructure
- Google for AI services

---

**Status:** Active Development | **Current Phase:** Week 0 - Foundation Setup
