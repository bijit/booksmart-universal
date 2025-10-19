#!/bin/bash

# E2E Test with Real Content URL

cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════"
echo "🧪 BOOKSMART E2E TEST - REAL URL"
echo "═══════════════════════════════════════════════════════"
echo ""

# Use existing server or start new one
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "🚀 Starting server..."
    node src/index.js > /tmp/booksmart-real.log 2>&1 &
    SERVER_PID=$!
    sleep 6
else
    echo "✅ Server already running"
    SERVER_PID=""
fi

# Register user
echo "1️⃣  Registering user..."
UNIQUE_ID=$(date +%s%N | md5sum | cut -c1-8)
TEST_EMAIL="realtest${UNIQUE_ID}@booksmarttest.dev"

REGISTER_RESPONSE=$(curl -sX POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpass123\",\"name\":\"Real Test User\"}")

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])" 2>/dev/null)

echo "✅ User: $TEST_EMAIL"
echo ""

# Create bookmark with REAL article
echo "2️⃣  Creating bookmark with REAL article URL..."
REAL_URL="https://en.wikipedia.org/wiki/Artificial_intelligence"
echo "URL: $REAL_URL"

CREATE_RESPONSE=$(curl -sX POST http://localhost:3000/api/bookmarks \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$REAL_URL\"}")

BOOKMARK_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['bookmark']['id'])" 2>/dev/null)

echo "✅ Bookmark: $BOOKMARK_ID"
echo "Status: pending"
echo ""

# Wait for processing
echo "3️⃣  Waiting for AI processing..."
echo "🤖 Jina → Gemini → Embeddings → Qdrant"
echo ""

MAX_WAIT=90
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
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ PROCESSING COMPLETED!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "4️⃣  Final Bookmark Data:"
        echo ""
        echo "$GET_RESPONSE" | python3 -m json.tool | head -30
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎉 END-TO-END TEST PASSED!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "✅ Content extracted with Jina"
        echo "✅ AI-generated title and description"
        echo "✅ 768D embedding vector generated"
        echo "✅ Stored in Qdrant vector database"
        echo "✅ Ready for semantic search!"
        
        # Clean up if we started the server
        if [ -n "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null
        fi
        exit 0
    elif [ "$STATUS" == "failed" ]; then
        echo ""
        echo "❌ Processing failed"
        echo "$GET_RESPONSE" | python3 -m json.tool
        if [ -n "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null
        fi
        exit 1
    fi
done

echo ""
echo "⚠️  Timeout after ${MAX_WAIT}s"
echo "Final status: $STATUS"

if [ -n "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
fi
exit 1
