#!/usr/bin/env node

// Load environment variables
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '..', 'db.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '..', 'db.env') });
} else {
  require('dotenv').config();
}

const { query, pool } = require('../api/db');

const userEmail = process.argv[2] || 'house1476@gmail.com';

async function checkUser() {
  try {
    const result = await query(
      'SELECT id, name, email, role, is_mi_reviewer FROM users WHERE email = $1',
      [userEmail]
    );
    
    if (result.rows.length === 0) {
      console.log(`User with email ${userEmail} not found`);
    } else {
      const user = result.rows[0];
      console.log('User details:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  MI Reviewer: ${user.is_mi_reviewer}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();









