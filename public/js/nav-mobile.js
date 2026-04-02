(function () {
  const BREAKPOINT = 900;
  const ANALYTICS_SCRIPT_ID = 'mi-vercel-insights';

  function shouldInjectAnalytics() {
    const host = String(window.location.hostname || '').toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      window.location.protocol === 'file:'
    ) {
      return false;
    }

    return true;
  }

  function injectVercelAnalytics() {
    if (!shouldInjectAnalytics()) {
      return;
    }

    if (document.getElementById(ANALYTICS_SCRIPT_ID)) {
      return;
    }

    window.va = window.va || function () {
      (window.vaq = window.vaq || []).push(arguments);
    };

    const analyticsScript = document.createElement('script');
    analyticsScript.id = ANALYTICS_SCRIPT_ID;
    analyticsScript.defer = true;
    analyticsScript.src = '/_vercel/insights/script.js';
    document.head.appendChild(analyticsScript);
  }

  function setupMobileNav(nav) {
    if (!nav || nav.dataset.mobileNavReady === '1') {
      return;
    }

    const originalChildren = Array.from(nav.children);
    if (originalChildren.length <= 1) {
      return;
    }

    const logoNode = originalChildren[0];

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Открыть меню');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';

    const panel = document.createElement('div');
    panel.className = 'nav-mobile-panel';

    nav.insertBefore(toggle, logoNode.nextSibling);
    originalChildren.slice(1).forEach((node) => {
      panel.appendChild(node);
    });
    nav.appendChild(panel);

    const closeMenu = () => {
      nav.classList.remove('mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (event) => {
      if (window.innerWidth > BREAKPOINT) {
        return;
      }
      if (nav.classList.contains('mobile-open') && !nav.contains(event.target)) {
        closeMenu();
      }
    });

    panel.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link && window.innerWidth <= BREAKPOINT) {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > BREAKPOINT) {
        closeMenu();
      }
    }, { passive: true });

    nav.classList.add('nav-mobile-ready');
    nav.dataset.mobileNavReady = '1';
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectVercelAnalytics();
    document.querySelectorAll('.nav-bar').forEach(setupMobileNav);
  });
})();
