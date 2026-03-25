import { getCurrentUser } from './api.js';

let currentUser = null;
let currentRejectTrackId = null;
let currentRejectReviewId = null;
let currentRejectType = 'track'; // 'track' or 'review'
let allTracksCache = []; // Cache for search filtering

// Check admin access on page load
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await getCurrentUser();
  
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  if (currentUser.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('admin-status').textContent = `Вы вошли как: ${currentUser.name} (${currentUser.email})`;

  initTabs();
  loadModerationQueue();
  initRejectModal();
  initTestDataForms();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.dataset.tab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show/hide content
      document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById(`${targetTab}-tab`).style.display = 'block';

      // Load content if needed
      if (targetTab === 'moderation') {
        loadModerationQueue();
      } else if (targetTab === 'reviews-moderation') {
        loadReviewsModerationQueue();
      } else if (targetTab === 'tracks') {
        loadAllTracks();
      } else if (targetTab === 'test-data') {
        loadTracksForReviewSelect();
      }
    });
  });
}

/**
 * Load moderation queue
 */
async function loadModerationQueue() {
  const queueDiv = document.getElementById('moderation-queue');
  queueDiv.innerHTML = '<p>Загрузка...</p>';

  try {
    const response = await fetch('/api/admin/moderation-queue', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load moderation queue');
    }

    const data = await response.json();
    const tracks = data.tracks || [];

    if (tracks.length === 0) {
      queueDiv.innerHTML = '<p>Очередь модерации пуста</p>';
      return;
    }

    queueDiv.innerHTML = tracks.map(track => `
      <div class="moderation-item" data-id="${track.id}">
        <img src="${track.cover || '../svg/album.png'}" alt="Cover" class="moderation-cover" onerror="this.src='../svg/album.png'">
        <div class="moderation-info">
          <h3>${track.title}</h3>
          <p><strong>Исполнитель:</strong> ${track.artist}</p>
          <p><strong>Тип:</strong> ${track.type === 'single' ? 'Сингл' : track.type === 'album' ? 'Альбом' : 'EP'}</p>
          <p><strong>Добавил:</strong> ${track.submitter_name || 'Неизвестен'} (${track.submitter_email || 'N/A'})</p>
          <p><strong>Дата:</strong> ${new Date(track.created_at).toLocaleString('ru-RU')}</p>
        </div>
        <div class="moderation-actions">
          <button class="btn-approve" onclick="approveTrack(${track.id})">Одобрить</button>
          <button class="btn-reject" onclick="showRejectModal(${track.id})">Отклонить</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading moderation queue:', error);
    queueDiv.innerHTML = '<p style="color: red;">Ошибка загрузки очереди модерации</p>';
  }
}

/**
 * Load all tracks
 */
async function loadAllTracks() {
  const tracksDiv = document.getElementById('all-tracks');
  tracksDiv.innerHTML = '<p>Загрузка...</p>';

  try {
    const response = await fetch('/api/admin/tracks', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load tracks');
    }

    const data = await response.json();
    allTracksCache = data.tracks || [];

    renderTracksGrid(allTracksCache);
    
    // Setup search
    const searchInput = document.getElementById('tracks-search');
    if (searchInput) {
      searchInput.removeEventListener('input', handleTracksSearch);
      searchInput.addEventListener('input', handleTracksSearch);
    }
  } catch (error) {
    console.error('Error loading tracks:', error);
    tracksDiv.innerHTML = '<p style="color: red;">Ошибка загрузки релизов</p>';
  }
}

/**
 * Handle tracks search
 */
function handleTracksSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    renderTracksGrid(allTracksCache);
    return;
  }
  
  const filtered = allTracksCache.filter(track => 
    track.title.toLowerCase().includes(query) || 
    track.artist.toLowerCase().includes(query)
  );
  
  renderTracksGrid(filtered);
}

/**
 * Render tracks grid
 */
function renderTracksGrid(tracks) {
  const tracksDiv = document.getElementById('all-tracks');
  
  if (tracks.length === 0) {
    tracksDiv.innerHTML = '<p style="width: 100%; text-align: center; color: #969696;">Нет релизов</p>';
    return;
  }

  tracksDiv.innerHTML = tracks.map(track => {
    const statusClass = `status-${track.status}`;
    const statusText = {
      'pending': 'На модерации',
      'approved': 'Одобрен',
      'rejected': 'Отклонен'
    }[track.status] || track.status;

    return `
      <div class="admin-track-card" data-id="${track.id}" style="width: 175px; background: #1a1a1a; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
        <img src="${track.cover || '../svg/album.png'}" alt="Cover" style="width: 175px; height: 175px; object-fit: cover; display: block;" onerror="this.src='../svg/album.png'">
        <div style="padding: 10px;">
          <div style="font-weight: bold; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${track.title}">${track.title}</div>
          <div style="color: #969696; font-size: 0.8em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${track.artist}">${track.artist}</div>
          <div style="margin-top: 5px;"><span class="status-badge ${statusClass}" style="font-size: 0.7em; padding: 2px 8px;">${statusText}</span></div>
          <div style="display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;">
            ${track.status === 'pending' ? `
              <button class="btn-approve" onclick="approveTrack(${track.id})" style="padding: 5px 8px; font-size: 0.75em;">✓</button>
              <button class="btn-reject" onclick="showRejectModal(${track.id})" style="padding: 5px 8px; font-size: 0.75em;">✗</button>
            ` : ''}
            <button class="btn-reject" onclick="deleteTrack(${track.id})" style="background: #880000; padding: 5px 8px; font-size: 0.75em;">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Approve track
 */
window.approveTrack = async function(trackId) {
  if (!confirm('Одобрить этот релиз?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/releases/${trackId}/approve`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve');
    }

    alert('Релиз одобрен!');
    loadModerationQueue();
    loadAllTracks();
  } catch (error) {
    console.error('Error approving track:', error);
    alert(`Ошибка: ${error.message}`);
  }
};

/**
 * Show reject modal for tracks
 */
window.showRejectModal = function(trackId) {
  currentRejectTrackId = trackId;
  currentRejectType = 'track';
  document.getElementById('reject-modal-title').textContent = 'Отклонить релиз';
  document.getElementById('reject-modal').style.display = 'flex';
  document.getElementById('reject-reason').value = '';
};

/**
 * Load reviews moderation queue
 */
async function loadReviewsModerationQueue() {
  const queueDiv = document.getElementById('reviews-moderation-queue');
  queueDiv.innerHTML = '<p>Загрузка...</p>';

  try {
    const response = await fetch('/api/admin/reviews/moderation-queue', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load reviews moderation queue');
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    if (reviews.length === 0) {
      queueDiv.innerHTML = '<p>Очередь модерации отзывов пуста</p>';
      return;
    }

    queueDiv.innerHTML = reviews.map(review => `
      <div class="moderation-item" data-id="${review.id}">
        <img src="${review.track_cover || '../svg/album.png'}" alt="Cover" class="moderation-cover" onerror="this.src='../svg/album.png'">
        <div class="moderation-info">
          <h3>Отзыв на: ${review.track_title}</h3>
          <p><strong>Исполнитель:</strong> ${review.track_artist}</p>
          <p><strong>Автор отзыва:</strong> ${review.author_name || 'Неизвестен'} (${review.author_email || 'N/A'})</p>
          <p><strong>Оценка:</strong> ${review.avg_score}/10</p>
          <p><strong>Текст:</strong> ${review.text ? review.text.substring(0, 200) + (review.text.length > 200 ? '...' : '') : 'Нет текста'}</p>
          <p><strong>Дата:</strong> ${new Date(review.created_at).toLocaleString('ru-RU')}</p>
        </div>
        <div class="moderation-actions">
          <button class="btn-approve" onclick="approveReview(${review.id})">Одобрить</button>
          <button class="btn-reject" onclick="showRejectReviewModal(${review.id})">Отклонить</button>
          <button class="btn-reject" onclick="deleteReview(${review.id})" style="background: #880000;">Удалить</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading reviews moderation queue:', error);
    queueDiv.innerHTML = '<p style="color: red;">Ошибка загрузки очереди модерации отзывов</p>';
  }
}

/**
 * Approve review
 */
window.approveReview = async function(reviewId) {
  if (!confirm('Одобрить этот отзыв?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/reviews/${reviewId}/approve`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve review');
    }

    alert('Отзыв одобрен!');
    loadReviewsModerationQueue();
  } catch (error) {
    console.error('Error approving review:', error);
    alert(`Ошибка: ${error.message}`);
  }
};

/**
 * Show reject review modal
 */
window.showRejectReviewModal = function(reviewId) {
  currentRejectReviewId = reviewId;
  currentRejectType = 'review';
  document.getElementById('reject-modal-title').textContent = 'Отклонить отзыв';
  document.getElementById('reject-modal').style.display = 'flex';
  document.getElementById('reject-reason').value = '';
};

/**
 * Initialize reject modal
 */
function initRejectModal() {
  const modal = document.getElementById('reject-modal');
  const cancelBtn = document.getElementById('cancel-reject');
  const confirmBtn = document.getElementById('confirm-reject');

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    currentRejectTrackId = null;
    currentRejectReviewId = null;
    currentRejectType = 'track';
  });

  confirmBtn.addEventListener('click', async () => {
    const reason = document.getElementById('reject-reason').value.trim();
    
    if (!reason) {
      alert('Укажите причину отклонения');
      return;
    }

    try {
      let url, successMessage;
      
      if (currentRejectType === 'review') {
        url = `/api/admin/reviews/${currentRejectReviewId}/reject`;
        successMessage = 'Отзыв отклонен';
      } else {
        url = `/api/admin/releases/${currentRejectTrackId}/reject`;
        successMessage = 'Релиз отклонен';
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject');
      }

      alert(successMessage);
      modal.style.display = 'none';
      
      if (currentRejectType === 'review') {
        currentRejectReviewId = null;
        loadReviewsModerationQueue();
      } else {
        currentRejectTrackId = null;
        loadModerationQueue();
        loadAllTracks();
      }
      currentRejectType = 'track';
    } catch (error) {
      console.error('Error rejecting:', error);
      alert(`Ошибка: ${error.message}`);
    }
  });

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      currentRejectTrackId = null;
      currentRejectReviewId = null;
      currentRejectType = 'track';
    }
  });
}

