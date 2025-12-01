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
  const email = form.querySelector('input[name="email"]').value;
  const password = form.querySelector('input[name="password"]').value;
  const confirmPassword = form.querySelector('input[name="confirm-password"]')?.value;
  const username = form.querySelector('input[name="username"]')?.value;

  let progress = 0;
  let total = 90;

  if (email) progress += 30;
  if (password) progress += 30;
  if (confirmPassword && password === confirmPassword) progress += 15;
  if (username) progress += 15;

  const baseText = button.dataset.baseText || 'Войти';
  button.textContent = `${baseText} (${progress}/${total})`;

  // Dynamic fill animation
  const fillPercentage = (progress / total) * 100;
  button.style.setProperty('--fill-width', `${fillPercentage}%`);

  if (progress === total) {
    button.disabled = false;
    button.classList.add('filled');
  } else {
    button.disabled = true;
    button.classList.remove('filled');
  }
}

// Function to handle login submission
export async function handleLogin(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const errors = validateLogin(email, password);
  if (errors.length > 0) {
    alert(errors.join('\n'));
    return;
  }
  try {
    const result = await import('./api.js').then(m => m.login({ email, password }));
    if (result.success) {
      alert('Вход выполнен успешно!');
      window.location.href = 'index.html';
    } else {
      alert('Ошибка входа.');
    }
  } catch (error) {
    alert('Ошибка сети.');
  }
}

// Function to handle register submission
export async function handleRegister(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const errors = validateRegister(email, password, confirmPassword);
  if (errors.length > 0) {
    alert(errors.join('\n'));
    return;
  }
  try {
    const result = await import('./api.js').then(m => m.register({ email, password }));
    if (result.success) {
      alert('Регистрация выполнена успешно!');
      window.location.href = 'login.html';
    } else {
      alert('Ошибка регистрации.');
    }
  } catch (error) {
    alert('Ошибка сети.');
  }
}
