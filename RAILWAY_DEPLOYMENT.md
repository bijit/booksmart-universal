# Railway Deployment Guide for BookSmart

This guide will help you deploy the BookSmart backend to Railway.

---

## Why Railway?

- ✅ **Faster Processing**: 5-15 seconds (vs 30-60s with Vercel cron)
- ✅ **Better UX**: Background worker runs continuously
- ✅ **No Timeouts**: Can process multiple bookmarks in a row
- ✅ **Easy Debugging**: Full server logs
- ✅ **$5 Free Credit/Month**: Enough for testing with friends

**Cost**: ~$5-10/month after free credit

---

## Prerequisites

- GitHub account (Railway connects to your repo)
- All your API keys ready:
  - Supabase URL, Anon Key, Service Role Key
  - Qdrant URL, API Key
  - Gemini API Key
  - Jina API Key (optional)

---

## Step 1: Prepare Your Repository

Your code is already ready! We've added:
- ✅ `backend/railway.json` - Railway configuration
- ✅ `backend/.railwayignore` - Files to exclude
- ✅ `extension/src/config.js` - Configurable API URL

Make sure all changes are committed:

```bash
cd /home/kniyogi/projects/booksmart_v1.0

git add .
git commit -m "feat: Add Railway deployment configuration"
git push origin main
```

---

## Step 2: Sign Up for Railway

1. Go to: https://railway.app
2. Click **"Start a New Project"**
3. Sign in with **GitHub**
4. Authorize Railway to access your repositories

---

## Step 3: Deploy from GitHub

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: **`booksmart`**
4. Railway will detect it's a Node.js app automatically

**Select the Backend Directory:**
- Railway might try to deploy the root
- Click **"Settings"** → **"General"**
- Set **Root Directory**: `backend`
- Click **"Save"**

---

## Step 4: Add Environment Variables

Click **"Variables"** tab and add these:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
GEMINI_API_KEY=your_gemini_api_key
JINA_API_KEY=your_jina_api_key
PORT=3000
NODE_ENV=production
```

**Where to find these:**
- Copy from your local `.env` file in `backend/.env`
- Make sure all values are correct

---

## Step 5: Deploy!

1. Railway will automatically deploy after you add variables
2. Wait 2-3 minutes for deployment
3. Check the **"Deployments"** tab for progress

**Look for:**
```
✅ Build successful
✅ Deploy successful
🚀 BookSmart API Server
📡 Server running on: http://0.0.0.0:3000
```

---

## Step 6: Get Your Railway URL

1. Click **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Railway will give you a URL like:
   ```
   https://booksmart-production.up.railway.app
   ```
4. **Copy this URL!** You'll need it for the extension.

---

## Step 7: Test the Deployment

Test your deployed backend:

```bash
# Health check
curl https://your-app-name.up.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

---

## Step 8: Update Extension Configuration

Now update the extension to use your Railway URL:

1. Open: `extension/src/config.js`

2. Change the API_BASE_URL:
   ```javascript
   // OLD:
   const API_BASE_URL = 'http://localhost:3000/api';

   // NEW:
   const API_BASE_URL = 'https://your-app-name.up.railway.app/api';
   ```

3. Update manifest.json host permissions:
   ```bash
   # Edit: extension/public/manifest.json
   ```

   Change:
   ```json
   "host_permissions": [
     "http://localhost:3000/*",
     "https://api.booksmart.app/*"
   ]
   ```

   To:
   ```json
   "host_permissions": [
     "http://localhost:3000/*",
     "https://your-app-name.up.railway.app/*"
   ]
   ```

---

## Step 9: Rebuild Extension

```bash
cd extension
./build.sh
```

This will create a new `extension/dist/` folder with the updated config.

---

## Step 10: Create New Extension ZIP

```bash
cd /home/kniyogi/projects/booksmart_v1.0

# Remove old ZIP
rm booksmart-extension.zip

# Create new ZIP with Railway URL
python3 -c "
import zipfile
import os

def zipdir(path, ziph):
    for root, dirs, files in os.walk(path):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, path)
            ziph.write(file_path, arcname)

with zipfile.ZipFile('booksmart-extension.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipdir('extension/dist', zipf)

print('✓ Created booksmart-extension.zip with Railway configuration')
"
```

---

## Step 11: Share with Friends!

Now you can share the extension:

1. Send them `booksmart-extension.zip`
2. Give them instructions from the README "Quick Start (For End Users)"
3. They install extension → Create account → Start bookmarking!

**They'll connect to YOUR Railway backend** - no setup needed on their end!

---

## Monitoring Your Deployment

**View Logs:**
1. Railway Dashboard → Your Project
2. Click **"Deployments"** → Latest deployment
3. Click **"View Logs"**

**You'll see:**
```
🚀 BookSmart API Server
📡 Server running on: http://0.0.0.0:3000
🤖 Starting Bookmark Processing Worker
📊 Poll interval: 5s
```

**Watch Processing in Real-Time:**
```
[Worker] Found 1 pending bookmark(s)
[Worker] Processing bookmark uuid...
[Jina] Extracting content from: https://...
[Gemini] Summarizing content...
[Worker] ✅ Successfully processed bookmark
```

---

## Cost Monitoring

**Free Tier:**
- $5 credit/month
- Covers ~500-1000 users for testing

**View Usage:**
1. Railway Dashboard → Your Project
2. Click **"Usage"**
3. See current month's cost

**After Free Credit:**
- ~$5-10/month depending on usage
- You'll get email warnings before charges

---

## Troubleshooting

### "Build Failed"

**Check:**
- Root directory is set to `backend`
- All environment variables are added
- View build logs for specific errors

### "App Crashed"

**Common causes:**
1. Missing environment variable
2. Invalid API keys
3. Can't connect to Supabase/Qdrant

**Fix:**
- Check logs in Railway dashboard
- Verify all API keys are correct
- Test connections locally first

### "Extension Can't Connect"

**Check:**
1. Railway app is running (not crashed)
2. Railway URL is correct in `config.js`
3. Manifest `host_permissions` includes Railway URL
4. Rebuilt extension after changes
5. Reloaded extension in Chrome

---

## Updating Your Deployment

When you make code changes:

```bash
# Commit changes
git add .
git commit -m "fix: your change description"
git push origin main

# Railway auto-deploys!
# Check "Deployments" tab for progress
```

Railway will:
1. Detect the push
2. Rebuild automatically
3. Deploy new version
4. Zero downtime!

---

## Rolling Back

If something breaks:

1. Railway Dashboard → **"Deployments"**
2. Find last working deployment
3. Click **"•••"** → **"Redeploy"**
4. Previous version is live again!

---

## Next Steps

Once deployed:

1. ✅ Test with your own account
2. ✅ Invite a friend to test
3. ✅ Monitor logs for any errors
4. ✅ Watch the costs in usage tab

**You're live!** 🚀

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check Railway logs for errors
- Test locally first with `npm run dev`

---

**Happy Deploying!** 🎉
