# Music Inspector - Implementation TODO List

## 📋 Development Priority Order

**Phase 1: Foundation** (Database & Auth) → **Phase 2: Core Features** (Releases & Moderation) → **Phase 3: Media & Pages** (Images & Auto-generation) → **Phase 4: Advanced Features** (Ranking & Admin Panel)

---

## 🗄️ DATABASE SCHEMA & MIGRATIONS

### 1.1 Extend Users Table
- **Task**: Add `role` and `is_mi_reviewer` columns to `users` table
- **Details**:
  - Add `role ENUM('user', 'admin') DEFAULT 'user'`
  - Add `is_mi_reviewer BOOLEAN DEFAULT FALSE`
  - Add index on `role` for admin queries
  - Create migration script: `migrations/001_add_user_roles.sql`
- **Dependencies**: None
- **Technical Notes**: Use ENUM type for role, boolean for MI badge flag. Store MI reviewer user IDs in env/config.

### 1.2 Create Artists Table
- **Task**: Create `artists` table with image storage reference
- **Details**:
  - Fields: `id`, `name` (UNIQUE), `image_path`, `bio` (TEXT, nullable), `created_at`
  - Add index on `name` for fast lookups
  - Create migration: `migrations/002_create_artists.sql`
- **Dependencies**: None
- **Technical Notes**: `image_path` stores relative path to compressed image file.

### 1.3 Update Tracks Table for Moderation
- **Task**: Add moderation status and link to artists
- **Details**:
  - Add `status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'`
  - Add `artist_id INTEGER REFERENCES artists(id)` (nullable, for future linking)
  - Add `rejected_reason TEXT` (nullable)
  - Add `approved_at TIMESTAMP` (nullable)
  - Add `approved_by INTEGER REFERENCES users(id)` (nullable)
  - Add index on `status` for moderation queue queries
  - Create migration: `migrations/003_add_track_moderation.sql`
- **Dependencies**: 1.2 (artists table)
- **Technical Notes**: Keep `artist` VARCHAR field for backward compatibility during transition.

### 1.4 Add Image Storage Fields
- **Task**: Add image path columns to tracks and artists
- **Details**:
  - Update `tracks.cover` to store relative path (not URL)
  - Add `tracks.cover_original_path` (nullable, for original upload)
  - Add `artists.image_original_path` (nullable)
  - Create migration: `migrations/004_update_image_storage.sql`
- **Dependencies**: 1.2, 1.3
- **Technical Notes**: Store paths relative to upload directory. Use UUIDs for filenames to avoid conflicts.

### 1.5 Add Review Metadata
- **Task**: Add MI badge flag to reviews table
- **Details**:
  - Add `is_mi_review BOOLEAN DEFAULT FALSE`
  - Add index on `is_mi_review` for filtering
  - Create migration: `migrations/005_add_review_mi_flag.sql`
- **Dependencies**: None
- **Technical Notes**: Set `is_mi_review = TRUE` when `user_id` matches MI reviewer accounts.

### 1.6 Create Popular Releases View/Table
- **Task**: Create materialized view or table for popular releases ranking
- **Details**:
  - Create `popular_releases` table: `release_id`, `review_count_3d`, `last_updated`
  - Or use materialized view with refresh function
  - Add index on `review_count_3d DESC`
  - Create migration: `migrations/006_create_popular_releases.sql`
- **Dependencies**: 1.3
- **Technical Notes**: Refresh every 3 days via cron or scheduled function. Count reviews with `created_at >= NOW() - INTERVAL '3 days'`.

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### 2.1 Add Role-Based Access Control
- **Task**: Implement role checking middleware and update JWT payload
- **Details**:
  - Update `api/auth.js`: Include `role` and `is_mi_reviewer` in JWT token
  - Create `api/middleware.js` with `requireAdmin()` and `requireAuth()` functions
  - Update `authenticate` middleware to fetch full user data including role
  - Add `getCurrentUser()` endpoint that returns full user object with role
- **Dependencies**: 1.1
- **Technical Notes**: Store role in JWT for performance, but verify against DB for critical operations.

