/* =========================================================
   PromptForge-Louis — translate.js
   Thai → English translation module for prompt generation.
   Free client-side only: Dictionary → Cache → MyMemory → gtx fallback.
   Exposes: window.PF.Translate
   ========================================================= */
(function (global) {
  "use strict";

  const TRANSLATE = {
    /* ---------- Constants ---------- */
    CACHE_KEY: "promptforge.translate-cache.v1",
    CACHE_VERSION: 1,
    CACHE_MAX_ENTRIES: 500,
    ENABLED_KEY: "promptforge.translate-enabled.v1",

    /* ---------- Thai detection ---------- */
    hasThai: function (text) {
      if (!text || typeof text !== "string") return false;
      return /[\u0E00-\u0E7F]/.test(text);
    },

    /* ---------- Cache management ---------- */
    _loadCache: function () {
      try {
        const raw = localStorage.getItem(this.CACHE_KEY);
        if (!raw) return { version: this.CACHE_VERSION, order: [], map: {} };
        const parsed = JSON.parse(raw);
        if (parsed.version !== this.CACHE_VERSION) {
          return { version: this.CACHE_VERSION, order: [], map: {} };
        }
        return parsed;
      } catch (e) {
        console.warn("[PF Translate] Cache load failed:", e);
        return { version: this.CACHE_VERSION, order: [], map: {} };
      }
    },

    _saveCache: function (cache) {
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        console.warn("[PF Translate] Cache save failed:", e);
      }
    },

    _cacheGet: function (key) {
      const cache = this._loadCache();
      return cache.map[key] || null;
    },

    _cacheSet: function (key, value) {
      const cache = this._loadCache();
      if (!(key in cache.map)) {
        // New entry — add to order (LRU)
        cache.order.push(key);
        // Evict if over limit
        while (cache.order.length > this.CACHE_MAX_ENTRIES) {
          const oldest = cache.order.shift();
          delete cache.map[oldest];
        }
      } else {
        // Update existing — move to end (most recently used)
        const idx = cache.order.indexOf(key);
        if (idx >= 0) cache.order.splice(idx, 1);
        cache.order.push(key);
      }
      cache.map[key] = value;
      this._saveCache(cache);
    },

    getCacheStats: function () {
      const cache = this._loadCache();
      return {
        entries: cache.order.length,
        maxEntries: this.CACHE_MAX_ENTRIES,
        version: cache.version
      };
    },

    clearCache: function () {
      localStorage.removeItem(this.CACHE_KEY);
    },

    /* ---------- Dictionary lookup (P1) ---------- */
    _dict: null,
    _dictLoaded: false,
    _dictLoadPromise: null,

    _loadDictionary: async function () {
      if (this._dictLoaded) return this._dict;
      if (this._dictLoadPromise) return this._dictLoadPromise;

      this._dictLoadPromise = (async () => {
        try {
          const resp = await fetch("../data/shared/th-en-prompt-dict.json", { cache: "no-cache" });
          if (!resp.ok) throw new Error("Failed to load dictionary");
          this._dict = await resp.json();
          this._dictLoaded = true;
          return this._dict;
        } catch (e) {
          console.warn("[PF Translate] Dictionary load failed:", e);
          this._dict = { version: 1, entries: [] };
          this._dictLoaded = true;
          return this._dict;
        }
      })();

      return this._dictLoadPromise;
    },

    _dictLookup: function (text) {
      if (!this._dict || !this._dict.entries) return null;
      const lower = text.toLowerCase().trim();

      // Exact match first
      for (const entry of this._dict.entries) {
        if (entry.th.toLowerCase() === lower) {
          return entry.en;
        }
      }

      // Includes match (phrase contains dict entry)
      for (const entry of this._dict.entries) {
        if (lower.includes(entry.th.toLowerCase())) {
          return entry.en;
        }
      }

      return null;
    },

    /* ---------- API Calls ---------- */
    _fetchWithTimeout: function (url, timeoutMs = 8000) {
      return Promise.race([
        fetch(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        )
      ]);
    },

    _callMyMemory: async function (text) {
      const url = "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text) + "&langpair=th|en";
      const resp = await this._fetchWithTimeout(url);
      if (!resp.ok) throw new Error("MyMemory HTTP " + resp.status);
      const data = await resp.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText.trim();
      }
      throw new Error("MyMemory: no translatedText in response");
    },

    _callGtx: async function (text) {
      const url = "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx&sl=th&tl=en&dt=t&q=" + encodeURIComponent(text);
      const resp = await this._fetchWithTimeout(url);
      if (!resp.ok) throw new Error("gtx HTTP " + resp.status);
      const data = await resp.json();
      // gtx returns: [[["translated", "original", ...], ...], ...]
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0].trim();
      }
      throw new Error("gtx: unexpected response format");
    },

    /* ---------- Core translation function ---------- */
    translateTHtoEN: async function (text) {
      if (!text || typeof text !== "string") {
        return { text: text || "", fallback: false, fromCache: false, source: "none" };
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return { text: "", fallback: false, fromCache: false, source: "none" };
      }

      // Early return if no Thai characters
      if (!this.hasThai(trimmed)) {
        return { text: trimmed, fallback: false, fromCache: false, source: "none" };
      }

      // 1. Dictionary lookup (P1)
      await this._loadDictionary();
      const dictResult = this._dictLookup(trimmed);
      if (dictResult) {
        return { text: dictResult, fallback: false, fromCache: false, source: "dict" };
      }

      // 2. Cache lookup
      const cached = this._cacheGet(trimmed);
      if (cached) {
        return { text: cached, fallback: false, fromCache: true, source: "cache" };
      }

      // 3. MyMemory API (primary)
      try {
        const translated = await this._callMyMemory(trimmed);
        this._cacheSet(trimmed, translated);
        return { text: translated, fallback: false, fromCache: false, source: "mymemory" };
      } catch (e) {
        console.warn("[PF Translate] MyMemory failed:", e.message);
      }

      // 4. gtx fallback
      try {
        const translated = await this._callGtx(trimmed);
        this._cacheSet(trimmed, translated);
        return { text: translated, fallback: true, fromCache: false, source: "gtx" };
      } catch (e) {
        console.warn("[PF Translate] gtx fallback failed:", e.message);
      }

      // 5. All failed — return original with fallback flag
      return { text: trimmed, fallback: true, fromCache: false, source: "raw" };
    },

    /* ---------- Translate entire state (free-text fields only) ---------- */
    // Fields to translate: subjects[].text, additionalDescription, watermarkText,
    // projectTypeCustom, artStyleCustom, cameraAngleCustom, cameraMovementCustom,
    // lightingCustom, backgroundCustom, moodCustom, typographyCustom,
    // customEffects, watermarkCustomPosition, durationCustom
    translateState: async function (state) {
      if (!state) return { enState: state, notes: [] };

      const notes = [];
      const enState = JSON.parse(JSON.stringify(state)); // Deep clone

      // Helper to translate a single field and record note
      const translateField = async (fieldPath, getValue, setValue, fieldName) => {
        const original = getValue();
        if (!original || !original.trim()) return;

        const result = await this.translateTHtoEN(original);
        if (result.text !== original) {
          setValue(result.text);
          notes.push({
            field: fieldName,
            original: original,
            translated: result.text,
            fallback: result.fallback,
            source: result.source
          });
        }
      };

      // Translate subjects[].text
      if (enState.subjects && Array.isArray(enState.subjects)) {
        for (let i = 0; i < enState.subjects.length; i++) {
          const subj = enState.subjects[i];
          if (subj && subj.text) {
            await translateField(
              `subjects[${i}].text`,
              () => subj.text,
              (v) => { enState.subjects[i].text = v; },
              `subjects[${i}].text`
            );
          }
        }
      }

      // Translate other free-text fields
      const textFields = [
        { key: "additionalDescription", name: "additionalDescription" },
        { key: "watermarkText", name: "watermarkText" },
        { key: "projectTypeCustom", name: "projectTypeCustom" },
        { key: "artStyleCustom", name: "artStyleCustom" },
        { key: "cameraAngleCustom", name: "cameraAngleCustom" },
        { key: "cameraMovementCustom", name: "cameraMovementCustom" },
        { key: "lightingCustom", name: "lightingCustom" },
        { key: "backgroundCustom", name: "backgroundCustom" },
        { key: "moodCustom", name: "moodCustom" },
        { key: "typographyCustom", name: "typographyCustom" },
        { key: "customEffects", name: "customEffects" },
        { key: "watermarkCustomPosition", name: "watermarkCustomPosition" },
        { key: "durationCustom", name: "durationCustom" }
      ];

      for (const f of textFields) {
        await translateField(
          f.key,
          () => enState[f.key],
          (v) => { enState[f.key] = v; },
          f.name
        );
      }

      return { enState, notes };
    },

    /* ---------- Toggle persistence ---------- */
    getEnabled: function () {
      try {
        const val = localStorage.getItem(this.ENABLED_KEY);
        return val !== "false"; // Default true
      } catch (e) {
        return true;
      }
    },

    setEnabled: function (enabled) {
      try {
        localStorage.setItem(this.ENABLED_KEY, enabled ? "true" : "false");
      } catch (e) {
        console.warn("[PF Translate] Failed to persist toggle:", e);
      }
    }
  };

  // Expose globally
  global.PF = global.PF || {};
  global.PF.Translate = TRANSLATE;

})(typeof window !== "undefined" ? window : this);