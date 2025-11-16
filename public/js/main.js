import { getReviews, getReleases } from './api.js';
import { renderReviews, initReviewExpand, initReviewOpen } from './reviews.js';
import { renderMonthlyReleases } from './releases.js';

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
  // Load and render reviews
  const reviewsContainer = document.querySelector('.reviews-grid');
  if (reviewsContainer) {
    const reviews = await getReviews();
    renderReviews(reviews, reviewsContainer);
    initReviewExpand(reviewsContainer);
    initReviewOpen(reviewsContainer);
  }

  // Load and render monthly releases
  const releasesContainer = document.querySelector('.main-content');
  if (releasesContainer) {
    const releases = await getReleases();
    const releasesSection = document.createElement('div');
    releasesSection.classList.add('monthly-releases-container');
    releasesContainer.appendChild(releasesSection);
    renderMonthlyReleases(releases, releasesSection);
  }

  // Preserve existing carousel logic
  const trackWrapper = document.querySelector(".last-added-tracks");
  const prevBtn = document.querySelector(".but-prev-last-added-tracks");
  const nextBtn = document.querySelector(".but-next-last-added-tracks");
  const wrapper = document.querySelector(".last-added-tracks-wrapper");

  if (trackWrapper && prevBtn && nextBtn && wrapper) {
    const cardWidth = 161 + 16; // width + gap
    let currentIndex = 0;

    function updateButtons() {
      const visibleCards = Math.floor(wrapper.offsetWidth / cardWidth);
      const totalCards = trackWrapper.children.length;

      nextBtn.addEventListener("click", () => {
        if (currentIndex < totalCards - visibleCards) {
          currentIndex++;
          trackWrapper.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        }
      });

      prevBtn.addEventListener("click", () => {
        if (currentIndex > 0) {
          currentIndex--;
          trackWrapper.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        }
      });
    }

    updateButtons();
  }

  // Preserve badge logic
  document.querySelectorAll('.track-card').forEach(card => {
    const wrapper = card.querySelector('.track-cover-wrapper');

    const badge = document.createElement("div");
    badge.classList.add("track-badge");
    badge.style.backgroundColor = "#141414";
    badge.style.borderRadius = "50%";
    badge.style.padding = "4px";

    if (card.dataset.type === "single") {
      badge.innerHTML = `
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <path d="M406.3 48.2c-4.7.9-202 39.2-206.2 40-4.2.8-8.1 3.6-8.1 8v240.1c0 1.6-.1 7.2-2.4 11.7-3.1 5.9-8.5 10.2-16.1 12.7-3.3 1.1-7.8 2.1-13.1 3.3-24.1 5.4-64.4 14.6-64.4 51.8 0 31.1 22.4 45.1 41.7 47.5 2.1.3 4.5.7 7.1.7 6.7 0 36-3.3 51.2-13.2 11-7.2 24.1-21.4 24.1-47.8V190.5c0-3.8 2.7-7.1 6.4-7.8l152-30.7c5-1 9.6 2.8 9.6 7.8v130.9c0 4.1-.2 8.9-2.5 13.4-3.1 5.9-8.5 10.2-16.2 12.7-3.3 1.1-8.8 2.1-14.1 3.3-24.1 5.4-64.4 14.5-64.4 51.7 0 33.7 25.4 47.2 41.8 48.3 6.5.4 11.2.3 19.4-.9s23.5-5.5 36.5-13c17.9-10.3 27.5-26.8 27.5-48.2V55.9c-.1-4.4-3.8-8.9-9.8-7.7z"></path>
        </svg>
      `;
    } else if (card.dataset.type === "album") {
      badge.innerHTML = `
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" class="relative size-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11.99" cy="11.99" r="2.01"></circle>
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
          <path d="M12 6a6 6 0 0 0-6 6h2a4 4 0 0 1 4-4z"></path>
        </svg>
      `;
    }

    wrapper.appendChild(badge);
  });

  // Score calculation (assuming data-values attribute)
  document.querySelectorAll('.review-score').forEach(el => {
    if (el.dataset.values) {
      const nums = el.dataset.values.split(',').map(Number);
      const avg = Math.round(nums.reduce((a, b) => a + b) / nums.length * 10);
      el.textContent = avg;
    }
  });
});
