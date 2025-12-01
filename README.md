# Music Inspector

A modern music platform where users can register, add tracks/albums, and leave reviews.

## Features

- User registration and authentication
- Track and album management
- Review system with 5 criteria scoring
- AI-generated reviews
- Search and filtering
- Responsive design

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (ES6 Modules)
- **Backend:** Node.js, Express (Vercel Serverless)
- **Database:** PostgreSQL (Neon)
- **Authentication:** JWT with httpOnly cookies
- **Deployment:** Vercel

## Project Structure

```
music-inspector/
├── api/                    # Serverless functions
│   ├── auth.js            # Authentication endpoints
│   ├── tracks.js          # Track management
│   ├── reviews.js         # Review system
│   ├── db.js              # Database connection
│   └── index.js           # Main API router
├── public/                # Static files
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   ├── *.html             # HTML pages
│   └── assets/            # Images, etc.
├── schema.sql             # Database schema
├── package.json           # Dependencies
├── vercel.json            # Vercel configuration
└── README.md
```

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Secret key for JWT
   - `FRONTEND_URL`: Frontend URL for CORS
4. Run database migrations: `psql -f schema.sql`
5. Deploy to Vercel: `vercel`

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `GET /api/user` - Get current user

### Tracks
- `POST /api/tracks/create` - Create new track
- `GET /api/tracks/latest` - Get latest tracks
- `GET /api/tracks/catalog` - Get track catalog with search/filter
- `GET /api/tracks/:id` - Get specific track

### Reviews
- `POST /api/reviews/add` - Add review to track
- `GET /api/reviews/by-track/:id` - Get reviews for track
- `GET /api/reviews/latest` - Get latest reviews
- `POST /api/mi-review` - Generate AI review

## Development

Run locally with: `npm run dev`

## License

MIT
