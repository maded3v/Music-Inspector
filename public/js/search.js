// Search module - opens releases page with search query
let searchTimeout = null;
let allTracks = [];
let allReleases = [];

// Initialize search with data
export function initSearch(tracks, releases) {
  allTracks = tracks || [];
  allReleases = releases || [];
  
  const searchInput = document.querySelector('.search-input');
  if (!searchInput) return;

  // Handle Enter key to open search results
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = e.target.value.trim();
      if (query) {
        // Open releases page with search query
        window.open(`releases.html?search=${encodeURIComponent(query)}`, '_blank');
        // Clear input
        e.target.value = '';
      }
    }
  });

  // Optional: Show search suggestions on input (not filtering main page)
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    // Just clear any existing timeout, don't filter
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  });
}

// Update search data after dynamic content is loaded
export function updateSearchData(tracks, releases) {
  allTracks = tracks || [];
  allReleases = releases || [];
}

