#!/usr/bin/env node

/**
 * Database Connection and Permissions Test Script
 * Tests database connectivity, table existence, and INSERT permissions
 */

// Load environment variables from db.env or .env
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '..', 'db.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });
} else {
  require('dotenv').config();
}

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables!');
  console.error('   Please set DATABASE_URL in db.env or .env file');
  process.exit(1);
}

console.log('🔍 Testing database connection and permissions...\n');

// Determine SSL configuration based on connection string
function getPoolConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    
    const requiresSSL = sslMode === 'require' || sslMode === 'prefer';
    const isLocalhost = url.hostname === 'localhost' || 
                        url.hostname === '127.0.0.1' ||
                        url.hostname === '';
    const isRemoteService = url.hostname.includes('.neon.tech') ||
                           url.hostname.includes('.railway.app') ||
                           url.hostname.includes('.supabase.co') ||
                           url.hostname.includes('amazonaws.com') ||
                           url.hostname.includes('azure.com');
    
    const config = { connectionString };
    
    if (requiresSSL || (isRemoteService && !isLocalhost)) {
      config.ssl = { rejectUnauthorized: false };
    } else if (isLocalhost) {
      config.ssl = false;
    }
    
    return config;
  } catch (error) {
    return { connectionString, ssl: false };
  }
}

const pool = new Pool(getPoolConfig(DATABASE_URL));

async function testConnection() {
  let client;
  try {
    console.log('1. Testing database connection...');
    client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_user, current_database()');
    console.log('   ✅ Connection successful!');
    console.log(`   - Current user: ${result.rows[0].current_user}`);
    console.log(`   - Database: ${result.rows[0].current_database}`);
    console.log(`   - Server time: ${result.rows[0].current_time}\n`);
    return true;
  } catch (error) {
    console.error('   ❌ Connection failed!');
    console.error(`   Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Database server is not running or connection string is incorrect');
    } else if (error.code === '28P01') {
      console.error('   → Authentication failed - check username and password');
    } else if (error.code === '3D000') {
      console.error('   → Database does not exist');
    }
    return false;
  } finally {
    if (client) client.release();
  }
}

async function testTableExists() {
  let client;
  try {
    console.log('2. Checking if users table exists...');
    client = await pool.connect();
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (result.rows[0].exists) {
      console.log('   ✅ Users table exists\n');
      return true;
    } else {
      console.error('   ❌ Users table does not exist!');
      console.error('   → Run migrations: npm run migrate');
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error checking table: ${error.message}`);
    return false;
  } finally {
    if (client) client.release();
  }
}

