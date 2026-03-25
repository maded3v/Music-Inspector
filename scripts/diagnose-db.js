#!/usr/bin/env node
/**
 * Database Connection Diagnostic Tool
 * Helps identify database connection issues
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });

console.log('🔍 Database Connection Diagnostic Tool\n');
console.log('=' .repeat(60));

// 1. Check environment variables
console.log('\n1. Checking Environment Variables...');
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set');
  console.error('   Please set DATABASE_URL in db.env or .env file');
  process.exit(1);
}

console.log('✅ DATABASE_URL is set');
console.log('   Length:', dbUrl.length, 'characters');

// Parse connection string (safely)
try {
  const url = new URL(dbUrl);
  console.log('✅ Connection string is valid');
  console.log('   Protocol:', url.protocol);
  console.log('   Host:', url.hostname);
  console.log('   Port:', url.port || '5432 (default)');
  console.log('   Database:', url.pathname.substring(1));
  console.log('   Username:', url.username || 'not set');
  console.log('   Password:', url.password ? '***' + url.password.slice(-2) : 'not set');
  
  // Check SSL mode
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) {
    console.log('   SSL Mode:', sslMode);
  }
} catch (error) {
  console.error('❌ Invalid DATABASE_URL format:', error.message);
  console.error('   Expected format: postgresql://user:password@host:port/database');
  process.exit(1);
}

// 2. Check database file
console.log('\n2. Checking Configuration Files...');
const dbEnvPath = path.join(__dirname, '..', 'db.env');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(dbEnvPath)) {
  console.log('✅ db.env file exists');
  const stats = fs.statSync(dbEnvPath);
  console.log('   Size:', stats.size, 'bytes');
  console.log('   Modified:', stats.mtime);
} else {
  console.log('⚠️  db.env file not found');
}

if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
} else {
  console.log('ℹ️  .env file not found (using db.env)');
}

// 3. Test database connection
console.log('\n3. Testing Database Connection...');
const { Pool } = require('pg');

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    const requiresSSL = sslMode === 'require' || sslMode === 'prefer';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isRemoteService = url.hostname.includes('.neon.tech') ||
                           url.hostname.includes('.railway.app') ||
                           url.hostname.includes('.supabase.co') ||
                           url.hostname.includes('amazonaws.com') ||
                           url.hostname.includes('azure.com');
    
    const config = {
      connectionString: connectionString,
      connectionTimeoutMillis: 5000
    };
    
    if (requiresSSL || (isRemoteService && !isLocalhost)) {
      config.ssl = { rejectUnauthorized: false };
      console.log('   SSL: Enabled (required)');
    } else if (isLocalhost) {
      config.ssl = false;
      console.log('   SSL: Disabled (localhost)');
    } else {
      console.log('   SSL: Auto-detect');
    }
    
    return config;
  } catch (error) {
    return { connectionString, ssl: false };
  }
}

const pool = new Pool(getPoolConfig());

pool.query('SELECT NOW() as current_time, current_database(), current_user, version()')
  .then((result) => {
    console.log('✅ Database connection successful!');
    console.log('   Database:', result.rows[0].current_database);
    console.log('   User:', result.rows[0].current_user);
    console.log('   Server time:', result.rows[0].current_time);
    console.log('   PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    
    // Test table existence
    console.log('\n4. Checking Database Schema...');
    return pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
  })
  .then((result) => {
    const tables = result.rows.map(r => r.table_name);
    console.log(`✅ Found ${tables.length} tables in database`);
    
    const requiredTables = ['users', 'tracks', 'reviews', 'artists'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    
    if (missingTables.length === 0) {
      console.log('✅ All required tables exist');
      tables.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log('⚠️  Missing required tables:', missingTables.join(', '));
      console.log('   Run migrations to create missing tables');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Database diagnostic complete - connection is healthy');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database connection failed!');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    // Provide specific guidance
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check if PostgreSQL is running:');
      console.error('      - Windows: Check Services or run: net start postgresql-x64-XX');
      console.error('      - Linux/Mac: sudo systemctl status postgresql');
      console.error('   2. Verify host and port in DATABASE_URL');
      console.error('   3. Check firewall rules');
    } else if (error.code === '28P01') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check username and password in DATABASE_URL');
      console.error('   2. Verify user has access to the database');
    } else if (error.code === '3D000') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Create the database: CREATE DATABASE <database_name>;');
      console.error('   2. Or update DATABASE_URL to point to existing database');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check hostname in DATABASE_URL');
      console.error('   2. Verify network connectivity');
      console.error('   3. Check DNS resolution');
    } else if (error.message && error.message.includes('SSL')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. For localhost: SSL should be disabled');
      console.error('   2. For remote services: SSL is required');
      console.error('   3. Check sslmode parameter in DATABASE_URL');
    }
    
    console.log('\n' + '='.repeat(60));
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });







