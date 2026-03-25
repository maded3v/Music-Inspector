#!/usr/bin/env node

/**
 * Migration Runner Script
 * Runs all pending migrations (idempotent)
 * 
 * Usage: node scripts/run-migrations.js
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

const { pool } = require('../api/db');

async function runMigrations() {
  try {
    console.log('📋 Running migrations...\n');

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .filter(f => f.startsWith('0'))
      .sort();

    if (files.length === 0) {
      console.error('❌ No migration files found');
      process.exit(1);
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running ${file}...`);
      try {
        await pool.query(sql);
        console.log(`✓ ${file} completed\n`);
      } catch (error) {
        // Ignore "already exists" errors (idempotent migrations)
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('IF NOT EXISTS')) {
          console.log(`⚠ ${file} - some objects already exist (skipped)\n`);
        } else {
          console.error(`❌ Error in ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();

