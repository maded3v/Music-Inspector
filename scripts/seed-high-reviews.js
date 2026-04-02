const bcrypt = require('bcryptjs');
const { query, pool } = require('../api/db');
const { columnExists, tableExists } = require('../api/utils/dbHelpers');

const DEMO_REVIEWERS = [
  {
    name: 'Echo Nova',
    email: 'echo.nova@mi-demo.local',
    avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=EchoNova'
  },
  {
    name: 'Luna Pulse',
    email: 'luna.pulse@mi-demo.local',
    avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=LunaPulse'
  },
  {
    name: 'Urban Drift',
    email: 'urban.drift@mi-demo.local',
    avatar: 'https://api.dicebear.com/9.x/thumbs/svg?seed=UrbanDrift'
  }
];

const REVIEW_TEMPLATES = [
  'Сильная подача, очень цельный звук и уверенная атмосфера. Релиз хочется переслушивать снова.',
  'Крепкий материал: отличные акценты, хороший баланс, цепляет с первого прослушивания.',
  'Стиль выдержан до конца, трек звучит свежо и качественно. Отличная работа по вайбу.',
  'Очень достойный релиз: настроение держится, детали на месте, исполнение выше среднего.',
  'Энергия и подача на высоком уровне, есть интересные решения в структуре и динамике.'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildScores() {
  const score1 = randomInt(8, 10);
  const score2 = randomInt(8, 10);
  const score3 = randomInt(8, 10);
  const score4 = randomInt(8, 10);
  const score5 = randomInt(8, 10);
  const avg = ((score1 + score2 + score3 + score4 + score5) / 5).toFixed(1);

  return {
    score1,
    score2,
    score3,
    score4,
    score5,
    avg
  };
}

function pickReviewText(track, index) {
  const baseText = REVIEW_TEMPLATES[(track.id + index) % REVIEW_TEMPLATES.length];
  return `${baseText} (${track.title} - ${track.artist})`;
}

async function ensureDemoUsers(hasAvatarColumn) {
  const passwordHash = await bcrypt.hash('demo-reviewer-2026', 10);
  const createdUsers = [];

  for (const reviewer of DEMO_REVIEWERS) {
    const existing = await query(
      'SELECT id, name, avatar FROM users WHERE email = $1 LIMIT 1',
      [reviewer.email]
    );

    if (existing.rows.length > 0) {
      const userId = existing.rows[0].id;
      const existingAvatar = typeof existing.rows[0].avatar === 'string'
        ? existing.rows[0].avatar.trim()
        : '';

      // Keep manually set avatars intact across deploys.
      // Seed default avatar only when user has no avatar.
      if (hasAvatarColumn && !existingAvatar) {
        await query('UPDATE users SET avatar = $1 WHERE id = $2', [reviewer.avatar, userId]);
      }

      createdUsers.push({
        ...reviewer,
        id: userId,
        avatar: existingAvatar || reviewer.avatar
      });
      continue;
    }

    let inserted;
    if (hasAvatarColumn) {
      inserted = await query(
        'INSERT INTO users (name, email, password, avatar) VALUES ($1, $2, $3, $4) RETURNING id',
        [reviewer.name, reviewer.email, passwordHash, reviewer.avatar]
      );
    } else {
      inserted = await query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
        [reviewer.name, reviewer.email, passwordHash]
      );
    }

    createdUsers.push({ ...reviewer, id: inserted.rows[0].id });
  }

  return createdUsers;
}

async function seedReviews() {
  const hasUsersAvatar = await columnExists('users', 'avatar');
  const hasReviewStatus = await columnExists('reviews', 'status');
  const hasReviewMiFlag = await columnExists('reviews', 'is_mi_review');
  const hasReviewApprovedAt = await columnExists('reviews', 'approved_at');
  const hasReviewApprovedBy = await columnExists('reviews', 'approved_by');

  const reviewers = await ensureDemoUsers(hasUsersAvatar);
  const reviewerIds = reviewers.map((user) => user.id);

  const tracksResult = await query(
    `SELECT id, title, artist
     FROM tracks
     WHERE status = 'approved'
     ORDER BY created_at DESC`
  );
  const tracks = tracksResult.rows || [];

  if (!tracks.length) {
    console.log('No approved tracks found, skipping review seeding.');
    return;
  }

  const approvedFilter = hasReviewStatus ? "AND (status = 'approved' OR status IS NULL)" : '';
  const countsResult = await query(
    `SELECT track_id, COUNT(*)::int AS count
     FROM reviews
     WHERE track_id = ANY($1::int[])
     ${approvedFilter}
     GROUP BY track_id`,
    [tracks.map((track) => track.id)]
  );

  const reviewCountByTrack = new Map();
  for (const row of countsResult.rows) {
    reviewCountByTrack.set(Number(row.track_id), Number(row.count || 0));
  }

  const existingByTrackAndUser = await query(
    `SELECT track_id, user_id
     FROM reviews
     WHERE track_id = ANY($1::int[])
       AND user_id = ANY($2::int[])
       ${approvedFilter}`,
    [tracks.map((track) => track.id), reviewerIds]
  );

  const usedUsersByTrack = new Map();
  for (const row of existingByTrackAndUser.rows) {
    const trackId = Number(row.track_id);
    const userId = Number(row.user_id);
    if (!usedUsersByTrack.has(trackId)) {
      usedUsersByTrack.set(trackId, new Set());
    }
    usedUsersByTrack.get(trackId).add(userId);
  }

  let insertedReviews = 0;

  for (const track of tracks) {
    const currentCount = reviewCountByTrack.get(track.id) || 0;
    const targetCount = (track.id % 2 === 0) ? 2 : 3;
    const needed = Math.max(0, targetCount - currentCount);

    if (needed === 0) {
      continue;
    }

    if (!usedUsersByTrack.has(track.id)) {
      usedUsersByTrack.set(track.id, new Set());
    }

    const usedUsers = usedUsersByTrack.get(track.id);
    let cursor = 0;

    for (let i = 0; i < needed; i += 1) {
      let reviewer = reviewers.find((user) => !usedUsers.has(user.id));
      if (!reviewer) {
        reviewer = reviewers[cursor % reviewers.length];
      }
      cursor += 1;
      usedUsers.add(reviewer.id);

      const scores = buildScores();
      const text = pickReviewText(track, i + insertedReviews);

      const columns = ['track_id', 'user_id', 'text', 'score1', 'score2', 'score3', 'score4', 'score5', 'avg_score'];
      const values = [
        track.id,
        reviewer.id,
        text,
        scores.score1,
        scores.score2,
        scores.score3,
        scores.score4,
        scores.score5,
        scores.avg
      ];

      if (hasReviewMiFlag) {
        columns.push('is_mi_review');
        values.push(false);
      }

      if (hasReviewStatus) {
        columns.push('status');
        values.push('approved');
      }

      if (hasReviewApprovedAt) {
        columns.push('approved_at');
        values.push(new Date());
      }

      if (hasReviewApprovedBy) {
        columns.push('approved_by');
        values.push(null);
      }

      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      await query(
        `INSERT INTO reviews (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );

      insertedReviews += 1;
    }
  }

  const votesTableExists = await tableExists('review_votes');
  console.log(`Seed complete. Inserted ${insertedReviews} high-score reviews.`);
  console.log(`Tracks processed: ${tracks.length}.`);
  console.log(`Review votes table present: ${votesTableExists ? 'yes' : 'no'}.`);
}

async function run() {
  try {
    await seedReviews();
  } catch (error) {
    console.error('Failed to seed reviews:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