### 2.2 Update Registration to Set Default Role
- **Task**: Ensure new users get `role = 'user'` by default
- **Details**:
  - Update `api/auth.js` register function to explicitly set `role = 'user'`
  - Add validation to prevent role manipulation in registration payload
- **Dependencies**: 1.1, 2.1
- **Technical Notes**: Never trust client-provided role. Always set server-side.

### 2.3 Create Admin User Seeding Script
- **Task**: Create script to promote users to admin or set MI reviewers
- **Details**:
  - Create `scripts/promote-admin.js` to update user roles
  - Create `scripts/set-mi-reviewers.js` to set MI badge users
  - Add to package.json as npm scripts
- **Dependencies**: 1.1
- **Technical Notes**: Use environment variables or command-line args for user IDs/emails.

---

## 📤 RELEASE SUBMISSION & MODERATION

### 3.1 Create Unified "Add Release" Endpoint
- **Task**: Update `api/tracks.js` createTrack to handle moderation workflow
- **Details**:
  - Check `req.user.role` - if admin, set `status = 'approved'`, else `status = 'pending'`
  - If admin: set `approved_at = NOW()`, `approved_by = user.id`
  - Return appropriate response based on status
  - Update endpoint: `POST /api/tracks/create`
- **Dependencies**: 1.3, 2.1
- **Technical Notes**: Use database transaction to ensure atomicity of release + auto-review creation.

### 3.2 Implement Auto-Review Creation on Submission
- **Task**: Automatically create first review from submitting user
- **Details**:
  - After track creation, create review with default scores (or prompt user)
  - Use same transaction as track creation
  - Set review text to placeholder or empty (user can edit later)
  - Update `api/tracks.js` createTrack function
- **Dependencies**: 3.1
- **Technical Notes**: Consider making review optional or prompting user in frontend before submission.

### 3.3 Create Moderation Queue Endpoint
- **Task**: Create admin-only endpoint to fetch pending releases
- **Details**:
  - Create `GET /api/admin/moderation-queue`
  - Return tracks with `status = 'pending'` ordered by `created_at ASC`
  - Include submitter info (user name, email)
  - Use `requireAdmin()` middleware
- **Dependencies**: 1.3, 2.1
- **Technical Notes**: Add pagination (limit/offset) for large queues.

### 3.4 Create Approve/Reject Endpoints
- **Task**: Create admin endpoints for moderation actions
- **Details**:
  - `POST /api/admin/releases/:id/approve` - set status to approved, set approved_by/approved_at
  - `POST /api/admin/releases/:id/reject` - set status to rejected, require rejection_reason
  - Both use `requireAdmin()` middleware
  - Return updated track object
- **Dependencies**: 1.3, 2.1, 3.3
- **Technical Notes**: Add validation to prevent approving already-approved releases.

### 3.5 Update Track Listing to Filter by Status
- **Task**: Update `getLatestTracks` and `getCatalog` to only show approved releases
- **Details**:
  - Add `WHERE status = 'approved'` to all public track queries
  - Create separate admin endpoint `GET /api/admin/tracks/all` for full list
  - Update `api/tracks.js`
- **Dependencies**: 1.3
- **Technical Notes**: Ensure backward compatibility - existing tracks should be auto-approved or migrated.

---

## 🎨 ARTIST MANAGEMENT

### 4.1 Create Artist CRUD Endpoints
- **Task**: Create full CRUD API for artists
- **Details**:
  - `GET /api/artists` - list all artists (public)
  - `GET /api/artists/:id` - get artist details
  - `POST /api/artists` - create artist (authenticated, can be user or admin)
  - `PUT /api/artists/:id` - update artist (admin only)
  - Create `api/artists.js`
- **Dependencies**: 1.2, 2.1
- **Technical Notes**: Check for duplicate artist names before creation.

### 4.2 Implement Artist-Release Linking
- **Task**: Link releases to artists when artist exists
- **Details**:
  - In `createTrack`, check if artist name exists in `artists` table
  - If exists, set `track.artist_id` to artist ID
  - If not, create new artist entry (or prompt user)
  - Update `api/tracks.js`
