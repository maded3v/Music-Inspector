// Function to validate login form
export function validateLogin(email, password) {
  const errors = [];
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    errors.push('Введите корректный email.');
  }
  if (!password || password.length < 6) {
    errors.push('Пароль должен быть не менее 6 символов.');
  }
  return errors;
}

// Function to validate register form
export function validateRegister(email, password, confirmPassword) {
  const errors = [];
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    errors.push('Введите корректный email.');
  }
  if (!password || password.length < 6) {
    errors.push('Пароль должен быть не менее 6 символов.');
  }
  if (password !== confirmPassword) {
    errors.push('Пароли не совпадают.');
  }
  return errors;
}

// Function to update button text based on input length
export function updateButtonText(form, button) {
  // Always enable button - no validation blocking
  button.disabled = false;
  button.classList.add('filled');
  
  const baseText = button.dataset.baseText || 'Войти';
  button.textContent = baseText;
}

// Function to handle login submission
export async function handleLogin(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  
  // Show loading state
  const submitButton = document.querySelector('#login-form button[type="submit"]');
  const originalText = submitButton ? submitButton.textContent : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Вход...';
  }
  
  try {
    const result = await import('./api.js?v=20260412').then(m => m.login({ email, password }));
    if (result.success) {
      // Show success message briefly
      if (submitButton) {
        submitButton.textContent = '✓ Успешно!';
        submitButton.style.backgroundColor = '#4caf50';
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } else {
      throw new Error('Ошибка входа');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert(error.message || 'Ошибка входа. Проверьте email и пароль.');
    
    // Reset button state
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'Войти';
      submitButton.style.backgroundColor = '';
    }
  }
}

// Function to handle register submission
export async function handleRegister(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const name = formData.get('name') || email.split('@')[0]; // Use email prefix as name if not provided
  
  // Show loading state
  const submitButton = document.querySelector('#register-form button[type="submit"]');
  const originalText = submitButton ? submitButton.textContent : '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Регистрация...';
  }
  
  try {
    const result = await import('./api.js?v=20260412').then(m => m.register({ name, email, password }));
    if (result.success) {
      // Show success message briefly
      if (submitButton) {
        submitButton.textContent = '✓ Успешно!';
        submitButton.style.backgroundColor = '#4caf50';
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } else {
      throw new Error('Ошибка регистрации');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert(error.message || 'Ошибка регистрации. Попробуйте другой email.');
    
    // Reset button state
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'Зарегистрироваться';
      submitButton.style.backgroundColor = '';
    }
  }
}
