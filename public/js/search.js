import { withApiUrl, resolveArtistUrl, resolveCoverUrl } from './api.js?v=20260421';

let initialized = false;
let dataLoaded = false;
let currentInput = null;
let currentDropdown = null;
let currentItems = [];
let activeIndex = -1;

const searchState = {
  releases: [],
  artists: []
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeImagePath(path, fallback, kind) {
  if (!path) return fallback;

  const resolved = kind === 'artist'
    ? resolveArtistUrl(path)
    : resolveCoverUrl(path);

  return resolved || fallback;
}

function getSearchDataItems() {
  const releaseItems = searchState.releases.map((release) => ({
    kind: 'release',
    label: release.title || 'Без названия',
    subtitle: release.artist || '',
    href: `track.html?id=${release.id}`,
    icon: normalizeImagePath(release.cover, 'svg/album.png', 'cover')
  }));

  const artistItems = searchState.artists.map((artist) => ({
    kind: 'artist',
    label: artist.name,
    subtitle: 'Исполнитель',
    href: artist.id ? `artist.html?id=${artist.id}` : `releases.html?search=${encodeURIComponent(artist.name)}`,
    icon: normalizeImagePath(artist.image, 'svg/person.png', 'artist')
  }));

  return [...releaseItems, ...artistItems];
}

function hydrateFromReleases(releases) {
  const normalized = Array.isArray(releases) ? releases : [];
  searchState.releases = normalized
    .filter((item) => item && item.id)
    .map((item) => ({
      id: item.id,
      title: item.title || '',
      artist: item.artist || item.artist_name || '',
      cover: item.cover || item.cover_path || 'svg/album.png'
    }));

  const artistsByKey = new Map();
  normalized.forEach((item) => {
    const name = (item.artist_name || item.artist || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (artistsByKey.has(key)) return;

    artistsByKey.set(key, {
      id: item.artist_id || null,
      name,
      image: item.artist_image || 'svg/person.png'
    });
  });

  searchState.artists = Array.from(artistsByKey.values());
}

async function loadSearchData() {
  if (dataLoaded) return;

  try {
    const response = await fetch(withApiUrl('/api/tracks/catalog?sort=created_at&order=desc'), {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load search data');
    }

    const payload = await response.json();
    hydrateFromReleases(payload.tracks || []);
    dataLoaded = true;
  } catch (error) {
    console.error('Global search data load failed:', error);
  }
}

function scoreItem(item, query) {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const subtitle = item.subtitle.toLowerCase();

  if (label.startsWith(q)) return 0;
  if (subtitle.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (subtitle.includes(q)) return 3;
  return 99;
}

function getSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return getSearchDataItems()
    .filter((item) => item.label.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
    .sort((a, b) => scoreItem(a, q) - scoreItem(b, q) || a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }))
    .slice(0, 8);
}

function closeDropdown() {
  if (!currentDropdown) return;
  currentDropdown.innerHTML = '';
  currentDropdown.style.display = 'none';
  currentItems = [];
  activeIndex = -1;
}

function highlightActiveItem() {
  if (!currentDropdown) return;
  const buttons = currentDropdown.querySelectorAll('.nav-search-suggestion');
  buttons.forEach((btn, idx) => {
    const active = idx === activeIndex;
    btn.classList.toggle('is-active', active);
    if (active) {
      btn.scrollIntoView({ block: 'nearest' });
    }
  });
}

function isReleasesPage() {
  return window.location.pathname.endsWith('/releases.html') || window.location.pathname.endsWith('releases.html');
}

function pickItem(item) {
  if (!currentInput || !item) return;

  if (isReleasesPage()) {
    currentInput.value = item.label;
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    closeDropdown();
    return;
  }

  window.location.href = item.href;
}

function renderDropdown() {
  if (!currentInput || !currentDropdown) return;

  const query = currentInput.value.trim();
  currentItems = getSuggestions(query);
  activeIndex = -1;

  if (!query || currentItems.length === 0) {
    closeDropdown();
    return;
  }

  currentDropdown.innerHTML = currentItems
    .map((item, idx) => `
      <button type="button" class="nav-search-suggestion" data-index="${idx}">
        <span class="nav-search-suggestion-main">
          <img src="${escapeHtml(item.icon)}" alt="icon" class="nav-search-suggestion-icon" onerror="this.onerror=null; this.src='${item.kind === 'artist' ? 'svg/person.png' : 'svg/album.png'}';">
          <span class="nav-search-suggestion-text">${escapeHtml(item.label)}</span>
        </span>
        <span class="nav-search-suggestion-type">${item.kind === 'artist' ? 'Исполнитель' : 'Релиз'}</span>
      </button>
    `)
    .join('');
  currentDropdown.style.display = 'block';

  currentDropdown.querySelectorAll('.nav-search-suggestion').forEach((button) => {
    button.addEventListener('mouseenter', () => {
      const idx = Number(button.dataset.index);
      activeIndex = Number.isNaN(idx) ? -1 : idx;
      highlightActiveItem();
    });

    button.addEventListener('click', () => {
      const idx = Number(button.dataset.index);
      if (Number.isNaN(idx)) return;
      pickItem(currentItems[idx]);
    });
  });
}

async function attachSearch(input) {
  if (!input || input.dataset.globalSearchBound === '1') return;
  input.dataset.globalSearchBound = '1';
  currentInput = input;

  const searchBar = input.closest('.search-bar');
  if (!searchBar) return;

  currentDropdown = searchBar.querySelector('.nav-search-suggestions');
  if (!currentDropdown) {
    currentDropdown = document.createElement('div');
    currentDropdown.className = 'nav-search-suggestions';
    searchBar.appendChild(currentDropdown);
  }

  await loadSearchData();

  input.addEventListener('input', () => {
    renderDropdown();
  });

  input.addEventListener('focus', () => {
    renderDropdown();
  });

  input.addEventListener('keydown', (event) => {
    const hasSuggestions = currentItems.length > 0 && currentDropdown && currentDropdown.style.display !== 'none';

    if (event.key === 'ArrowDown' && hasSuggestions) {
      event.preventDefault();
      activeIndex = activeIndex < currentItems.length - 1 ? activeIndex + 1 : 0;
      highlightActiveItem();
      return;
    }

    if (event.key === 'ArrowUp' && hasSuggestions) {
      event.preventDefault();
      activeIndex = activeIndex > 0 ? activeIndex - 1 : currentItems.length - 1;
      highlightActiveItem();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (hasSuggestions && activeIndex >= 0) {
        pickItem(currentItems[activeIndex]);
        return;
      }

      const query = input.value.trim();
      closeDropdown();
      if (!query) return;

      if (isReleasesPage()) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        window.location.href = `releases.html?search=${encodeURIComponent(query)}`;
      }
      return;
    }

    if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  document.addEventListener('click', (event) => {
    if (!searchBar.contains(event.target)) {
      closeDropdown();
    }
  });
}

export async function initGlobalSearch() {
  if (initialized) return;
  initialized = true;

  const input = document.querySelector('.search-bar .search-input');
  if (!input) return;

  await attachSearch(input);
}

// Backward compatible API for existing pages
export async function initSearch(_tracks, releases) {
  if (Array.isArray(releases) && releases.length > 0) {
    hydrateFromReleases(releases);
    dataLoaded = true;
  }
  await initGlobalSearch();
}

export function updateSearchData(_tracks, releases) {
  if (Array.isArray(releases) && releases.length > 0) {
    hydrateFromReleases(releases);
    dataLoaded = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initGlobalSearch().catch(() => {});
  });
} else {
  initGlobalSearch().catch(() => {});
}
