import { getReviews, getReleases, getMonthlyAlbums } from './api.js';
import { renderReviews, initReviewExpand, initReviewOpen } from './reviews.js';
import { renderMonthlyReleases } from './releases.js';
import { renderReleaseCards } from './components/releaseCard.js';
import { initSearch } from './search.js';
import { initTiltEffect } from './tilt-effect.js';
import { initAuthStatus } from './auth-status.js';

// Function to render last added releases (both tracks and albums)
function renderLastAddedReleases(releases, container) {
  if (!releases || releases.length === 0) {
    container.innerHTML = '<div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">Пока нет добавленных релизов</div>';
    return;
  }

  // Use unified release card component
  container.innerHTML = renderReleaseCards(releases, 'default');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and update UI
  const currentUser = await initAuthStatus();
  
  // Show "Add Release" button if logged in
  const addReleaseBtn = document.getElementById('add-release-btn');
  if (currentUser && addReleaseBtn) {
    addReleaseBtn.style.display = 'inline-block';
  }
  // Load data
  const reviews = await getReviews();
  const releases = await getReleases();

  // Load and render reviews (limit to 2)
  const reviewsContainer = document.querySelector('.reviews-grid');
  if (reviewsContainer) {
    const limitedReviews = reviews.slice(0, 2);
    renderReviews(limitedReviews, reviewsContainer);
    initReviewExpand(reviewsContainer);
    initReviewOpen(reviewsContainer);
  }

  // Load and render latest releases (both tracks and albums)
  const lastAddedTracksContainer = document.querySelector('.last-added-tracks');
  if (lastAddedTracksContainer) {
    // Show all releases (tracks and albums), sort by newest first
    const allReleases = releases
      .sort((a, b) => new Date(b.created_at || b.releaseDate || 0) - new Date(a.created_at || a.releaseDate || 0));
    
    renderLastAddedReleases(allReleases, lastAddedTracksContainer);
  }

  // Load and render monthly albums (exactly 6 highest-rated from current month)
  const releasesContainer = document.querySelector('.main-content');
  if (releasesContainer) {
    const releasesSection = document.createElement('div');
    releasesSection.classList.add('monthly-releases-container');
    releasesContainer.appendChild(releasesSection);
    
    // Fetch monthly albums from dedicated endpoint
    try {
      const monthlyAlbums = await getMonthlyAlbums();
      renderMonthlyReleases(monthlyAlbums, releasesSection);
      
      // Initialize tilt effect after cards are rendered
      setTimeout(() => {
        initTiltEffect();
      }, 100);
    } catch (error) {
      console.error('Error loading monthly albums:', error);
      releasesSection.innerHTML = `
        <div class="monthly-releases">
          <div class="monthly-releases-title">Альбомы месяца</div>
          <div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">
            Ошибка загрузки альбомов месяца
          </div>
        </div>
      `;
    }
  }

  // Initialize search with tracks and releases data
  // Wait a bit for DOM to be ready (including dynamically loaded releases)
  setTimeout(() => {
    const tracks = Array.from(document.querySelectorAll('.track-card')).map(card => ({
      title: card.querySelector('.track-title')?.textContent || '',
      artist: card.querySelector('.track-artist')?.textContent || '',
      id: card.dataset.id || ''
    }));
    
    initSearch(tracks, releases);
  }, 200);

  // Preserve existing carousel logic
  const trackWrapper = document.querySelector(".last-added-tracks");
  const prevBtn = document.querySelector(".but-prev-last-added-tracks");
  const nextBtn = document.querySelector(".but-next-last-added-tracks");
  const wrapper = document.querySelector(".last-added-tracks-wrapper");

  if (trackWrapper && prevBtn && nextBtn && wrapper) {
    let currentOffset = 0;

    const getStep = () => {
      const firstCard = trackWrapper.querySelector('.track-card-link, .track-card');
      if (!firstCard) {
        return 0;
      }

      const cardWidth = firstCard.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(trackWrapper).gap) || 16;
      return cardWidth + gap;
    };

    const getMaxOffset = () => Math.max(0, trackWrapper.scrollWidth - wrapper.clientWidth);

    const updateCarousel = () => {
      const maxOffset = getMaxOffset();
      currentOffset = Math.min(Math.max(0, currentOffset), maxOffset);
      trackWrapper.style.transform = `translateX(-${currentOffset}px)`;

      const atStart = currentOffset <= 0;
      const atEnd = currentOffset >= maxOffset - 1;

      prevBtn.classList.toggle('is-disabled', atStart);
      nextBtn.classList.toggle('is-disabled', atEnd);
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
    };

    nextBtn.addEventListener('click', () => {
      currentOffset += getStep();
      updateCarousel();
    });

    prevBtn.addEventListener('click', () => {
      currentOffset -= getStep();
      updateCarousel();
    });

    window.addEventListener('resize', updateCarousel);
    updateCarousel();
  }

  // Badges are now rendered by the unified component, no need for manual badge creation

  // Score calculation (assuming data-values attribute)
  document.querySelectorAll('.review-score').forEach(el => {
    if (el.dataset.values) {
      const nums = el.dataset.values.split(',').map(Number);
      const avg = Math.round(nums.reduce((a, b) => a + b) / nums.length * 10);
      el.textContent = avg;
    }
  });
});
