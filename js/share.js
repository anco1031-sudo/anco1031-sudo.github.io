/* =========================================================
   PromptForge — share.js
   Copy per-model, Export/Import JSON, Share URL hash
   ========================================================= */
(function (global) {
  "use strict";

  const D = global.PF_DATA;
  const Generator = global.PF.Generator;
  const History = global.PF.History;
  const app = global.PF.app;

  /* ===========================================================
     Copy per-model formats
     =========================================================== */

  function getCurrentState() {
    return app ? app.state : null;
  }

  function getLastResult() {
    return app && app.state ? app.state.lastResult : null;
  }

  function generateForPreset(state, presetValue) {
    // Temporarily override aiPreset to generate for specific format
    const tempState = Object.assign({}, state, { aiPreset: presetValue });
    return Generator.generate(tempState);
  }

  function copyNatural(state) {
    const result = generateForPreset(state, "ChatGPT Images");
    return result.prompt;
  }

  function copyMidjourney(state) {
    const result = generateForPreset(state, "Midjourney");
    return result.prompt;
  }

  function copySDXL(state) {
    const result = generateForPreset(state, "SDXL");
    return result.prompt;
  }

  function copyRunway(state) {
    const result = generateForPreset(state, "Runway Gen-3");
    return result.prompt;
  }

  function copyPika(state) {
    const result = generateForPreset(state, "Pika");
    return result.prompt;
  }

  function copySora(state) {
    const result = generateForPreset(state, "Sora");
    return result.prompt;
  }

  function copyKling(state) {
    const result = generateForPreset(state, "Kling");
    return result.prompt;
  }

  function copyLuma(state) {
    const result = generateForPreset(state, "Luma Dream Machine");
    return result.prompt;
  }

  function copyAll(state, result) {
    if (!result) return "";
    return "=== PROMPT ===\n" + result.prompt + "\n\n=== NEGATIVE PROMPT ===\n" + result.negative + "\n\n=== SETTINGS ===\n" + JSON.stringify(extractSettings(state), null, 2);
  }

  function extractSettings(state) {
    return {
      outputMode: state.outputMode,
      projectTypeCategory: state.projectTypeCategory,
      projectTypePreset: state.projectTypePreset,
      projectTypeCustom: state.projectTypeCustom,
      subjects: state.subjects,
      artStyle: state.artStyle,
      artStyleCustom: state.artStyleCustom,
      cameraAngle: state.cameraAngle,
      cameraAngleCustom: state.cameraAngleCustom,
      cameraMovement: state.cameraMovement,
      cameraMovementCustom: state.cameraMovementCustom,
      lighting: state.lighting,
      lightingCustom: state.lightingCustom,
      colorMode: state.colorMode,
      colors: state.colors,
      background: state.background,
      backgroundCustom: state.backgroundCustom,
      mood: state.mood,
      moodCustom: state.moodCustom,
      typography: state.typography,
      typographyCustom: state.typographyCustom,
      effects: state.effects,
      customEffects: state.customEffects,
      watermarkPosition: state.watermarkPosition,
      watermarkCustomPosition: state.watermarkCustomPosition,
      watermarkText: state.watermarkText,
      aspectRatio: state.aspectRatio,
      customResolution: state.customResolution,
      composition: state.composition,
      renderingQuality: state.renderingQuality,
      promptExpansion: state.promptExpansion,
      aiPreset: state.aiPreset,
      additionalDescription: state.additionalDescription,
      duration: state.duration,
      durationCustom: state.durationCustom,
      fps: state.fps,
      motionStrength: state.motionStrength,
      loop: state.loop,
      transition: state.transition
    };
  }

  /* ===========================================================
     Export / Import JSON
     =========================================================== */

  function buildExportData() {
    const state = getCurrentState();
    if (!state) return null;

    const history = History.getHistory();
    const favorites = History.getFavorites();

    return {
      version: "1.0",
      timestamp: Date.now(),
      state: extractSettings(state),
      lastResult: state.lastResult ? {
        prompt: state.lastResult.prompt,
        negative: state.lastResult.negative,
        meta: state.lastResult.meta,
        id: state.lastResult.id,
        timestamp: state.lastResult.timestamp
      } : null,
      history: history,
      favorites: favorites
    };
  }

  function exportToFile() {
    const data = buildExportData();
    if (!data) {
      toast("No data to export.", "error");
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "promptforge-export-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Exported to JSON file.", "success");
  }

  function importFromFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || !data.state) {
            reject(new Error("Invalid export file format"));
            return;
          }
          applyImportedState(data);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(new Error("Failed to read file")); };
      reader.readAsText(file);
    });
  }

  function applyImportedState(data) {
    const state = getCurrentState();
    if (!state) return;

    // Restore state fields
    const imported = data.state;
    Object.keys(imported).forEach(function (key) {
      if (key !== "lastResult" && key !== "subjectImages" && key !== "backgroundImages") {
        state[key] = imported[key];
      }
    });

    // Handle arrays that need cloning
    if (imported.subjects) state.subjects = imported.subjects.slice();
    if (imported.colors) state.colors = imported.colors.slice();
    if (imported.effects) state.effects = imported.effects.slice();
    if (imported.subjectImages) state.subjectImages = imported.subjectImages.slice();
    if (imported.backgroundImages) state.backgroundImages = imported.backgroundImages.slice();

    // Restore history & favorites if present
    if (data.history) {
      localStorage.setItem("promptforge.history.v1", JSON.stringify(data.history));
    }
    if (data.favorites) {
      localStorage.setItem("promptforge.favorites.v1", JSON.stringify(data.favorites));
    }

    // Restore lastResult if present
    if (data.lastResult) {
      state.lastResult = data.lastResult;
    }

    // Re-sync UI
    if (app && app.state) {
      // We need to call the internal syncUIFromState - but it's not exposed
      // Instead, we'll trigger a page reload or manually sync
      syncUIFromImportedState(state);
    }

    renderHistory();
    renderFavorites();

    if (state.lastResult) {
      renderOutput(state.lastResult);
    }

    toast("Imported successfully.", "success");
  }

  // We need access to internal functions - they'll be wired from app.js
  let syncUIFromImportedState = function () {};
  let renderOutput = function () {};
  let renderHistory = function () {};
  let renderFavorites = function () {};
  let toast = function () {};

  function wireInternalFunctions(fns) {
    syncUIFromImportedState = fns.syncUIFromState;
    renderOutput = fns.renderOutput;
    renderHistory = fns.renderHistory;
    renderFavorites = fns.renderFavorites;
    toast = fns.toast;
  }

  /* ===========================================================
     Share URL Hash
     =========================================================== */

  function encodeStateToHash(state) {
    const settings = extractSettings(state);
    // Remove empty/null values to keep URL shorter
    const cleaned = {};
    Object.keys(settings).forEach(function (k) {
      const v = settings[k];
      if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        cleaned[k] = v;
      }
    });
    const json = JSON.stringify(cleaned);
    // Compress: base64url encode
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeStateFromHash(hash) {
    try {
      // Remove #s= prefix
      const match = hash.match(/[#&]s=([^&]+)/);
      if (!match) return null;
      const base64url = match[1];
      // Convert base64url to base64
      let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
      // Add padding if needed
      while (base64.length % 4) base64 += "=";
      const json = decodeURIComponent(escape(atob(base64)));
      return JSON.parse(json);
    } catch (e) {
      console.warn("PromptForge: failed to decode share hash", e);
      return null;
    }
  }

  function applySharedState(sharedState) {
    const state = getCurrentState();
    if (!state || !sharedState) return false;

    Object.keys(sharedState).forEach(function (key) {
      if (key !== "lastResult" && key !== "subjectImages" && key !== "backgroundImages") {
        state[key] = sharedState[key];
      }
    });

    // Handle arrays
    if (sharedState.subjects) state.subjects = sharedState.subjects.slice();
    if (sharedState.colors) state.colors = sharedState.colors.slice();
    if (sharedState.effects) state.effects = sharedState.effects.slice();
    if (sharedState.subjectImages) state.subjectImages = sharedState.subjectImages.slice();
    if (sharedState.backgroundImages) state.backgroundImages = sharedState.backgroundImages.slice();

    // Sync UI
    syncUIFromImportedState(state);

    // Generate and show output
    const result = Generator.generate(state);
    if (result) {
      state.lastResult = result;
      renderOutput(result);
    }

    return true;
  }

  function getShareUrl() {
    const state = getCurrentState();
    if (!state) return null;
    const encoded = encodeStateToHash(state);
    const baseUrl = window.location.origin + window.location.pathname;
    return baseUrl + "#s=" + encoded;
  }

  function copyShareLink() {
    const url = getShareUrl();
    if (!url) {
      toast("Nothing to share yet.", "error");
      return Promise.resolve(false);
    }
    return copyToClipboard(url).then(function (ok) {
      if (ok) toast("Share link copied.", "success");
      else toast("Copy failed.", "error");
      return ok;
    });
  }

  function initShareFromHash() {
    const hash = window.location.hash;
    if (hash.includes("s=")) {
      const sharedState = decodeStateFromHash(hash);
      if (sharedState) {
        applySharedState(sharedState);
        toast("Loaded from shared link.", "success");
      }
    }
  }

  /* ===========================================================
     Copy to clipboard (re-export from app.js)
     =========================================================== */
  function copyToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ===========================================================
     Public API
     ========================================================= */
  global.PF = global.PF || {};
  global.PF.Share = {
    // Copy per-model
    copyNatural: function () { return copyToClipboard(copyNatural(getCurrentState())); },
    copyMidjourney: function () { return copyToClipboard(copyMidjourney(getCurrentState())); },
    copySDXL: function () { return copyToClipboard(copySDXL(getCurrentState())); },
    copyRunway: function () { return copyToClipboard(copyRunway(getCurrentState())); },
    copyPika: function () { return copyToClipboard(copyPika(getCurrentState())); },
    copySora: function () { return copyToClipboard(copySora(getCurrentState())); },
    copyKling: function () { return copyToClipboard(copyKling(getCurrentState())); },
    copyLuma: function () { return copyToClipboard(copyLuma(getCurrentState())); },
    copyAll: function () { return copyToClipboard(copyAll(getCurrentState(), getLastResult())); },

    // Export/Import
    exportToFile: exportToFile,
    importFromFile: importFromFile,

    // Share URL
    getShareUrl: getShareUrl,
    copyShareLink: copyShareLink,
    initShareFromHash: initShareFromHash,

    // Internal wiring
    wireInternalFunctions: wireInternalFunctions
  };

})(typeof window !== "undefined" ? window : this);