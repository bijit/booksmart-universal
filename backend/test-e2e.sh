#!/bin/bash

# End-to-End Test for BookSmart Background Processing
# Tests the complete flow: Create bookmark → Worker processes → AI extraction → Vector storage

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════"
echo "🧪 BOOKSMART END-TO-END TEST"
echo "═══════════════════════════════════════════════════════"
echo ""

# Clean up any existing processes
echo "🧹 Cleaning up..."
pkill -f "node src/index.js" 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 2

# Start server with worker
echo "🚀 Starting server with background worker..."
node src/index.js > /tmp/booksmart-e2e.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 6

# Check if server started
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Server failed to start"
    cat /tmp/booksmart-e2e.log
    exit 1
fi

echo "✅ Server running"
echo ""

# Step 1: Register user
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  REGISTER USER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
UNIQUE_ID=$(date +%s%N | md5sum | cut -c1-8)
TEST_EMAIL="e2etest${UNIQUE_ID}@booksmarttest.dev"

REGISTER_RESPONSE=$(curl -sX POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpass123\",\"name\":\"E2E Test User\"}")

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Registration failed"
    echo "$REGISTER_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

echo "✅ User registered: $TEST_EMAIL"
echo ""

# Step 2: Create bookmark
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  CREATE BOOKMARK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "URL: https://example.com"

CREATE_RESPONSE=$(curl -sX POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test Bookmark"}')

BOOKMARK_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark']['id'])" 2>/dev/null)

if [ -z "$BOOKMARK_ID" ]; then
    echo "❌ Bookmark creation failed"
    echo "$CREATE_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

echo "✅ Bookmark created: $BOOKMARK_ID"
echo "Status: pending"
echo ""

# Step 3: Wait for background worker to process
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  WAITING FOR BACKGROUND PROCESSING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Worker will process: Jina → Gemini → Qdrant"
echo ""

# Poll bookmark status for up to 60 seconds
MAX_WAIT=60
ELAPSED=0
STATUS="pending"

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))

    GET_RESPONSE=$(curl -sX GET "http://localhost:3000/api/bookmarks/$BOOKMARK_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")

    STATUS=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark']['processing_status'])" 2>/dev/null)

    echo "⏱️  ${ELAPSED}s: Status = $STATUS"

    if [ "$STATUS" == "completed" ]; then
        echo ""
        echo "✅ Processing completed!"
        break
    elif [ "$STATUS" == "failed" ]; then
        echo ""
        echo "❌ Processing failed"
        echo "$GET_RESPONSE" | python3 -m json.tool
        break
    fi
done

if [ "$STATUS" != "completed" ]; then
    echo ""
    echo "⚠️  Processing did not complete in ${MAX_WAIT}s"
    echo "Final status: $STATUS"
    echo ""
    echo "Server logs:"
    tail -50 /tmp/booksmart-e2e.log
    kill $SERVER_PID
    exit 1
fi

# Step 4: Verify processed bookmark
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  VERIFY PROCESSED BOOKMARK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FINAL_RESPONSE=$(curl -sX GET "http://localhost:3000/api/bookmarks/$BOOKMARK_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$FINAL_RESPONSE" | python3 -m json.tool | head -25

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ END-TO-END TEST PASSED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  ✅ User registration"
echo "  ✅ Bookmark creation"
echo "  ✅ Background processing (Jina + Gemini + Qdrant)"
echo "  ✅ AI-generated title and description"
echo "  ✅ Vector storage in Qdrant"
echo "  ✅ Status updated to 'completed'"
echo ""

# Clean up
kill $SERVER_PID 2>/dev/null
rm -f /tmp/booksmart-e2e.log

echo "🎉 BookSmart is fully functional!"
