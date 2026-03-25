#!/usr/bin/env node

/**
 * Script to promote a user to admin role
 * Usage: node scripts/promote-admin.js <user-email>
 */

// Load environment variables from db.env or .env
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '..', 'db.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });
} else {
  require('dotenv').config();
}

const { query, pool } = require('../api/db');

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: node scripts/promote-admin.js <user-email>');
  process.exit(1);
}

async function promoteToAdmin() {
  try {
    // Check if user exists
    const userResult = await query('SELECT id, name, email, role FROM users WHERE email = $1', [userEmail]);
    
    if (userResult.rows.length === 0) {
      console.error(`User with email ${userEmail} not found`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    
    if (user.role === 'admin') {
      console.log(`User ${userEmail} is already an admin`);
      process.exit(0);
    }

    // Promote to admin
    await query('UPDATE users SET role = $1 WHERE email = $2', ['admin', userEmail]);
    
    console.log(`✓ Successfully promoted ${userEmail} to admin role`);
    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

promoteToAdmin();

