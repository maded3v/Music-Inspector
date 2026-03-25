#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', 'db.env') });
const localUrl = process.env.DATABASE_URL;

dotenv.config({ path: path.join(__dirname, '..', '.env.vercel'), override: true });
const remoteUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!localUrl) {
  console.error('Local DATABASE_URL not found in db.env');
  process.exit(1);
}

if (!remoteUrl) {
  console.error('Remote DATABASE_URL not found in .env.vercel');
  process.exit(1);
}

const localPool = new Pool({ connectionString: localUrl, ssl: false });
const remotePool = new Pool({ connectionString: remoteUrl, ssl: { rejectUnauthorized: false } });

const tablesInOrder = ['users', 'artists', 'tracks', 'reviews'];

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function copyTableData(tableName) {
  const sourceColumns = await getColumns(localPool, tableName);
  const targetColumns = await getColumns(remotePool, tableName);
  const targetSet = new Set(targetColumns);
  const sharedColumns = sourceColumns.filter((column) => targetSet.has(column));

  if (sharedColumns.length === 0) {
    console.log(`${tableName}: skipped (no shared columns)`);
    return;
  }

  const selectSql = `SELECT ${sharedColumns.map(quoteIdent).join(', ')} FROM ${quoteIdent(tableName)} ORDER BY id`;
  const sourceRows = (await localPool.query(selectSql)).rows;

  if (sourceRows.length === 0) {
    console.log(`${tableName}: 0 rows`);
    return;
  }

  const params = [];
  let paramIndex = 1;
  const valueBlocks = sourceRows.map((row) => {
    const placeholders = sharedColumns.map((column) => {
      params.push(row[column]);
      return `$${paramIndex++}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const insertSql = `INSERT INTO ${quoteIdent(tableName)} (${sharedColumns.map(quoteIdent).join(', ')}) VALUES ${valueBlocks.join(', ')}`;
  await remotePool.query(insertSql, params);

  if (sharedColumns.includes('id')) {
    await remotePool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdent(tableName)}), 1), true)`,
      [tableName]
    );
  }

  console.log(`${tableName}: copied ${sourceRows.length}`);
}

async function main() {
  await remotePool.query('BEGIN');
  try {
    await remotePool.query('TRUNCATE TABLE reviews, tracks, artists, users RESTART IDENTITY CASCADE');
    for (const tableName of tablesInOrder) {
      await copyTableData(tableName);
    }
    await remotePool.query('COMMIT');
    console.log('Data sync completed');
  } catch (error) {
    await remotePool.query('ROLLBACK');
    console.error('Data sync failed:', error.message);
    process.exitCode = 1;
  } finally {
    await localPool.end();
    await remotePool.end();
  }
}

main();