async function testTableStructure() {
  let client;
  try {
    console.log('3. Checking users table structure...');
    client = await pool.connect();
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.error('   ❌ No columns found in users table!');
      return false;
    }
    
    console.log('   ✅ Table structure:');
    result.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`      - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });
    
    // Check for required columns
    const columnNames = result.rows.map(r => r.column_name);
    const required = ['id', 'name', 'email', 'password'];
    const missing = required.filter(col => !columnNames.includes(col));
    
    if (missing.length > 0) {
      console.error(`   ❌ Missing required columns: ${missing.join(', ')}`);
      return false;
    }
    
    // Check for role column (from migration)
    if (!columnNames.includes('role')) {
      console.warn('   ⚠️  Role column not found (migration 001 may not have run)');
    }
    
    if (!columnNames.includes('is_mi_reviewer')) {
      console.warn('   ⚠️  is_mi_reviewer column not found (migration 001 may not have run)');
    }
    
    console.log('');
    return true;
  } catch (error) {
    console.error(`   ❌ Error checking structure: ${error.message}`);
    return false;
  } finally {
    if (client) client.release();
  }
}

async function testPermissions() {
  let client;
  try {
    console.log('4. Testing INSERT permissions...');
    client = await pool.connect();
    
    // Try to insert a test record (will rollback)
    await client.query('BEGIN');
    
    const testEmail = `test_${Date.now()}@test.com`;
    const result = await client.query(`
      INSERT INTO users (name, email, password, role, is_mi_reviewer)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email
    `, ['Test User', testEmail, 'hashed_password', 'user', false]);
    
    // Rollback the test insert
    await client.query('ROLLBACK');
    
    console.log('   ✅ INSERT permission granted');
    console.log(`   → Test insert successful (rolled back): ID ${result.rows[0].id}\n`);
    return true;
  } catch (error) {
    console.error('   ❌ INSERT permission test failed!');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === '42501') {
      console.error('   → Permission denied - user lacks INSERT privilege');
      console.error('   → Run: GRANT INSERT ON users TO your_user;');
    } else if (error.message.includes('column "role"')) {
      console.error('   → Role column missing - run migration 001');
    } else if (error.message.includes('column "is_mi_reviewer"')) {
      console.error('   → is_mi_reviewer column missing - run migration 001');
    }
    
    return false;
  } finally {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {
        // Ignore rollback errors
      }
      client.release();
    }
  }
}

async function testSequencePermissions() {
  let client;
  try {
    console.log('5. Testing sequence permissions (for SERIAL id)...');
    client = await pool.connect();
    
    // Check if we can use the sequence
    const result = await client.query(`
      SELECT last_value, is_called 
      FROM users_id_seq
    `);
    
    console.log('   ✅ Sequence accessible');
    console.log(`   → Current sequence value: ${result.rows[0].last_value}\n`);
    return true;
  } catch (error) {
    console.error('   ❌ Sequence access failed!');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === '42501') {
      console.error('   → Permission denied - user lacks USAGE privilege on sequence');
      console.error('   → Run: GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO your_user;');
    } else if (error.message.includes('does not exist')) {
      console.error('   → Sequence not found - table may not have been created properly');
    }
    
    return false;
  } finally {
    if (client) client.release();
  }
}

async function getCurrentUserPermissions() {
  let client;
  try {
    console.log('6. Checking current user permissions...');
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        grantee,
        privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND grantee = current_user
    `);
    
    if (result.rows.length > 0) {
      console.log('   ✅ User has the following privileges:');
      result.rows.forEach(row => {
        console.log(`      - ${row.privilege_type}`);
      });
    } else {
      console.warn('   ⚠️  No explicit grants found (may be using table owner privileges)');
    }
    
    console.log('');
    return true;
  } catch (error) {
    console.error(`   ⚠️  Could not check permissions: ${error.message}\n`);
    return false;
  } finally {
    if (client) client.release();
  }
}

async function runTests() {
  const results = {
    connection: false,
    tableExists: false,
    structure: false,
    permissions: false,
    sequence: false
  };
  
  results.connection = await testConnection();
  if (!results.connection) {
    console.error('\n❌ Cannot proceed - database connection failed');
    await pool.end();
    process.exit(1);
  }
  
  results.tableExists = await testTableExists();
  if (!results.tableExists) {
    console.error('\n❌ Cannot proceed - users table does not exist');
    await pool.end();
    process.exit(1);
  }
  
  results.structure = await testTableStructure();
  results.permissions = await testPermissions();
  results.sequence = await testSequencePermissions();
  await getCurrentUserPermissions();
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Connection: ${results.connection ? '✅' : '❌'}`);
  console.log(`   Table exists: ${results.tableExists ? '✅' : '❌'}`);
  console.log(`   Structure: ${results.structure ? '✅' : '❌'}`);
  console.log(`   INSERT permission: ${results.permissions ? '✅' : '❌'}`);
  console.log(`   Sequence access: ${results.sequence ? '✅' : '❌'}`);
  
  if (results.connection && results.tableExists && results.structure && results.permissions && results.sequence) {
    console.log('\n✅ All tests passed! Database is ready for registration.');
  } else {
    console.log('\n❌ Some tests failed. Please fix the issues above.');
  }
  
  await pool.end();
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

