# Music Inspector

Music platform with user auth, releases, reviews, artist pages and admin moderation.

## Stack
- Node.js + Express
- PostgreSQL
- Static frontend (HTML/CSS/JS)
- API in `api/`

## Run after cloning from GitHub
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and set real values.
3. Run SQL schema/migrations in your PostgreSQL.
4. Start app:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

## Required environment variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - secret for auth tokens
- `FRONTEND_URL` - frontend origin for CORS (for local: `http://localhost:3000`)

Example:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:3000
```

## Deploy (Render API + Vercel Frontend)
1. Push repository to GitHub.
2. Create Render Web Service from this repo (Blueprint): `render.yaml`.
3. In Render set secrets:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `BLOB_READ_WRITE_TOKEN` (optional, if uploads are stored in Vercel Blob)
4. Keep `FRONTEND_URL=https://music-inspector.vercel.app` in Render env.
5. Deploy frontend on Vercel (static `public/`).
6. Frontend API base is resolved in `public/js/api.js`:
   - Localhost -> same origin (`/api`)
   - Production -> `https://music-inspector-api.onrender.com`
   - If Render gives another hostname, override in browser console:
     `localStorage.setItem('MI_API_BASE', 'https://your-api.onrender.com')`

Notes:
- Render uses `server.js` for API and static serving.
- Cookies are configured for cross-site auth when frontend and API domains differ.

## Scripts
- `npm run dev` - run local server
- `npm start` - production server start
- `npm run setup-db` - setup database
- `npm run migrate` - run migrations
- `npm run promote-admin` - grant admin role
- `npm run set-mi-reviewers` - set MI reviewers
