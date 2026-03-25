import { getCurrentUser, searchArtists, createArtist, uploadCover, uploadArtistImage, addReview, getTrack } from './api.js';
import { showErrorModal, showLoadingModal, showSuccessModal, closeModal } from './modal.js';

let currentUser = null;
let selectedArtistId = null;
let coverImagePath = null;
let artistImagePath = null;
let isCreatingNewArtist = false;
let searchTimeout = null;

// Generate random color for avatar background
function generateAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const saturation = 60 + (Math.abs(hash) % 20);
  const lightness = 45 + (Math.abs(hash) % 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getNickname(email) {
  if (!email) return '';
  return email.split('@')[0];
}

function getFirstLetter(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function updateAuthStatus(user) {
  const authButtons = document.querySelectorAll('.auth-buttons');
  const profileSection = document.querySelector('.profile-section');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileNickname = document.getElementById('profile-nickname');
  
  if (user) {
    authButtons.forEach(btn => btn.style.display = 'none');
    if (profileSection) {
      profileSection.style.display = 'flex';
      const nickname = getNickname(user.email || user.name);
      if (profileNickname) {
        profileNickname.textContent = nickname;
      }
      if (profileAvatar) {
        const firstLetter = getFirstLetter(nickname);
        const bgColor = generateAvatarColor(user.email || user.name);
        profileAvatar.textContent = firstLetter;
        profileAvatar.style.backgroundColor = bgColor;
      }
    }
  } else {
    authButtons.forEach(btn => btn.style.display = 'flex');
    if (profileSection) {
      profileSection.style.display = 'none';
    }
  }
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await getCurrentUser();
  
  if (!currentUser) {
    showErrorModal(
      'Требуется авторизация',
      'Для добавления релиза необходимо войти в систему.',
      'Войти',
      () => {
        window.location.href = 'login.html';
      }
    );
    
    // Redirect after 2 seconds if modal not closed
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return;
  }

  updateAuthStatus(currentUser);
  initArtistSearch();
  initCoverPreview();
  initArtistImagePreview();
  initRatingSliders();
  initForm();
});

/**
 * Initialize artist search with autocomplete
 */
function initArtistSearch() {
  const artistInput = document.getElementById('artist');
  const suggestionsDiv = document.getElementById('artist-suggestions');
  const createBtn = document.getElementById('create-artist-btn');

  artistInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    suggestionsDiv.innerHTML = '';
    selectedArtistId = null;
    createBtn.style.display = 'none';

    if (query.length < 2) {
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const artists = await searchArtists(query);
        
        if (artists.length > 0) {
          suggestionsDiv.innerHTML = artists.map(artist => `
            <div class="artist-suggestion" data-id="${artist.id}" data-name="${artist.name}">
              ${artist.name}
            </div>
          `).join('');

          // Add click handlers
          suggestionsDiv.querySelectorAll('.artist-suggestion').forEach(item => {
            item.addEventListener('click', () => {
              const artistId = item.dataset.id;
              const artistName = item.dataset.name;
              artistInput.value = artistName;
              selectedArtistId = parseInt(artistId);
              suggestionsDiv.innerHTML = '';
              createBtn.style.display = 'none';
            });
          });
        } else {
          // Show "create new" button if no results
          createBtn.style.display = 'block';
          createBtn.onclick = () => {
            isCreatingNewArtist = true;
            document.getElementById('artist-image-group').style.display = 'block';
            document.getElementById('artist-image').required = true;
          };
        }
      } catch (error) {
        console.error('Artist search error:', error);
      }
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!artistInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.innerHTML = '';
    }
  });
}

/**
 * Initialize artist image preview
 */
function initArtistImagePreview() {
  const artistImageInput = document.getElementById('artist-image');
  const previewDiv = document.getElementById('artist-image-preview');

  if (!artistImageInput || !previewDiv) return;

  artistImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('artist-image-error', 'Недопустимый формат. Используйте JPG, PNG или WebP');
      artistImageInput.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('artist-image-error', 'Файл слишком большой. Максимум 5MB');
      artistImageInput.value = '';
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">`;
    };
    reader.readAsDataURL(file);
    clearError('artist-image-error');
  });
}

/**
 * Initialize rating sliders with value display
 */
function initRatingSliders() {
  for (let i = 1; i <= 5; i++) {
    const slider = document.getElementById(`score${i}`);
    const valueDisplay = document.getElementById(`score${i}-value`);
    
    if (slider && valueDisplay) {
      // Update display on change
      slider.addEventListener('input', (e) => {
        valueDisplay.textContent = parseFloat(e.target.value).toFixed(1);
      });
      
      // Initialize display
      valueDisplay.textContent = parseFloat(slider.value).toFixed(1);
    }
  }
}

/**
 * Initialize cover image preview
 */
function initCoverPreview() {
  const coverInput = document.getElementById('cover');
  const previewDiv = document.getElementById('cover-preview');

  coverInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('cover-error', 'Недопустимый формат. Используйте JPG, PNG или WebP');
      coverInput.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('cover-error', 'Файл слишком большой. Максимум 5MB');
      coverInput.value = '';
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewDiv.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 300px; max-height: 300px; border-radius: 8px;">`;
    };
    reader.readAsDataURL(file);
    clearError('cover-error');
  });
}

/**
 * Initialize form submission
 */