- **Dependencies**: 1.2, 1.3, 3.1
- **Technical Notes**: Use case-insensitive matching for artist names. Consider fuzzy matching for typos.

### 4.3 Create Artist Search/Select Component
- **Task**: Frontend component for artist selection during release submission
- **Details**:
  - Create `public/js/artists.js` with `searchArtists(query)` function
  - Add autocomplete/select dropdown in release form
  - Allow "Create New Artist" option
  - Update release submission form
- **Dependencies**: 4.1, 4.2
- **Technical Notes**: Debounce search queries. Show artist image in dropdown if available.

---

## 🖼️ MEDIA HANDLING & IMAGE UPLOAD

### 5.1 Set Up Image Upload Infrastructure
- **Task**: Configure file upload handling (multer or similar)
- **Details**:
  - Install `multer` or `formidable` package
  - Create `api/upload.js` middleware for file handling
  - Configure upload directory structure: `public/uploads/covers/`, `public/uploads/artists/`
  - Add to `.gitignore`: `public/uploads/`
- **Dependencies**: None
- **Technical Notes**: For Vercel, consider using Vercel Blob Storage or external service (S3, Cloudinary).

### 5.2 Implement Image Compression
- **Task**: Add image compression before storage
- **Details**:
  - Install `sharp` package for image processing
  - Create `api/utils/imageProcessor.js` with compression function
  - Compress to max 1920x1920px, quality 85%, convert to WebP
  - Store original in separate folder if needed
  - Update upload endpoints to use compression
- **Dependencies**: 5.1
- **Technical Notes**: Use sharp for serverless compatibility. Generate multiple sizes (thumbnail, medium, full).

### 5.3 Create Cover Image Upload Endpoint
- **Task**: Create endpoint for release cover uploads
- **Details**:
  - `POST /api/upload/cover` - accepts multipart/form-data
  - Authenticate user (requireAuth)
  - Compress and save image
  - Return image path/URL
  - Create `api/upload.js`
- **Dependencies**: 5.1, 5.2
- **Technical Notes**: Validate file type (jpg, png, webp), max size (5MB), dimensions.

### 5.4 Create Artist Image Upload Endpoint
- **Task**: Create endpoint for artist image uploads
- **Details**:
  - `POST /api/upload/artist` - accepts multipart/form-data
  - Authenticate user (requireAuth)
  - Compress and save image
  - Return image path/URL
  - Update `api/upload.js`
- **Dependencies**: 5.1, 5.2
- **Technical Notes**: Same validation as cover upload. Consider square crop for artist images.

### 5.5 Update Release Submission to Handle Images
- **Task**: Integrate image upload into release creation flow
- **Details**:
  - Update frontend form to include file input for cover
  - Upload image first, get path, then submit release with path
  - Or handle multipart in single request
  - Update `api/tracks.js` createTrack
- **Dependencies**: 5.3, 3.1
- **Technical Notes**: Consider two-step flow: upload image → get URL → submit release, or single multipart request.

---

## 🏠 FRONTEND: RELEASE SUBMISSION UI

### 6.1 Create "Add Release" Button on Homepage
- **Task**: Add submission button near "Latest Releases" section
- **Details**:
  - Add button in `public/index.html` near releases section
  - Link to `submit-release.html` or open modal
  - Show only if user is authenticated
  - Update `public/js/main.js` to conditionally show button
- **Dependencies**: 2.1 (check auth status)
- **Technical Notes**: Use `getCurrentUser()` API to check auth state.

### 6.2 Create Release Submission Form Page
- **Task**: Create `public/submit-release.html` with full submission form
- **Details**:
  - Form fields: title, artist (with autocomplete), type (single/album/ep), cover upload, link
  - Include artist creation option if not found
  - Show preview of uploaded cover
  - Submit button that calls API
  - Redirect to track page on success (if approved) or show "pending moderation" message
  - Create `public/js/submit-release.js`
- **Dependencies**: 3.1, 4.3, 5.5
- **Technical Notes**: Validate all fields client-side. Show loading state during submission.

