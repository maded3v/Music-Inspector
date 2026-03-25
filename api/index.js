const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

if (process.env.FRONTEND_URL) {
  allowedOrigins.add(process.env.FRONTEND_URL);
}

if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
const authRoutes = require('./auth');
const trackRoutes = require('./tracks');
const reviewRoutes = require('./reviews');
const adminRoutes = require('./admin');
const artistRoutes = require('./artists');
const { getCurrentUser } = require('./middleware');

// Auth routes
app.post('/api/register', authRoutes.register);
app.post('/api/login', authRoutes.login);
app.post('/api/logout', authRoutes.logout);
app.get('/api/user', authRoutes.getUser);
app.get('/api/user/current', getCurrentUser);

// Track routes
app.post('/api/tracks/create', trackRoutes.createTrack);
app.get('/api/tracks/latest', trackRoutes.getLatestTracks);
app.get('/api/tracks/monthly-albums', trackRoutes.getMonthlyAlbums);
app.get('/api/tracks/catalog', trackRoutes.getCatalog);
app.get('/api/tracks/:id', trackRoutes.getTrack);

// Review routes
app.post('/api/reviews/add', reviewRoutes.addReview);
app.get('/api/reviews/by-track/:id', reviewRoutes.getReviewsByTrack);
app.get('/api/reviews/latest', reviewRoutes.getLatestReviews);
app.post('/api/mi-review', reviewRoutes.generateMIReview);

// Artist routes
app.get('/api/artists', artistRoutes.getAllArtists);
app.get('/api/artists/search', artistRoutes.searchArtists);
app.get('/api/artists/:id', artistRoutes.getArtist);
app.get('/api/artists/:id/stats', artistRoutes.getArtistWithStats);
app.post('/api/artists', artistRoutes.createArtist);
app.put('/api/artists/:id', artistRoutes.updateArtist);

// Upload routes
const uploadRoutes = require('./upload');
app.post('/api/upload/cover', uploadRoutes.uploadCover);
app.post('/api/upload/artist', uploadRoutes.uploadArtistImage);
app.post('/api/upload/avatar', uploadRoutes.uploadAvatar);

// User routes
const userRoutes = require('./users');
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;
