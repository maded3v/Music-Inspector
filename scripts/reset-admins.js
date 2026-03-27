#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function loadEnvFile() {
  const dotenv = require('dotenv');

  const candidates = [
    '.env.vercel',
    'db.env',
    '.env'
  ];

  for (const filename of candidates) {
    const envPath = path.join(__dirname, '..', filename);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return filename;
    }
  }

  dotenv.config();
  return 'process environment';
}

function parseAdminArgs(args) {
  if (args.length === 0) {
    return [
      { email: 'house1476@gmail.com', password: 'admin1', name: 'house1476' },
      { email: 'admin@musicinspector.com', password: 'admin2', name: 'admin' }
    ];
  }

  const parsed = [];
  for (const value of args) {
    const firstColon = value.indexOf(':');
    if (firstColon <= 0 || firstColon === value.length - 1) {
      throw new Error(`Invalid admin format: ${value}. Use email:password or email:password:name`);
    }

    const email = value.slice(0, firstColon).trim();
    const rest = value.slice(firstColon + 1);
    const secondColon = rest.indexOf(':');

    let password;
    let name;

    if (secondColon >= 0) {
      password = rest.slice(0, secondColon).trim();
      name = rest.slice(secondColon + 1).trim() || email.split('@')[0];
    } else {
      password = rest.trim();
      name = email.split('@')[0];
    }

    if (!email || !password) {
      throw new Error(`Invalid admin entry: ${value}`);
    }

    parsed.push({ email, password, name });
  }

  return parsed;
}

async function main() {
  const loadedFrom = loadEnvFile();
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    throw new Error('Database URL is not set (DATABASE_URL/POSTGRES_URL)');
  }

  const admins = parseAdminArgs(process.argv.slice(2));
  const useSsl = connectionString.includes('vercel-storage.com') || connectionString.includes('neon.tech') || connectionString.includes('sslmode=require');

  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  try {
    const upsertSql = `
      INSERT INTO users (name, email, password, role, is_mi_reviewer)
      VALUES ($1, $2, $3, 'admin', true)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        role = 'admin',
        is_mi_reviewer = true
      RETURNING id, name, email, role, is_mi_reviewer
    `;

    const updated = [];
    for (const admin of admins) {
      const hash = await bcrypt.hash(admin.password, 10);
      const result = await pool.query(upsertSql, [admin.name, admin.email, hash]);
      updated.push({
        ...result.rows[0],
        password: admin.password
      });
    }

    console.log(`Loaded env from: ${loadedFrom}`);
    console.log('Admin accounts updated:');
    for (const account of updated) {
      console.log(`- ${account.email} | password: ${account.password} | role: ${account.role}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to reset admins:', error.message);
  process.exit(1);
});
