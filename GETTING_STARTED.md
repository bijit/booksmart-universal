# Getting Started with BookSmart Development

**Status:** ✅ Git initialized, directory structure created
**Next:** Week 1 - Environment Setup

---

## What We Just Completed

✅ **Git Repository Initialized**
- Main branch created
- Initial commit completed
- .gitignore configured

✅ **Directory Structure Created**
- Backend (Node.js API)
- Extension (Chrome extension)
- Manager (React app)
- Shared (common code)

✅ **Configuration Files**
- package.json (monorepo with workspaces)
- .env.example (all environment variables documented)
- README.md (comprehensive project overview)
- IMPLEMENTATION_PLAN.md (10-week timeline)

---

## Your Next Steps (Week 1)

### Step 1: Create Service Accounts (Day 1)

#### 1.1 Qdrant Cloud (Vector Database)
```bash
# Visit: https://cloud.qdrant.io/
# Sign up for free account
# Create a cluster (free tier: 1GB, 500K vectors)
# Copy:
#   - Cluster URL (https://xxxx.qdrant.io)
#   - API Key
```

#### 1.2 Supabase (Backend Database + Auth)
```bash
# Visit: https://supabase.com/
# Create new project (free tier: 500MB)
# Go to Project Settings > API
# Copy:
#   - Project URL
#   - anon/public key
#   - service_role key (keep secret!)
```

#### 1.3 Google Cloud Console
```bash
# Visit: https://console.cloud.google.com/

# Enable Google AI (Gemini)
# Go to: https://makersuite.google.com/app/apikey
# Create API key
# Copy: API Key

# Set up OAuth 2.0
# Go to: APIs & Services > Credentials
# Create OAuth 2.0 Client ID
# Application type: Web application
# Authorized redirect URIs:
#   - http://localhost:3000/auth/callback
#   - https://your-domain.vercel.app/auth/callback
# Copy:
#   - Client ID
#   - Client Secret
```

#### 1.4 Jina AI (Optional for now)
```bash
# Visit: https://jina.ai/
# Sign up (optional - works without API key for testing)
# Free tier: 1,000 requests/day
# If signing up, copy: API Key
```

#### 1.5 Vercel (Deployment - can do later)
```bash
# Visit: https://vercel.com/
# Sign up with GitHub
# Install Vercel CLI: npm install -g vercel
# Login: vercel login
```

---

### Step 2: Configure Environment (Day 1)

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your actual keys
nano .env.local  # or use your favorite editor

# REQUIRED for Week 1:
QDRANT_URL=https://your-cluster-id.qdrant.io
QDRANT_API_KEY=your_actual_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_key_here
GOOGLE_AI_API_KEY=your_actual_key_here
GOOGLE_OAUTH_CLIENT_ID=your_actual_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_actual_secret_here

# OPTIONAL for now:
JINA_API_KEY=  # Can leave empty, Jina works without it
```

---

### Step 3: Install Dependencies (Day 2)

```bash
# Install root dependencies
npm install

# This will install dependencies for all workspaces:
# - backend
# - extension
# - manager
# - shared
```

---

### Step 4: Initialize Databases (Day 2-3)

#### 4.1 Create Qdrant Collection

```bash
# We'll create a script for this
# backend/scripts/setup-qdrant.js

# Run it:
npm run setup:qdrant

# This will:
# - Connect to Qdrant Cloud
# - Create 'bookmarks' collection
# - Configure 768-dimensional vectors
# - Set up indexing parameters
```

#### 4.2 Set Up Supabase Tables

```bash
# We'll create SQL migrations
# backend/migrations/*.sql

# Run them:
npm run setup:supabase

# This will create:
# - bookmarks table
# - search_history table
# - user_preferences table
# - import_jobs table
# - RLS policies
```

---

### Step 5: Test Connections (Day 3)

```bash
# We'll create a test script
# backend/scripts/test-connections.js

# Run it:
node backend/scripts/test-connections.js

# Should output:
# ✅ Qdrant connection successful
# ✅ Supabase connection successful
# ✅ Google AI API working
# ✅ Jina AI API working (if configured)
```

---

### Step 6: Start Development (Day 4+)

```bash
# Start all services in development mode
npm run dev

