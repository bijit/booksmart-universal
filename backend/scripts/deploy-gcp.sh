#!/bin/bash

# BookSmart GCP Deployment Script
# This script deploys:
# 1. Crawl4AI (Content Extraction Service)
# 2. BookSmart Backend

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1" # Change this if needed

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No GCP project ID found. Please set your project using 'gcloud config set project [PROJECT_ID]'"
    exit 1
fi

# Check for required environment variables
MISSING_VARS=()
[ -z "$SUPABASE_URL" ] && MISSING_VARS+=("SUPABASE_URL")
[ -z "$SUPABASE_ANON_KEY" ] && MISSING_VARS+=("SUPABASE_ANON_KEY")
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
[ -z "$QDRANT_URL" ] && MISSING_VARS+=("QDRANT_URL")
[ -z "$QDRANT_API_KEY" ] && MISSING_VARS+=("QDRANT_API_KEY")
[ -z "$GOOGLE_AI_API_KEY" ] && MISSING_VARS+=("GOOGLE_AI_API_KEY")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing environment variables in your terminal:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please export them before running this script, for example:"
    echo "export SUPABASE_URL='your_url_here'"
    exit 1
fi

echo "🚀 Starting deployment to GCP Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Navigate to backend directory relative to this script
cd "$(dirname "$0")/.."


# 2. Deploy BookSmart Backend
echo "--------------------------------------------------"
echo "📦 Step 2: Deploying BookSmart Backend..."
echo "--------------------------------------------------"

BACKEND_SERVICE_NAME="booksmart-backend"

# Build the backend image using Cloud Build
echo "🏗️  Building backend container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME

# Deploy backend to Cloud Run
echo "🚢 Deploying backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3000 \
    --memory 2Gi \
    --cpu 1 \
    --timeout 600 \
    --set-env-vars="NODE_ENV=production,SUPABASE_URL=$SUPABASE_URL,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,QDRANT_URL=$QDRANT_URL,QDRANT_API_KEY=$QDRANT_API_KEY,GOOGLE_AI_API_KEY=$GOOGLE_AI_API_KEY,MANAGER_BASE_URL=$MANAGER_BASE_URL"

echo "--------------------------------------------------"
echo "✅ All deployments complete!"
echo "--------------------------------------------------"

# Get the URL of the backend service
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')
echo "🌍 Backend URL: $BACKEND_URL"
echo "👉 Update your VITE_API_BASE_URL in manager/.env.development to: $BACKEND_URL/api"
echo "👉 Update API_BASE_URL in extension/src/config.js to: $BACKEND_URL/api"
echo "--------------------------------------------------"
