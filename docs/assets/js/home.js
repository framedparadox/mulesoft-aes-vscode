/*
 * Home page interactions: the hero editor sequence, the scroll-lit privacy
 * statement, the live AES demo, the Secure Properties explorer, the
 * whole-file panel demo and the KeyIdentifier reorder demo.
 */
(() => {
  'use strict';

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedQuery.matches;
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /** Morph `from` into `to`, settling characters left to right (a "decrypting" shimmer). */
  const scramble = (el, from, to, duration, isAlive = () => true) =>
    new Promise((resolve) => {
      if (reduced()) {
        el.textContent = to;
        resolve();
        return;
      }
      const start = performance.now();
      const frame = (now) => {
        if (!isAlive()) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const length = Math.round(from.length + (to.length - from.length) * eased);
        const settled = Math.floor(to.length * eased);
        let out = to.slice(0, Math.min(settled, length));
        for (let i = out.length; i < length; i++) out += B64[(Math.random() * 64) | 0];
        el.textContent = out;
        if (t < 1) requestAnimationFrame(frame);
        else {
          el.textContent = to;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });

  /* ================================================================== */
  /* 1. Hero: select → right-click → pick a KeyIdentifier → sealed       */
  /* ================================================================== */
  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const win = hero.querySelector('.vs-window');
    const editor = hero.querySelector('.vs-editor');
    const value = hero.querySelector('[data-hero-value]');
    const line = value.closest('.l');
    const menu = hero.querySelector('[data-hero-menu]');
    const menuItem = hero.querySelector('[data-hero-item]');
    const quickPick = hero.querySelector('[data-hero-qp]');
    const position = hero.querySelector('[data-hero-pos]');
    const replay = hero.querySelector('[data-hero-replay]');
    const PLAIN = value.dataset.plain;
    const CIPHER = value.dataset.cipher;
    let run = 0;

    const placeMenu = () => {
      const e = editor.getBoundingClientRect();
      const v = value.getBoundingClientRect();
      const w = menu.offsetWidth;
      const h = menu.offsetHeight;
      const left = Math.max(8, Math.min(v.left - e.left + Math.min(v.width * 0.6, 96), e.width - w - 8));
      // Like VS Code, shift the menu up when it would run off the bottom.
      const top = Math.max(8, Math.min(v.bottom - e.top + 2, e.height - h - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };

    const reset = () => {
      value.textContent = PLAIN;
      value.classList.remove('is-selected', 'is-sealed');
      line.classList.remove('is-current');
      menu.classList.remove('is-open');
      menuItem.classList.remove('is-hover');
      quickPick.classList.remove('is-open');
      replay.classList.remove('is-visible');
      position.textContent = 'Ln 10, Col 14';
    };

    const play = async () => {
      const id = ++run;
      const alive = () => id === run;
      const step = async (ms) => {
        await sleep(ms);
        return alive();
      };

      reset();
      if (!(await step(450))) return;
      line.classList.add('is-current');
      value.classList.add('is-selected');
      position.textContent = 'Ln 10, Col 32 (18 selected)';

      if (!(await step(850))) return;
      placeMenu();
      menu.classList.add('is-open');

      if (!(await step(750))) return;
      menuItem.classList.add('is-hover');

      if (!(await step(700))) return;
      menu.classList.remove('is-open');

      if (!(await step(180))) return;
      menuItem.classList.remove('is-hover');
      quickPick.classList.add('is-open');

      if (!(await step(1400))) return;
      quickPick.classList.remove('is-open');

      if (!(await step(200))) return;
      value.classList.remove('is-selected');
      await scramble(value, PLAIN, CIPHER, 950, alive);
      if (!alive()) return;
      value.classList.add('is-sealed');
      position.textContent = 'Ln 10, Col 62';
      replay.classList.add('is-visible');
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            io.disconnect();
            play();
          }
        },
        { threshold: 0.35 }
      );
      io.observe(win);
    } else {
      play();
    }

    replay.querySelector('button').addEventListener('click', play);
    window.addEventListener('resize', () => {
      if (menu.classList.contains('is-open')) placeMenu();
    });
  }

  /* ================================================================== */
  /* 2. Scroll-lit statement                                            */
  /* ================================================================== */
  document.querySelectorAll('[data-lit]').forEach((el) => {
    const words = [];
    const split = (node, highlight) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            const span = document.createElement('span');
            span.className = highlight ? 'w hl' : 'w';
            span.textContent = part;
            words.push(span);
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          split(child, highlight || child.classList.contains('hl'));
          if (child.classList.contains('hl')) child.classList.remove('hl');
        }
      });
    };
    split(el, false);

    if (reduced()) {
      el.classList.add('is-static');
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (vh * 0.82 - rect.top) / (rect.height + vh * 0.3)));
      const lit = Math.round(progress * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  });

  /* ================================================================== */
  /* 3. Live demo — the extension's AES routine on the Web Crypto API    */
  /* ================================================================== */
  const demo = document.querySelector('[data-demo]');
  if (demo) {
    const te = new TextEncoder();
    const td = new TextDecoder();
    const SAMPLE_KEY = 'DEV-7fQ2xK9mLp4Rv8Ns3Wb6Tz1Hc5Yj';
    const SAMPLE_TEXT = 'myDatabasePassword';

    const seg = demo.querySelector('[data-demo-mode]');
    const modeButtons = [...seg.querySelectorAll('button')];
    const keyInput = demo.querySelector('#demo-key');
    const eyeBtn = demo.querySelector('[data-demo-eye]');
    const sampleBtn = demo.querySelector('[data-demo-sample]');
    const algoBadge = demo.querySelector('[data-demo-algo]');
    const countEl = demo.querySelector('[data-demo-count]');
    const hintEl = demo.querySelector('[data-demo-hint]');
    const input = demo.querySelector('#demo-input');
    const inputLabel = demo.querySelector('[data-demo-input-label]');
    const output = demo.querySelector('[data-demo-output]');
    const outputText = demo.querySelector('[data-demo-output-text]');
    const copyBtn = demo.querySelector('[data-demo-copy]');
    const swapBtn = demo.querySelector('[data-demo-swap]');
    const outputLabel = demo.querySelector('[data-demo-output-label]');

    let mode = 'encrypt';
    let lastResult = '';
    let seq = 0;

    /* Same rules as src/aes/aesCrypto.ts and src/aes/secureValue.ts. */
    const unwrap = (text) => {
      let v = text.trim();
      const q = v[0];
      if (v.length >= 2 && (q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1).trim();
      if (v.startsWith('![') && v.endsWith(']')) v = v.slice(2, -1);
      return v;
    };

    const toBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    };

    const fromBase64 = (text) => {
      let s = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };

    const cipherKey = async (key, usage) => {
      if (key.length < 16) throw new Error('Key must be at least 16 characters long.');
      const keyBytes = te.encode(key);
      const iv = te.encode(key.substring(0, 16));
      if (iv.length !== 16) {
        throw new Error('Invalid IV: the first 16 characters of the key must be plain ASCII.');
      }
      const raw = keyBytes.slice(0, keyBytes.length === 32 ? 32 : 16);
      const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, [usage]);
      return { cryptoKey, iv };
    };

    const encrypt = async (text, key) => {
      const { cryptoKey, iv } = await cipherKey(key, 'encrypt');
      const ct = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, te.encode(text));
      return `![${toBase64(ct)}]`;
    };

    const decrypt = async (text, key) => {
      const { cryptoKey, iv } = await cipherKey(key, 'decrypt');
      let data;
      try {
        data = fromBase64(unwrap(text));
      } catch {
        throw new Error('That isn’t valid Base64. Paste a ![…] value or raw Base64.');
      }
      if (!data.length || data.length % 16 !== 0) {
        throw new Error('This value isn’t a whole number of AES blocks — it may be truncated.');
      }
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, data);
        return td.decode(pt);
      } catch {
        throw new Error('Decryption failed. Make sure this is the same key that encrypted the value.');
      }
    };

    const describeKey = (key) => {
      if (!key) return { badge: 'No key', tone: 'muted', hint: 'Enter at least 16 characters, or use the sample key.' };
      if (key.length < 16) {
        const n = 16 - key.length;
        return { badge: 'Too short', tone: 'warn', hint: `${n} more character${n === 1 ? '' : 's'} needed. Keys must be at least 16 characters long.` };
      }
      if (te.encode(key.substring(0, 16)).length !== 16) {
        return { badge: 'Invalid IV', tone: 'warn', hint: 'The first 16 characters become the IV, so they must be plain ASCII.' };
      }
      if (te.encode(key).length === 32) {
        return { badge: 'AES-256-CBC', tone: 'ok', hint: 'Exactly 32 characters: full-strength AES-256.' };
      }
      if (key.length === 24) {
        return { badge: 'AES-128-CBC', tone: 'accent', hint: 'A 24-character key still resolves to AES-128 here. The Secure Properties tool supports true AES-192.' };
      }
      if (key.length === 16) {
        return { badge: 'AES-128-CBC', tone: 'accent', hint: 'Use exactly 32 characters to switch to AES-256.' };
      }
      return { badge: 'AES-128-CBC', tone: 'accent', hint: 'Only the first 16 bytes are used. Use exactly 32 characters for AES-256.' };
    };

    const updateMeter = () => {
      const key = keyInput.value;
      const d = describeKey(key);
      algoBadge.textContent = d.badge;
      algoBadge.className = `badge badge--${d.tone}`;
      countEl.textContent = `${key.length} / 32`;
      hintEl.textContent = d.hint;
    };

    const setOutput = (text, state) => {
      output.classList.toggle('is-empty', state === 'empty');
      output.classList.toggle('is-error', state === 'error');
      outputText.textContent = text;
      const ok = state === 'ok';
      lastResult = ok ? text : '';
      copyBtn.disabled = !ok;
      swapBtn.disabled = !ok;
    };

    const placeholder = () =>
      mode === 'encrypt' ? 'Your ![…] token will appear here.' : 'The decrypted text will appear here.';

    const run = async () => {
      const id = ++seq;
      updateMeter();
      const key = keyInput.value;
      const text = input.value;

      if (!window.crypto || !window.crypto.subtle) {
        setOutput('This browser only exposes the Web Crypto API over HTTPS or on localhost.', 'error');
        return;
      }
      if (!text) {
        setOutput(placeholder(), 'empty');
        return;
      }
      if (key.length < 16) {
        setOutput(`Enter a key of at least 16 characters to ${mode}.`, 'empty');
        return;
      }
      try {
        const result = mode === 'encrypt' ? await encrypt(text, key) : await decrypt(text, key);
        if (id === seq) setOutput(result, 'ok');
      } catch (error) {
        if (id === seq) setOutput(error instanceof Error ? error.message : String(error), 'error');
      }
    };

    const setMode = (next) => {
      mode = next;
      modeButtons.forEach((b, i) => {
        const on = b.dataset.mode === next;
        b.setAttribute('aria-pressed', String(on));
        if (on) seg.style.setProperty('--i', i);
      });
      inputLabel.textContent = next === 'encrypt' ? 'Text to encrypt' : 'Value to decrypt';
      input.placeholder = next === 'encrypt' ? 'e.g. myDatabasePassword' : 'Paste a ![…] value or raw Base64';
      outputLabel.textContent = next === 'encrypt' ? 'Encrypted value' : 'Decrypted text';
      run();
    };

    modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    keyInput.addEventListener('input', run);
    input.addEventListener('input', run);

    eyeBtn.addEventListener('click', () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      eyeBtn.setAttribute('aria-pressed', String(show));
      eyeBtn.setAttribute('aria-label', show ? 'Hide key' : 'Show key');
      eyeBtn.title = show ? 'Hide key' : 'Show key';
    });

    sampleBtn.addEventListener('click', () => {
      keyInput.value = SAMPLE_KEY;
      run();
      keyInput.focus();
    });

    swapBtn.addEventListener('click', () => {
      if (!lastResult) return;
      input.value = lastResult;
      setMode(mode === 'encrypt' ? 'decrypt' : 'encrypt');
      input.focus();
    });

    copyBtn.addEventListener('click', async () => {
      if (lastResult && window.MuleSite && (await window.MuleSite.copyText(lastResult))) {
        window.MuleSite.flashCopied(copyBtn);
      }
    });

    keyInput.value = SAMPLE_KEY;
    input.value = SAMPLE_TEXT;
    setMode('encrypt');
  }

  /* ================================================================== */
  /* 4. Secure Properties explorer — adaptive controls, like the tool     */
  /* ================================================================== */
  const explorer = document.querySelector('[data-explorer]');
  if (explorer) {
    const ALGOS = {
      AES: {
        full: 'Advanced Encryption Standard',
        iv: 16,
        key: '16, 24 or 32 characters → AES-128, AES-192 or AES-256',
        cipher: (m) => `aes-{128|192|256}-${m}`,
        runtime: 'always',
        tag: 'Default',
      },
      Blowfish: {
        full: 'Bruce Schneier’s 64-bit block cipher',
        iv: 8,
        key: 'At least 16 characters; up to 56 bytes are used',
        cipher: (m) => `bf-${m}`,
        runtime: 'legacy',
      },
      DES: {
        full: 'Data Encryption Standard',
        iv: 8,
        key: 'At least 16 characters; only the first 8 bytes are used',
        cipher: (m) => `des-${m}`,
        runtime: 'legacy',
        tag: 'Legacy',
      },
      DESede: {
        full: 'Triple DES (3DES)',
        iv: 8,
        key: 'At least 24 characters',
        cipher: (m) => `des-ede3-${m}`,
        runtime: 'always',
      },
      RC2: {
        full: 'Rivest Cipher 2',
        iv: 8,
        key: 'At least 16 characters',
        cipher: (m) => `rc2-${m}`,
        runtime: 'legacy',
        tag: 'Legacy',
      },
      RCA: {
        full: 'RC4 / ARCFOUR stream cipher',
        iv: 0,
        key: 'At least 16 characters',
        cipher: () => 'rc4',
        runtime: 'legacy',
        stream: true,
        tag: 'Legacy',
      },
    };

    const state = { algo: 'AES', mode: 'CBC', random: false };
    const algoPills = [...explorer.querySelectorAll('[data-algo]')];
    const modePills = [...explorer.querySelectorAll('[data-mode]')];
    const ivSwitch = explorer.querySelector('#iv-switch');
    const ivRow = explorer.querySelector('[data-iv-row]');
    const ivNote = explorer.querySelector('[data-iv-note]');
    const modeNote = explorer.querySelector('[data-mode-note]');
    const readout = explorer.querySelector('[data-readout]');
    const out = (name) => explorer.querySelector(`[data-r="${name}"]`);

    const render = (animate) => {
      const a = ALGOS[state.algo];
      const noMode = Boolean(a.stream);
      const noIv = noMode || state.mode === 'ECB';
      const random = state.random && !noIv;

      algoPills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.algo === state.algo)));
      modePills.forEach((p) => {
        p.disabled = noMode;
        p.setAttribute('aria-pressed', String(!noMode && p.dataset.mode === state.mode));
      });
      modeNote.textContent = noMode ? 'Not used by stream ciphers' : '';
      ivSwitch.disabled = noIv;
      ivSwitch.checked = random;
      ivRow.classList.toggle('is-disabled', noIv);
      ivNote.textContent = noIv
        ? noMode
          ? 'Disabled: RC4 takes no IV'
          : 'Disabled: ECB takes no IV'
        : 'Prepends a fresh IV to every value';

      out('name').textContent = state.algo;
      out('full').textContent = a.full;
      const tag = out('tag');
      tag.hidden = !a.tag;
      tag.textContent = a.tag || '';
      tag.className = `badge ${a.tag === 'Legacy' ? 'badge--warn' : 'badge--accent'}`;

      out('cipher').innerHTML = `<code>${noMode ? 'rc4' : a.cipher(state.mode.toLowerCase())}</code>`;
      out('iv').textContent = noMode
        ? 'None: RC4 is a stream cipher'
        : state.mode === 'ECB'
          ? 'None: ECB mode doesn’t use one'
          : random
            ? `${a.iv} random bytes, prepended to the ciphertext`
            : `${a.iv} bytes, taken from the first ${a.iv} key characters`;
      out('key').textContent = a.key;
      out('output').textContent = random ? 'Different on every run' : 'Identical for identical input';
      const rt = out('runtime');
      rt.textContent = a.runtime === 'always' ? 'Always available' : 'May need OpenSSL’s legacy provider';
      rt.className = a.runtime === 'always' ? 'ok' : 'warn';

      out('token').innerHTML = random
        ? '![<span class="dim">base64(</span>IV ‖ ciphertext<span class="dim">)</span>]'
        : '![<span class="dim">base64(</span>ciphertext<span class="dim">)</span>]';

      let hint = '';
      if (state.algo === 'AES' && state.mode === 'CBC' && !random) {
        hint = 'These are the defaults, and they’re byte-for-byte identical to the MuleSoft AES tool.';
      } else if (noMode) {
        hint = 'RC4 has no mode and no IV, so both controls switch off automatically.';
      } else if (state.mode === 'ECB') {
        hint = 'ECB uses no IV, so “Use Random IVs” switches off automatically.';
      } else if (a.tag === 'Legacy') {
        hint = 'Offered for compatibility with existing values. Avoid it for new secrets.';
      } else if (random) {
        hint = 'Random IVs make every token unique, and they still decrypt to the same value.';
      }
      out('hint').textContent = hint;

      if (animate && !reduced()) {
        readout.classList.remove('fade-swap');
        void readout.offsetWidth;
        readout.classList.add('fade-swap');
      }
    };

    algoPills.forEach((p) =>
      p.addEventListener('click', () => {
        state.algo = p.dataset.algo;
        render(true);
      })
    );
    modePills.forEach((p) =>
      p.addEventListener('click', () => {
        state.mode = p.dataset.mode;
        render(true);
      })
    );
    ivSwitch.addEventListener('change', () => {
      state.random = ivSwitch.checked;
      render(true);
    });
    render(false);
  }

  /* ================================================================== */
  /* 5. Whole-file workflow demo                                         */
  /* ================================================================== */
  const filePanel = document.querySelector('[data-filepanel]');
  if (filePanel) {
    const all = filePanel.querySelector('[data-fp-all]');
    const rows = [...filePanel.querySelectorAll('.field-row')];
    const apply = filePanel.querySelector('[data-fp-apply]');
    const count = filePanel.querySelector('[data-fp-count]');
    let done = false;

    const boxes = () => rows.map((r) => r.querySelector('.vs-check')).filter((b) => !b.disabled);

    const update = () => {
      const open = boxes();
      const checked = open.filter((b) => b.checked).length;
      all.checked = open.length > 0 && checked === open.length;
      all.indeterminate = checked > 0 && checked < open.length;
      all.disabled = open.length === 0;
      count.textContent = `${checked} of ${open.length} selected`;
      if (!done) apply.disabled = checked === 0;
    };

    rows.forEach((row) => {
      const box = row.querySelector('.vs-check');
      row.addEventListener('click', (e) => {
        if (e.target === box || box.disabled) return;
        box.checked = !box.checked;
        update();
      });
      box.addEventListener('change', update);
    });

    all.addEventListener('change', () => {
      boxes().forEach((b) => (b.checked = all.checked));
      update();
    });

    apply.addEventListener('click', async () => {
      if (done) {
        rows.forEach((row) => {
          const val = row.querySelector('.fval');
          const box = row.querySelector('.vs-check');
          val.textContent = val.dataset.plain;
          row.classList.remove('is-sealed');
          box.disabled = false;
          box.checked = false;
        });
        done = false;
        apply.textContent = 'Encrypt selected values';
        update();
        return;
      }
      const targets = rows.filter((r) => r.querySelector('.vs-check').checked);
      apply.disabled = true;
      await Promise.all(
        targets.map((row, i) => {
          const val = row.querySelector('.fval');
          const box = row.querySelector('.vs-check');
          box.checked = false;
          box.disabled = true;
          row.classList.add('is-sealed');
          return sleep(i * 70).then(() => scramble(val, val.dataset.plain, val.dataset.cipher, 700));
        })
      );
      done = true;
      apply.textContent = 'Reset demo';
      apply.disabled = false;
      update();
    });

    update();
  }

  /* ================================================================== */
  /* 6. KeyIdentifier list — drag or Move up / Move down, with FLIP      */
  /* ================================================================== */
  const keyList = document.querySelector('[data-keys]');
  if (keyList) {
    const mask = (key) =>
      key.length <= 8 ? '*'.repeat(key.length) : key.slice(0, 5) + '*'.repeat(key.length - 8) + key.slice(-3);

    const flip = (mutate, skip) => {
      const items = [...keyList.children];
      const before = new Map(items.map((el) => [el, el.offsetTop]));
      mutate();
      if (reduced()) return;
      items.forEach((el) => {
        if (el === skip) return;
        const dy = before.get(el) - el.offsetTop;
        if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: EASE });
      });
    };

    const syncButtons = () => {
      const items = [...keyList.children];
      items.forEach((row, i) => {
        row.querySelector('[data-up]').disabled = i === 0;
        row.querySelector('[data-down]').disabled = i === items.length - 1;
      });
    };

    keyList.querySelectorAll('.key-row').forEach((row) => {
      const val = row.querySelector('.kval');
      val.textContent = mask(val.dataset.key);

      row.querySelector('[data-eye]').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const show = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${row.dataset.name} key`);
        val.textContent = show ? val.dataset.key : mask(val.dataset.key);
      });

      const move = (dir, btn) => {
        const sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        flip(() => keyList.insertBefore(dir < 0 ? row : sibling, dir < 0 ? sibling : row));
        syncButtons();
        if (btn.disabled) (dir < 0 ? row.querySelector('[data-down]') : row.querySelector('[data-up]')).focus();
      };
      row.querySelector('[data-up]').addEventListener('click', (e) => move(-1, e.currentTarget));
      row.querySelector('[data-down]').addEventListener('click', (e) => move(1, e.currentTarget));

      // Direct manipulation: the row stays glued to the pointer, respecting the grab offset.
      const grip = row.querySelector('[data-grip]');
      grip.addEventListener('pointerdown', (down) => {
        if (down.button !== 0) return;
        down.preventDefault();
        grip.setPointerCapture(down.pointerId);
        let originY = down.clientY;
        let offset = 0;
        row.classList.add('is-dragging');

        const onMove = (e) => {
          offset = e.clientY - originY;
          const prev = row.previousElementSibling;
          const next = row.nextElementSibling;
          if (next && offset > next.offsetHeight / 2) {
            const top = row.offsetTop;
            flip(() => keyList.insertBefore(next, row), row);
            originY += row.offsetTop - top;
          } else if (prev && offset < -prev.offsetHeight / 2) {
            const top = row.offsetTop;
            flip(() => keyList.insertBefore(row, prev), row);
            originY += row.offsetTop - top;
          }
          offset = e.clientY - originY;
          row.style.transform = `translateY(${offset}px)`;
        };

        const onUp = () => {
          grip.removeEventListener('pointermove', onMove);
          grip.removeEventListener('pointerup', onUp);
          grip.removeEventListener('pointercancel', onUp);
          row.style.transform = '';
          if (!reduced() && offset) {
            row.animate([{ transform: `translateY(${offset}px)` }, { transform: 'none' }], { duration: 380, easing: EASE });
          }
          row.classList.remove('is-dragging');
          syncButtons();
        };

        grip.addEventListener('pointermove', onMove);
        grip.addEventListener('pointerup', onUp);
        grip.addEventListener('pointercancel', onUp);
      });
    });
    syncButtons();
  }
})();
