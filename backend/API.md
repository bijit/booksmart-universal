# BookSmart API Documentation

Complete REST API documentation for BookSmart backend.

**Base URL:** `http://localhost:3000/api`

---

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### Register User

**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name" // optional
}
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1234567890
  }
}
```

### Login

**POST** `/auth/login`

Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "user": { "id": "uuid", "email": "user@example.com", "name": "User Name" },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1234567890
  }
}
```

### Refresh Token

**POST** `/auth/refresh`

Refresh an expired access token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Response:** `200 OK`
```json
{
  "message": "Token refreshed successfully",
  "session": {
    "access_token": "new_jwt_token",
    "refresh_token": "new_refresh_token",
    "expires_at": 1234567890
  }
}
```

### Get Current User

**GET** `/auth/me` 🔒

Get currently authenticated user info.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "created_at": "2025-10-19T00:00:00Z"
  }
}
```

---

## Bookmarks

All bookmark endpoints require authentication.

### Create Bookmark

**POST** `/bookmarks` 🔒

Create a new bookmark. Returns immediately while AI processes in background.

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title" // optional
}
```

**Response:** `201 Created`
```json
{
  "message": "Bookmark created successfully",
  "bookmark": {
    "id": "uuid",
    "url": "https://example.com/article",
    "title": "Article Title",
    "status": "pending",
    "created_at": "2025-10-19T00:00:00Z"
  }
}
```

**Processing States:**
- `pending` - Waiting for background worker
- `processing` - Currently being processed
- `completed` - AI processing complete
- `failed` - Processing failed (see error_message)

### List Bookmarks

**GET** `/bookmarks?limit=50&offset=0&status=completed` 🔒

Get user's bookmarks with pagination.

**Query Parameters:**
- `limit` (number, default: 50) - Results per page
- `offset` (number, default: 0) - Pagination offset
- `status` (string, optional) - Filter by status

**Response:** `200 OK`
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "title": "AI-Generated Title",
      "description": "AI-generated description...",
      "tags": ["ai", "machine-learning"],
      "processing_status": "completed",
      "created_at": "2025-10-19T00:00:00Z",
      "updated_at": "2025-10-19T00:00:10Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

### Get Bookmark

**GET** `/bookmarks/:id` 🔒

Get a single bookmark with full content.

**Response:** `200 OK`
```json
{
  "bookmark": {
    "id": "uuid",
    "url": "https://example.com",
    "title": "AI-Generated Title",
    "description": "Full AI-generated description",
    "content": "Full extracted content from URL...",
    "tags": ["tag1", "tag2"],
    "processing_status": "completed",
    "qdrant_point_id": "uuid",
    "created_at": "2025-10-19T00:00:00Z"
  }
}
```

### Update Bookmark

**PUT** `/bookmarks/:id` 🔒

Update bookmark title and tags.

**Request Body:**
```json
{
  "title": "New Title",
  "tags": ["new", "tags"]
}
```

**Response:** `200 OK`
```json
{
  "message": "Bookmark updated successfully",
  "bookmark": { /* updated bookmark */ }
}
```

### Delete Bookmark

**DELETE** `/bookmarks/:id` 🔒

Delete a bookmark (removes from both Supabase and Qdrant).

**Response:** `200 OK`
```json
{
  "message": "Bookmark deleted successfully"
}
```

---

## Search

All search endpoints require authentication.

### Semantic Search

**POST** `/search` 🔒

Search bookmarks using natural language queries with AI.

**Request Body:**
```json
{
  "query": "machine learning algorithms",
  "limit": 10,
  "scoreThreshold": 0.5,
  "searchType": "hybrid",  // "semantic" or "hybrid"
  "tags": ["ai", "python"] // optional filter
}
```

**Parameters:**
- `query` (string, required) - Natural language search query
- `limit` (number, 1-100, default: 10) - Max results
- `scoreThreshold` (number, 0-1, default: 0.5) - Minimum relevance score
- `searchType` (string, default: "hybrid") - "semantic" or "hybrid"
- `tags` (array, optional) - Filter by tags

**Response:** `200 OK`
```json
{
  "query": "machine learning algorithms",
  "searchType": "hybrid",
  "results": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "title": "Machine Learning Guide",
      "description": "Introduction to ML algorithms...",
      "tags": ["ai", "ml"],
      "score": 0.85,
      "semantic_score": 0.78,
      "text_match_score": 0.92,
      "created_at": "2025-10-19T00:00:00Z"
    }
  ],
  "total": 1,
  "options": {
    "limit": 10,
    "scoreThreshold": 0.5,
    "tags": null
  }
}
```

**Search Types:**
- `semantic` - Pure vector similarity search (AI understanding)
- `hybrid` - Combines semantic (60%) + text matching (40%)

### Search by Tags

**GET** `/search/tags?tags=ai&tags=python&limit=50` 🔒

Search bookmarks by tags only (fast, no AI).

**Query Parameters:**
- `tags` (string or array, required) - Tag(s) to search
- `limit` (number, default: 50) - Max results

**Response:** `200 OK`
```json
{
  "tags": ["ai", "python"],
  "results": [/* array of bookmarks */],
  "total": 5
}
```

---

## User Preferences

All preference endpoints require authentication.

### Get Preferences

**GET** `/preferences` 🔒

Get user's preferences and settings.

**Response:** `200 OK`
```json
{
  "preferences": {
    "default_tags": ["work", "research"],
    "auto_extract": true,
    "search_threshold": 0.5,
    "max_results": 20,
    "created_at": "2025-10-19T00:00:00Z",
    "updated_at": "2025-10-19T00:00:00Z"
  }
}
```

### Update Preferences

**PUT** `/preferences` 🔒

Update user preferences (partial updates supported).

**Request Body:**
```json
{
  "default_tags": ["work", "learning"],
  "auto_extract": true,
  "search_threshold": 0.7,
  "max_results": 30
}
```

**Parameters:**
- `default_tags` (array) - Tags automatically applied to new bookmarks
- `auto_extract` (boolean) - Enable/disable automatic content extraction
- `search_threshold` (number, 0-1) - Default search relevance threshold
- `max_results` (number, 1-100) - Default max search results

**Response:** `200 OK`
```json
{
  "message": "Preferences updated successfully",
  "preferences": { /* updated preferences */ }
}
```

---

## Health Check

### Server Health

**GET** `/health`

Check server health and status (no authentication required).

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-10-19T00:00:00Z",
  "uptime": 123.456,
  "environment": "development"
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Detailed error message",
  "timestamp": "2025-10-19T00:00:00Z"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have access to this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Operation failed"
}
```

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Authenticated: 1000 requests per 15 minutes per user

---

## Background Processing

Bookmarks are processed asynchronously:

1. **User creates bookmark** → Saved as "pending"
2. **API returns immediately** (< 100ms)
3. **Background worker processes** (every 5 seconds):
   - Extract content with Jina AI
   - Generate title + description with Gemini
   - Create 768D embedding vector
   - Store in Qdrant vector database
4. **Status updated to "completed"** (~10 seconds total)

Users can poll GET `/bookmarks/:id` to check processing status.

---

## Development

### Start Server
```bash
npm start              # Production
npm run dev            # Development (nodemon)
```

### Run Tests
```bash
npm run test:connections  # Test all service connections
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are UUIDs
- Semantic search uses 768-dimensional vectors (Google text-embedding-004)
- Vector similarity uses cosine distance
- Hybrid search: 60% semantic + 40% text matching
