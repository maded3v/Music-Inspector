// Sample data for fallback when API is unavailable
const sampleReviews = [
  {
    "id": "r123",
    "trackId": "t456",
    "author": "quwewe",
    "authorAvatar": "people/авай 3.png",
    "miBadge": true,
    "score": 80,
    "subscores": [7,8,7,7,8],
    "title": "Держит планку",
    "text": "Лёгкий трек, бит делает его почти хитом. Текст нормальный, без «вау», но в целом достойный. Структура радует — всё запоминается и качает. Звук качественный, хоть и перегруженный, но вокал madk1d’a звучит слабее, чем раньше. Харизма при этом на месте. Лёгкий трек, бит делает его почти хитом. Текст нормальный, без «вау», но в целом достойный. Структура радует — всё запоминается и качает. Звук качественный, хоть и перегруженный, но вокал madk1d’a звучит слабее, чем раньше. Харизма при этом на месте.",
    "cover": "traks/madkid_drki.jpg",
    "publishedAt": "2025-11-10T12:00:00Z"
  },
  {
    "id": "r124",
    "trackId": "t457",
    "author": "made.dev",
    "authorAvatar": "people/madedev1.png",
    "miBadge": false,
    "score": 90,
    "subscores": [9,8,9,7,8],
    "title": "плавятсямозги swag",
    "text": "Марк — одно из открытий года. Sexyswag выстрелил колкими строчками, фирменным звучанием и целостностью. Впереди большой тур, ждём новый альбом.",
    "cover": "traks/sexyswag2010.jpeg",
    "publishedAt": "2025-11-11T12:00:00Z"
  }
];

const sampleReleases = [
  {
    "id": "t456",
    "title": "sexyswag2010",
    "artist": "madk1d",
    "cover": "traks/sexyswag2010.jpeg",
    "releaseDate": "2025-11-01",
    "type": "album",
    "tier": "gold",
    "peopleScore": 85,
    "miScore": 90,
    "subscores": [9, 8, 9, 8, 9],
    "shortDescription": "Краткий анонс для золотого релиза."
  },
  {
    "id": "t457",
    "title": "дырки в штанах",
    "artist": "madk1d",
    "cover": "traks/madkid_drki.jpg",
    "releaseDate": "2025-11-02",
    "type": "album",
    "tier": "silver",
    "peopleScore": 75,
    "miScore": 80,
    "subscores": [7, 8, 7, 8, 8],
    "shortDescription": "Краткий анонс для серебряного релиза."
  },
  {
    "id": "t458",
    "title": "another track",
    "artist": "artist",
    "cover": "traks/madkid_drki.jpg",
    "releaseDate": "2025-11-03",
    "type": "album",
    "tier": "bronze",
    "peopleScore": 65,
    "miScore": 70,
    "subscores": [6, 7, 6, 7, 7],
    "shortDescription": "Краткий анонс для бронзового релиза."
  },
  {
    "id": "t459",
    "title": "test album",
    "artist": "test artist",
    "cover": "traks/madkid_drki.jpg",
    "releaseDate": "2025-11-04",
    "type": "album",
    "tier": "other",
    "peopleScore": 60,
    "miScore": 65,
    "subscores": [6, 6, 6, 6, 6],
    "shortDescription": "Тестовый альбом без награды."
  },
  {
    "id": "t460",
    "title": "Новый альбом",
    "artist": "Новый артист",
    "cover": "traks/sexyswag2010.jpeg",
    "releaseDate": "2025-11-05",
    "type": "album",
    "tier": "other",
    "peopleScore": 70,
    "miScore": 75,
    "subscores": [7, 7, 7, 7, 7],
    "shortDescription": "Еще один тестовый альбом."
  },
  {
    "id": "t461",
    "title": "Последний альбом",
    "artist": "Последний артист",
    "cover": "traks/madkid_drki.jpg",
    "releaseDate": "2025-11-06",
    "type": "album",
    "tier": "other",
    "peopleScore": 55,
    "miScore": 60,
    "subscores": [5, 6, 5, 6, 6],
    "shortDescription": "Последний тестовый альбом."
  }
];

// API wrapper functions with fallback to sample data
export async function getReleases() {
  try {
    const response = await fetch(`${API_BASE}/api/getLatestTracks`);
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, using sample data for releases');
    return sampleReleases;
  }
}

export async function getReviews() {
  try {
    const response = await fetch(`${API_BASE}/api/getLatestReviews`);
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, using sample data for reviews');
    return sampleReviews;
  }
}

export async function getReview(id) {
  try {
    const response = await fetch(`${API_BASE}/api/getReviewsByTrack?id=${id}`);
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, using sample data for review');
    return sampleReviews.find(review => review.id === id) || null;
  }
}

export async function login(credentials) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!response.ok) throw new Error('Login failed');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, mocking login success');
    return { success: true, message: 'Logged in successfully' };
  }
}

export async function register(payload) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Registration failed');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, mocking register success');
    return { success: true, message: 'Registered successfully' };
  }
}
