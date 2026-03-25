// Local development server
// Runs Express app to serve both API and static files

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware (must be before routes)
app.use(cors({
  origin: process.env.FRONTEND_URL || true, // Allow all origins in development
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Load API routes
const authRoutes = require('./api/auth');
const trackRoutes = require('./api/tracks');
const reviewRoutes = require('./api/reviews');
const adminRoutes = require('./api/admin');
const artistRoutes = require('./api/artists');
const uploadRoutes = require('./api/upload');
const { getCurrentUser } = require('./api/middleware');

// API routes (must be before static files)
app.post('/api/register', authRoutes.register);
app.post('/api/login', authRoutes.login);
app.post('/api/logout', authRoutes.logout);
app.get('/api/user', authRoutes.getUser);
app.get('/api/user/current', getCurrentUser);

app.post('/api/tracks/create', trackRoutes.createTrack);
app.get('/api/tracks/latest', trackRoutes.getLatestTracks);
app.get('/api/tracks/monthly-albums', trackRoutes.getMonthlyAlbums);
app.get('/api/tracks/catalog', trackRoutes.getCatalog);
app.get('/api/tracks/:id', trackRoutes.getTrack);

app.post('/api/reviews/add', reviewRoutes.addReview);
app.get('/api/reviews/by-track/:id', reviewRoutes.getReviewsByTrack);
app.get('/api/reviews/latest', reviewRoutes.getLatestReviews);
app.post('/api/mi-review', reviewRoutes.generateMIReview);

app.get('/api/artists', artistRoutes.getAllArtists);
app.get('/api/artists/search', artistRoutes.searchArtists);
app.get('/api/artists/:id', artistRoutes.getArtist);
app.get('/api/artists/:id/stats', artistRoutes.getArtistWithStats);
app.post('/api/artists', artistRoutes.createArtist);
app.put('/api/artists/:id', artistRoutes.updateArtist);

app.post('/api/upload/cover', uploadRoutes.uploadCover);
app.post('/api/upload/artist', uploadRoutes.uploadArtistImage);
app.post('/api/upload/avatar', uploadRoutes.uploadAvatar);

// User routes
const userRoutes = require('./api/users');
app.get('/api/users/:userId/stats', userRoutes.getUserStats);
app.get('/api/users/:userId/reviews', userRoutes.getUserReviews);
app.get('/api/users/:userId/releases', userRoutes.getUserReleases);

// Admin routes
app.get('/api/admin/moderation-queue', adminRoutes.getModerationQueue);
app.post('/api/admin/releases/:id/approve', adminRoutes.approveRelease);
app.post('/api/admin/releases/:id/reject', adminRoutes.rejectRelease);
app.delete('/api/admin/releases/:id', adminRoutes.deleteRelease);
app.get('/api/admin/tracks', adminRoutes.getAllTracks);
app.get('/api/admin/reviews/moderation-queue', adminRoutes.getReviewModerationQueue);
app.post('/api/admin/reviews/:id/approve', adminRoutes.approveReview);
app.post('/api/admin/reviews/:id/reject', adminRoutes.rejectReview);
app.delete('/api/admin/reviews/:id', adminRoutes.deleteReview);
app.post('/api/admin/promote', adminRoutes.promoteToAdmin);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const { checkDatabaseHealth } = require('./api/db');
  
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.connected) {
      res.json({ 
        status: 'OK',
        database: {
          connected: true,
          database: dbHealth.database,
          version: dbHealth.version
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'SERVICE_UNAVAILABLE',
        database: {
          connected: false,
          error: dbHealth.error,
          errorCode: dbHealth.errorCode
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'SERVICE_UNAVAILABLE',
      database: {
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Serve static files from public directory (after API routes)
// This will automatically serve HTML files like register.html, login.html, etc.
// Set index to false so we handle index.html explicitly
app.use(express.static(path.join(__dirname, 'public'), { 
  index: false,
  extensions: ['html', 'css', 'js', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'ico']
}));

// Explicitly handle root path - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all middleware: serve index.html ONLY for routes without file extensions
// This runs only if express.static didn't find a matching file
app.use((req, res, next) => {
  // Don't interfere with API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // If path has a file extension, it should have been served by static middleware
  // If it wasn't found, return 404
  if (req.path.includes('.')) {
    return res.status(404).send('File not found');
  }
  
  // For paths without extensions (like /sign-in, /sign-up), serve index.html
  // This allows SPA-style routing if needed in the future
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Wait for database connection before starting server
const { getConnectionStatus, connectionPromise } = require('./api/db');

// Start server only after database connection is established
async function startServer() {
  try {
    // Wait for database connection test to complete
    console.log('⏳ Waiting for database connection...');
    await connectionPromise;
    
    const dbStatus = getConnectionStatus();
    
    if (!dbStatus.connected) {
      console.error('❌ CRITICAL: Cannot start server - database connection not established');
      console.error('   Last error:', dbStatus.lastError);
      console.error('   Please check database configuration and ensure database server is running');
      process.exit(1);
    }
    
    // Database is connected, start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
      console.log(`🔌 API endpoints available at: http://localhost:${PORT}/api/*`);
      console.log(`💾 Database: Connected`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ CRITICAL: Failed to establish database connection:', error.message);
    console.error('   Server will not start without database connection');
    process.exit(1);
  }
}

// Start server after DB connection is established
startServer();

