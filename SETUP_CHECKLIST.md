# BookSmart Setup Checklist

**Date:** October 12, 2025
**Status:** Week 1 - Environment Setup

---

## ✅ What You've Done So Far

- [x] Created Qdrant Cloud account
- [x] Created Supabase account
- [x] Created Vercel account
- [x] Have Google account

---

## 📋 Next Steps

### Step 1: Set Up Google OAuth (5-10 minutes)

Follow these exact steps:

#### 1.1 Go to Google Cloud Console
```
https://console.cloud.google.com/
```

#### 1.2 Create New Project
- Click "Select a project" dropdown at top
- Click "New Project"
- Project name: `BookSmart`
- Click "Create" button
- Wait for project to be created (~30 seconds)

#### 1.3 Enable Required APIs
- Go to "APIs & Services" > "Library"
- Search for: **"Generative Language API"**
  - Click on it
  - Click "Enable"
- Search for: **"Google+ API"** (for OAuth)
  - Click on it
  - Click "Enable"

#### 1.4 Configure OAuth Consent Screen
- Go to "APIs & Services" > "OAuth consent screen"
- Select "External" user type
- Click "Create"
- Fill in:
  - App name: `BookSmart`
  - User support email: [Your email]
  - Developer contact: [Your email]
- Click "Save and Continue"
- Scopes: Skip (click "Save and Continue")
- Test users: Skip for now (click "Save and Continue")
- Click "Back to Dashboard"

#### 1.5 Create OAuth Client ID
- Go to "APIs & Services" > "Credentials"
- Click "+ CREATE CREDENTIALS"
- Select "OAuth client ID"
- Application type: **Web application**
- Name: `BookSmart Backend`
- Authorized redirect URIs - Click "ADD URI" and add:
  - `http://localhost:3000/api/auth/callback`
  - `http://localhost:5173/auth/callback`
- Click "Create"
- **IMPORTANT:** Copy these immediately:
  - ✅ Client ID (looks like: `123456-abcdef.apps.googleusercontent.com`)
  - ✅ Client Secret (looks like: `GOCSPX-abc123xyz`)

#### 1.6 Get Gemini API Key
- Go to: https://makersuite.google.com/app/apikey
- Click "Create API Key"
- Select your `BookSmart` project
- Click "Create API key in existing project"
- **Copy the API key** (looks like: `AIzaSy...`)

---

### Step 2: Gather All API Keys (5 minutes)

Now collect keys from all your accounts:

#### 2.1 From Qdrant Cloud
```
1. Go to: https://cloud.qdrant.io/
2. Click on your cluster name
3. Copy:
   - Cluster URL (e.g., https://xyz123-abc456.qdrant.io)
   - API Key (click "Generate new API key" if needed)
```

#### 2.2 From Supabase
```
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: Project Settings (gear icon) > API
4. Copy:
   - Project URL (e.g., https://abcdefgh.supabase.co)
   - anon public key (starts with "eyJ...")
   - service_role key (starts with "eyJ..." - different from anon!)
```

**Important:** Make sure you copy BOTH keys - anon AND service_role!

---

### Step 3: Configure Environment Variables (5 minutes)

#### 3.1 Open the .env.local file

```bash
# Use your preferred editor:
nano .env.local
# or
code .env.local
# or
vim .env.local
```

#### 3.2 Replace ALL Placeholders

Find each `PASTE_YOUR_...` line and replace with your actual keys:

```bash
# From Qdrant
QDRANT_URL=https://your-cluster-id.qdrant.io
QDRANT_API_KEY=your_actual_qdrant_api_key

# From Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ...your_actual_anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_actual_service_role_key...

# From Google
GOOGLE_AI_API_KEY=AIzaSy...your_actual_gemini_key...
GOOGLE_OAUTH_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-abc123xyz
```

#### 3.3 Save and Close
- In nano: `Ctrl+X`, then `Y`, then `Enter`
- In vim: `:wq`
- In VS Code: `Ctrl+S`

---

### Step 4: Install Dependencies (2-3 minutes)

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

This will take 2-3 minutes to download all packages.

---

### Step 5: Initialize Qdrant (1 minute)

```bash
npm run setup:qdrant
```

