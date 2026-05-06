console.log('--- SERVER STARTUP INITIATED ---');
import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
})); 
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true })); 
app.use(morgan('dev')); 

// Helper for lazy loading routes
const lazyRoute = (modulePath) => async (req, res, next) => {
  try {
    const module = await import(modulePath);
    const router = module.default;
    router(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Mount API routes with dynamic imports to prevent startup blocking
app.use('/api/auth', lazyRoute('./routes/auth.routes.js'));
app.use('/api/bookmarks', lazyRoute('./routes/bookmarks.routes.js'));
app.use('/api/search', lazyRoute('./routes/search.routes.js'));
app.use('/api/preferences', lazyRoute('./routes/preferences.routes.js'));
app.use('/api/import', lazyRoute('./routes/import.routes.js'));
app.use('/api/debug', lazyRoute('./routes/debug.routes.js'));

// Health check endpoint (Directly in index.js for maximum reliability)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from backend/public
const managerPath = resolve(__dirname, '../public');
app.use(express.static(managerPath));

// Serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    });
  }
  res.sendFile(resolve(managerPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('CRITICAL SERVER ERROR:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 BookSmart API Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Initialize services asynchronously AFTER port is bound
  (async () => {
    try {
      console.log('[Init] Port bound. Starting background services...');
      
      const { initializeCollection } = await import('./services/qdrant.service.js');
      const { startWorker } = await import('./workers/bookmark.worker.js');
      
      console.log('[Init] Initializing Qdrant collection...');
      await initializeCollection();
      
      console.log('[Init] Starting background worker...');
      startWorker();
    } catch (err) {
      console.error('❌ Critical Error during deferred initialization:', err.message);
    }
  })();
});

export default app;
