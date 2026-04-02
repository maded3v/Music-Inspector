import { getReviews, getReleases, getTopReleases } from './api.js?v=20260409';
import { renderReviews, initReviewExpand, initReviewOpen } from './reviews.js?v=20260409';
import { renderMonthlyReleases } from './releases.js?v=20260409';
import { renderReleaseCards } from './components/releaseCard.js?v=20260409';
import { initSearch } from './search.js';
import { initTiltEffect } from './tilt-effect.js';
import { initAuthStatus } from './auth-status.js?v=20260409';

// Function to render last added releases (both tracks and albums)
function renderLastAddedReleases(releases, container) {
  if (!releases || releases.length === 0) {
    container.innerHTML = '<div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">Пока нет добавленных релизов</div>';
    return;
  }

  // Use unified release card component
  container.innerHTML = renderReleaseCards(releases, 'home');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and update UI
  const currentUser = await initAuthStatus();
  
  // Show "Add Release" button if logged in
  const addReleaseBtn = document.getElementById('add-release-btn');
  if (currentUser && addReleaseBtn) {
    addReleaseBtn.classList.remove('is-hidden');
  }
  // Load data in parallel
  const [reviews, releases, topReleases] = await Promise.all([
    getReviews(),
    getReleases(),
    getTopReleases().catch((error) => {
      console.error('Error loading top releases:', error);
      return [];
    })
  ]);

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
      .slice()
      .sort((a, b) => new Date(b.created_at || b.releaseDate || 0) - new Date(a.created_at || a.releaseDate || 0));
    
    renderLastAddedReleases(allReleases, lastAddedTracksContainer);
  }

  // Load and render top releases (6 highest-rated cards)
  const releasesContainer = document.querySelector('.main-content');
  if (releasesContainer) {
    const releasesSection = document.createElement('div');
    releasesSection.classList.add('monthly-releases-container');
    releasesContainer.appendChild(releasesSection);
    
    try {
      renderMonthlyReleases(topReleases, releasesSection);

      // Initialize tilt effect after cards are rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => initTiltEffect());
      });
    } catch (error) {
      releasesSection.innerHTML = `
        <div class="monthly-releases">
          <div class="monthly-releases-title">Лучшие релизы</div>
          <div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">
            Ошибка загрузки лучших релизов
          </div>
        </div>
      `;
    }
  }

  // Initialize search with tracks and releases data after cards are in DOM
  requestAnimationFrame(() => {
    const tracks = Array.from(document.querySelectorAll('.track-card')).map(card => ({
      title: card.querySelector('.track-title')?.textContent || '',
      artist: card.querySelector('.track-artist')?.textContent || '',
      id: card.dataset.id || ''
    }));
    
    initSearch(tracks, releases);
  });

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

    const getMaxOffset = () => {
      const raw = trackWrapper.scrollWidth - wrapper.clientWidth;
      return Math.max(0, Math.ceil(raw));
    };

    const updateCarousel = () => {
      const maxOffset = getMaxOffset();
      currentOffset = Math.min(Math.max(0, currentOffset), maxOffset);
      trackWrapper.style.transform = `translate3d(-${currentOffset}px, 0, 0)`;

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

    window.addEventListener('resize', updateCarousel, { passive: true });
    window.addEventListener('load', updateCarousel, { passive: true });
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
