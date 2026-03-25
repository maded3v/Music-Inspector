# Codebase Refactoring Plan

## Critical Issues Identified

### 1. Database Schema Mismatch
- **Issue**: Code references `status` column in reviews table, but column doesn't exist
- **Impact**: Queries hang or fail with syntax errors
- **Files Affected**: 
  - `api/reviews.js` (multiple queries)
  - `api/tracks.js` (getTrack endpoint)
  - `api/artists.js` (getArtistWithStats)
- **Fix**: Add proper column detection and fallback logic, OR run migration 007

### 2. Inconsistent Error Handling
- **Issue**: Some endpoints return detailed errors, others return generic "Server error"
- **Impact**: Poor debugging experience, unclear user feedback
- **Fix**: Standardize all error responses

### 3. Missing Validation
- **Issue**: Some endpoints lack proper input validation
- **Impact**: Potential security issues, data corruption
- **Fix**: Add comprehensive validation

### 4. Hardcoded Values
- **Issue**: Magic strings, hardcoded paths
- **Impact**: Difficult to maintain, not configurable
- **Fix**: Extract to constants/config

### 5. Frontend Error Handling
- **Issue**: Generic error messages, silent failures
- **Impact**: Poor UX, difficult debugging
- **Fix**: Add proper error states and messages

## Refactoring Steps

1. Fix database queries to handle missing status column
2. Standardize API error responses
3. Add comprehensive validation
4. Fix frontend error handling
5. Remove dead code
6. Add proper logging







