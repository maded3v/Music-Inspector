const { query } = require('../db');

// Cache for column existence checks
const columnCache = new Map();
const tableCache = new Map();

/**
 * Check if a column exists in a table
 * Uses caching to avoid repeated queries
 */
async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }

  try {
    const result = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = $2`,
      [tableName, columnName]
    );
    
    const exists = result.rows.length > 0;
    columnCache.set(cacheKey, exists);
    return exists;
  } catch (error) {
    console.error(`Error checking column ${tableName}.${columnName}:`, error);
    // On error, assume column doesn't exist (safer fallback)
    columnCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Check if a table exists in current schema
 */
async function tableExists(tableName) {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  try {
    const result = await query(
      `SELECT to_regclass($1) as regclass`,
      [tableName]
    );

    const exists = Boolean(result.rows[0]?.regclass);
    if (exists) {
      tableCache.set(tableName, true);
    }
    return exists;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

/**
 * Build a reviews query that handles missing status column gracefully
 */
async function buildReviewsQuery(baseQuery, trackId, options = {}) {
  const { 
    requireApproved = true,
    requireApprovedTrack = true,
    limit = null 
  } = options;

  // Check if status column exists
  const statusExists = await columnExists('reviews', 'status');
  
  let whereClauses = [`r.track_id = $1`];
  let params = [trackId];
  let paramIndex = 2;

  // Add status filter if column exists and required
  if (statusExists && requireApproved) {
    whereClauses.push(`(r.status = 'approved' OR r.status IS NULL)`);
  }

  // Add track status filter if required
  if (requireApprovedTrack) {
    whereClauses.push(`t.status = 'approved'`);
  }

  const whereClause = whereClauses.join(' AND ');
  let queryText = baseQuery.replace('{{WHERE}}', whereClause);
  
  if (limit) {
    queryText += ` LIMIT $${paramIndex}`;
    params.push(limit);
  }

  return { queryText, params };
}

/**
 * Build a reviews query for multiple tracks
 */
async function buildReviewsQueryForTracks(baseQuery, trackIds, options = {}) {
  const { requireApproved = true } = options;
  
  const statusExists = await columnExists('reviews', 'status');
  
  let whereClauses = [`r.track_id IN (${trackIds.map((_, i) => `$${i + 1}`).join(',')})`];
  let params = [...trackIds];
  let paramIndex = trackIds.length + 1;

  if (statusExists && requireApproved) {
    whereClauses.push(`(r.status = 'approved' OR r.status IS NULL)`);
  }

  whereClauses.push(`t.status = 'approved'`);

  const whereClause = whereClauses.join(' AND ');
  const queryText = baseQuery.replace('{{WHERE}}', whereClause);

  return { queryText, params };
}

module.exports = {
  columnExists,
  tableExists,
  buildReviewsQuery,
  buildReviewsQueryForTracks
};








