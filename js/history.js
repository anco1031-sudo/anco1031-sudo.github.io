/* =========================================================
   PromptForge — history.js
   LocalStorage-backed history & favorites with restore,
   delete, and star/unstar. Single shared API.
   PF-L6: Added search, filter, and restore-as-draft support.
   ========================================================= */
(function (global) {
  "use strict";

  const KEYS = {
    history: "promptforge.history.v1",
    favorites: "promptforge.favorites.v1"
  };

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("PromptForge: failed to read", key, e);
      return [];
    }
  }

  function write(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn("PromptForge: failed to write", key, e);
      return false;
    }
  }

  /* ---------- History ---------- */
  function getHistory() { return read(KEYS.history); }

  function addToHistory(entry) {
    // entry: { id, prompt, negative, state, timestamp }
    if (!entry || !entry.prompt) return;
    const list = getHistory();
    // De-dupe: if identical prompt already exists in last 5, skip
    const recent = list.slice(0, 5);
    if (recent.some(function (e) { return e.prompt === entry.prompt; })) return;
    list.unshift(entry);
    // Cap to 50
    if (list.length > 50) list.length = 50;
    write(KEYS.history, list);
  }

  function removeFromHistory(id) {
    const list = getHistory().filter(function (e) { return e.id !== id; });
    write(KEYS.history, list);
  }

  function clearHistory() { write(KEYS.history, []); }

  /* ---------- Favorites ---------- */
  function getFavorites() { return read(KEYS.favorites); }

  function addToFavorites(entry) {
    if (!entry || !entry.prompt) return;
    const list = getFavorites();
    if (list.some(function (e) { return e.id === entry.id; })) return;
    list.unshift(entry);
    if (list.length > 200) list.length = 200;
    write(KEYS.favorites, list);
  }

  function removeFromFavorites(id) {
    const list = getFavorites().filter(function (e) { return e.id !== id; });
    write(KEYS.favorites, list);
  }

  function isFavorite(id) {
    return getFavorites().some(function (e) { return e.id === id; });
  }

  function clearFavorites() { write(KEYS.favorites, []); }

  /* ---------- PF-L6: Search & Filter ---------- */
  function searchHistory(query, modeFilter, presetFilter) {
    const list = getHistory();
    if (!query && !modeFilter && !presetFilter) return list;
    
    const q = (query || "").toLowerCase().trim();
    return list.filter(function (e) {
      if (q) {
        const haystack = [
          e.prompt,
          e.negative,
          e.state && e.state.aiPreset,
          e.state && e.state.projectTypePreset,
          e.state && e.state.projectTypeCategory,
          e.state && e.state.projectTypeCustom,
          e.state && e.state.artStyle,
          e.state && e.state.artStyleCustom
        ].filter(Boolean).join(" ").toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      if (modeFilter && e.state && e.state.outputMode !== modeFilter) return false;
      if (presetFilter && e.state && e.state.aiPreset !== presetFilter) return false;
      return true;
    });
  }

  /* ---------- PF-L6: Get unique presets from history for filter dropdown ---------- */
  function getHistoryPresets() {
    const list = getHistory();
    const presets = new Set();
    list.forEach(function (e) {
      if (e.state && e.state.aiPreset) presets.add(e.state.aiPreset);
    });
    return Array.from(presets).sort();
  }

  /* ---------- Helpers ---------- */
  function makeId() {
    return "pf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    if (d < 7) return d + "d ago";
    const w = Math.floor(d / 7);
    if (w < 5) return w + "w ago";
    return new Date(ts).toLocaleDateString();
  }

  global.PF = global.PF || {};
  global.PF.History = {
    getHistory: getHistory,
    addToHistory: addToHistory,
    removeFromHistory: removeFromHistory,
    clearHistory: clearHistory,
    getFavorites: getFavorites,
    addToFavorites: addToFavorites,
    removeFromFavorites: removeFromFavorites,
    isFavorite: isFavorite,
    clearFavorites: clearFavorites,
    makeId: makeId,
    timeAgo: timeAgo,
    searchHistory: searchHistory,
    getHistoryPresets: getHistoryPresets
  };

})(typeof window !== "undefined" ? window : this);
