# Database Migrations

This directory contains SQL migration scripts for the Music Inspector database schema.

## Migration Order

Run migrations in numerical order:

1. `001_add_user_roles.sql` - Add user roles and MI reviewer flag
2. `002_create_artists.sql` - Create artists table
3. `003_add_track_moderation.sql` - Add moderation status to tracks
4. `004_update_image_storage.sql` - Update image storage fields
5. `005_add_review_mi_flag.sql` - Add MI badge flag to reviews
6. `006_create_popular_releases.sql` - Create popular releases view

## Running Migrations

### Using psql:
```bash
psql $DATABASE_URL -f migrations/001_add_user_roles.sql
psql $DATABASE_URL -f migrations/002_create_artists.sql
psql $DATABASE_URL -f migrations/003_add_track_moderation.sql
psql $DATABASE_URL -f migrations/004_update_image_storage.sql
psql $DATABASE_URL -f migrations/005_add_review_mi_flag.sql
psql $DATABASE_URL -f migrations/006_create_popular_releases.sql
```

### Using npm script (if configured):
```bash
npm run migrate
```

## Notes

- Migrations are idempotent (safe to run multiple times)
- Always backup your database before running migrations
- Test migrations on a development database first
- Migration 003 sets existing tracks to 'approved' status for backward compatibility











