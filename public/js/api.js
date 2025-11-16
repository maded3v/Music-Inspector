// Sample data for fallback when API is unavailable
const sampleReviews = [
  {
    "id": "r123",
    "trackId": "t456",
    "author": "quwewe",
    "authorAvatar": "/people/авай 3.png",
    "miBadge": true,
    "score": 80,
    "subscores": [7,8,7,7,8],
    "title": "Держит планку",
    "text": "Лёгкий трек, бит делает его почти хитом. Текст нормальный, без «вау», но в целом достойный. Структура радует — всё запоминается и качает. Звук качественный, хоть и перегруженный, но вокал madk1d’a звучит слабее, чем раньше. Харизма при этом на месте. Лёгкий трек, бит делает его почти хитом. Текст нормальный, без «вау», но в целом достойный. Структура радует — всё запоминается и качает. Звук качественный, хоть и перегруженный, но вокал madk1d’a звучит слабее, чем раньше. Харизма при этом на месте.",
    "cover": "/traks/madkid_drki.jpg",
    "publishedAt": "2025-11-10T12:00:00Z"
  },
  {
    "id": "r124",
    "trackId": "t457",
    "author": "made.dev",
    "authorAvatar": "/people/madedev1.png",
    "miBadge": false,
    "score": 90,
    "subscores": [9,8,9,7,8],
    "title": "плавятсямозги swag",
    "text": "Марк — одно из открытий года. Sexyswag выстрелил колкими строчками, фирменным звучанием и целостностью. Впереди большой тур, ждём новый альбом.",
    "cover": "/traks/sexyswag2010.jpeg",
    "publishedAt": "2025-11-11T12:00:00Z"
  }
];

const sampleReleases = [
  {
    "id": "t456",
    "title": "sexyswag2010",
    "artist": "madk1d",
    "cover": "/traks/sexyswag2010.jpeg",
    "releaseDate": "2025-11-01",
    "tier": "gold",
    "shortDescription": "Краткий анонс для золотого релиза."
  },
  {
    "id": "t457",
    "title": "дырки в штанах",
    "artist": "madk1d",
    "cover": "/traks/madkid_drki.jpg",
    "releaseDate": "2025-11-02",
    "tier": "silver",
    "shortDescription": "Краткий анонс для серебряного релиза."
  },
  {
    "id": "t458",
    "title": "another track",
    "artist": "artist",
    "cover": "/traks/madkid_drki.jpg",
    "releaseDate": "2025-11-03",
    "tier": "bronze",
    "shortDescription": "Краткий анонс для бронзового релиза."
  }
];

// API wrapper functions with fallback to sample data
export async function getReleases() {
  try {
    const response = await fetch('/api/releases');
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, using sample data for releases');
    return sampleReleases;
  }
}

export async function getReviews() {
  try {
    const response = await fetch('/api/reviews');
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch (error) {
    console.warn('API unavailable, using sample data for reviews');
    return sampleReviews;
  }
}

export async function getReview(id) {
  try {
    const response = await fetch(`/api/reviews/${id}`);
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