### 6.3 Add Release Form Validation
- **Task**: Client-side validation for release submission
- **Details**:
  - Validate title (required, max 255 chars)
  - Validate artist (required, or must create new)
  - Validate type (must be single/album/ep)
  - Validate cover (required, image file, max 5MB)
  - Validate link (optional, must be valid URL if provided)
  - Update `public/js/submit-release.js`
- **Dependencies**: 6.2
- **Technical Notes**: Show inline error messages. Disable submit until valid.

---

## 👑 ADMIN PANEL

### 7.1 Create Admin Panel Base Page
- **Task**: Create `public/admin.html` with admin dashboard
- **Details**:
  - Check user role on page load (redirect if not admin)
  - Create navigation/sidebar for admin sections
  - Show moderation queue count badge
  - Create `public/js/admin.js` for admin utilities
- **Dependencies**: 2.1
- **Technical Notes**: Protect route client-side and server-side. Use `requireAdmin()` on all admin endpoints.

### 7.2 Create Moderation Queue UI
- **Task**: Build moderation queue interface in admin panel
- **Details**:
  - Display list of pending releases with cover, title, artist, submitter, date
  - Show "Approve" and "Reject" buttons for each
  - Reject button opens modal for rejection reason
  - Approve button immediately approves
  - Refresh queue after action
  - Create `public/js/moderation-queue.js`
- **Dependencies**: 3.3, 3.4, 7.1
- **Technical Notes**: Use pagination or infinite scroll for large queues. Show loading states.

### 7.3 Add Admin Release Management
- **Task**: Allow admins to view/edit all releases
- **Details**:
  - List all releases (approved, pending, rejected) with status badges
  - Allow status changes (approve/reject)
  - Allow editing release details (title, artist, type, cover, link)
  - Create `GET /api/admin/tracks`, `PUT /api/admin/tracks/:id`
  - Create `public/js/admin-releases.js`
- **Dependencies**: 1.3, 2.1, 7.1
- **Technical Notes**: Add audit log for admin actions (who approved/rejected, when).

### 7.4 Add Admin User Management
- **Task**: Allow admins to manage users and roles
- **Details**:
  - List all users with roles
  - Promote users to admin
  - Set MI reviewer flags
  - Create `GET /api/admin/users`, `PUT /api/admin/users/:id/role`
  - Create `public/js/admin-users.js`
- **Dependencies**: 1.1, 2.1, 7.1
- **Technical Notes**: Prevent demoting last admin. Add confirmation dialogs for role changes.

---

## 🏆 POPULAR RELEASES FEED

### 8.1 Create Popular Releases Calculation Function
- **Task**: Implement ranking algorithm for popular releases
- **Details**:
  - Create `api/utils/popularReleases.js` with calculation function
  - Query: Count reviews where `created_at >= NOW() - INTERVAL '3 days'` grouped by track_id
  - Sort by review count DESC
  - Update `popular_releases` table or return directly
- **Dependencies**: 1.6
- **Technical Notes**: Use efficient SQL with proper indexes. Consider caching results.

### 8.2 Create Popular Releases Endpoint
- **Task**: Create API endpoint to fetch popular releases
- **Details**:
  - `GET /api/releases/popular` - returns top N releases by 3-day review count
  - Include release details, review count, average score
  - Add pagination (limit/offset)
  - Create `api/releases.js` or add to `api/tracks.js`
- **Dependencies**: 8.1
- **Technical Notes**: Cache results for 1 hour to reduce DB load. Refresh every 3 days.

### 8.3 Create Scheduled Job for Popular Releases Refresh
- **Task**: Set up cron job or scheduled function to refresh popular releases
- **Details**:
  - Use Vercel Cron or external service (cron-job.org, GitHub Actions)
  - Run every 3 days at midnight
  - Call internal endpoint or direct DB function
  - Update `vercel.json` with cron configuration
- **Dependencies**: 8.1, 8.2
- **Technical Notes**: For Vercel, use `vercel.json` cron. For other platforms, use external cron service.

### 8.4 Update Homepage to Show Popular Releases
- **Task**: Replace or add popular releases section on homepage
- **Details**:
  - Fetch popular releases on page load
  - Display in "Popular Releases" section
  - Update `public/js/main.js` to load popular releases
  - Style similar to existing releases section
