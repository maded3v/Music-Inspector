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
  const confirmPassword = form.querySelector('input[name="confirmPassword"]')?.value;

  let progress = 0;
  if (email) progress += 45;
  if (password) progress += 45;
  if (confirmPassword && password === confirmPassword) progress += 10;

  button.textContent = `Войти (${progress}/90)`;
  if (progress === 90) {
    button.disabled = false;
    button.style.background = '#007bff';
  } else {
    button.disabled = true;
    button.style.background = '#666';
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