**Expected output:**
```
🔧 Starting Qdrant setup...
🔗 Testing Qdrant connection...
✅ Connected to Qdrant successfully
📦 Creating collection 'bookmarks'...
✅ Collection 'bookmarks' created successfully!
```

If you see errors, check:
- QDRANT_URL is correct (starts with https://)
- QDRANT_API_KEY is correct
- Your Qdrant cluster is active

---

### Step 6: Initialize Supabase (5 minutes)

```bash
npm run setup:supabase
```

This will show you the SQL migration files. You need to run them manually:

#### 6.1 Go to Supabase SQL Editor
- Open: https://supabase.com/dashboard
- Select your project
- Click "SQL Editor" in left sidebar
- Click "+ New query"

#### 6.2 Run Each Migration
Copy and paste each file in order:

1. **backend/migrations/001_create_bookmarks.sql**
   - Paste entire contents
   - Click "Run" or press `Ctrl+Enter`
   - Wait for "Success"

2. **backend/migrations/002_create_search_history.sql**
   - Paste entire contents
   - Click "Run"
   - Wait for "Success"

3. **backend/migrations/003_create_user_preferences.sql**
   - Paste entire contents
   - Click "Run"
   - Wait for "Success"

4. **backend/migrations/004_create_import_jobs.sql**
   - Paste entire contents
   - Click "Run"
   - Wait for "Success"

5. **backend/migrations/005_create_rls_policies.sql**
   - Paste entire contents
   - Click "Run"
   - Wait for "Success"

#### 6.3 Verify Tables Created
- Go to "Table Editor" in Supabase
- You should see 4 new tables:
  - bookmarks
  - search_history
  - user_preferences
  - import_jobs

---

### Step 7: Test All Connections (1 minute)

```bash
npm run test:connections
```

**Expected output:**
```
🧪 Testing connections to all services...

Testing Qdrant Cloud... ✅ Connected! Found 1 collections
Testing Supabase... ✅ Connected! Database accessible
Testing Google Gemini... ✅ Connected! Response: "Hello..."
Testing Google Embeddings... ✅ Connected! Generated 768d vector
Testing Jina AI... ✅ Connected without API key (free tier)! Extracted 1234 characters

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Connection Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Successful: 5/5
❌ Failed: 0/5

🎉 All connections successful! Ready to start development.
```

If any tests fail, double-check the corresponding API key in `.env.local`

---

## 🎉 Success Criteria

You're done with Week 1 setup when:

- [x] ✅ All accounts created
- [x] ✅ Google OAuth configured
- [x] ✅ All API keys collected
- [x] ✅ .env.local file configured
- [x] ✅ Dependencies installed
- [x] ✅ Qdrant collection created
- [x] ✅ Supabase tables created
- [x] ✅ All connection tests passing

---

## 📊 Your Progress

Current status: **In Progress - Step ?**

---

## 🆘 Troubleshooting

### "Cannot connect to Qdrant"
- Check QDRANT_URL has `https://` prefix
- Verify API key is correct (no extra spaces)
- Ensure cluster is active in Qdrant dashboard

### "Supabase connection failed"
- Verify SUPABASE_URL format
- Check you're using correct key (anon vs service_role)
- Ensure project is not paused

### "Google AI API error"
- Verify API key is correct
- Check Generative Language API is enabled
- Ensure you have free quota remaining

### "OAuth client ID invalid"
- Check you copied full Client ID
- Verify Client Secret matches
- Ensure redirect URIs are exactly: `http://localhost:3000/api/auth/callback`

### "npm install fails"
- Ensure Node.js >= 18: `node --version`
- Clear cache: `npm cache clean --force`
- Delete node_modules and retry

---

## 🎯 Next Steps After Setup

Once all tests pass, you're ready for **Week 2: Backend API Development**

We'll implement:
1. Authentication service
2. Qdrant integration layer
3. Supabase integration layer
4. Basic CRUD operations

---

## 📝 Notes

- Keep your `.env.local` file SECRET (already in .gitignore)
- Never commit API keys to Git
- Jina AI key is optional for now (free tier works)
- Vercel token not needed until deployment (Week 10)

---

**Ready to start? Let me know when you're done with setup!**
