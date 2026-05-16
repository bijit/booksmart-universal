#!/bin/bash

# BookSmart Manager GCP Deployment Script
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
MANAGER_SERVICE_NAME="booksmart-manager"

# Navigate to manager directory
cd "$(dirname "$0")/.."

echo "🚀 Deploying BookSmart Manager to Cloud Run..."
echo "Project ID: $PROJECT_ID"

# Build the manager image using Cloud Build
echo "🏗️  Building manager container image..."
gcloud builds submit . \
    --config=cloudbuild.yaml \
    --substitutions=_VITE_API_BASE_URL="$VITE_API_BASE_URL",_VITE_SUPABASE_URL="$VITE_SUPABASE_URL",_VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY"


# Deploy to Cloud Run
echo "🚢 Deploying manager to Cloud Run..."
gcloud run deploy $MANAGER_SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$MANAGER_SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 80

echo "--------------------------------------------------"
MANAGER_URL=$(gcloud run services describe $MANAGER_SERVICE_NAME --platform managed --region $REGION --format='value(status.url)')
echo "🌍 Manager URL: $MANAGER_URL"
echo "--------------------------------------------------"
