// Import unified release card component
import { renderReleaseCard, renderReleaseCards } from './components/releaseCard.js?v=20260405';

// Re-export for backward compatibility
export { renderReleaseCard, renderReleaseCards };

// Function to render a single release card for all releases page
// Uses unified component with 'default' variant
export function renderReleaseCardAll(release) {
  return renderReleaseCard(release, 'default');
}

// Function to render top releases section (6 cards)
export function renderMonthlyReleases(albums, container) {
  if (!albums || albums.length === 0) {
    container.innerHTML = `
      <div class="monthly-releases">
        <div class="monthly-releases-title">Лучшие релизы</div>
        <div class="no-releases" style="text-align: center; padding: 40px; color: #969696;">
          Пока нет релизов
        </div>
      </div>
    `;
    return;
  }

  // Render using unified component with 'monthly' variant style
  const html = `
    <div class="monthly-releases">
      <div class="monthly-releases-title">Лучшие релизы</div>
      <div class="monthly-releases-grid">
        ${renderReleaseCards(albums, 'monthly')}
      </div>
    </div>
  `;
  container.innerHTML = html;
}

