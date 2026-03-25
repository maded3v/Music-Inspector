#!/usr/bin/env node

/**
 * Database Setup Script
 * Creates database (if needed) and runs all migrations
 * 
 * Usage: node scripts/setup-database.js [database-url]
 * 
 * If DATABASE_URL is not provided, it will use the one from db.env or .env file
 */

// Load environment variables from db.env or .env
const fs = require('fs');
const path = require('path');

// Try to load db.env first, then .env
if (fs.existsSync(path.join(__dirname, '..', 'db.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });
} else {
  require('dotenv').config();
}

const { Pool } = require('pg');

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found!');
  console.error('   Please provide it as an argument or set it in .env file');
  console.error('   Usage: node scripts/setup-database.js postgresql://user:pass@host:port/dbname');
  process.exit(1);
}

// Parse database URL to get connection info
function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      user: parsed.username,
      password: parsed.password,
      host: parsed.hostname,
      port: parsed.port || 5432,
      database: parsed.pathname.slice(1), // Remove leading /
      ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : false
    };
  } catch (error) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }
}

async function runMigration(pool, migrationFile) {
  const filePath = path.join(__dirname, '..', 'migrations', migrationFile);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`  Running ${migrationFile}...`);
  try {
    await pool.query(sql);
    console.log(`  ✓ ${migrationFile} completed`);
    return true;
  } catch (error) {
    // Check if error is due to already existing objects (idempotent migrations)
    if (error.message.includes('already exists') || 
        error.message.includes('duplicate') ||
        error.message.includes('IF NOT EXISTS')) {
      console.log(`  ⚠ ${migrationFile} - some objects already exist (skipping)`);
      return true;
    }
    console.error(`  ❌ Error in ${migrationFile}:`, error.message);
    throw error;
  }
}

async function setupDatabase() {
  const dbConfig = parseDatabaseUrl(DATABASE_URL);
  const dbName = dbConfig.database;
  
  // Connect to postgres database to create target database if needed
  const adminPool = new Pool({
    user: dbConfig.user,
    password: dbConfig.password,
    host: dbConfig.host,
    port: dbConfig.port,
    database: 'postgres', // Connect to default postgres DB
    ssl: dbConfig.ssl
  });

  try {
    console.log('📦 Setting up database...\n');

    // Check if database exists
    const dbCheck = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`📝 Creating database "${dbName}"...`);
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Database "${dbName}" created\n`);
    } else {
      console.log(`✓ Database "${dbName}" already exists\n`);
    }

    await adminPool.end();

    // Connect to target database
    const pool = new Pool({
      user: dbConfig.user,
      password: dbConfig.password,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbName,
      ssl: dbConfig.ssl
    });

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to database\n');

    // Check if base schema exists (users table)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📝 Base schema not found, creating base tables...\n');
      const schemaPath = path.join(__dirname, '..', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        // Remove INSERT statements from schema (we'll handle data separately)
        const cleanSchema = schemaSQL.split('-- Insert some sample data')[0];
        await pool.query(cleanSchema);
        console.log('✓ Base schema created\n');
      } else {
        console.error('❌ schema.sql not found!');
        process.exit(1);
      }
    } else {
      console.log('✓ Base schema already exists\n');
    }

    // Get migration files in order
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .filter(f => f.startsWith('0'))
      .sort();

    if (files.length === 0) {
      console.error('❌ No migration files found in migrations/ directory');
      process.exit(1);
    }

    console.log(`📋 Running ${files.length} migration(s)...\n`);

    // Run migrations in order
    for (const file of files) {
      await runMigration(pool, file);
    }

    console.log('\n✅ Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Promote a user to admin: npm run promote-admin <email>');
    console.log('   2. Set MI reviewers: npm run set-mi-reviewers <email1> <email2>');
    console.log('   3. Start the server: npm run dev');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupDatabase();

