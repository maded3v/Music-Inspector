#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { put } = require('@vercel/blob');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.vercel'), override: true });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const sourceBaseUrl = String(
  process.env.IMAGE_SOURCE_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://music-inspector.onrender.com'
).replace(/\/$/, '');

if (!connectionString) {
  console.error('Missing DATABASE_URL/POSTGRES_URL environment variable');
  process.exit(1);
}

if (!blobToken) {
  console.error('Missing BLOB_READ_WRITE_TOKEN environment variable');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

function isRelativeUploadPath(value) {
  return typeof value === 'string' && value.startsWith('uploads/');
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || '').replace(/^\/+/, '');
}

function detectContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function readImageBuffer(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const absolutePath = path.join(__dirname, '..', 'public', normalizedPath);

  try {
    return await fs.readFile(absolutePath);
  } catch {
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available. Use Node.js 18+ to run this script.');
    }

    const remoteUrl = `${sourceBaseUrl}/${normalizedPath}`;
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status} ${remoteUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

async function uploadFileToBlob(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const fileBuffer = await readImageBuffer(normalizedPath);
  const uploaded = await put(normalizedPath, fileBuffer, {
    access: 'public',
    addRandomSuffix: false,
    token: blobToken,
    contentType: detectContentType(normalizedPath)
  });

  return uploaded.url;
}

async function migrateColumn({ table, idColumn, valueColumn }) {
  const selectSql = `SELECT ${idColumn} AS id, ${valueColumn} AS value FROM ${table}`;
  const result = await pool.query(selectSql);

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const currentValue = row.value;

    if (!isRelativeUploadPath(currentValue)) {
      skipped += 1;
      continue;
    }

    try {
      const blobUrl = await uploadFileToBlob(currentValue);
      const updateSql = `UPDATE ${table} SET ${valueColumn} = $1 WHERE ${idColumn} = $2`;
      await pool.query(updateSql, [blobUrl, row.id]);
      updated += 1;
      console.log(`${table}.${valueColumn} id=${row.id} -> migrated`);
    } catch (error) {
      skipped += 1;
      console.warn(`${table}.${valueColumn} id=${row.id} -> skipped (${error.message})`);
    }
  }

  return { updated, skipped };
}

async function main() {
  try {
    const tracks = await migrateColumn({ table: 'tracks', idColumn: 'id', valueColumn: 'cover' });
    const artists = await migrateColumn({ table: 'artists', idColumn: 'id', valueColumn: 'image_path' });
    const users = await migrateColumn({ table: 'users', idColumn: 'id', valueColumn: 'avatar' });

    console.log('Migration complete:', {
      tracks,
      artists,
      users
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