# This starts:
# - Backend API on http://localhost:3000
# - Manager page on http://localhost:5173
# - Extension in watch mode (auto-rebuild on changes)

# Or start individually:
npm run dev:backend
npm run dev:manager
npm run dev:extension
```

---

## Development Commands

```bash
# Development
npm run dev              # Start all services
npm run dev:backend      # Backend only
npm run dev:manager      # Manager only
npm run dev:extension    # Extension only

# Building
npm run build            # Build all
npm run build:backend    # Backend only
npm run build:manager    # Manager only
npm run build:extension  # Extension only

# Testing
npm test                 # Test all
npm run test:backend     # Backend tests
npm run test:manager     # Manager tests

# Database
npm run setup:qdrant     # Initialize Qdrant collection
npm run setup:supabase   # Run Supabase migrations

# Code Quality
npm run lint             # Lint all code
npm run format           # Format all code

# Docker (for local development)
npm run docker:up        # Start local services
npm run docker:down      # Stop local services
```

---

## Project Structure Reference

```
booksmart_v1.0/
├── backend/              # Node.js API (Vercel Functions)
│   ├── src/
│   │   ├── services/     # Jina extraction, Gemini, Qdrant, etc.
│   │   ├── routes/       # API endpoints
│   │   └── middleware/   # Auth, validation
│   ├── scripts/          # Setup scripts
│   └── migrations/       # SQL migrations
│
├── extension/            # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/   # Service worker (bookmark listener)
│   │   ├── content/      # Content scripts (page access)
│   │   ├── popup/        # Extension popup UI
│   │   └── storage/      # IndexedDB cache
│   └── public/
│       └── manifest.json # Extension manifest
│
├── manager/              # React Manager Page
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       └── hooks/        # Custom hooks
│
└── shared/               # Shared TypeScript types
    └── types/
```

---

## Week 1 Checklist

### Day 1: Accounts
- [ ] Create Qdrant Cloud account
- [ ] Create Supabase account
- [ ] Set up Google Cloud Console
- [ ] Get Google AI API key
- [ ] Set up Google OAuth
- [ ] Configure .env.local

### Day 2: Dependencies
- [ ] Install npm dependencies
- [ ] Create setup-qdrant.js script
- [ ] Create setup-supabase.js script
- [ ] Write SQL migrations

### Day 3: Database Setup
- [ ] Run Qdrant setup
- [ ] Run Supabase migrations
- [ ] Test all connections
- [ ] Verify databases are accessible

### Day 4-5: Backend Scaffolding
- [ ] Set up backend package.json
- [ ] Create config loaders
- [ ] Set up database clients
- [ ] Write connection tests

### Day 6-7: Project Initialization
- [ ] Set up extension package.json
- [ ] Set up manager package.json
- [ ] Configure build tools
- [ ] Set up testing framework

---

## Common Issues & Solutions

### "Cannot connect to Qdrant"
- Check QDRANT_URL has https:// prefix
- Verify API key is correct
- Ensure cluster is active in Qdrant dashboard

### "Supabase connection failed"
- Check SUPABASE_URL format
- Verify you're using the correct key (anon vs service_role)
- Check project is not paused

### "Google AI API error"
- Verify API key is correct
- Check billing is enabled (has free tier)
- Ensure Gemini API is enabled in console

### "npm install fails"
- Ensure Node.js >= 18.0.0: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and retry

---

## Getting Help

1. Check [README.md](README.md) for overview
2. Check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for timeline
3. Review context files:
   - booksmart_product_spec.md.txt
   - booksmart_decisions.md.txt
   - claude.md.txt

---

## What's Next After Week 1?

**Week 2:** Backend API Core
- Authentication service
- Qdrant integration
- Supabase integration
- Basic CRUD operations

**Week 3:** AI Processing Pipeline
- Jina AI extraction
- Gemini summarization
- Google embeddings
- Background worker

---

**Current Status:** ✅ Foundation Complete
**Next Milestone:** Environment Setup Complete (End of Week 1)
**Ready to Start:** Yes! Begin with Step 1 above.

---

_Good luck! 🚀_
