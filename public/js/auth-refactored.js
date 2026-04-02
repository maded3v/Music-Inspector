/**
 * Refactored Authentication System
 * Handles registration, login, logout with proper modal feedback
 * Ensures automatic login after registration
 * Maintains auth state across all pages
 */

import { login as apiLogin, register as apiRegister, getCurrentUser, logout as apiLogout } from './api.js?v=20260412';
import { showLoadingModal, showSuccessModal, showErrorModal, closeModal } from './modal.js';
import { initAuthStatus, updateAuthStatus } from './auth-status.js?v=20260412';

/**
 * Handle user registration with automatic login
 */
export async function handleRegister(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirm-password');
  const name = formData.get('name') || email.split('@')[0];
  
  // Client-side validation
  if (!email || !password) {
    showErrorModal(
      'Ошибка регистрации',
      'Пожалуйста, заполните все обязательные поля.'
    );
    return;
  }
  
  if (password.length < 6) {
    showErrorModal(
      'Ошибка регистрации',
      'Пароль должен содержать минимум 6 символов.'
    );
    return;
  }
  
  if (confirmPassword && password !== confirmPassword) {
    showErrorModal(
      'Ошибка регистрации',
      'Пароли не совпадают.'
    );
    return;
  }
  
  // Show loading modal
  showLoadingModal('Регистрация...');
  
  try {
    // Register user
    const result = await apiRegister({ name, email, password });
    
    if (result.success) {
      // Close loading modal
      closeModal();
      
      // Show success modal
      showSuccessModal(
        'Регистрация успешна!',
        `Добро пожаловать, ${result.user.name || name}! Сейчас вы будете автоматически авторизованы.`,
        'Продолжить',
        () => {
          // User is already logged in (cookie set by backend)
          // Update auth status and redirect
          window.location.href = 'index.html';
        }
      );
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        closeModal();
        window.location.href = 'index.html';
      }, 2000);
    } else {
      closeModal();
      showErrorModal(
        'Ошибка регистрации',
        'Не удалось создать аккаунт. Попробуйте другой email.'
      );
    }
  } catch (error) {
    console.error('Registration error:', error);
    closeModal();
    
    let errorMessage = 'Произошла ошибка при регистрации.';
    
    if (error.message) {
      if (error.message.includes('already exists') || error.message.includes('существует')) {
        errorMessage = 'Пользователь с таким email уже существует.';
      } else if (error.message.includes('email')) {
        errorMessage = 'Неверный формат email адреса.';
      } else {
        errorMessage = error.message;
      }
    }
    
    showErrorModal('Ошибка регистрации', errorMessage);
  }
}

/**
 * Handle user login
 */
export async function handleLogin(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  
  // Client-side validation
  if (!email || !password) {
    showErrorModal(
      'Ошибка входа',
      'Пожалуйста, введите email и пароль.'
    );
    return;
  }
  
  // Show loading modal
  showLoadingModal('Вход в систему...');
  
  try {
    const result = await apiLogin({ email, password });
    
    if (result.success) {
      // Close loading modal
      closeModal();
      
      // Show success modal
      showSuccessModal(
        'Вход выполнен!',
        `Добро пожаловать, ${result.user.name || 'пользователь'}!`,
        'Продолжить',
        () => {
          window.location.href = 'index.html';
        }
      );
      
      // Auto-redirect after 1.5 seconds
      setTimeout(() => {
        closeModal();
        window.location.href = 'index.html';
      }, 1500);
    } else {
      closeModal();
      showErrorModal(
        'Ошибка входа',
        'Неверный email или пароль.'
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    closeModal();
    
    let errorMessage = 'Неверный email или пароль.';
    
    if (error.message) {
      if (error.message.includes('credentials') || error.message.includes('Invalid')) {
        errorMessage = 'Неверный email или пароль.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Ошибка подключения к серверу. Проверьте интернет соединение.';
      } else {
        errorMessage = error.message;
      }
    }
    
    showErrorModal('Ошибка входа', errorMessage);
  }
}

/**
 * Handle user logout
 */
export async function handleLogout() {
  showLoadingModal('Выход из системы...');
  
  try {
    await apiLogout();
    
    closeModal();
    
    showSuccessModal(
      'Выход выполнен',
      'Вы успешно вышли из системы.',
      'OK',
      () => {
        window.location.href = 'index.html';
      }
    );
    
    // Auto-redirect after 1 second
    setTimeout(() => {
      closeModal();
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    console.error('Logout error:', error);
    closeModal();
    // Even if logout fails, redirect to homepage
    window.location.href = 'index.html';
  }
}

/**
 * Check if user is authenticated (for protected pages)
 */
export async function requireAuth(redirectUrl = 'login.html') {
  const user = await getCurrentUser();
  
  if (!user) {
    showErrorModal(
      'Требуется авторизация',
      'Для доступа к этой странице необходимо войти в систему.',
      'Войти',
      () => {
        window.location.href = redirectUrl;
      }
    );
    return false;
  }
  
  return true;
}

/**
 * Initialize authentication on page load
 * Updates UI to show username and avatar
 */
export async function initAuth() {
  const user = await initAuthStatus();
  return user;
}

// Legacy function names for backward compatibility
export function updateButtonText(form, button) {
  // This function is no longer needed with modal system
  // but kept for backward compatibility
}



