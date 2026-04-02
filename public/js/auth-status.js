/**
 * Shared authentication status utility
 * Updates nav-bar auth buttons on all pages
 */

import { getCurrentUser, resolveAvatarUrl } from './api.js?v=20260412';
import { initGlobalSearch } from './search.js';

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

// Get nickname from email (email without domain)
function getNickname(name, email) {
  if (name && String(name).trim()) {
    return String(name).trim();
  }

  if (email) {
    return String(email).split('@')[0];
  }

  return '';
}

// Get first letter of username for avatar
function getFirstLetter(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

// Update auth status display in nav-bar
export function updateAuthStatus(user) {
  const authButtons = document.querySelectorAll('.auth-buttons');
  const profileSection = document.querySelector('.profile-section');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileNickname = document.getElementById('profile-nickname');
  
  if (user) {
    // User is logged in - hide auth buttons, show profile
    authButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
    if (profileSection) {
      profileSection.style.display = 'flex';
      
      // Set nickname
      const nickname = getNickname(user.name, user.email);
      if (profileNickname) {
        profileNickname.textContent = nickname;
      }
      
      // Set avatar
      if (profileAvatar) {
        profileAvatar.innerHTML = '';
        if (user.avatar) {
          // Display user avatar if available
          const avatarPath = resolveAvatarUrl(user.avatar);
          profileAvatar.textContent = '';
          profileAvatar.style.backgroundColor = 'transparent';
          profileAvatar.innerHTML = `<img src="${avatarPath}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.onerror=null; this.style.display='none'; this.parentElement.textContent='${getFirstLetter(nickname)}'; this.parentElement.style.backgroundColor='${generateAvatarColor(user.email || user.name)}';">`;
        } else {
          // Fallback to generated avatar
          const firstLetter = getFirstLetter(nickname);
          const bgColor = generateAvatarColor(user.email || user.name);
          profileAvatar.textContent = firstLetter;
          profileAvatar.style.backgroundColor = bgColor;
        }
      }
    }
  } else {
    // User is not logged in - show auth buttons, hide profile
    authButtons.forEach(btn => {
      if (btn) btn.style.display = 'flex';
    });
    if (profileSection) {
      profileSection.style.display = 'none';
    }
  }
}

// Initialize auth status on page load
export async function initAuthStatus() {
  await initGlobalSearch();
  let currentUser = await getCurrentUser();

  if (!currentUser && window.location.hostname === 'music-inspector.vercel.app') {
    try {
      const override = window.localStorage.getItem('MI_API_BASE');
      if (override && !override.includes('music-inspector.onrender.com')) {
        window.localStorage.removeItem('MI_API_BASE');
        currentUser = await getCurrentUser();
      }
    } catch {
      // Ignore storage errors silently
    }
  }

  updateAuthStatus(currentUser);
  return currentUser;
}

