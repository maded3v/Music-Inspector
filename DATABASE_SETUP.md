# Database Setup Guide

This guide will help you set up the PostgreSQL database for Music Inspector.

## Prerequisites

- PostgreSQL installed and running
- Node.js and npm installed
- Database credentials (host, port, username, password, database name)

## Option 1: Automated Setup (Recommended)

### Step 1: Create `.env` file

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/music_inspector
JWT_SECRET=your-secret-key-here
FRONTEND_URL=http://localhost:3000
```

**Important:** Replace the values with your actual database credentials.

### Step 2: Run Setup Script

The setup script will:
- Create the database if it doesn't exist
- Run all migrations in order
- Set up all tables, indexes, and views

```bash
node scripts/setup-database.js
```

Or if you want to specify the database URL directly:

```bash
node scripts/setup-database.js postgresql://user:pass@host:port/dbname
```

### Step 3: Verify Setup

Check that tables were created:

```bash
psql $DATABASE_URL -c "\dt"
```

You should see tables: `users`, `tracks`, `reviews`, `artists`, and view `popular_releases`.

## Option 2: Manual Setup

### Step 1: Create Database

Connect to PostgreSQL and create the database:

```bash
psql -U postgres
```

Then in psql:

```sql
CREATE DATABASE music_inspector;
\q
```

### Step 2: Run Migrations

Run each migration file in order:

```bash
psql $DATABASE_URL -f migrations/001_add_user_roles.sql
psql $DATABASE_URL -f migrations/002_create_artists.sql
psql $DATABASE_URL -f migrations/003_add_track_moderation.sql
psql $DATABASE_URL -f migrations/004_update_image_storage.sql
psql $DATABASE_URL -f migrations/005_add_review_mi_flag.sql
psql $DATABASE_URL -f migrations/006_create_popular_releases.sql
```

Or run all at once:

```bash
for file in migrations/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### Step 3: Verify Setup

```bash
psql $DATABASE_URL -c "\dt"
```

## Option 3: Using Docker (Alternative)

If you don't have PostgreSQL installed locally:

```bash
# Start PostgreSQL in Docker
docker run --name music-inspector-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=music_inspector \
  -p 5432:5432 \
  -d postgres:15

# Wait a few seconds for DB to start, then run setup
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/music_inspector \
  node scripts/setup-database.js
```

## After Setup

### 1. Create Admin User

First, register a user through the app or directly in the database, then promote them:

```bash
npm run promote-admin user@example.com
```

### 2. Set MI Reviewers

```bash
npm run set-mi-reviewers reviewer1@example.com reviewer2@example.com
```

### 3. Verify Database Structure

Check that everything is set up correctly:

```bash
psql $DATABASE_URL -c "
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;
"
```

## Troubleshooting

### Error: "database does not exist"
- Make sure PostgreSQL is running
- Check your DATABASE_URL is correct
- Create the database manually first (see Option 2, Step 1)

### Error: "relation already exists"
- This is normal for idempotent migrations
- The script will skip objects that already exist
- Safe to run migrations multiple times

### Error: "permission denied"
- Make sure your database user has CREATE DATABASE privileges
- Or create the database manually as a superuser first

### Error: "connection refused"
- Check PostgreSQL is running: `pg_isready` or `systemctl status postgresql`
- Verify host and port in DATABASE_URL
- Check firewall settings

## Database Schema Overview

After setup, you'll have:

- **users** - User accounts with roles (user/admin) and MI reviewer flags
- **artists** - Artist information with images
- **tracks** - Releases/tracks with moderation status
- **reviews** - User reviews with MI badge flags
- **popular_releases** - Materialized view for ranking

## Next Steps

Once the database is set up:
1. ✅ Database is ready
2. Start implementing artist management API
3. Set up image upload system
4. Build frontend forms