- **Dependencies**: 8.2
- **Technical Notes**: Show loading skeleton. Fallback to latest releases if popular fails.

---

## 📄 AUTO-GENERATED PAGES

### 9.1 Create Dynamic Release Page Generator
- **Task**: Create server-side or client-side release page generation
- **Details**:
  - Option A: Server-side: `api/pages/release.js` that generates HTML
  - Option B: Client-side: `public/release.html?id=X` that fetches and renders
  - Display: release info, cover image, artist image, rating, all reviews
  - Include navigation back to homepage
  - Create `public/js/release-page.js` if client-side
- **Dependencies**: 3.1, 4.2, 5.3
- **Technical Notes**: For SEO, prefer server-side rendering. For simplicity, client-side is fine initially.

### 9.2 Create Dynamic Artist Page Generator
- **Task**: Create artist profile page
- **Details**:
  - Route: `public/artist.html?id=X`
  - Display: artist image, name, bio, all releases by artist
  - Show release cards with covers
  - Link to each release page
  - Create `public/js/artist-page.js`
- **Dependencies**: 4.1, 9.1
- **Technical Notes**: Fetch artist + releases in single query with JOIN for performance.

### 9.3 Enhance Review Page
- **Task**: Update existing `public/review.html` to be fully dynamic
- **Details**:
  - Ensure it loads review by ID from URL
  - Display: review text, scores, author (with MI badge if applicable), release info, cover
  - Link to release page and artist page
  - Update `public/js/api.js` to fetch single review
  - Update `public/review.html` if needed
- **Dependencies**: 1.5, 2.1
- **Technical Notes**: Check `is_mi_review` flag to show MI badge. Fetch related release data.

### 9.4 Add Navigation Links Between Pages
- **Task**: Add cross-linking between release, artist, and review pages
- **Details**:
  - Release page: link to artist page, link to each review page
  - Artist page: link to each release page
  - Review page: link to release page and artist page
  - Update all three page templates
- **Dependencies**: 9.1, 9.2, 9.3
- **Technical Notes**: Use consistent URL structure: `/release.html?id=123`, `/artist.html?id=456`, `/review.html?id=789`.

---

## 🎖️ MI BADGE SYSTEM

### 10.1 Implement MI Badge Logic in Reviews
- **Task**: Automatically mark reviews from MI accounts with badge
- **Details**:
  - In `api/reviews.js` addReview, check if `user.is_mi_reviewer === true`
  - If true, set `is_mi_review = TRUE` in review
  - Update review queries to include `is_mi_review` flag
  - Update `api/reviews.js`
- **Dependencies**: 1.5, 2.1
- **Technical Notes**: Check user flag from JWT or DB query. Set flag on review creation, not on fetch.

### 10.2 Display MI Badge in Frontend
- **Task**: Show MI badge in review cards and review pages
- **Details**:
  - Update `public/js/reviews.js` renderReviewCard to show badge if `is_mi_review === true`
  - Update `public/review.html` to display badge
  - Update `public/track.html` review list to show badge
  - Style badge consistently (e.g., "MI" badge with special styling)
- **Dependencies**: 10.1
- **Technical Notes**: Use CSS class `.mi-badge` for consistent styling. Show badge next to author name.

---

## 🔍 SEARCH & FILTERING ENHANCEMENTS

### 11.1 Add Artist Search
- **Task**: Add artist search to catalog/search functionality
- **Details**:
  - Update `GET /api/tracks/catalog` to search by artist name
  - Add artist filter dropdown in releases page
  - Update `public/releases.html` search to include artists
  - Update `public/js/search.js`
- **Dependencies**: 4.1
- **Technical Notes**: Use ILIKE for case-insensitive search. Consider full-text search for better results.

### 11.2 Add Status Filter for Admins
- **Task**: Allow admins to filter releases by status
- **Details**:
  - Add status filter in admin panel (all/pending/approved/rejected)
  - Update admin releases list endpoint to accept status filter
  - Update `public/js/admin-releases.js`
