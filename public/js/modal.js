/**
 * Modal Dialog System for Authentication Feedback
 * Provides centered, styled dialogs for success, error, and loading states
 */

// Create modal container and styles if not already present
function initModalStyles() {
  if (document.getElementById('modal-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    .auth-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideIn {
      from { 
        transform: translateY(-20px);
        opacity: 0;
      }
      to { 
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .auth-modal {
      background: #1e1e1e;
      border-radius: 12px;
      padding: 40px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.3s ease-out;
      border: 1px solid #333;
    }
    
    .auth-modal-icon {
      text-align: center;
      font-size: 64px;
      margin-bottom: 20px;
      animation: scaleIn 0.4s ease-out 0.1s both;
    }
    
    @keyframes scaleIn {
      from { 
        transform: scale(0);
        opacity: 0;
      }
      to { 
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .auth-modal-icon.success {
      color: #4caf50;
    }
    
    .auth-modal-icon.error {
      color: #f44336;
    }
    
    .auth-modal-icon.loading {
      color: #2196F3;
      animation: rotate 1s linear infinite;
    }
    
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .auth-modal-title {
      font-size: 24px;
      font-weight: 600;
      color: #fff;
      text-align: center;
      margin-bottom: 12px;
    }
    
    .auth-modal-message {
      font-size: 16px;
      color: #b0b0b0;
      text-align: center;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    
    .auth-modal-button {
      width: 100%;
      padding: 14px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .auth-modal-button:hover {
      background: #1976D2;
    }
    
    .auth-modal-button.success {
      background: #4caf50;
    }
    
    .auth-modal-button.success:hover {
      background: #45a049;
    }
    
    .auth-modal-loading-spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top: 4px solid #2196F3;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      margin: 0 auto 20px;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Show loading modal
 */
export function showLoadingModal(message = 'Обработка...') {
  initModalStyles();
  
  const overlay = document.createElement('div');
  overlay.className = 'auth-modal-overlay';
  overlay.id = 'auth-modal-overlay';
  
  overlay.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-loading-spinner"></div>
      <div class="auth-modal-title">${message}</div>
      <div class="auth-modal-message">Пожалуйста, подождите...</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Show success modal
 */
export function showSuccessModal(title, message, buttonText = 'OK', onClose = null) {
  initModalStyles();
  closeModal(); // Close any existing modal
  
  const overlay = document.createElement('div');
  overlay.className = 'auth-modal-overlay';
  overlay.id = 'auth-modal-overlay';
  
  overlay.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-icon success">✓</div>
      <div class="auth-modal-title">${title}</div>
      <div class="auth-modal-message">${message}</div>
      <button class="auth-modal-button success">${buttonText}</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const button = overlay.querySelector('.auth-modal-button');
  const handleClose = () => {
    closeModal();
    if (onClose) onClose();
  };
  
  button.addEventListener('click', handleClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  
  return overlay;
}

/**
 * Show error modal
 */
export function showErrorModal(title, message, buttonText = 'OK', onClose = null) {
  initModalStyles();
  closeModal(); // Close any existing modal
  
  const overlay = document.createElement('div');
  overlay.className = 'auth-modal-overlay';
  overlay.id = 'auth-modal-overlay';
  
  overlay.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-icon error">✕</div>
      <div class="auth-modal-title">${title}</div>
      <div class="auth-modal-message">${message}</div>
      <button class="auth-modal-button">${buttonText}</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const button = overlay.querySelector('.auth-modal-button');
  const handleClose = () => {
    closeModal();
    if (onClose) onClose();
  };
  
  button.addEventListener('click', handleClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose();
  });
  
  return overlay;
}

/**
 * Close modal
 */
export function closeModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show auto-closing success toast
 */
export function showSuccessToast(message, duration = 3000) {
  showSuccessModal('Успешно!', message, 'OK');
  setTimeout(() => {
    closeModal();
  }, duration);
}



