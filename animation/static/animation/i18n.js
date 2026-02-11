(() => {
  const SUPPORTED_LANGS = ['ru', 'uk', 'en'];
  const DEFAULT_LANG = 'ru';

  const getUserId = () => {
    if (typeof window === 'undefined') return null;
    const id = window.CURRENT_USER_ID;
    if (id === null || id === undefined || id === '') return null;
    return String(id);
  };

  const getStorageKey = () => {
    const userId = getUserId();
    return userId ? `animstudio.lang.user.${userId}` : 'animstudio.lang.guest';
  };

  const normalizeLang = (lang) => {
    if (!lang) return null;
    const value = String(lang).toLowerCase();
    if (value === 'ua') return 'uk';
    if (value.startsWith('uk')) return 'uk';
    if (value.startsWith('ru')) return 'ru';
    if (value.startsWith('en')) return 'en';
    if (SUPPORTED_LANGS.includes(value)) return value;
    return null;
  };

  const detectLang = () => {
    const fromNavigator = normalizeLang(navigator.language || navigator.userLanguage);
    return fromNavigator || DEFAULT_LANG;
  };

  const interpolate = (text, params) => {
    if (!params) return text;
    return String(text).replace(/%\{(\w+)\}/g, (_, key) => {
      const val = params[key];
      return val === undefined || val === null ? '' : String(val);
    });
  };

  const state = {
    lang: DEFAULT_LANG,
    dict: null,
    url: null,
    ready: null,
  };

  const loadDict = async () => {
    if (state.dict) return state.dict;
    const url = state.url || window.I18N_URL || '/static/animation/i18n.json';
    state.url = url;
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Failed to load i18n dictionary: ${response.status}`);
    }
    state.dict = await response.json();
    return state.dict;
  };

  const getLang = () => state.lang;

  const ensureDictLoaded = async () => {
    if (state.dict) return true;
    try {
      await loadDict();
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load i18n dictionary', err);
      return false;
    }
  };

  const emitLanguageChanged = () => {
    window.dispatchEvent(new CustomEvent('i18n:language-changed', {
      detail: { lang: state.lang },
    }));
  };

  const setLang = async (lang) => {
    const normalized = normalizeLang(lang) || DEFAULT_LANG;
    state.lang = normalized;
    try {
      localStorage.setItem(getStorageKey(), normalized);
    } catch (_) {
      // ignore
    }
    document.documentElement.lang = normalized;
    if (await ensureDictLoaded()) {
      applyTranslations(document);
    }
    syncLanguageSelector();
    emitLanguageChanged();
  };

  const initLang = () => {
    let stored = null;
    try {
      stored = normalizeLang(localStorage.getItem(getStorageKey()));
    } catch (_) {
      stored = null;
    }
    state.lang = stored || detectLang();
    document.documentElement.lang = state.lang;
  };

  const t = (key, params) => {
    const dict = state.dict;
    const lang = state.lang;
    const fallbackLang = DEFAULT_LANG;
    const k = String(key);

    const fromLang = dict && dict[lang] && Object.prototype.hasOwnProperty.call(dict[lang], k) ? dict[lang][k] : null;
    const fromFallback = dict && dict[fallbackLang] && Object.prototype.hasOwnProperty.call(dict[fallbackLang], k) ? dict[fallbackLang][k] : null;
    const text = fromLang ?? fromFallback ?? k;
    return interpolate(text, params);
  };

  const parseAttrPairs = (raw) => {
    if (!raw) return [];
    return String(raw)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf(':');
        if (idx === -1) return null;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return null;
        return { attr, key };
      })
      .filter(Boolean);
  };

  const applyTranslations = (root = document) => {
    if (!state.dict) return;

    const nodes = root.querySelectorAll ? root.querySelectorAll('[data-i18n]') : [];
    nodes.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    const attrNodes = root.querySelectorAll ? root.querySelectorAll('[data-i18n-attr]') : [];
    attrNodes.forEach((el) => {
      const pairs = parseAttrPairs(el.getAttribute('data-i18n-attr'));
      pairs.forEach(({ attr, key }) => {
        el.setAttribute(attr, t(key));
      });
    });
  };

  const syncLanguageSelector = () => {
    const select = document.getElementById('language-select');
    if (!select) return;
    if (select.value !== state.lang) {
      select.value = state.lang;
    }
  };

  const attachLanguageSelector = () => {
    const select = document.getElementById('language-select');
    if (!select) return;
    syncLanguageSelector();
    select.addEventListener('change', () => {
      void setLang(select.value);
    });
  };

  const init = async () => {
    initLang();
    attachLanguageSelector();
    if (await ensureDictLoaded()) {
      applyTranslations(document);
    }
    syncLanguageSelector();
    emitLanguageChanged();
  };

  state.ready = init().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('i18n init failed', err);
  });

  window.I18N = {
    ready: state.ready,
    t,
    getLang,
    setLang,
    applyTranslations,
  };
  window.t = t;
})();

