/*
 * Shared behaviour for every page: theme, navigation, scroll reveals,
 * copy buttons and the table-of-contents scroll spy.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'mule-aes-theme';
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ */
  /* Theme: 'auto' follows the OS; 'light' / 'dark' are explicit.        */
  /* ------------------------------------------------------------------ */
  const readTheme = () => {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : 'auto';
    } catch {
      return 'auto';
    }
  };

  const effectiveTheme = (pref) => (pref === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : pref);

  const syncThemeUi = (pref) => {
    const effective = effectiveTheme(pref);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      const next = effective === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', `Switch to ${next} appearance`);
      btn.title = `Switch to ${next} appearance`;
    });
    document.querySelectorAll('[data-theme-seg]').forEach((seg) => {
      const buttons = [...seg.querySelectorAll('button[data-value]')];
      buttons.forEach((b, i) => {
        const on = b.dataset.value === pref;
        b.setAttribute('aria-pressed', String(on));
        if (on) seg.style.setProperty('--i', i);
      });
    });
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = effective === 'dark' ? '#000000' : '#ffffff';
  };

  const applyTheme = (pref, animate) => {
    if (animate && !reducedMotion.matches) {
      root.classList.add('theme-fade');
      window.setTimeout(() => root.classList.remove('theme-fade'), 420);
    }
    if (pref === 'auto') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = pref;
    }
    try {
      if (pref === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch {
      /* Storage can be unavailable (private mode, blocked site data). */
    }
    syncThemeUi(pref);
  };

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = effectiveTheme(readTheme()) === 'dark' ? 'light' : 'dark';
      // If the explicit choice now matches the OS, fall back to following it.
      applyTheme(next === (darkQuery.matches ? 'dark' : 'light') ? 'auto' : next, true);
    });
  });

  document.querySelectorAll('[data-theme-seg] button[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.value, true));
  });

  darkQuery.addEventListener('change', () => syncThemeUi(readTheme()));
  syncThemeUi(readTheme());

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const toggle = nav.querySelector('.menu-toggle');
    const setOpen = (open) => {
      nav.dataset.open = String(open);
      toggle?.setAttribute('aria-expanded', String(open));
    };
    toggle?.addEventListener('click', () => setOpen(nav.dataset.open !== 'true'));
    nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.dataset.open === 'true') {
        setOpen(false);
        toggle?.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (nav.dataset.open === 'true' && !nav.contains(e.target)) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Reveal on scroll                                                    */
  /* ------------------------------------------------------------------ */
  const revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------ */
  /* Copy to clipboard                                                   */
  /* ------------------------------------------------------------------ */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  };

  const flashCopied = (btn) => {
    const label = btn.querySelector('.label');
    const original = label?.textContent;
    btn.classList.add('is-copied');
    if (label) label.textContent = 'Copied';
    window.clearTimeout(btn._copyTimer);
    btn._copyTimer = window.setTimeout(() => {
      btn.classList.remove('is-copied');
      if (label && original) label.textContent = original;
    }, 1600);
  };

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    let text = btn.dataset.copy;
    if (!text) {
      const target = btn.dataset.copyTarget
        ? document.querySelector(btn.dataset.copyTarget)
        : btn.closest('pre, .cmd')?.querySelector('code');
      text = target ? target.innerText.trim() : '';
    }
    if (!text) return;
    if (await copyText(text)) flashCopied(btn);
  });

  // Expose for page scripts.
  window.MuleSite = { copyText, flashCopied, reducedMotion };

  /* ------------------------------------------------------------------ */
  /* Scroll spy for tables of contents and in-page nav                    */
  /* ------------------------------------------------------------------ */
  const spyLinks = [...document.querySelectorAll('[data-spy] a[href^="#"]')];
  if (spyLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map();
    spyLinks.forEach((a) => {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const target = document.getElementById(id);
      if (!target) return;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(a);
    });
    const visible = new Set();
    const order = [...byId.keys()];
    const update = () => {
      const current = order.find((id) => visible.has(id));
      spyLinks.forEach((a) => a.removeAttribute('aria-current'));
      if (current) byId.get(current).forEach((a) => a.setAttribute('aria-current', 'true'));
    };
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        update();
      },
      { rootMargin: `-${56 + 8}px 0px -62% 0px` }
    );
    byId.forEach((_, id) => spy.observe(document.getElementById(id)));

    // Close the mobile "On this page" menu after choosing an entry.
    document.querySelectorAll('.toc-mobile a').forEach((a) =>
      a.addEventListener('click', () => a.closest('details')?.removeAttribute('open'))
    );
  }

  /* ------------------------------------------------------------------ */
  /* Footer year                                                          */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
