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

## Quick Start (For End Users)

Just want to use BookSmart? Follow these simple steps:

### Step 1: Install the Chrome Extension

1. Download the extension files from your BookSmart administrator
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Select the `extension/` folder
6. The BookSmart extension icon will appear in your toolbar

### Step 2: Create Your Account

1. Click the BookSmart extension icon in Chrome toolbar
2. Click **"Create account"** link
3. Fill in:
   - Full Name
   - Email address
   - Password (minimum 8 characters)
4. Click **"Create Account"**
5. You'll be automatically logged in!

### Step 3: Start Bookmarking!

1. Navigate to any webpage (e.g., Wikipedia article, blog post, PDF)
2. Click the Chrome ★ star icon (or press Ctrl+D / Cmd+D)
3. Save the bookmark
4. BookSmart will automatically:
   - Extract the content (takes 5-10 seconds)
   - Generate an AI summary
   - Create searchable tags
   - Make it semantically searchable

5. Open the BookSmart popup to see your bookmarks with tags
6. Use the search box to find bookmarks by concept, not just keywords!

**That's it!** No API keys or database setup needed - the backend is already running.

---

## Self-Hosting / Development Setup

Want to run your own BookSmart instance? Follow these detailed instructions:

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Chrome browser
- Git

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/kniyogi/booksmart.git
cd booksmart_v1.0

# Install backend dependencies
cd backend
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your API keys:

```env
# Required - Get from https://supabase.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Required - Get from https://cloud.qdrant.io
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key

# Required - Get from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# Optional - Get from https://jina.ai (free tier: 1000 requests/day)
JINA_API_KEY=your_jina_api_key

PORT=3000
NODE_ENV=development
```

**Where to get API keys:**
- **Supabase**: Sign up at https://supabase.com (free tier), create a project, get keys from Project Settings → API
- **Qdrant**: Sign up at https://cloud.qdrant.io (free tier: 1GB), create a cluster, get URL and API key
- **Gemini**: Get API key from https://makersuite.google.com/app/apikey (Google AI Studio)
- **Jina AI** (optional): Sign up at https://jina.ai/reader for content extraction

### Step 3: Initialize Databases

```bash
# From backend directory
cd backend

# Create Qdrant collection (vector database)
node scripts/setup-qdrant.js

# Initialize Supabase tables
node scripts/setup-supabase.js
```

### Step 4: Start the Backend Server

```bash
# From backend directory
npm run dev
```

You should see:
```
🚀 BookSmart API Server
📡 Server running on: http://localhost:3000
```

Keep this terminal running.

### Step 5: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Navigate to and select: `booksmart_v1.0/extension/` folder
5. The BookSmart extension icon should appear in your toolbar

### Step 6: Create Your Account

1. Click the BookSmart extension icon in Chrome toolbar
2. Click **"Create account"** link
3. Fill in:
   - Full Name
   - Email address
   - Password (minimum 8 characters)
4. Click **"Create Account"**
5. You'll be automatically logged in!

### Step 7: Start Bookmarking!

1. Navigate to any webpage (e.g., Wikipedia article, blog post, PDF)
2. Click the Chrome ★ star icon (or press Ctrl+D / Cmd+D)
3. Save the bookmark
4. BookSmart will:
   - Extract the content (takes 5-10 seconds)
   - Generate an AI summary
   - Create searchable tags
   - Make it semantically searchable

5. Open the BookSmart popup to see your bookmarks with tags
6. Use the search box to find bookmarks by concept, not just keywords!

---

## Detailed Setup (For Developers)

### Database Schema Setup

The setup scripts automatically create these tables in Supabase:

```sql
-- Bookmarks metadata
bookmarks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  url TEXT NOT NULL,
  title TEXT,
  qdrant_point_id UUID,
  processing_status TEXT,
  extraction_method TEXT,
  retry_count INTEGER,
  error_message TEXT,
  tags TEXT[],
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

The Qdrant collection stores:
- 768-dimensional embeddings (Google Text Embeddings)
- Full page content and metadata
- Tags and descriptions for semantic search

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
