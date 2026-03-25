/**
 * Script to delete all reviews, tracks (releases), and artists from the database
 * Deletes in order: reviews -> tracks -> artists (respecting foreign key constraints)
 */

const { query, connectionPromise } = require('../api/db');

async function clearAllData() {
  // Wait for database connection
  console.log('🔄 Waiting for database connection...');
  await connectionPromise;
  try {
    console.log('🗑️  Starting data deletion...\n');

    // Step 1: Delete all reviews
    console.log('1️⃣  Deleting all reviews...');
    const reviewsResult = await query('DELETE FROM reviews');
    console.log(`   ✅ Deleted ${reviewsResult.rowCount} review(s)\n`);

    // Step 2: Delete all tracks (releases)
    console.log('2️⃣  Deleting all tracks (releases)...');
    const tracksResult = await query('DELETE FROM tracks');
    console.log(`   ✅ Deleted ${tracksResult.rowCount} track(s)\n`);

    // Step 3: Delete all artists
    console.log('3️⃣  Deleting all artists...');
    const artistsResult = await query('DELETE FROM artists');
    console.log(`   ✅ Deleted ${artistsResult.rowCount} artist(s)\n`);

    // Verify deletion
    console.log('🔍 Verifying deletion...');
    const reviewsCheck = await query('SELECT COUNT(*) as count FROM reviews');
    const tracksCheck = await query('SELECT COUNT(*) as count FROM tracks');
    const artistsCheck = await query('SELECT COUNT(*) as count FROM artists');

    console.log(`   Reviews remaining: ${reviewsCheck.rows[0].count}`);
    console.log(`   Tracks remaining: ${tracksCheck.rows[0].count}`);
    console.log(`   Artists remaining: ${artistsCheck.rows[0].count}\n`);

    if (reviewsCheck.rows[0].count === '0' && 
        tracksCheck.rows[0].count === '0' && 
        artistsCheck.rows[0].count === '0') {
      console.log('✅ All data successfully deleted!');
    } else {
      console.log('⚠️  Warning: Some data may still remain');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting data:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

// Run the script
clearAllData();