/**
 * Load tracks for review select dropdown
 */
async function loadTracksForReviewSelect() {
  const select = document.getElementById('test-review-track');
  if (!select) return;
  
  try {
    const response = await fetch('/api/admin/tracks', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to load tracks');
    }
    
    const data = await response.json();
    const tracks = (data.tracks || []).filter(t => t.status === 'approved');
    
    select.innerHTML = '<option value="">Выберите релиз...</option>' + 
      tracks.map(track => `<option value="${track.id}">${track.title} - ${track.artist}</option>`).join('');
  } catch (error) {
    console.error('Error loading tracks for select:', error);
  }
}

/**
 * Initialize test data forms
 */
function initTestDataForms() {
  // Test Release Form
  const releaseForm = document.getElementById('test-release-form');
  if (releaseForm) {
    releaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('test-release-title').value.trim();
      const artist = document.getElementById('test-release-artist').value.trim();
      const type = document.getElementById('test-release-type').value;
      const link = document.getElementById('test-release-link').value.trim();
      
      const resultDiv = document.getElementById('test-release-result');
      resultDiv.innerHTML = '<p style="color: #ff9800;">Создание...</p>';
      
      try {
        const response = await fetch('/api/tracks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title, artist, type, link })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create release');
        }
        
        resultDiv.innerHTML = `<p style="color: #4CAF50;">✓ Релиз создан! ID: ${data.track?.id || 'N/A'}</p>`;
        releaseForm.reset();
        
        // Reload tracks list for review select
        loadTracksForReviewSelect();
        loadAllTracks();
      } catch (error) {
        console.error('Error creating test release:', error);
        resultDiv.innerHTML = `<p style="color: #f44336;">✗ Ошибка: ${error.message}</p>`;
      }
    });
  }
  
  // Test Review Form
  const reviewForm = document.getElementById('test-review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const trackId = document.getElementById('test-review-track').value;
      const text = document.getElementById('test-review-text').value.trim();
      const score1 = parseInt(document.getElementById('test-review-score1').value);
      const score2 = parseInt(document.getElementById('test-review-score2').value);
      const score3 = parseInt(document.getElementById('test-review-score3').value);
      const score4 = parseInt(document.getElementById('test-review-score4').value);
      const score5 = parseInt(document.getElementById('test-review-score5').value);
      
      if (!trackId) {
        alert('Выберите релиз');
        return;
      }
      
      const resultDiv = document.getElementById('test-review-result');
      resultDiv.innerHTML = '<p style="color: #ff9800;">Создание...</p>';
      
      try {
        const response = await fetch('/api/reviews/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ trackId, text, score1, score2, score3, score4, score5 })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create review');
        }
        
        resultDiv.innerHTML = `<p style="color: #4CAF50;">✓ Отзыв создан! ID: ${data.review?.id || 'N/A'}</p>`;
        reviewForm.reset();
        document.getElementById('test-review-score1').value = '7';
        document.getElementById('test-review-score2').value = '7';
        document.getElementById('test-review-score3').value = '7';
        document.getElementById('test-review-score4').value = '7';
        document.getElementById('test-review-score5').value = '7';
      } catch (error) {
        console.error('Error creating test review:', error);
        resultDiv.innerHTML = `<p style="color: #f44336;">✗ Ошибка: ${error.message}</p>`;
      }
    });
  }
  
  // Admin Promotion Form
  const promoteForm = document.getElementById('promote-admin-form');
  if (promoteForm) {
    promoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('promote-email').value.trim();
      const resultDiv = document.getElementById('promote-result');
      resultDiv.innerHTML = '<p style="color: #ff9800;">Назначение...</p>';
      
      try {
        const response = await fetch('/api/admin/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to promote user');
        }
        
        resultDiv.innerHTML = `<p style="color: #4CAF50;">✓ ${data.message}</p>`;
        promoteForm.reset();
      } catch (error) {
        console.error('Error promoting user:', error);
        resultDiv.innerHTML = `<p style="color: #f44336;">✗ Ошибка: ${error.message}</p>`;
      }
    });
  }
}

/**
 * Delete a track
 */
window.deleteTrack = async function(trackId) {
  if (!confirm('Вы уверены, что хотите удалить этот релиз? Все связанные отзывы также будут удалены.')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/releases/${trackId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete track');
    }

    alert('Релиз удален!');
    loadModerationQueue();
    loadAllTracks();
    loadTracksForReviewSelect();
  } catch (error) {
    console.error('Error deleting track:', error);
    alert(`Ошибка: ${error.message}`);
  }
};

/**
 * Delete a review
 */
window.deleteReview = async function(reviewId) {
  if (!confirm('Вы уверены, что хотите удалить этот отзыв?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete review');
    }

    alert('Отзыв удален!');
    loadReviewsModerationQueue();
  } catch (error) {
    console.error('Error deleting review:', error);
    alert(`Ошибка: ${error.message}`);
  }
};











