// Function to render a single release card for monthly releases
export function renderReleaseCard(release) {
  // Calculate average score from subscores if available, otherwise from peopleScore/miScore
  let averageScore = null;
  if (release.subscores && release.subscores.length > 0) {
    const sum = release.subscores.reduce((a, b) => a + b, 0);
    averageScore = Math.round((sum / release.subscores.length) * 10);
  } else if (release.peopleScore && release.miScore) {
    averageScore = Math.round((release.peopleScore + release.miScore) / 2);
  } else if (release.peopleScore) {
    averageScore = release.peopleScore;
  } else if (release.miScore) {
    averageScore = release.miScore;
  }

  const tier = release.tier || 'other';

  return `
    <div class="release-card" data-tier="${tier}" data-id="${release.id}">
      <div class="release-cover-wrapper">
        <img src="${release.cover}" alt="Обложка" class="release-cover">
      </div>
      <div class="release-info">
        <div class="release-title album-title">${release.title}</div>
        <div class="release-artist album-artist">${release.artist}</div>
      </div>
      ${averageScore ? `
        <div class="monthly-release-score album-score">${averageScore}</div>
      ` : ''}
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
  // Sort by tier: gold, silver, bronze first, then others
  const tierOrder = { gold: 1, silver: 2, bronze: 3, other: 4 };
  const sortedReleases = releases
    .filter(r => r.type === 'album') // Only albums
    .sort((a, b) => {
      const aTier = a.tier || 'other';
      const bTier = b.tier || 'other';
      const aOrder = tierOrder[aTier] || 4;
      const bOrder = tierOrder[bTier] || 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return 0;
    });

  // Limit releases on mobile for optimization
  const isMobile = window.innerWidth < 768;
  const maxReleases = isMobile ? 6 : sortedReleases.length;
  const releasesToRender = sortedReleases.slice(0, maxReleases);

  console.log('Total albums to render:', releasesToRender.length);
  console.log('Albums:', releasesToRender.map(r => `${r.title} (${r.tier})`));

  const html = `
    <div class="monthly-releases">
      <div class="monthly-releases-title">Альбомы месяца</div>
      <div class="monthly-releases-grid">
        ${releasesToRender.map(renderReleaseCard).join('')}
      </div>
    </div>
  `;
  container.innerHTML = html;
}

