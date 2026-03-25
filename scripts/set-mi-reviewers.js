#!/usr/bin/env node

/**
 * Script to set MI reviewer flag for users
 * Usage: node scripts/set-mi-reviewers.js <user-email-1> <user-email-2> ...
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

const userEmails = process.argv.slice(2);

if (userEmails.length === 0) {
  console.error('Usage: node scripts/set-mi-reviewers.js <user-email-1> <user-email-2> ...');
  process.exit(1);
}

async function setMIReviewers() {
  try {
    for (const email of userEmails) {
      // Check if user exists
      const userResult = await query('SELECT id, name, email, is_mi_reviewer FROM users WHERE email = $1', [email]);
      
      if (userResult.rows.length === 0) {
        console.warn(`⚠ User with email ${email} not found, skipping...`);
        continue;
      }

      const user = userResult.rows[0];
      
      if (user.is_mi_reviewer) {
        console.log(`✓ User ${email} already has MI reviewer flag`);
        continue;
      }

      // Set MI reviewer flag
      await query('UPDATE users SET is_mi_reviewer = $1 WHERE email = $2', [true, email]);
      
      console.log(`✓ Successfully set MI reviewer flag for ${email}`);
    }
    
    console.log('\n✓ All MI reviewers set successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error setting MI reviewers:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setMIReviewers();

