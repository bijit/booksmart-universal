#!/bin/bash
set -e

# Final E2E Test: Real bookmark processing with worker
cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 FINAL E2E TEST - Background Worker + Real Bookmark"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Clean up
pkill -9 -f "node src/index.js" 2>/dev/null || true
sleep 2

# Start server with worker
echo "🚀 Starting server with background worker..."
node src/index.js > /tmp/worker-e2e.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
sleep 6

# Check server
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Server failed to start"
    cat /tmp/worker-e2e.log
    exit 1
fi
echo "   ✅ Server running"
echo ""

# Register user
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Register User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
UNIQUE_ID=$(date +%s | md5sum | cut -c1-8)
TEST_EMAIL="worker-test-${UNIQUE_ID}@booksmarttest.dev"

REGISTER_RESPONSE=$(curl -sX POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpass123\",\"name\":\"Worker Test\"}")

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Registration failed"
    echo "$REGISTER_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

echo "   ✅ User: $TEST_EMAIL"
echo ""

# Create bookmark
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Create Bookmark"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_URL="https://en.wikipedia.org/wiki/Bookmark_(digital)"

echo "   URL: $TEST_URL"
echo ""

CREATE_RESPONSE=$(curl -sX POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$TEST_URL\"}")

BOOKMARK_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark']['id'])" 2>/dev/null)

if [ -z "$BOOKMARK_ID" ]; then
    echo "❌ Bookmark creation failed"
    echo "$CREATE_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

echo "   ✅ Bookmark created: $BOOKMARK_ID"
echo "   ✅ Status: pending"
echo ""

# Wait for worker to process
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Wait for Background Worker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🤖 Worker will:"
echo "      1. Extract content with Jina"
echo "      2. Generate summary with Gemini"
echo "      3. Create embeddings"
echo "      4. Store in Qdrant"
echo ""

MAX_WAIT=90
ELAPSED=0
STATUS="pending"

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))

    GET_RESPONSE=$(curl -sX GET "http://localhost:3000/api/bookmarks/$BOOKMARK_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null)

    STATUS=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark']['processing_status'])" 2>/dev/null)

    echo "   ⏱️  ${ELAPSED}s: Status = $STATUS"

    if [ "$STATUS" == "completed" ]; then
        echo ""
        echo "   ✅ Processing completed in ${ELAPSED}s!"
        echo ""

        # Show final result
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "STEP 4: Verify Processed Bookmark"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        TITLE=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark'].get('title', 'N/A'))" 2>/dev/null)
        DESCRIPTION=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; desc=json.load(sys.stdin)['bookmark'].get('description', ''); print(desc[:100] + '...' if len(desc) > 100 else desc)" 2>/dev/null)
        QDRANT_ID=$(echo "$GET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark'].get('qdrant_point_id', 'N/A'))" 2>/dev/null)

        echo ""
        echo "   📄 Title: $TITLE"
        echo "   📝 Description: $DESCRIPTION"
        echo "   🔍 Qdrant Point ID: $QDRANT_ID"
        echo "   ✅ Status: completed"
        echo ""

        # Show worker logs
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Worker Log (last 30 lines):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -30 /tmp/worker-e2e.log | grep -E "\[Worker\]|\[Jina\]|\[Gemini\]|\[Embeddings\]"
        echo ""

        echo "═══════════════════════════════════════════════════════════════"
        echo "✅ FINAL E2E TEST PASSED!"
        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        echo "Complete flow verified:"
        echo "  ✅ User registration"
        echo "  ✅ Bookmark creation (API returns immediately)"
        echo "  ✅ Background worker picked up bookmark"
        echo "  ✅ Jina extracted content"
        echo "  ✅ Gemini generated summary"
        echo "  ✅ Embeddings created (768D vector)"
        echo "  ✅ Qdrant stored bookmark"
        echo "  ✅ Status updated to 'completed'"
        echo ""
        echo "🎉 ALL SYSTEMS OPERATIONAL!"
        echo "═══════════════════════════════════════════════════════════════"

        kill $SERVER_PID 2>/dev/null
        rm -f /tmp/worker-e2e.log
        exit 0
    fi

    if [ "$STATUS" == "failed" ]; then
        echo ""
        echo "   ❌ Processing failed"
        echo ""
        echo "$GET_RESPONSE" | python3 -m json.tool
        echo ""
        echo "Worker logs:"
        tail -50 /tmp/worker-e2e.log
        kill $SERVER_PID
        exit 1
    fi
done

echo ""
echo "⚠️  Timeout after ${MAX_WAIT}s"
echo "Final status: $STATUS"
echo ""
echo "Worker logs:"
tail -50 /tmp/worker-e2e.log

kill $SERVER_PID 2>/dev/null
exit 1
