// Import unified release card component
import { renderReleaseCard, renderReleaseCards } from './components/releaseCard.js';

// Re-export for backward compatibility
export { renderReleaseCard, renderReleaseCards };

// Function to render a single release card for all releases page
// Uses unified component with 'default' variant
export function renderReleaseCardAll(release) {
  return renderReleaseCard(release, 'default');
}

// Function to render the monthly releases section
// CRITICAL: Only albums, exactly 6, single row, current month, highest rating
// Albums are already filtered and sorted by backend
export function renderMonthlyReleases(albums, container) {
  if (!albums || albums.length === 0) {
    container.innerHTML = `
      <div class="monthly-releases">
        <div class="monthly-releases-title">Альбомы месяца</div>
        <div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">
          Пока нет альбомов в этом месяце
        </div>
      </div>
    `;
    return;
  }

  // Render using unified component with 'monthly' variant
  // Backend already returns exactly 6 albums, sorted by rating
  const html = `
    <div class="monthly-releases">
      <div class="monthly-releases-title">Альбомы месяца</div>
      <div class="monthly-releases-grid">
        ${renderReleaseCards(albums, 'monthly')}
      </div>
    </div>
  `;
  container.innerHTML = html;
}

