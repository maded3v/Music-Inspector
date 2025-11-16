// Function to render a single release card for monthly releases
export function renderReleaseCard(release) {
  return `
    <div class="release-card ${release.tier}">
      <div class="release-info">
        <div class="release-title">${release.title}</div>
        <div class="release-artist">${release.artist}</div>
      </div>
    </div>
  `;
}

// Function to render a single release card for all releases page
export function renderReleaseCardAll(release) {
  return `
    <div class="release-card ${release.tier}">
      <div class="release-cover-wrapper">
        <img src="${release.cover}" alt="Обложка" class="release-cover">
      </div>
      <div class="release-info">
        <div class="release-title">${release.title}</div>
        <div class="release-artist">${release.artist}</div>
        <div class="release-date">${release.releaseDate}</div>
        <div class="release-description">${release.shortDescription}</div>
      </div>
    </div>
  `;
}

// Function to render the monthly releases section
export function renderMonthlyReleases(releases, container) {
  // Filter and sort by tier: gold, silver, bronze
  const tierOrder = { gold: 1, silver: 2, bronze: 3 };
  const sortedReleases = releases
    .filter(r => ['gold', 'silver', 'bronze'].includes(r.tier))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  const html = `
    <div class="monthly-releases">
      <h2 class="monthly-releases-title">Релизы месяца</h2>
      <div class="monthly-releases-grid">
        ${sortedReleases.map(renderReleaseCard).join('')}
      </div>
    </div>
  `;
  container.innerHTML = html;
}
