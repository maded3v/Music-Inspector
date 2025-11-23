// Utility functions for adding placeholder cards to fill rows

/**
 * Calculate how many cards fit in a row and add placeholders to fill the remaining space
 * @param {HTMLElement} container - The container element with cards
 * @param {number} cardWidth - Width of a single card in pixels
 * @param {number} gap - Gap between cards in pixels
 * @param {string} placeholderHTML - HTML string for placeholder card
 */
export function fillRowWithPlaceholders(container, cardWidth, gap, placeholderHTML) {
  if (!container) return;
  
  // Get container width
  const containerWidth = container.offsetWidth;
  
  // Calculate how many cards fit in one row
  const cardsPerRow = Math.floor((containerWidth + gap) / (cardWidth + gap));
  
  // Get current number of real cards
  const realCards = container.querySelectorAll(':not(.release-card-placeholder):not(.track-card-placeholder)');
  const realCardCount = realCards.length;
  
  // Calculate how many placeholders needed
  const placeholdersNeeded = cardsPerRow - (realCardCount % cardsPerRow);
  
  // Only add placeholders if there's a remainder (not a full row)
  if (realCardCount % cardsPerRow !== 0 && placeholdersNeeded < cardsPerRow) {
    // Remove existing placeholders first
    const existingPlaceholders = container.querySelectorAll('.release-card-placeholder, .track-card-placeholder');
    existingPlaceholders.forEach(p => p.remove());
    
    // Add new placeholders
    for (let i = 0; i < placeholdersNeeded; i++) {
      // Create placeholder with index for variety
      const placeholder = typeof placeholderHTML === 'function' 
        ? placeholderHTML(i) 
        : placeholderHTML;
      container.insertAdjacentHTML('beforeend', placeholder);
    }
  } else {
    // Remove placeholders if row is full
    const existingPlaceholders = container.querySelectorAll('.release-card-placeholder, .track-card-placeholder');
    existingPlaceholders.forEach(p => p.remove());
  }
}

// Fake data for placeholders
const fakeAlbums = [
  { title: "Загрузка...", artist: "Ожидание", score: 0 },
  { title: "Скоро здесь", artist: "Скоро", score: 0 },
  { title: "Пустое место", artist: "Заполнитель", score: 0 }
];

const fakeTracks = [
  { title: "Загрузка...", artist: "Ожидание", peopleScore: 0, miScore: 0 },
  { title: "Скоро здесь", artist: "Скоро", peopleScore: 0, miScore: 0 },
  { title: "Пустое место", artist: "Заполнитель", peopleScore: 0, miScore: 0 }
];

/**
 * Create placeholder HTML for release card
 */
export function createReleasePlaceholder(index = 0) {
  const fake = fakeAlbums[index % fakeAlbums.length];
  return `
    <div class="release-card release-card-placeholder" data-placeholder="true">
      <div class="release-cover-wrapper">
        <div class="placeholder-cover" style="width: 150px; height: 150px; background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.7rem;">placeholder</div>
      </div>
      <div class="release-info">
        <div class="release-title album-title">${fake.title}</div>
        <div class="release-artist album-artist">${fake.artist}</div>
      </div>
      <div class="monthly-release-score album-score">--</div>
    </div>
  `;
}

/**
 * Create placeholder HTML for track card
 */
export function createTrackPlaceholder(index = 0) {
  const fake = fakeTracks[index % fakeTracks.length];
  return `
    <div class="track-card track-card-placeholder" data-placeholder="true">
      <div class="track-cover-wrapper">
        <div class="placeholder-cover" style="width: 150px; height: 150px; background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.7rem;">placeholder</div>
      </div>
      <div class="track-info">
        <div class="track-title">${fake.title}</div>
        <div class="track-artist">${fake.artist}</div>
      </div>
      <div class="rewiews-badges">
        <div class="rewiews-badge-people">--</div>
        <div class="rewiews-badge-MI">--</div>
      </div>
    </div>
  `;
}

/**
 * Initialize placeholder filling for monthly releases
 */
export function initMonthlyReleasesPlaceholders() {
  const grid = document.querySelector('.monthly-releases-grid');
  if (!grid) return;
  
  // Card width: 166px, gap: 16px
  const cardWidth = 166;
  const gap = 16;
  
  // Use ResizeObserver to recalculate on container resize
  const resizeObserver = new ResizeObserver(() => {
    fillRowWithPlaceholders(grid, cardWidth, gap, (i) => createReleasePlaceholder(i));
  });
  
  resizeObserver.observe(grid);
  
  // Initial calculation
  setTimeout(() => {
    fillRowWithPlaceholders(grid, cardWidth, gap, (i) => createReleasePlaceholder(i));
  }, 100);
}

/**
 * Initialize placeholder filling for last added tracks
 */
export function initLastAddedTracksPlaceholders() {
  const tracksContainer = document.querySelector('.last-added-tracks');
  const wrapper = document.querySelector('.last-added-tracks-wrapper');
  if (!tracksContainer || !wrapper) return;
  
  // Card width: 161px, gap: 16px
  const cardWidth = 161;
  const gap = 16;
  
  // Use wrapper width for calculation (it has the actual visible width)
  const calculatePlaceholders = () => {
    const containerWidth = wrapper.offsetWidth || 1082; // Fallback to known width
    fillRowWithPlaceholders(tracksContainer, cardWidth, gap, (i) => createTrackPlaceholder(i));
  };
  
  // Use ResizeObserver to recalculate on container resize
  const resizeObserver = new ResizeObserver(() => {
    calculatePlaceholders();
  });
  
  resizeObserver.observe(wrapper);
  
  // Initial calculation
  setTimeout(() => {
    calculatePlaceholders();
  }, 100);
}

