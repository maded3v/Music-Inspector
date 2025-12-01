const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
const authRoutes = require('./auth');
const trackRoutes = require('./tracks');
const reviewRoutes = require('./reviews');

// Auth routes
app.post('/api/register', authRoutes.register);
app.post('/api/login', authRoutes.login);
app.get('/api/user', authRoutes.getUser);

// Track routes
app.post('/api/tracks/create', trackRoutes.createTrack);
app.get('/api/tracks/latest', trackRoutes.getLatestTracks);
app.get('/api/tracks/catalog', trackRoutes.getCatalog);
app.get('/api/tracks/:id', trackRoutes.getTrack);

// Review routes
app.post('/api/reviews/add', reviewRoutes.addReview);
app.get('/api/reviews/by-track/:id', reviewRoutes.getReviewsByTrack);
app.get('/api/reviews/latest', reviewRoutes.getLatestReviews);
app.post('/api/mi-review', reviewRoutes.generateMIReview);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;