function initForm() {
  const form = document.getElementById('release-form');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    clearAllErrors();
    document.getElementById('form-message').textContent = '';

    // Validate form
    if (!validateForm()) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
      // Upload cover image first
      const coverFile = document.getElementById('cover').files[0];
      if (coverFile) {
        const uploadResult = await uploadCover(coverFile);
        coverImagePath = uploadResult.imagePath;
      }

      // Handle artist creation with image if needed
      if (isCreatingNewArtist && !selectedArtistId) {
        const artistName = document.getElementById('artist').value.trim();
        const artistImageFile = document.getElementById('artist-image').files[0];
        
        if (!artistImageFile) {
          showError('artist-image-error', 'Изображение исполнителя обязательно при создании нового исполнителя');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Отправить на модерацию';
          return;
        }

        // Upload artist image
        const artistUploadResult = await uploadArtistImage(artistImageFile);
        artistImagePath = artistUploadResult.imagePath;

        // Create artist with image
        const artistResult = await createArtist({ 
          name: artistName,
          image_path: artistImagePath
        });
        selectedArtistId = artistResult.artist.id;
        isCreatingNewArtist = false;
      }

      // Get form data
      const formData = {
        title: document.getElementById('title').value.trim(),
        artist: document.getElementById('artist').value.trim(),
        type: document.getElementById('type').value,
        cover: coverImagePath,
        link: document.getElementById('link').value.trim() || null,
        artist_id: selectedArtistId || null
      };

      // Import createTrack function
      const { createTrack } = await import('./api.js');
      const result = await createTrack(formData);

      // Create review for the track
      const reviewText = document.getElementById('review-text').value.trim();
      const score1 = parseFloat(document.getElementById('score1').value);
      const score2 = parseFloat(document.getElementById('score2').value);
      const score3 = parseFloat(document.getElementById('score3').value);
      const score4 = parseFloat(document.getElementById('score4').value);
      const score5 = parseFloat(document.getElementById('score5').value);

      // Add review (convert 0-10 scale to 1-10 for database - 0 becomes 1)
      const reviewScores = {
        score1: Math.max(1, Math.ceil(score1)),
        score2: Math.max(1, Math.ceil(score2)),
        score3: Math.max(1, Math.ceil(score3)),
        score4: Math.max(1, Math.ceil(score4)),
        score5: Math.max(1, Math.ceil(score5))
      };

      await addReview({
        trackId: result.track.id,
        text: reviewText,
        ...reviewScores
      });

      // Show success message
      const messageDiv = document.getElementById('form-message');
      if (currentUser.role === 'admin') {
        messageDiv.textContent = '✓ Релиз опубликован!';
        messageDiv.className = 'form-message success';
        setTimeout(() => {
          window.location.href = `track.html?id=${result.track.id}`;
        }, 1500);
      } else {
        messageDiv.textContent = '✓ Релиз отправлен на модерацию!';
        messageDiv.className = 'form-message success';
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      }
    } catch (error) {
      console.error('Submit error:', error);
      
      // Handle specific error types
      let errorMessage = 'Ошибка при отправке релиза';
      
      if (error.status === 400) {
        errorMessage = error.message || 'Неверные данные. Проверьте все поля.';
      } else if (error.status === 401) {
        errorMessage = 'Необходима авторизация. Пожалуйста, войдите в систему.';
      } else if (error.status === 403) {
        errorMessage = 'Недостаточно прав для выполнения этого действия.';
      } else if (error.status === 500) {
        errorMessage = 'Ошибка сервера. Попробуйте позже или обратитесь в поддержку.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show field-specific errors if available
      if (error.data && error.data.field) {
        showError(`${error.data.field}-error`, errorMessage);
      } else {
        document.getElementById('form-message').textContent = `Ошибка: ${errorMessage}`;
        document.getElementById('form-message').className = 'form-message error';
      }
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить на модерацию';
    }
  });
}

/**
 * Validate form
 */
function validateForm() {
  let isValid = true;

  const title = document.getElementById('title').value.trim();
  if (!title || title.length === 0) {
    showError('title-error', 'Название обязательно');
    isValid = false;
  }

  const artist = document.getElementById('artist').value.trim();
  if (!artist || artist.length === 0) {
    showError('artist-error', 'Исполнитель обязателен');
    isValid = false;
  }

  // Validate review text
  const reviewText = document.getElementById('review-text').value.trim();
  if (!reviewText || reviewText.length === 0) {
    showError('review-text-error', 'Текст рецензии обязателен');
    isValid = false;
  }

  // Validate ratings (all must be set, 0-10)
  for (let i = 1; i <= 5; i++) {
    const score = parseFloat(document.getElementById(`score${i}`).value);
    if (isNaN(score) || score < 0 || score > 10) {
      showError(`score${i}-error`, 'Оценка должна быть от 0 до 10');
      isValid = false;
    }
  }

  // Validate artist image if creating new artist
  if (isCreatingNewArtist && !selectedArtistId) {
    const artistImageFile = document.getElementById('artist-image').files[0];
    if (!artistImageFile) {
      showError('artist-image-error', 'Изображение исполнителя обязательно при создании нового исполнителя');
      isValid = false;
    }
  }

  const type = document.getElementById('type').value;
  if (!type) {
    showError('type-error', 'Выберите тип релиза');
    isValid = false;
  }

  const cover = document.getElementById('cover').files[0];
  if (!cover) {
    showError('cover-error', 'Обложка обязательна');
    isValid = false;
  }

  const link = document.getElementById('link').value.trim();
  if (link && !isValidUrl(link)) {
    showError('link-error', 'Некорректный URL');
    isValid = false;
  }

  return isValid;
}

/**
 * Helper functions
 */
function showError(fieldId, message) {
  const errorEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.textContent = message;
  }
}

function clearError(fieldId) {
  const errorEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.textContent = '';
  }
}

function clearAllErrors() {
  ['title-error', 'artist-error', 'type-error', 'cover-error', 'link-error', 
   'review-text-error', 'score1-error', 'score2-error', 'score3-error', 'score4-error', 'score5-error',
   'artist-image-error'].forEach(id => {
    clearError(id);
  });
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}



