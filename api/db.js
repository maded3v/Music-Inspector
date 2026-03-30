// Load environment variables from db.env or .env
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '..', 'db.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });
} else {
  require('dotenv').config();
}

const { Pool } = require('pg');
const isServerless = Boolean(process.env.VERCEL);

// Parse DATABASE_URL to determine SSL requirements
function getPoolConfig() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!connectionString) {
    throw new Error('Database URL is not set (DATABASE_URL/POSTGRES_URL)');
  }
  
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    
    // Check if connection string explicitly requires SSL
    const requiresSSL = sslMode === 'require' || sslMode === 'prefer';
    
    // For localhost connections, typically no SSL needed unless explicitly requested
    // For remote connections (Neon, Railway, etc.), SSL is usually required
    const isLocalhost = url.hostname === 'localhost' || 
                        url.hostname === '127.0.0.1' ||
                        url.hostname === '';
    
    // Remote database services typically require SSL
    const isRemoteService = url.hostname.includes('.neon.tech') ||
                           url.hostname.includes('.railway.app') ||
                           url.hostname.includes('.supabase.co') ||
                           url.hostname.includes('amazonaws.com') ||
                           url.hostname.includes('azure.com');
    
    const config = {
      connectionString: connectionString,
      // Add connection timeout and query timeout
      connectionTimeoutMillis: 10000, // 10 seconds
      query_timeout: 10000, // 10 seconds
      statement_timeout: 10000, // 10 seconds
      idle_in_transaction_session_timeout: 10000 // 10 seconds
    };
  
    // Enable SSL only if:
    // 1. Explicitly required via sslmode parameter
    // 2. It's a remote service (Neon, Railway, etc.)
    // 3. Not localhost
    if (requiresSSL || (isRemoteService && !isLocalhost)) {
      config.ssl = {
        rejectUnauthorized: false
      };
    } else if (isLocalhost) {
      // Explicitly disable SSL for local connections
      config.ssl = false;
    }
    // If neither condition is met, let pg library decide (default behavior)
    
    return config;
  } catch (error) {
    // If URL parsing fails, use safe defaults
    console.warn('Could not parse DATABASE_URL, using default SSL settings');
    return {
      connectionString: connectionString,
      ssl: false  // Default to no SSL for safety
    };
  }
}

let pool;
let dbConnectionStatus = {
  connected: false,
  lastError: null,
  lastCheck: null
};

// Initialize pool with error handling
try {
  pool = new Pool(getPoolConfig());
} catch (error) {
  console.error('❌ CRITICAL: Failed to create database pool:', error.message);
  console.error('   Error details:', error);
  pool = null;

  if (!isServerless) {
    process.exit(1); // Fail fast for non-serverless local server
  }
}

// Handle pool errors
if (pool) {
  pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err);
    console.error('   Error code:', err.code);
    console.error('   Error message:', err.message);
    dbConnectionStatus.connected = false;
    dbConnectionStatus.lastError = err.message;
    dbConnectionStatus.lastCheck = new Date();
  });
}

// Test connection on startup (BLOCKING - server won't start if DB is unavailable)
async function testDatabaseConnection() {
  if (!pool) {
    dbConnectionStatus.connected = false;
    dbConnectionStatus.lastError = 'Database pool is not initialized';
    dbConnectionStatus.lastCheck = new Date();
    return false;
  }

  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Testing database connection (attempt ${attempt}/${maxRetries})...`);
      const result = await pool.query('SELECT NOW() as current_time, current_database(), current_user');
      
      dbConnectionStatus.connected = true;
      dbConnectionStatus.lastError = null;
      dbConnectionStatus.lastCheck = new Date();
      
      console.log('✅ Database connection established');
      console.log(`   - Database: ${result.rows[0].current_database}`);
      console.log(`   - User: ${result.rows[0].current_user}`);
      console.log(`   - Server time: ${result.rows[0].current_time}`);
      return true;
    } catch (err) {
      dbConnectionStatus.connected = false;
      dbConnectionStatus.lastError = err.message;
      dbConnectionStatus.lastCheck = new Date();
      
      console.error(`❌ Database connection failed (attempt ${attempt}/${maxRetries}):`, err.message);
      console.error('   Error code:', err.code);
      
      // Provide helpful error messages
      if (err.code === 'ECONNREFUSED') {
        console.error('   → Database server is not running or host/port is incorrect');
        console.error('   → Check that PostgreSQL is running and accessible');
      } else if (err.code === '28P01') {
        console.error('   → Authentication failed - check username and password in DATABASE_URL');
      } else if (err.code === '3D000') {
        console.error('   → Database does not exist - create the database first');
      } else if (err.code === 'ENOTFOUND') {
        console.error('   → Database host not found - check hostname in DATABASE_URL');
      } else if (err.message && err.message.includes('SSL')) {
        console.error('   → SSL connection error - check SSL configuration');
      } else {
        console.error('   → Full error:', err);
      }
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`   ⏳ Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // All retries failed
  console.error('\n❌ CRITICAL: Could not establish database connection after', maxRetries, 'attempts');
  console.error('   Server will not start without database connection');
  console.error('   Please check:');
  console.error('   1. DATABASE_URL in db.env or .env file');
  console.error('   2. Database server is running');
  console.error('   3. Network connectivity to database host');
  console.error('   4. Firewall rules allow connection');

  if (!isServerless) {
    process.exit(1); // Fail fast for non-serverless local server
  }

  return false;
}

// Export connection promise so server can wait for it
const connectionPromise = isServerless ? Promise.resolve(false) : testDatabaseConnection();

// Wrapper function with timeout and better error handling
const queryWithTimeout = async (text, params, timeoutMs = 10000) => {
  // Ensure pool exists before querying
  if (!pool) {
    const error = new Error('Database pool is not initialized');
    error.code = 'ECONNREFUSED';
    error.isConnectionError = true;
    throw error;
  }
  
  try {
    const result = await pool.query({
      text,
      values: params,
      query_timeout: timeoutMs,
      statement_timeout: timeoutMs
    });
    
    // Update connection status on successful query
    dbConnectionStatus.connected = true;
    dbConnectionStatus.lastError = null;
    dbConnectionStatus.lastCheck = new Date();
    
    return result;
  } catch (error) {
    // Update connection status on error
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === '57014'
    ) {
      dbConnectionStatus.connected = false;
      dbConnectionStatus.lastError = error.message;
      dbConnectionStatus.lastCheck = new Date();
      error.isConnectionError = true;
    }
    
    // Log database errors for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Database query error:', {
        message: error.message,
        code: error.code,
        query: text.substring(0, 100), // Log first 100 chars of query
        params: params ? params.length : 0
      });
    }
    
    throw error;
  }
};

/**
 * Check database connection health
 */
async function checkDatabaseHealth() {
  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database(), version()');
    return {
      connected: true,
      database: result.rows[0].current_database,
      serverTime: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1], // PostgreSQL version
      lastCheck: new Date()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      errorCode: error.code,
      lastCheck: new Date()
    };
  }
}

module.exports = {
  query: queryWithTimeout,
  pool,
  checkDatabaseHealth,
  getConnectionStatus: () => ({ ...dbConnectionStatus }),
  connectionPromise // Export promise so server can await it
};
