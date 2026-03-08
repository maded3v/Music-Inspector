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

## Deploy (Vercel + GitHub)
1. Push repository to GitHub.
2. Import repository in Vercel.
3. Add environment variables in Vercel project settings:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `FRONTEND_URL` (set to your production domain)
4. Deploy.

Notes:
- API requests are routed through `api/index.js`.
- Static files are served from `public/`.

## Scripts
- `npm run dev` - run local server
- `npm start` - production server start
- `npm run setup-db` - setup database
- `npm run migrate` - run migrations
- `npm run promote-admin` - grant admin role
- `npm run set-mi-reviewers` - set MI reviewers