- **Dependencies**: 1.3, 7.3
- **Technical Notes**: Default to "pending" in moderation queue, "all" in full list.

---

## 🧪 TESTING & VALIDATION

### 12.1 Add Input Validation Middleware
- **Task**: Create validation middleware for all endpoints
- **Details**:
  - Install `joi` or `express-validator`
  - Create `api/middleware/validation.js`
  - Add validation rules for track creation, review creation, etc.
  - Return clear error messages
- **Dependencies**: None
- **Technical Notes**: Validate on both client and server. Server validation is critical for security.

### 12.2 Add Error Handling Middleware
- **Task**: Centralize error handling across API
- **Details**:
  - Create `api/middleware/errorHandler.js`
  - Catch all errors, log appropriately, return consistent error format
  - Update `api/index.js` to use error handler
- **Dependencies**: None
- **Technical Notes**: Don't expose internal errors to clients. Log full errors server-side.

---

## 📦 DEPLOYMENT & CONFIGURATION

### 13.1 Update Environment Variables
- **Task**: Document and configure all required env vars
- **Details**:
  - `DATABASE_URL` - PostgreSQL connection
  - `JWT_SECRET` - JWT signing secret
  - `FRONTEND_URL` - CORS origin
  - `MI_REVIEWER_IDS` - Comma-separated user IDs for MI reviewers
  - `UPLOAD_DIR` - Path to upload directory (or blob storage config)
  - Update `.env.example` and README
- **Dependencies**: None
- **Technical Notes**: Use Vercel environment variables. Never commit secrets.

### 13.2 Configure Image Storage for Production
- **Task**: Set up production image storage (Vercel Blob, S3, or Cloudinary)
- **Details**:
  - Choose storage solution based on platform
  - Update upload endpoints to use storage service
  - Configure CDN for image delivery
  - Update image paths in database
- **Dependencies**: 5.1, 5.2
- **Technical Notes**: Vercel Blob is easiest for Vercel deployments. S3 + CloudFront for scale.

### 13.3 Create Database Migration Scripts
- **Task**: Create migration system for database changes
- **Details**:
  - Create `migrations/` directory
  - Create migration runner script
  - Document migration order in README
  - Add npm script: `npm run migrate`
- **Dependencies**: All database tasks
- **Technical Notes**: Use sequential numbering (001, 002, etc.). Test migrations on staging first.

---

## 📝 DOCUMENTATION

### 14.1 Update API Documentation
- **Task**: Document all new API endpoints
- **Details**:
  - Update README.md with new endpoints
  - Document request/response formats
  - Add authentication requirements
  - Include example requests
- **Dependencies**: All API tasks
- **Technical Notes**: Consider using OpenAPI/Swagger for interactive docs.

### 14.2 Create Admin Panel Documentation
- **Task**: Document admin panel features and workflows
- **Details**:
  - How to approve/reject releases
  - How to manage users
  - How to set MI reviewers
  - Create `docs/ADMIN.md`
- **Dependencies**: 7.1, 7.2, 7.3, 7.4
- **Technical Notes**: Include screenshots or screen recordings for complex workflows.

---

## 🎯 QUICK REFERENCE: CRITICAL PATH

**Minimum Viable Implementation Order:**

1. **Database Setup** (1.1, 1.2, 1.3, 1.5)
2. **Auth & Roles** (2.1, 2.2)
3. **Release Submission** (3.1, 3.2, 6.2, 6.3)
4. **Moderation** (3.3, 3.4, 7.1, 7.2)
5. **Image Upload** (5.1, 5.2, 5.3, 5.5)
6. **Artist Management** (4.1, 4.2, 4.3)
7. **Pages** (9.1, 9.2, 9.3)
8. **Popular Releases** (8.1, 8.2, 8.4)
9. **MI Badge** (10.1, 10.2)
10. **Polish & Deploy** (12.1, 12.2, 13.1, 13.2)

---

**Estimated Timeline:** 4-6 weeks for full implementation (1 developer, full-time)

**Priority:** Focus on items 1-7 first for core functionality, then add 8-10 for enhanced features.










