/* =========================================================
   PromptForge-Louis — app.js
   Main application wiring. Initializes all UI components,
   reads/writes state, drives the generator + history UI.
   ========================================================= */
(function (global) {
  "use strict";

  const D = global.PF_DATA;
  const { ComboBox, Accordion, Generator, History } = global.PF;

  /* ===========================================================
     i18n System (PF-L4) — TH/EN UI localization
     =========================================================== */
  const i18n = {
    currentLang: "th",
    translations: {},
    loaded: false,

    async init() {
      // Load saved language or default to Thai
      const saved = localStorage.getItem("pf-lang");
      if (saved === "en" || saved === "th") {
        this.currentLang = saved;
      }
      await this.loadTranslations(this.currentLang);
      this.applyTranslations();
      this.updateLangToggleUI();
      this.loaded = true;
    },

    async loadTranslations(lang) {
      try {
        const resp = await fetch(`../data/i18n/${lang}.json`, { cache: "no-cache" });
        if (!resp.ok) throw new Error(`Failed to load ${lang}.json`);
        this.translations = await resp.json();
        this.currentLang = lang;
        localStorage.setItem("pf-lang", lang);
      } catch (err) {
        console.error("[i18n] Load failed:", err);
        // Fallback to English if Thai fails
        if (lang !== "en") {
          await this.loadTranslations("en");
        }
      }
    },

    t(key) {
      const keys = key.split(".");
      let val = this.translations;
      for (const k of keys) {
        if (val && typeof val === "object" && k in val) {
          val = val[k];
        } else {
          return key; // Return key as fallback
        }
      }
      return typeof val === "string" ? val : key;
    },

    applyTranslations() {
      // Elements with data-i18n attribute
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        const translation = this.t(key);
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          if (el.placeholder !== undefined && !el.value) {
            el.placeholder = translation;
          } else if (el.type === "button" || el.type === "submit") {
            el.value = translation;
          } else {
            el.textContent = translation;
          }
        } else {
          el.textContent = translation;
        }
      });

      // Elements with data-i18n-placeholder
      document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        el.placeholder = this.t(key);
      });

      // Elements with data-i18n-title
      document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.dataset.i18nTitle;
        el.title = this.t(key);
      });

      // Update document title
      document.title = this.t("app.title") + " — " + this.t("app.subtitle");

      // Update output panel subtitle based on mode
      const subtitleEl = document.getElementById("outputSubtitle");
      if (subtitleEl) {
        const modeKey = this.currentLang === "th" ? "outputSubtitle.video" : "outputSubtitle.image";
        // Actually we need to check state.outputMode
        const isVideo = global.PF?.app?.state?.outputMode === "video";
        subtitleEl.textContent = this.t(isVideo ? "outputSubtitle.video" : "outputSubtitle.image");
      }

      // Update panel titles/subtitles
      const leftTitle = document.querySelector(".panel--left .panel__title");
      const leftSub = document.querySelector(".panel--left .panel__subtitle");
      const rightTitle = document.querySelector(".panel--right .panel__title");
      const rightSub = document.querySelector(".panel--right .panel__subtitle");
      if (leftTitle) leftTitle.textContent = this.t("panelTitle.left");
      if (leftSub) leftSub.textContent = this.t("panelSubtitle.left");
      if (rightTitle) rightTitle.textContent = this.t("panelTitle.right");
      if (rightSub) rightSub.textContent = this.t("panelSubtitle.right");

      // Update history/favorites titles
      const histTitle = document.querySelector("#history .panel__title");
      const histSub = document.querySelector("#history .panel__subtitle");
      const favTitle = document.querySelector("#favorites .panel__title");
      const favSub = document.querySelector("#favorites .panel__subtitle");
      if (histTitle) histTitle.textContent = this.t("history.title");
      if (histSub) histSub.textContent = this.t("history.subtitle");
      if (favTitle) favTitle.textContent = this.t("favorites.title");
      if (favSub) favSub.textContent = this.t("favorites.subtitle");

      // Update search placeholder
      const histSearch = document.getElementById("historySearch");
      if (histSearch) histSearch.placeholder = this.t("history.searchPlaceholder");

      // Update filter labels
      const filterMode = document.getElementById("historyFilterMode");
      const filterPreset = document.getElementById("historyFilterPreset");
      if (filterMode) {
        const firstOpt = filterMode.querySelector("option");
        if (firstOpt) firstOpt.textContent = this.t("history.filterMode");
      }
      if (filterPreset) {
        const firstOpt = filterPreset.querySelector("option");
        if (firstOpt) firstOpt.textContent = this.t("history.filterPreset");
      }
    },

    toggleLanguage() {
      const newLang = this.currentLang === "th" ? "en" : "th";
      this.loadTranslations(newLang).then(() => {
        this.applyTranslations();
        this.updateLangToggleUI();
      });
    },

    updateLangToggleUI() {
      const btn = document.getElementById("langToggle");
      const text = document.getElementById("langToggleText");
      if (btn && text) {
        text.textContent = this.currentLang === "th" ? "TH" : "EN";
        btn.setAttribute("aria-label", this.currentLang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย");
        btn.title = this.currentLang === "th" ? "Switch to English" : "สลับเป็นภาษาไทย";
      }
      // Update html lang attribute
      document.documentElement.lang = this.currentLang === "th" ? "th" : "en";
    }
  };

  // Expose i18n globally for other modules
  global.PF = global.PF || {};
  global.PF.i18n = i18n;

  /* ===========================================================
     Central app state — ALL fields start empty/null (Issue #1).
     User must select/enter everything manually.
     =========================================================== */
  const state = {
    // Output mode (PF-L2)
    outputMode:          "image",   // "image" | "video"

    projectTypeCategory: null,
    projectTypePreset:   null,
    projectTypeCustom:   "",
    subjects:            [],   // [{id, text, importance}] (Issue #10)
    subjectImages:       [],   // dataURLs
    artStyle:            null,
    artStyleCustom:      "",
    cameraAngle:         null,        // Image mode
    cameraAngleCustom:   "",
    cameraMovement:      null,        // Video mode (V0)
    cameraMovementCustom: "",
    lighting:            null,
    lightingCustom:      "",
    colorMode:           "single", // single | dual | multi (mode is structural, not a content selection)
    colors:              [],   // empty by default
    background:          null,
    backgroundCustom:    "",
    backgroundImages:    [],
    mood:                null,
    moodCustom:          "",
    typography:          null,
    typographyCustom:    "",
    effects:             [],        // multi
    customEffects:       "",        // Issue #6 — comma-separated free text
    watermarkPosition:   null,      // Issue #8
    watermarkCustomPosition: "",
    watermarkText:       "",
    aspectRatio:         null,      // empty by default
    customResolution:    "",        // Issue #11 — e.g. "1920x1080"
    composition:         null,
    renderingQuality:    null,
    promptExpansion:     null,
    aiPreset:            null,
    additionalDescription: "",      // Issue #12
    autoTranslate:       true,        // PF-L7: Auto-translate TH→EN toggle
    // Video-only fields (PF-L2 stubs, wired in PF-L3)
    duration:            null,        // V1
    durationCustom:      "",
    fps:                 null,        // V2
    motionStrength:      null,        // V3
    loop:                null,        // V3
    transition:          null,        // V4
    // last generated
    lastResult:          null
  };

  /* ===========================================================
     PF-L6: Field Lock State — tracks which fields are locked from randomization
     =========================================================== */
  const fieldLocks = {
    projectTypeCategory: false,
    projectTypePreset: false,
    projectTypeCustom: false,
    subjects: false,
    artStyle: false,
    artStyleCustom: false,
    cameraAngle: false,
    cameraAngleCustom: false,
    cameraMovement: false,
    cameraMovementCustom: false,
    lighting: false,
    lightingCustom: false,
    colorMode: false,
    colors: false,
    background: false,
    backgroundCustom: false,
    mood: false,
    moodCustom: false,
    typography: false,
    typographyCustom: false,
    effects: false,
    customEffects: false,
    watermarkPosition: false,
    watermarkCustomPosition: false,
    watermarkText: false,
    aspectRatio: false,
    customResolution: false,
    composition: false,
    renderingQuality: false,
    promptExpansion: false,
    aiPreset: false,
    additionalDescription: false,
    duration: false,
    durationCustom: false,
    fps: false,
    motionStrength: false,
    loop: false,
    transition: false
  };

  /* ComboBox instances registry */
  const combos = {};

  /* ===========================================================
     Toast
     =========================================================== */
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast is-visible" + (kind ? " toast--" + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = "toast" + (kind ? " toast--" + kind : "");
    }, 2400);
  }

  /* ===========================================================
     Helpers
     =========================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

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
     Initialize Accordions
     =========================================================== */
  Accordion.init(document);

  /* ===========================================================
     Output Mode Toggle (PF-L2)
     =========================================================== */
  function initOutputMode() {
    const seg = $("#outputModeSeg");
    if (!seg) return;

    // Read mode from URL hash (#m=image|video)
    function getModeFromHash() {
      const hash = window.location.hash;
      const match = hash.match(/[#&]m=(image|video)/);
      return match ? match[1] : "image";
    }

    function setHashMode(mode) {
      const hash = window.location.hash;
      const newHash = hash.replace(/([#&])m=(image|video)/, "$1m=" + mode);
      if (newHash === hash) {
        // No existing m= param, append
        window.location.hash = hash + (hash ? "&" : "#") + "m=" + mode;
      } else {
        window.location.hash = newHash;
      }
    }

    function applyMode(mode) {
      state.outputMode = mode;

      // Update segmented control UI
      $all(".seg__btn", seg).forEach(function (btn) {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive);
      });

      // Show/hide sections per mode
      toggleSectionsForMode(mode);

      // Rebuild AI preset chips for the mode
      rebuildAiPresetChips(mode);

      // Rebuild aspect ratio grid for the mode
      rebuildAspectRatioGrid(mode);

      // Update rendering quality label
      updateRenderingQualityLabel(mode);

      // Update output panel labels
      updateOutputPanelLabels(mode);

      // PF-L5: Show/hide video copy buttons
      if (videoCopyBlock) {
        videoCopyBlock.style.display = mode === "video" ? "block" : "none";
      }

      // Update URL hash
      setHashMode(mode);
    }

    // Click handlers
    seg.addEventListener("click", function (e) {
      const btn = e.target.closest(".seg__btn");
      if (!btn) return;
      applyMode(btn.dataset.mode);
    });

    // Initialize from hash or default
    const initialMode = getModeFromHash();
    applyMode(initialMode);
  }

  /* ===========================================================
     Show/hide sections based on output mode (per matrix §4.2)
     =========================================================== */
  function toggleSectionsForMode(mode) {
    const isVideo = mode === "video";

    // Section 04 Camera Angle (image-only)
    toggleSection("sectionCameraAngle", !isVideo);
    // Section V0 Camera Movement (video-only)
    toggleSection("sectionCameraMovement", isVideo);
    // Section 09 Typography (collapsed by default in video)
    toggleSectionCollapsed("sectionTypography", isVideo);
    // Section 11 Watermark (collapsed by default in video)
    toggleSectionCollapsed("sectionWatermark", isVideo);
    // Section 12 Aspect Ratio (always shown, but filtered)
    // Sections V1-V4 (video-only)
    toggleSection("sectionDuration", isVideo);
    toggleSection("sectionFPS", isVideo);
    toggleSection("sectionMotionStrength", isVideo);
    toggleSection("sectionTransition", isVideo);
  }

  function toggleSection(sectionId, show) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    if (show) {
      el.hidden = false;
      // Ensure accordion is initialized
      if (!el.classList.contains("accordion-initialized")) {
        Accordion.init(el);
        el.classList.add("accordion-initialized");
      }
    } else {
      el.hidden = true;
      // Close accordion if open
      if (el.classList.contains("is-open")) {
        el.classList.remove("is-open");
      }
    }
  }

  function toggleSectionCollapsed(sectionId, collapsed) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    if (collapsed && el.classList.contains("is-open")) {
      el.classList.remove("is-open");
    }
    // Note: accordion stays visible, just collapsed by default
  }

  /* ===========================================================
     Rebuild AI Preset chips for the current mode
     =========================================================== */
  function rebuildAiPresetChips(mode) {
    const grid = $("#aiPresetGrid");
    if (!grid) return;
    const presets = mode === "video" ? D.AI_PRESETS_VIDEO : D.AI_PRESETS;
    if (!presets) return;

    // Clear grid
    grid.innerHTML = "";

    // If current preset not in new list, clear it
    if (state.aiPreset && !presets.some(function (p) { return p.value === state.aiPreset; })) {
      state.aiPreset = null;
    }

    presets.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.value;
      chip.dataset.value = item.value;
      if (state.aiPreset === item.value) chip.classList.add("is-active");
      chip.addEventListener("click", function () {
        $all(".chip", grid).forEach(function (c) {
          if (c !== chip) c.classList.remove("is-active");
        });
        chip.classList.toggle("is-active");
        if (chip.classList.contains("is-active")) {
          state.aiPreset = item.value;
        } else {
          state.aiPreset = null;
        }
      });
      grid.appendChild(chip);
    });
  }

  /* ===========================================================
     Rebuild Aspect Ratio grid for the current mode
     =========================================================== */
  function rebuildAspectRatioGrid(mode) {
    const grid = $("#ratioGrid");
    if (!grid) return;

    const allRatios = D.ASPECT_RATIOS || [];
    let ratios;
    if (mode === "video") {
      // Video: 16:9, 9:16, 1:1 first, then others
      const priority = ["16:9", "9:16", "1:1"];
      const priorityRatios = priority.map(function (v) {
        return allRatios.find(function (r) { return r.value === v; });
      }).filter(Boolean);
      const otherRatios = allRatios.filter(function (r) { return !priority.includes(r.value); });
      ratios = priorityRatios.concat(otherRatios);
    } else {
      ratios = allRatios;
    }

    // Clear grid
    grid.innerHTML = "";

    // If current aspect ratio not in new list, clear it
    if (state.aspectRatio && !ratios.some(function (r) { return r.value === state.aspectRatio; })) {
      state.aspectRatio = null;
    }

    ratios.forEach(function (r) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ratio";
      btn.dataset.value = r.value;
      if (r.value === state.aspectRatio) btn.classList.add("is-active");

      const maxEdge = 22;
      const long = Math.max(r.w, r.h);
      const w = Math.round((r.w / long) * maxEdge);
      const h = Math.round((r.h / long) * maxEdge);

      btn.innerHTML =
        '<span class="ratio__shape" style="width:' + w + 'px;height:' + h + 'px"></span>' +
        '<span class="ratio__label">' + r.value + '</span>';

      btn.addEventListener("click", function () {
        $all(".ratio", grid).forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        state.aspectRatio = r.value;
      });
      grid.appendChild(btn);
    });
  }

  /* ===========================================================
     Update Rendering Quality label for video mode
     =========================================================== */
  function updateRenderingQualityLabel(mode) {
    const label = $("#renderingQualityLabel");
    if (!label) return;
    label.textContent = mode === "video" ? "Quality + FPS hint" : "Rendering Quality";
  }

  /* ===========================================================
     Update Output Panel labels for the current mode
     =========================================================== */
  function updateOutputPanelLabels(mode) {
    const subtitle = $("#outputSubtitle");
    const promptLabel = $("#promptLabel");
    const negativeLabel = $("#negativeLabel");
    const i18n = global.PF.i18n;
    if (subtitle) subtitle.textContent = mode === "video" ? i18n.t("outputSubtitle.video") : i18n.t("outputSubtitle.image");
    if (promptLabel) promptLabel.textContent = mode === "video" ? i18n.t("labels.videoPrompt") : i18n.t("labels.outputPrompt");
    if (negativeLabel) negativeLabel.textContent = mode === "video" ? i18n.t("labels.videoNegative") : i18n.t("labels.outputNegative");
  }

  /* ===========================================================
     Initialize ComboBoxes
     =========================================================== */
  function initComboboxes() {
    // Project Type — category
    const ptCatEl = $('[data-combobox="projectTypeCategory"]');
    const ptPresetEl = $('[data-combobox="projectTypePreset"]');
    const artStyleEl = $('[data-combobox="artStyle"]');
    const cameraAngleEl = $('[data-combobox="cameraAngle"]');
    const lightingEl = $('[data-combobox="lighting"]');
    const backgroundEl = $('[data-combobox="background"]');
    const moodEl = $('[data-combobox="mood"]');
    const typographyEl = $('[data-combobox="typography"]');
    const cameraMovementEl = $('[data-combobox="cameraMovement"]');
    const durationEl = $('[data-combobox="duration"]');
    const fpsEl = $('[data-combobox="fps"]');
    const transitionEl = $('[data-combobox="transition"]');

    // Category combobox — flat list of category names
    const catNames = Object.keys(D.PROJECT_TYPE);
    combos.projectTypeCategory = ComboBox.create(ptCatEl, {
      mode: "single",
      options: catNames.map(function (c) { return { value: c, phrase: c }; }),
      placeholder: "Select category…",
      onChange: function (val) {
        state.projectTypeCategory = val;
        // Rebuild preset combobox for the new category. If the current
        // preset value isn't in the new category's list, clear it.
        rebuildProjectTypePresets(val);
      }
    });
    // No default selection — Issue #1: every field starts empty.

    // Preset combobox (initial — empty)
    rebuildProjectTypePresets(null);

    // Art Style
    combos.artStyle = ComboBox.create(artStyleEl, {
      mode: "single",
      options: D.ART_STYLE,
      placeholder: "Search art styles…",
      allowCustom: true,
      onChange: function (val) { state.artStyle = val; }
    });

    // Camera Angle
    combos.cameraAngle = ComboBox.create(cameraAngleEl, {
      mode: "single",
      options: D.CAMERA_ANGLE,
      placeholder: "Search camera angles…",
      allowCustom: true,
      onChange: function (val) { state.cameraAngle = val; }
    });

    // Lighting
    combos.lighting = ComboBox.create(lightingEl, {
      mode: "single",
      options: D.LIGHTING,
      placeholder: "Search lighting…",
      allowCustom: true,
      onChange: function (val) { state.lighting = val; }
    });

    // Background
    combos.background = ComboBox.create(backgroundEl, {
      mode: "single",
      options: D.BACKGROUND,
      placeholder: "Search backgrounds…",
      allowCustom: true,
      onChange: function (val) { state.background = val; }
    });

    // Mood
    combos.mood = ComboBox.create(moodEl, {
      mode: "single",
      options: D.MOOD,
      placeholder: "Search moods…",
      allowCustom: true,
      onChange: function (val) { state.mood = val; }
    });

    // Typography
    combos.typography = ComboBox.create(typographyEl, {
      mode: "single",
      options: D.TYPOGRAPHY,
      placeholder: "Search typography styles…",
      allowCustom: true,
      onChange: function (val) { state.typography = val; }
    });

    // Camera Movement (Video mode)
    if (cameraMovementEl) {
      combos.cameraMovement = ComboBox.create(cameraMovementEl, {
        mode: "single",
        options: D.CAMERA_MOVEMENTS || [],
        placeholder: "Search camera movements…",
        allowCustom: true,
        onChange: function (val) { state.cameraMovement = val; }
      });
    }

    // Duration (Video mode)
    if (durationEl) {
      combos.duration = ComboBox.create(durationEl, {
        mode: "single",
        options: (D.DURATIONS || []).map(function (d) { return { value: d.value, phrase: d.phrase }; }),
        placeholder: "Select duration…",
        allowCustom: true,
        onChange: function (val) { state.duration = val; }
      });
    }

    // FPS (Video mode)
    if (fpsEl) {
      combos.fps = ComboBox.create(fpsEl, {
        mode: "single",
        options: (D.FPS_OPTIONS || []).map(function (f) { return { value: f.value, phrase: f.phrase }; }),
        placeholder: "Select FPS…",
        allowCustom: true,
        onChange: function (val) { state.fps = val; }
      });
    }

    // Transition (Video mode)
    if (transitionEl) {
      combos.transition = ComboBox.create(transitionEl, {
        mode: "single",
        options: (D.TRANSITIONS || []).map(function (t) { return { value: t.value, phrase: t.phrase }; }),
        placeholder: "Select transition…",
        allowCustom: true,
        onChange: function (val) { state.transition = val; }
      });
    }
  }

  function rebuildProjectTypePresets(category) {
    const el = $('[data-combobox="projectTypePreset"]');
    if (!el) return;
    el.innerHTML = "";
    const presets = D.PROJECT_TYPE[category] || [];
    // If the currently-held preset value isn't valid for this category, clear it
    if (state.projectTypePreset && !presets.some(function (p) { return p.value === state.projectTypePreset; })) {
      state.projectTypePreset = null;
    }
    combos.projectTypePreset = ComboBox.create(el, {
      mode: "single",
      options: presets.map(function (p) { return { value: p.value, phrase: p.phrase }; }),
      placeholder: "Select preset…",
      allowCustom: true,
      onChange: function (val) { state.projectTypePreset = val; }
    });
  }

  /* ===========================================================
     Custom text inputs
     =========================================================== */
  function bindInputs() {
    const map = {
      "projectType-custom":      "projectTypeCustom",
      "artStyle-custom":         "artStyleCustom",
      "cameraAngle-custom":      "cameraAngleCustom",
      "cameraMovement-custom":   "cameraMovementCustom",
      "lighting-custom":         "lightingCustom",
      "background-custom":       "backgroundCustom",
      "mood-custom":             "moodCustom",
      "typography-custom":       "typographyCustom",
      // Issue #6: Custom Effects (comma-separated)
      "effects-custom":          "customEffects",
      // Issue #8: Watermark
      "watermark-custom-pos":    "watermarkCustomPosition",
      "watermark-text":          "watermarkText",
      // Issue #11: Custom Resolution
      "custom-resolution":       "customResolution",
      // Issue #12: Additional Description
      "additional-desc":         "additionalDescription",
      // Video-only custom inputs (PF-L2)
      "duration-custom":         "durationCustom"
    };
    Object.keys(map).forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () { state[map[id]] = el.value; });
    });
  }

  /* ===========================================================
     Color palette
     =========================================================== */
  function initColorPalette() {
    const modeBar = $("#colorMode");
    const colorRow = $("#colorRow");
    const addBtn = $("#colorAddBtn");
    const preview = $("#palettePreview");

    function maxForMode(m) { return m === "single" ? 1 : m === "dual" ? 2 : 6; }

    function syncAddBtn() {
      const max = maxForMode(state.colorMode);
      addBtn.hidden = !(state.colorMode === "multi") || state.colors.length >= max;
    }

    function renderSlots() {
      const max = maxForMode(state.colorMode);
      // Trim if needed
      if (state.colors.length > max) state.colors.length = max;
      // Issue #1: do NOT auto-add a default color. Empty palette stays empty
      // until the user picks one. We render a single "add color" tile when empty.

      colorRow.innerHTML = "";
      if (state.colors.length === 0) {
        const addTile = document.createElement("button");
        addTile.className = "btn btn--ghost btn--sm color-row__add-tile";
        addTile.type = "button";
        addTile.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
          ' Add color';
        addTile.addEventListener("click", function () {
          state.colors.push("#3B82F6");
          renderSlots();
          renderPreview();
          syncAddBtn();
        });
        colorRow.appendChild(addTile);
        return;
      }
      state.colors.forEach(function (c, i) {
        const slot = document.createElement("div");
        slot.className = "color-slot";
        slot.dataset.slot = i;
        slot.innerHTML =
          '<input type="color" class="color-slot__picker" value="' + c + '" />' +
          '<input type="text" class="color-slot__hex" value="' + c.toUpperCase() + '" maxlength="7" />' +
          ((state.colors.length > 1) ?
            '<button class="color-slot__remove" type="button" aria-label="Remove color"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>'
            : "");

        const picker = slot.querySelector(".color-slot__picker");
        const hex = slot.querySelector(".color-slot__hex");
        const remove = slot.querySelector(".color-slot__remove");

        picker.addEventListener("input", function () {
          state.colors[i] = picker.value;
          hex.value = picker.value.toUpperCase();
          renderPreview();
        });
        hex.addEventListener("input", function () {
          let v = hex.value.trim();
          if (v && !v.startsWith("#")) v = "#" + v;
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            state.colors[i] = v;
            picker.value = v;
            renderPreview();
          }
        });
        hex.addEventListener("blur", function () {
          hex.value = (state.colors[i] || "#3B82F6").toUpperCase();
        });
        if (remove) {
          remove.addEventListener("click", function () {
            state.colors.splice(i, 1);
            renderSlots();
            renderPreview();
            syncAddBtn();
          });
        }
        colorRow.appendChild(slot);
      });
    }

    function renderPreview() {
      preview.innerHTML = "";
      if (!state.colors.length) {
        preview.classList.add("is-empty");
        return;
      }
      preview.classList.remove("is-empty");
      state.colors.forEach(function (c) {
        const seg = document.createElement("div");
        seg.className = "palette-preview__seg";
        seg.style.background = c;
        seg.textContent = c.toUpperCase();
        preview.appendChild(seg);
      });
    }

    modeBar.addEventListener("click", function (e) {
      const btn = e.target.closest(".seg__btn");
      if (!btn) return;
      $all(".seg__btn", modeBar).forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      state.colorMode = btn.dataset.mode;
      renderSlots();
      renderPreview();
      syncAddBtn();
    });

    addBtn.addEventListener("click", function () {
      const max = maxForMode(state.colorMode);
      if (state.colors.length < max) {
        // Pick a different color than the last
        const palette = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
        const next = palette.find(function (p) { return !state.colors.includes(p); }) || "#94A3B8";
        state.colors.push(next);
        renderSlots();
        renderPreview();
        syncAddBtn();
      }
    });

    renderSlots();
    renderPreview();
    syncAddBtn();
  }

  /* ===========================================================
     Effects multi-select chips
     =========================================================== */
  const CHIP_GRID_DATA_KEY = {
    effectsGrid: "EFFECTS",
    compositionGrid: "COMPOSITION",
    renderingGrid: "RENDERING_QUALITY",
    expansionGrid: "PROMPT_EXPANSION",
    aiPresetGrid: "AI_PRESETS"
  };

  function initChipGrid(elId, stateKey, single) {
    const el = document.getElementById(elId);
    if (!el) return null;
    const isSingle = el.dataset.single === "1" || single;
    el.innerHTML = "";
    const list = D[CHIP_GRID_DATA_KEY[elId]];
    if (!list) return null;
    list.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.value;
      chip.dataset.value = item.value;
      chip.addEventListener("click", function () {
        if (isSingle) {
          $all(".chip", el).forEach(function (c) {
            if (c !== chip) c.classList.remove("is-active");
          });
          chip.classList.toggle("is-active");
          if (chip.classList.contains("is-active")) {
            state[stateKey] = item.value;
          } else {
            state[stateKey] = null;
          }
        } else {
          chip.classList.toggle("is-active");
          if (chip.classList.contains("is-active")) {
            if (!state[stateKey].includes(item.value)) state[stateKey].push(item.value);
          } else {
            state[stateKey] = state[stateKey].filter(function (v) { return v !== item.value; });
          }
        }
      });
      el.appendChild(chip);
    });

    // Pre-activate defaults
    function activate(val) {
      if (!val) return;
      const chip = el.querySelector('.chip[data-value="' + val + '"]');
      if (chip) chip.classList.add("is-active");
    }
    return { activate: activate };
  }

  function initEffects() { return initChipGrid("effectsGrid", "effects"); }
  function initComposition() {
    const c = initChipGrid("compositionGrid", "composition");
    if (state.composition) c.activate(state.composition);
  }
  function initRendering() {
    const c = initChipGrid("renderingGrid", "renderingQuality");
    if (state.renderingQuality) c.activate(state.renderingQuality);
  }
  function initExpansion() {
    const c = initChipGrid("expansionGrid", "promptExpansion");
    if (state.promptExpansion) c.activate(state.promptExpansion);
  }
  function initAiPreset() {
    const c = initChipGrid("aiPresetGrid", "aiPreset");
    if (state.aiPreset) c.activate(state.aiPreset);
  }

  /* Video-only chip grids (PF-L2) */
  function initMotionStrength() {
    const el = $("#motionStrengthGrid");
    if (!el) return;
    el.innerHTML = "";
    const list = D.MOTION_STRENGTH || [];
    list.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.value;
      chip.dataset.value = item.value;
      if (state.motionStrength === item.value) chip.classList.add("is-active");
      chip.addEventListener("click", function () {
        $all(".chip", el).forEach(function (c) {
          if (c !== chip) c.classList.remove("is-active");
        });
        chip.classList.toggle("is-active");
        if (chip.classList.contains("is-active")) {
          state.motionStrength = item.value;
        } else {
          state.motionStrength = null;
        }
      });
      el.appendChild(chip);
    });
  }

  function initLoop() {
    const el = $("#loopGrid");
    if (!el) return;
    el.innerHTML = "";
    const list = D.LOOP_OPTIONS || [];
    list.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.value;
      chip.dataset.value = item.value;
      if (state.loop === item.value) chip.classList.add("is-active");
      chip.addEventListener("click", function () {
        $all(".chip", el).forEach(function (c) {
          if (c !== chip) c.classList.remove("is-active");
        });
        chip.classList.toggle("is-active");
        if (chip.classList.contains("is-active")) {
          state.loop = item.value;
        } else {
          state.loop = null;
        }
      });
      el.appendChild(chip);
    });
  }

  /* Issue #8 — Watermark position chip grid (single-select). */
  function initWatermarkPosition() {
    const el = $("#watermarkPosGrid");
    if (!el) return;
    el.innerHTML = "";
    D.WATERMARK_POSITIONS.forEach(function (item) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = item.value;
      chip.dataset.value = item.value;
      if (state.watermarkPosition === item.value) chip.classList.add("is-active");
      chip.addEventListener("click", function () {
        $all(".chip", el).forEach(function (c) {
          if (c !== chip) c.classList.remove("is-active");
        });
        chip.classList.toggle("is-active");
        if (chip.classList.contains("is-active")) {
          state.watermarkPosition = item.value;
        } else {
          state.watermarkPosition = null;
        }
      });
      el.appendChild(chip);
    });
  }

  /* ===========================================================
     Issue #10 — Multiple Subjects
     =========================================================== */
  function makeSubjectId() {
    return "subj_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  }

  function renderSubjects() {
    const list = $("#subjectsList");
    if (!list) return;
    list.innerHTML = "";
    if (state.subjects.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history__empty";
      empty.style.padding = "12px";
      empty.textContent = "No subjects yet. Click \"Add Subject\" to begin.";
      list.appendChild(empty);
      return;
    }
    state.subjects.forEach(function (s, i) {
      const row = document.createElement("div");
      row.className = "subject-row";
      row.dataset.id = s.id;

      const indexEl = document.createElement("div");
      indexEl.className = "subject-row__index";
      indexEl.textContent = String(i + 1);

      const inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.className = "subject-row__input";
      inputEl.placeholder = "e.g. Minecraft Warrior";
      inputEl.value = s.text || "";
      inputEl.addEventListener("input", function () {
        s.text = inputEl.value;
      });

      const impEl = document.createElement("select");
      impEl.className = "subject-row__importance";
      var defaultImp = s.importance || (["Primary", "Secondary", "Tertiary", "Background"][i] || "Background");
      D.SUBJECT_IMPORTANCE.forEach(function (opt) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.value;
        if (defaultImp === opt.value) o.selected = true;
        impEl.appendChild(o);
      });
      impEl.addEventListener("change", function () {
        s.importance = impEl.value;
      });
      s.importance = defaultImp;

      const actions = document.createElement("div");
      actions.className = "subject-row__actions";

      // Lock button for subject (PF-L6)
      const lockBtn = document.createElement("button");
      lockBtn.type = "button";
      lockBtn.className = "subject-row__lock" + (fieldLocks.subjects ? " is-locked" : "");
      lockBtn.setAttribute("aria-label", fieldLocks.subjects ? "Unlock subject from randomization" : "Lock subject from randomization");
      lockBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      lockBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        fieldLocks.subjects = !fieldLocks.subjects;
        lockBtn.classList.toggle("is-locked", fieldLocks.subjects);
        lockBtn.setAttribute("aria-label", fieldLocks.subjects ? "Unlock subject from randomization" : "Lock subject from randomization");
      });

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "subject-row__btn";
      upBtn.setAttribute("aria-label", "Move up");
      upBtn.disabled = (i === 0);
      upBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
      upBtn.addEventListener("click", function () {
        if (i === 0) return;
        const tmp = state.subjects[i - 1];
        state.subjects[i - 1] = state.subjects[i];
        state.subjects[i] = tmp;
        renderSubjects();
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "subject-row__btn";
      downBtn.setAttribute("aria-label", "Move down");
      downBtn.disabled = (i === state.subjects.length - 1);
      downBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      downBtn.addEventListener("click", function () {
        if (i === state.subjects.length - 1) return;
        const tmp = state.subjects[i + 1];
        state.subjects[i + 1] = state.subjects[i];
        state.subjects[i] = tmp;
        renderSubjects();
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "subject-row__btn subject-row__btn--danger";
      delBtn.setAttribute("aria-label", "Remove subject");
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
      delBtn.addEventListener("click", function () {
        state.subjects.splice(i, 1);
        renderSubjects();
      });

      actions.appendChild(lockBtn);
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(delBtn);

      row.appendChild(indexEl);
      row.appendChild(inputEl);
      row.appendChild(impEl);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function initSubjects() {
    const addBtn = $("#addSubjectBtn");
    if (!addBtn) return;
    addBtn.addEventListener("click", function () {
      // Default importance based on position
      var defaults = ["Primary", "Secondary", "Tertiary", "Background"];
      var imp = defaults[state.subjects.length] || "Background";
      state.subjects.push({
        id: makeSubjectId(),
        text: "",
        importance: imp
      });
      renderSubjects();
      // Focus the just-added input
      setTimeout(function () {
        const inputs = $all(".subject-row__input");
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 0);
    });
    renderSubjects();
  }

  /* ===========================================================
     Aspect ratio grid
     =========================================================== */
  function initAspectRatios() {
    const grid = $("#ratioGrid");
    if (!grid) return;
    grid.innerHTML = "";
    D.ASPECT_RATIOS.forEach(function (r) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ratio";
      btn.dataset.value = r.value;
      if (r.value === state.aspectRatio) btn.classList.add("is-active");

      // Compute preview shape (max 24px on long edge)
      const maxEdge = 22;
      const long = Math.max(r.w, r.h);
      const w = Math.round((r.w / long) * maxEdge);
      const h = Math.round((r.h / long) * maxEdge);

      btn.innerHTML =
        '<span class="ratio__shape" style="width:' + w + 'px;height:' + h + 'px"></span>' +
        '<span class="ratio__label">' + r.value + '</span>';

      btn.addEventListener("click", function () {
        $all(".ratio", grid).forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        state.aspectRatio = r.value;
      });
      grid.appendChild(btn);
    });
  }

  /* ===========================================================
     Dropzone (image upload) — reusable
     =========================================================== */
  function initDropzone(rootId, inputId, previewsId, stateKey) {
    const dz = document.getElementById(rootId);
    const input = document.getElementById(inputId);
    const previews = document.getElementById(previewsId);
    if (!dz || !input || !previews) return;

    function handleFiles(files) {
      Array.from(files).forEach(function (file) {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          const url = e.target.result;
          state[stateKey].push(url);
          const wrap = document.createElement("div");
          wrap.className = "preview";
          wrap.innerHTML =
            '<img src="' + url + '" alt="preview" />' +
            '<button class="preview__remove" type="button" aria-label="Remove"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>';
          wrap.querySelector(".preview__remove").addEventListener("click", function () {
            const idx = state[stateKey].indexOf(url);
            if (idx >= 0) state[stateKey].splice(idx, 1);
            wrap.remove();
          });
          previews.appendChild(wrap);
        };
        reader.readAsDataURL(file);
      });
    }

    // Click to browse (handled by input overlay)
    input.addEventListener("change", function () {
      handleFiles(input.files);
      input.value = "";
    });

    // Drag and drop
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove("is-dragover");
      });
    });
    dz.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });

    // Keyboard accessibility on dropzone
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
  }

  /* ===========================================================
     Generate / Clear / Copy / Save
     =========================================================== */
  const promptOutput = $("#promptOutput");
  const negativeOutput = $("#negativeOutput");
  const outputMeta = $("#outputMeta");
  const saveFavBtn = $("#saveFavoriteBtn");
  const saveHistBtn = $("#saveHistoryBtn");

  // PF-L5: New copy buttons
  const copyPromptBtn = $("#copyPromptBtn");
  const copyNegativeBtn = $("#copyNegativeBtn");
  const copyNaturalBtn = $("#copyNaturalBtn");
  const copyMjBtn = $("#copyMjBtn");
  const copySdxlBtn = $("#copySdxlBtn");
  const copyRunwayBtn = $("#copyRunwayBtn");
  const copyPikaBtn = $("#copyPikaBtn");
  const copySoraBtn = $("#copySoraBtn");
  const copyKlingBtn = $("#copyKlingBtn");
  const copyLumaBtn = $("#copyLumaBtn");
  const videoCopyBlock = $("#videoCopyBlock");
  const videoFormatOutput = $("#videoFormatOutput");

  // PF-L5: Export/Import/Share buttons
  const exportBtn = $("#exportBtn");
  const importBtn = $("#importBtn");
  const shareBtn = $("#shareBtn");
  const importFileInput = $("#importFileInput");

  function renderOutput(result, translationNotes) {
    const i18n = global.PF.i18n;
    const translationNotesEl = $("#translationNotes");
    const translationNotesList = $("#translationNotesList");

    if (!result) {
      promptOutput.innerHTML = '<span class="output__placeholder">' + i18n.t("placeholders.additionalDesc") + '</span>';
      negativeOutput.innerHTML = '<span class="output__placeholder">' + i18n.t("placeholders.additionalDesc") + '</span>';
      outputMeta.innerHTML = "";
      saveFavBtn.disabled = true;
      saveHistBtn.disabled = true;
      // Hide video copy block when no result
      if (videoCopyBlock) videoCopyBlock.style.display = "none";
      if (translationNotesEl) translationNotesEl.style.display = "none";
      return;
    }

    promptOutput.textContent = result.prompt;
    negativeOutput.textContent = result.negative;

    outputMeta.innerHTML = "";
    result.meta.forEach(function (m) {
      const pill = document.createElement("span");
      pill.className = "meta-pill";
      pill.innerHTML = "<strong>" + m.label + ":</strong> " + m.value;
      outputMeta.appendChild(pill);
    });

    saveFavBtn.disabled = false;
    saveHistBtn.disabled = false;

    // Render translation notes (PF-L7)
    if (translationNotesEl && translationNotesList) {
      if (translationNotes && translationNotes.length > 0) {
        translationNotesEl.style.display = "block";
        translationNotesList.innerHTML = translationNotes.map(function (note) {
          var fallbackBadge = note.fallback
            ? '<span class="translation-notes__fallback" data-i18n="toast.fallbackNote">' + i18n.t("toast.fallbackNote") + '</span>'
            : '';
          return (
            '<li class="translation-notes__item">' +
              '<span class="translation-notes__field">' + note.field + ':</span>' +
              '<span class="translation-notes__original">' + i18n.t("labels.original") + ': ' + note.original + '</span>' +
              '<span class="translation-notes__translated">' + i18n.t("labels.translated") + ': ' + note.translated + '</span>' +
              fallbackBadge +
            '</li>'
          );
        }).join("");
      } else {
        translationNotesEl.style.display = "none";
      }
    }

    // PF-L5: Show/hide video copy buttons based on output mode
    if (videoCopyBlock) {
      const isVideo = state.outputMode === "video";
      videoCopyBlock.style.display = isVideo ? "block" : "none";
      if (isVideo && videoFormatOutput) {
        // Generate video format previews
        const videoState = Object.assign({}, state, { aiPreset: "Runway Gen-3" });
        const runwayResult = Generator.generate(videoState);
        videoState.aiPreset = "Pika";
        const pikaResult = Generator.generate(videoState);
        videoState.aiPreset = "Sora";
        const soraResult = Generator.generate(videoState);
        videoState.aiPreset = "Kling";
        const klingResult = Generator.generate(videoState);
        videoState.aiPreset = "Luma Dream Machine";
        const lumaResult = Generator.generate(videoState);
        videoFormatOutput.innerHTML =
          "<strong>" + i18n.t("buttons.copyRunway") + ":</strong> " + (runwayResult ? runwayResult.prompt : "") + "<br><br>" +
          "<strong>" + i18n.t("buttons.copyPika") + ":</strong> " + (pikaResult ? pikaResult.prompt : "") + "<br><br>" +
          "<strong>" + i18n.t("buttons.copySora") + ":</strong> " + (soraResult ? soraResult.prompt : "") + "<br><br>" +
          "<strong>" + i18n.t("buttons.copyKling") + ":</strong> " + (klingResult ? klingResult.prompt : "") + "<br><br>" +
          "<strong>" + i18n.t("buttons.copyLuma") + ":</strong> " + (lumaResult ? lumaResult.prompt : "");
      }
    }

    // PF-L6: Update quality meter
    updateQualityMeter();
  }

  /* ===========================================================
     PF-L6: Quality Meter — completion % + token estimate
     =========================================================== */
  const qualityMeterFill = $("#qualityMeterFill");
  const qualityMeterPct = $("#qualityMeterPct");
  const qualityMeterTokens = $("#qualityMeterTokens");
  const qualityMeterWarning = $("#qualityMeterWarning");
  const qualityMeterBar = $("#qualityMeter");

  // Model token limits (approximate)
  const MODEL_LIMITS = {
    "ChatGPT Images": 4096,
    "Flux": 512,
    "SDXL": 77,
    "Midjourney": 2500,
    "Gemini": 2048,
    "Runway Gen-3": 500,
    "Pika": 500,
    "Sora": 1000,
    "Kling": 500,
    "Luma Dream Machine": 500
  };

  function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~1 token per 4 characters for English
    return Math.ceil(text.length / 4);
  }

  function calculateCompletion(state) {
    // 14 core sections (per spec §6 item 7)
    const sections = [
      // 1. Project Type (category OR preset OR custom)
      !!(state.projectTypeCategory || state.projectTypePreset || (state.projectTypeCustom && state.projectTypeCustom.trim())),
      // 2. Subject (at least one with text)
      !!(state.subjects && state.subjects.some(function (s) { return s.text && s.text.trim(); })),
      // 3. Art Style
      !!(state.artStyle || (state.artStyleCustom && state.artStyleCustom.trim())),
      // 4. Camera Angle / Camera Movement (depends on mode)
      state.outputMode === "video" 
        ? !!(state.cameraMovement || (state.cameraMovementCustom && state.cameraMovementCustom.trim()))
        : !!(state.cameraAngle || (state.cameraAngleCustom && state.cameraAngleCustom.trim())),
      // 5. Lighting
      !!(state.lighting || (state.lightingCustom && state.lightingCustom.trim())),
      // 6. Color Palette (at least one color)
      !!(state.colors && state.colors.length > 0),
      // 7. Background
      !!(state.background || (state.backgroundCustom && state.backgroundCustom.trim())),
      // 8. Mood
      !!(state.mood || (state.moodCustom && state.moodCustom.trim())),
      // 9. Typography
      !!(state.typography || (state.typographyCustom && state.typographyCustom.trim())),
      // 10. Effects (built-in OR custom)
      !!(state.effects && state.effects.length > 0 || (state.customEffects && state.customEffects.trim())),
      // 11. Watermark
      !!(state.watermarkText && state.watermarkText.trim()),
      // 12. Aspect Ratio / Custom Resolution
      !!(state.aspectRatio || (state.customResolution && state.customResolution.trim())),
      // 13. Advanced (composition OR renderingQuality OR promptExpansion OR aiPreset)
      !!(state.composition || state.renderingQuality || state.promptExpansion || state.aiPreset),
      // 14. Additional Description
      !!(state.additionalDescription && state.additionalDescription.trim())
    ];
    
    const filled = sections.filter(Boolean).length;
    return Math.round((filled / sections.length) * 100);
  }

  function updateQualityMeter() {
    if (!qualityMeterFill || !qualityMeterPct || !qualityMeterTokens) return;
    
    const pct = calculateCompletion(state);
    const promptText = state.lastResult ? state.lastResult.prompt : "";
    const negativeText = state.lastResult ? state.lastResult.negative : "";
    const tokenEstimate = estimateTokens(promptText + " " + negativeText);
    
    // Update bar
    qualityMeterFill.style.width = pct + "%";
    qualityMeterFill.setAttribute("aria-valuenow", pct);
    
    // Update color based on percentage
    if (pct < 30) {
      qualityMeterFill.style.background = "var(--danger)";
    } else if (pct < 70) {
      qualityMeterFill.style.background = "linear-gradient(90deg, var(--warning), var(--success))";
    } else {
      qualityMeterFill.style.background = "var(--success)";
    }
    
    qualityMeterPct.textContent = pct + "%";
    qualityMeterTokens.textContent = "~" + tokenEstimate + " tokens";
    
    // Token limit warning
    const preset = state.aiPreset;
    const limit = preset ? MODEL_LIMITS[preset] : null;
    if (limit && tokenEstimate > limit) {
      qualityMeterWarning.hidden = false;
      qualityMeterWarning.textContent = "⚠ Exceeds " + preset + " limit (~" + limit + " tokens)";
    } else if (limit && tokenEstimate > limit * 0.8) {
      qualityMeterWarning.hidden = false;
      qualityMeterWarning.textContent = "⚠ Approaching " + preset + " limit (~" + limit + " tokens)";
    } else {
      qualityMeterWarning.hidden = true;
    }
  }

  /* ===========================================================
     PF-L6: Randomize — fills unlocked fields with random values
     =========================================================== */
  function doRandomize() {
    const randomizeBtn = $("#randomizeBtn");
    if (randomizeBtn) {
      randomizeBtn.classList.add("is-randomizing");
      randomizeBtn.disabled = true;
    }
    
    // Collect all randomizable fields with their option sources
    const randomizableFields = [
      // Project Type
      { key: "projectTypeCategory", source: () => Object.keys(D.PROJECT_TYPE), lock: "projectTypeCategory", setter: (v) => { state.projectTypeCategory = v; rebuildProjectTypePresets(v); } },
      { key: "projectTypePreset", source: () => D.PROJECT_TYPE[state.projectTypeCategory] || [], lock: "projectTypePreset", setter: (v) => { state.projectTypePreset = v; } },
      { key: "projectTypeCustom", source: () => ["Custom Project " + Math.floor(Math.random() * 1000)], lock: "projectTypeCustom", setter: (v) => { state.projectTypeCustom = v; document.getElementById("projectType-custom").value = v; } },
      
      // Subject (special handling - multiple subjects)
      { key: "subjects", source: () => ["Mystical forest guardian", "Cyberpunk samurai", "Steampunk airship captain", "Victorian ghost hunter", "Neon-lit street racer", "Ancient ruin explorer", "Cosmic entity", "Post-apocalyptic survivor", "Fantasy bard", "Mecha pilot"], lock: "subjects", setter: (v) => { 
          if (!state.subjects.length) {
            state.subjects.push({ id: makeSubjectId(), text: v, importance: "Primary" });
          } else if (!fieldLocks.subjects) {
            state.subjects[0].text = v;
          }
          renderSubjects();
        } },
      
      // Art Style
      { key: "artStyle", source: () => D.ART_STYLE.map(s => s.value), lock: "artStyle", setter: (v) => { state.artStyle = v; if (combos.artStyle) combos.artStyle.setValue(v); } },
      { key: "artStyleCustom", source: () => ["Mixed media " + Math.floor(Math.random() * 100)], lock: "artStyleCustom", setter: (v) => { state.artStyleCustom = v; document.getElementById("artStyle-custom").value = v; } },
      
      // Camera Angle / Movement
      { key: "cameraAngle", source: () => D.CAMERA_ANGLE.map(s => s.value), lock: "cameraAngle", setter: (v) => { state.cameraAngle = v; if (combos.cameraAngle) combos.cameraAngle.setValue(v); } },
      { key: "cameraAngleCustom", source: () => ["Custom angle " + Math.floor(Math.random() * 100) + "°"], lock: "cameraAngleCustom", setter: (v) => { state.cameraAngleCustom = v; document.getElementById("cameraAngle-custom").value = v; } },
      { key: "cameraMovement", source: () => (D.CAMERA_MOVEMENTS || []).map(s => s.value), lock: "cameraMovement", setter: (v) => { state.cameraMovement = v; if (combos.cameraMovement) combos.cameraMovement.setValue(v); } },
      { key: "cameraMovementCustom", source: () => ["Custom movement " + Math.floor(Math.random() * 100)], lock: "cameraMovementCustom", setter: (v) => { state.cameraMovementCustom = v; document.getElementById("cameraMovement-custom").value = v; } },
      
      // Lighting
      { key: "lighting", source: () => D.LIGHTING.map(s => s.value), lock: "lighting", setter: (v) => { state.lighting = v; if (combos.lighting) combos.lighting.setValue(v); } },
      { key: "lightingCustom", source: () => ["Custom lighting " + Math.floor(Math.random() * 100)], lock: "lightingCustom", setter: (v) => { state.lightingCustom = v; document.getElementById("lighting-custom").value = v; } },
      
      // Color Palette
      { key: "colorMode", source: () => ["single", "dual", "multi"], lock: "colorMode", setter: (v) => { state.colorMode = v; initColorPalette(); } },
      { key: "colors", source: () => ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#A855F7"], lock: "colors", setter: (v) => { state.colors = [v]; initColorPalette(); } },
      
      // Background
      { key: "background", source: () => D.BACKGROUND.map(s => s.value), lock: "background", setter: (v) => { state.background = v; if (combos.background) combos.background.setValue(v); } },
      { key: "backgroundCustom", source: () => ["Custom background " + Math.floor(Math.random() * 100)], lock: "backgroundCustom", setter: (v) => { state.backgroundCustom = v; document.getElementById("background-custom").value = v; } },
      
      // Mood
      { key: "mood", source: () => D.MOOD.map(s => s.value), lock: "mood", setter: (v) => { state.mood = v; if (combos.mood) combos.mood.setValue(v); } },
      { key: "moodCustom", source: () => ["Custom mood " + Math.floor(Math.random() * 100)], lock: "moodCustom", setter: (v) => { state.moodCustom = v; document.getElementById("mood-custom").value = v; } },
      
      // Typography
      { key: "typography", source: () => D.TYPOGRAPHY.map(s => s.value), lock: "typography", setter: (v) => { state.typography = v; if (combos.typography) combos.typography.setValue(v); } },
      { key: "typographyCustom", source: () => ["Custom typography " + Math.floor(Math.random() * 100)], lock: "typographyCustom", setter: (v) => { state.typographyCustom = v; document.getElementById("typography-custom").value = v; } },
      
      // Effects
      { key: "effects", source: () => D.EFFECTS.map(s => s.value), lock: "effects", setter: (v) => { state.effects = [v]; initEffects(); } },
      { key: "customEffects", source: () => ["floating particles, energy aura, magic sparks, volumetric lighting, lens flare"], lock: "customEffects", setter: (v) => { state.customEffects = v; document.getElementById("effects-custom").value = v; } },
      
      // Watermark
      { key: "watermarkPosition", source: () => D.WATERMARK_POSITIONS.map(s => s.value), lock: "watermarkPosition", setter: (v) => { state.watermarkPosition = v; initWatermarkPosition(); } },
      { key: "watermarkCustomPosition", source: () => ["Custom position " + Math.floor(Math.random() * 100)], lock: "watermarkCustomPosition", setter: (v) => { state.watermarkCustomPosition = v; document.getElementById("watermark-custom-pos").value = v; } },
      { key: "watermarkText", source: () => ["@PromptForge", "@MyBrand", "© 2024", "Watermark"], lock: "watermarkText", setter: (v) => { state.watermarkText = v; document.getElementById("watermark-text").value = v; } },
      
      // Aspect Ratio
      { key: "aspectRatio", source: () => D.ASPECT_RATIOS.map(s => s.value), lock: "aspectRatio", setter: (v) => { state.aspectRatio = v; rebuildAspectRatioGrid(state.outputMode); } },
      { key: "customResolution", source: () => ["1920x1080", "3840x2160", "1080x1920", "1280x720", "2048x2048"], lock: "customResolution", setter: (v) => { state.customResolution = v; document.getElementById("custom-resolution").value = v; } },
      
      // Advanced
      { key: "composition", source: () => D.COMPOSITION.map(s => s.value), lock: "composition", setter: (v) => { state.composition = v; initComposition(); } },
      { key: "renderingQuality", source: () => D.RENDERING_QUALITY.map(s => s.value), lock: "renderingQuality", setter: (v) => { state.renderingQuality = v; initRendering(); } },
      { key: "promptExpansion", source: () => D.PROMPT_EXPANSION.map(s => s.value), lock: "promptExpansion", setter: (v) => { state.promptExpansion = v; initExpansion(); } },
      { key: "aiPreset", source: () => (state.outputMode === "video" ? D.AI_PRESETS_VIDEO : D.AI_PRESETS).map(s => s.value), lock: "aiPreset", setter: (v) => { state.aiPreset = v; rebuildAiPresetChips(state.outputMode); } },
      
      // Additional Description
      { key: "additionalDescription", source: () => ["Add dramatic lighting. Enhance details. Make it cinematic.", "Focus on texture and material quality. Avoid blurry areas.", "Ensure coherent anatomy. No extra limbs. Clean composition."], lock: "additionalDescription", setter: (v) => { state.additionalDescription = v; document.getElementById("additional-desc").value = v; } },
      
      // Video-only
      { key: "duration", source: () => (D.DURATIONS || []).map(s => s.value), lock: "duration", setter: (v) => { state.duration = v; if (combos.duration) combos.duration.setValue(v); } },
      { key: "durationCustom", source: () => [String(Math.floor(Math.random() * 10) + 1)], lock: "durationCustom", setter: (v) => { state.durationCustom = v; document.getElementById("duration-custom").value = v; } },
      { key: "fps", source: () => (D.FPS_OPTIONS || []).map(s => s.value), lock: "fps", setter: (v) => { state.fps = v; if (combos.fps) combos.fps.setValue(v); } },
      { key: "motionStrength", source: () => (D.MOTION_STRENGTH || []).map(s => s.value), lock: "motionStrength", setter: (v) => { state.motionStrength = v; initMotionStrength(); } },
      { key: "loop", source: () => (D.LOOP_OPTIONS || []).map(s => s.value), lock: "loop", setter: (v) => { state.loop = v; initLoop(); } },
      { key: "transition", source: () => (D.TRANSITIONS || []).map(s => s.value), lock: "transition", setter: (v) => { state.transition = v; if (combos.transition) combos.transition.setValue(v); } }
    ];
    
    // Randomize unlocked fields
    randomizableFields.forEach(function (field) {
      if (fieldLocks[field.lock]) return; // Skip locked fields
      
      const options = field.source();
      if (options && options.length > 0) {
        const randomValue = options[Math.floor(Math.random() * options.length)];
        field.setter(randomValue);
      }
    });
    
    // Sync UI for chip grids that don't have combos
    initEffects();
    initComposition();
    initRendering();
    initExpansion();
    initAiPreset();
    initWatermarkPosition();
    initMotionStrength();
    initLoop();
    rebuildAspectRatioGrid(state.outputMode);
    initColorPalette();
    renderSubjects();
    
    // Update quality meter
    updateQualityMeter();
    
    if (randomizeBtn) {
      randomizeBtn.classList.remove("is-randomizing");
      randomizeBtn.disabled = false;
    }
    
    toast("Randomized unlocked fields!", "success");
  }

  async function doGenerate() {
    const generateBtn = $("#generateBtn");
    const i18n = global.PF.i18n;

    // Check if auto-translate is enabled and translate state if needed
    let enState = state;
    let translationNotes = [];

    if (state.autoTranslate && global.PF && global.PF.Translate) {
      generateBtn.disabled = true;
      generateBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>' +
        ' <span data-i18n="toast.translating">' + i18n.t("toast.translating") + '</span>';
      generateBtn.classList.add("is-translating");

      try {
        const translated = await global.PF.Translate.translateState(state);
        enState = translated.enState;
        translationNotes = translated.notes;

        // Show fallback toast if any field used fallback
        const hasFallback = translationNotes.some(function (n) { return n.fallback; });
        if (hasFallback) {
          toast(i18n.t("toast.fallbackNote"), "warning");
        }
      } catch (e) {
        console.error("[PF] Translation failed:", e);
        toast(i18n.t("toast.offlineNote"), "warning");
        enState = state; // Use original state on error
        translationNotes = [];
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/><path d="m12 3 9 9-9 9-9-9 9-9Z"/></svg>' +
          ' <span data-i18n="buttons.generate">' + i18n.t("buttons.generate") + '</span>';
        generateBtn.classList.remove("is-translating");
      }
    }

    // Generate prompt with translated state
    const result = Generator.generate(enState);
    if (!result || !result.prompt) {
      toast(i18n.t("toast.errorGenerate"), "error");
      return;
    }
    result.id = History.makeId();
    state.lastResult = result;
    renderOutput(result, translationNotes);

    // Show translation notes toast if any translations occurred
    if (translationNotes.length > 0) {
      var fields = translationNotes.map(function (n) { return n.field; }).join(", ");
      toast("Translated: " + fields + ". " + i18n.t("toast.generated"), "success");
    } else {
      toast(i18n.t("toast.generated"), "success");
    }

    // Auto-save to history (save original state, not translated)
    History.addToHistory({
      id: result.id,
      prompt: result.prompt,
      negative: result.negative,
      state: state,
      timestamp: result.timestamp
    });
    renderHistory();
    renderFavorites();
  }

  /* Walks user-entered text fields and reports if any were translated. */
  function detectTranslationInState(s) {
    var messages = [];
    (s.subjects || []).forEach(function (subj, i) {
      if (subj.text && subj.text.trim()) {
        var r = D.translateToIndonesian(subj.text);
        if (r.changed && r.translated !== subj.text) {
          messages.push("Subject " + (i + 1) + " translated to Indonesian");
        }
      }
    });
    if (s.additionalDescription && s.additionalDescription.trim()) {
      var r2 = D.translateToIndonesian(s.additionalDescription);
      if (r2.changed && r2.translated !== s.additionalDescription) {
        messages.push("Additional description translated");
      }
    }
    if (s.watermarkText && s.watermarkText.trim()) {
      var r3 = D.translateToIndonesian(s.watermarkText);
      if (r3.changed && r3.translated !== s.watermarkText) {
        messages.push("Watermark text translated");
      }
    }
    if (messages.length === 0) return null;
    return messages.join("; ") + ". Prompt generated & saved.";
  }

  function doClear() {
    // Clear only the output panel
    state.lastResult = null;
    renderOutput(null);
    updateQualityMeter();
    toast("Output cleared.");
  }

  function doResetAll() {
    // Reset everything to EMPTY (Issue #1)
    state.subjects = [];
    state.subjectImages = [];
    state.artStyle = null; state.artStyleCustom = "";
    state.cameraAngle = null; state.cameraAngleCustom = "";
    state.cameraMovement = null; state.cameraMovementCustom = "";
    state.lighting = null; state.lightingCustom = "";
    state.background = null; state.backgroundCustom = "";
    state.backgroundImages = [];
    state.mood = null; state.moodCustom = "";
    state.typography = null; state.typographyCustom = "";
    state.effects = [];
    state.customEffects = "";
    state.watermarkPosition = null;
    state.watermarkCustomPosition = "";
    state.watermarkText = "";
    state.composition = null;
    state.colors = [];
    state.colorMode = "single";
    state.projectTypeCategory = null;
    state.projectTypePreset = null;
    state.projectTypeCustom = "";
    state.aspectRatio = null;
    state.customResolution = "";
    state.renderingQuality = null;
    state.promptExpansion = null;
    state.aiPreset = null;
    state.additionalDescription = "";
    // Video-only fields (PF-L2)
    state.duration = null; state.durationCustom = "";
    state.fps = null;
    state.motionStrength = null;
    state.loop = null;
    state.transition = null;
    // Output mode resets to default "image"
    state.outputMode = "image";
    state.lastResult = null;

    // Reset UI
    Object.keys(combos).forEach(function (k) {
      if (combos[k] && combos[k].clear) combos[k].clear();
    });
    $all("input[type=text], input[type=tel], textarea, select").forEach(function (el) {
      if (!el.closest(".combobox")) el.value = "";
    });
    $all(".chip").forEach(function (c) { c.classList.remove("is-active"); });
    $all(".ratio").forEach(function (r) { r.classList.remove("is-active"); });
    $all(".preview").forEach(function (p) { p.remove(); });

    // Re-apply default output mode UI (PF-L2)
    const seg = $("#outputModeSeg");
    if (seg) {
      $all(".seg__btn", seg).forEach(function (btn) {
        const isActive = btn.dataset.mode === "image";
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive);
      });
    }
    toggleSectionsForMode("image");
    rebuildAiPresetChips("image");
    rebuildAspectRatioGrid("image");
    updateRenderingQualityLabel("image");
    updateOutputPanelLabels("image");
    // Update URL hash
    window.location.hash = window.location.hash.replace(/([#&])m=(image|video)/, "$1m=image");

    renderSubjects();
    initColorPalette();

    renderOutput(null);
    toast("All fields cleared.");
  }

  /* ===========================================================
     History / Favorites UI
     =========================================================== */
  function renderEntry(entry, isFav) {
    const card = document.createElement("div");
    card.className = "entry";
    card.dataset.id = entry.id;

    const title = entry.state && entry.state.aiPreset ? entry.state.aiPreset + " · " + (entry.state.aspectRatio || "") : "Prompt";

    const head = document.createElement("div");
    head.className = "entry__head";
    head.innerHTML =
      '<span class="entry__title">' + (title || "Prompt").trim() + '</span>' +
      '<span class="entry__time">' + History.timeAgo(entry.timestamp) + '</span>';

    const body = document.createElement("div");
    body.className = "entry__prompt";
    body.textContent = entry.prompt;

    const actions = document.createElement("div");
    actions.className = "entry__actions";

    // Restore
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "entry__btn";
    restoreBtn.type = "button";
    restoreBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg> Restore';
    restoreBtn.addEventListener("click", function () { restoreEntry(entry); });

    // Copy
    const copyBtn = document.createElement("button");
    copyBtn.className = "entry__btn";
    copyBtn.type = "button";
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg> Copy';
    copyBtn.addEventListener("click", function () {
      copyToClipboard(entry.prompt).then(function (ok) {
        toast(ok ? "Prompt copied." : "Copy failed.", ok ? "success" : "error");
      });
    });

    // Star (toggle favorite)
    const starBtn = document.createElement("button");
    starBtn.className = "entry__btn entry__btn--star" + (isFav ? " is-active" : "");
    starBtn.type = "button";
    starBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2Z"/></svg> ' + (isFav ? "Favorited" : "Favorite");
    starBtn.addEventListener("click", function () {
      if (History.isFavorite(entry.id)) {
        History.removeFromFavorites(entry.id);
        toast("Removed from favorites.");
      } else {
        History.addToFavorites(entry);
        toast("Saved to favorites.", "success");
      }
      renderFavorites();
      renderHistory();
    });

    // Delete
    const delBtn = document.createElement("button");
    delBtn.className = "entry__btn entry__btn--danger";
    delBtn.type = "button";
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Delete';
    delBtn.addEventListener("click", function () {
      if (isFav) {
        History.removeFromFavorites(entry.id);
        renderFavorites();
      } else {
        History.removeFromHistory(entry.id);
        renderHistory();
      }
      toast("Deleted.");
    });

    actions.appendChild(restoreBtn);

    // Restore as Draft (PF-L6) — restores without regenerating
    const restoreDraftBtn = document.createElement("button");
    restoreDraftBtn.className = "entry__btn entry__btn--restore";
    restoreDraftBtn.type = "button";
    restoreDraftBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Draft';
    restoreDraftBtn.title = "Restore as draft (edit before generating)";
    restoreDraftBtn.addEventListener("click", function () { restoreEntry(entry, true); });

    actions.appendChild(restoreDraftBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(starBtn);
    actions.appendChild(delBtn);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(actions);
    return card;
  }

  function renderHistory(query, modeFilter, presetFilter) {
    const list = $("#historyList");
    if (!list) return;
    list.innerHTML = "";
    const items = History.searchHistory(query || "", modeFilter || "", presetFilter || "");
    if (items.length === 0) {
      list.innerHTML = '<div class="history__empty">No history yet. Generate a prompt to see it here.</div>';
      return;
    }
    items.forEach(function (e) { list.appendChild(renderEntry(e, History.isFavorite(e.id))); });
  }

  function renderFavorites() {
    const list = $("#favoritesList");
    if (!list) return;
    list.innerHTML = "";
    const items = History.getFavorites();
    if (items.length === 0) {
      list.innerHTML = '<div class="history__empty">No favorites yet. Star a prompt to save it here.</div>';
      return;
    }
    items.forEach(function (e) { list.appendChild(renderEntry(e, true)); });
  }

  function restoreEntry(entry, asDraft) {
    // Restore state from entry
    if (entry.state) {
      Object.keys(entry.state).forEach(function (k) {
        if (k === "lastResult") return;
        if (k === "subjectImages" || k === "backgroundImages") {
          state[k] = (entry.state[k] || []).slice();
        } else {
          state[k] = entry.state[k];
        }
      });
    }
    // Re-sync UI
    syncUIFromState();
    
    if (asDraft) {
      // Restore as draft: show the prompt in output but don't set as lastResult
      renderOutput({
        prompt: entry.prompt,
        negative: entry.negative,
        meta: [],
        state: entry.state,
        timestamp: entry.timestamp,
        id: entry.id
      });
      state.lastResult = null; // Don't treat as generated result
      saveFavBtn.disabled = true;
      saveHistBtn.disabled = true;
      toast("Restored as draft. Edit fields then press Generate.");
    } else {
      // Full restore with lastResult
      renderOutput({
        prompt: entry.prompt,
        negative: entry.negative,
        meta: [],
        state: entry.state,
        timestamp: entry.timestamp,
        id: entry.id
      });
      state.lastResult = { prompt: entry.prompt, negative: entry.negative, id: entry.id, timestamp: entry.timestamp };
      saveFavBtn.disabled = false;
      saveHistBtn.disabled = false;
      toast("Restored. Press Generate to regenerate.");
    }
  }

  function syncUIFromState() {
    if (state.projectTypeCategory && combos.projectTypeCategory) combos.projectTypeCategory.setValue(state.projectTypeCategory);
    setTimeout(function () {
      if (state.projectTypePreset && combos.projectTypePreset) combos.projectTypePreset.setValue(state.projectTypePreset);
    }, 50);
    if (state.artStyle && combos.artStyle) combos.artStyle.setValue(state.artStyle);
    if (state.cameraAngle && combos.cameraAngle) combos.cameraAngle.setValue(state.cameraAngle);
    if (state.cameraMovement && combos.cameraMovement) combos.cameraMovement.setValue(state.cameraMovement);
    if (state.lighting && combos.lighting) combos.lighting.setValue(state.lighting);
    if (state.background && combos.background) combos.background.setValue(state.background);
    if (state.mood && combos.mood) combos.mood.setValue(state.mood);
    if (state.typography && combos.typography) combos.typography.setValue(state.typography);
    if (state.duration && combos.duration) combos.duration.setValue(state.duration);
    if (state.fps && combos.fps) combos.fps.setValue(state.fps);
    if (state.transition && combos.transition) combos.transition.setValue(state.transition);

    const textMap = {
      "projectType-custom":      "projectTypeCustom",
      "artStyle-custom":         "artStyleCustom",
      "cameraAngle-custom":      "cameraAngleCustom",
      "cameraMovement-custom":   "cameraMovementCustom",
      "lighting-custom":         "lightingCustom",
      "background-custom":       "backgroundCustom",
      "mood-custom":             "moodCustom",
      "typography-custom":       "typographyCustom",
      "effects-custom":          "customEffects",
      "watermark-custom-pos":    "watermarkCustomPosition",
      "watermark-text":          "watermarkText",
      "custom-resolution":       "customResolution",
      "additional-desc":         "additionalDescription",
      "duration-custom":         "durationCustom"
    };
    Object.keys(textMap).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = state[textMap[id]] || "";
    });

    // Chips
    $all(".chip-grid").forEach(function (grid) {
      $all(".chip", grid).forEach(function (chip) { chip.classList.remove("is-active"); });
    });
    const activeChips = [
      { grid: "effectsGrid",       values: state.effects },
      { grid: "compositionGrid",   values: state.composition ? [state.composition] : [] },
      { grid: "renderingGrid",     values: state.renderingQuality ? [state.renderingQuality] : [] },
      { grid: "expansionGrid",     values: state.promptExpansion ? [state.promptExpansion] : [] },
      { grid: "aiPresetGrid",      values: state.aiPreset ? [state.aiPreset] : [] },
      { grid: "watermarkPosGrid",  values: state.watermarkPosition ? [state.watermarkPosition] : [] },
      { grid: "motionStrengthGrid", values: state.motionStrength ? [state.motionStrength] : [] },
      { grid: "loopGrid",          values: state.loop ? [state.loop] : [] }
    ];
    activeChips.forEach(function (g) {
      const grid = document.getElementById(g.grid);
      if (!grid) return;
      g.values.forEach(function (v) {
        const chip = grid.querySelector('.chip[data-value="' + v + '"]');
        if (chip) chip.classList.add("is-active");
      });
    });

    // Aspect ratio
    $all("#ratioGrid .ratio").forEach(function (r) {
      r.classList.toggle("is-active", r.dataset.value === state.aspectRatio);
    });

    // Subjects
    renderSubjects();

    // Color palette: rebuild via re-init
    initColorPalette();

    // Re-apply output mode to ensure UI consistency (PF-L2)
    if (state.outputMode) {
      // The initOutputMode already ran, but we need to re-apply the mode-specific UI
      // sections visibility, AI preset chips, aspect ratio grid, labels
      toggleSectionsForMode(state.outputMode);
      rebuildAiPresetChips(state.outputMode);
      rebuildAspectRatioGrid(state.outputMode);
      updateRenderingQualityLabel(state.outputMode);
      updateOutputPanelLabels(state.outputMode);
    }
  }

  /* ===========================================================
     Navbar: smooth scroll, scroll-spy, and mobile hamburger menu
     =========================================================== */
  function initNav() {
    const links = $all(".nav__link");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        const target = link.getAttribute("href");
        if (target && target.startsWith("#")) {
          e.preventDefault();
          const el = document.querySelector(target);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          // Issue #1: close mobile drawer when a nav item is selected
          closeMobileNav();
        }
      });
    });

    // Scroll spy: highlight active nav link (both desktop + mobile)
    const sections = ["generator", "history", "favorites"]
      .map(function (id) { return { id: id, el: document.getElementById(id) }; })
      .filter(function (s) { return s.el; });

    function onScroll() {
      const scrollY = window.scrollY + 120;
      let activeId = sections[0] && sections[0].id;
      sections.forEach(function (s) {
        if (s.el.offsetTop <= scrollY) activeId = s.id;
      });
      links.forEach(function (l) {
        l.classList.toggle("is-active", l.getAttribute("href") === "#" + activeId);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // === Issue #1: Mobile hamburger menu wiring ===
    initMobileNav();
  }

  /* Mobile navigation drawer logic:
     - Toggle button opens/closes the drawer
     - Click on backdrop (outside drawer) closes it
     - Click on any nav link inside drawer closes it (handled above)
     - Escape key closes it
     - Auto-close when viewport grows past the mobile breakpoint
     - aria-expanded synced on the toggle button
  */
  function initMobileNav() {
    const toggle = document.getElementById("navToggle");
    const drawer = document.getElementById("mobileNav");
    const backdrop = document.getElementById("navBackdrop");
    if (!toggle || !drawer || !backdrop) return;

    function open() {
      drawer.classList.add("is-open");
      backdrop.classList.add("is-open");
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      drawer.removeAttribute("hidden");
      backdrop.removeAttribute("hidden");
      // Lock body scroll while drawer is open
      document.body.style.overflow = "hidden";
    }

    function close() {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      // Restore body scroll
      document.body.style.overflow = "";
      // After transition, hide from accessibility tree
      setTimeout(function () {
        if (!drawer.classList.contains("is-open")) drawer.setAttribute("hidden", "");
        if (!backdrop.classList.contains("is-open")) backdrop.setAttribute("hidden", "");
      }, 300);
    }

    // Expose closeMobileNav globally for initNav's link handler
    closeMobileNav = close;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (drawer.classList.contains("is-open")) close();
      else open();
    });

    // Click outside (on backdrop) closes
    backdrop.addEventListener("click", close);

    // Escape closes
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        close();
        toggle.focus();
      }
    });

    // Auto-close when resizing to desktop
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      const w = window.innerWidth;
      if (w > 980 && lastWidth <= 980 && drawer.classList.contains("is-open")) {
        close();
      }
      lastWidth = w;
    });
  }

  // Placeholder; replaced by initMobileNav's close() once initialized.
  let closeMobileNav = function () {};

  /* ===========================================================
     Wire buttons
     =========================================================== */
  function wireButtons() {
    $("#generateBtn").addEventListener("click", doGenerate);
    $("#clearBtn").addEventListener("click", doClear);
    $("#resetAllBtn").addEventListener("click", doResetAll);

    // PF-L6: Randomize button
    const randomizeBtn = $("#randomizeBtn");
    if (randomizeBtn) {
      randomizeBtn.addEventListener("click", doRandomize);
    }

    // PF-L5: Copy per-model buttons
    if (copyPromptBtn) {
      copyPromptBtn.addEventListener("click", function () {
        if (!state.lastResult || !state.lastResult.prompt) {
          toast("Nothing to copy yet.", "error"); return;
        }
        copyToClipboard(state.lastResult.prompt).then(function (ok) {
          toast(ok ? "Prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyNegativeBtn) {
      copyNegativeBtn.addEventListener("click", function () {
        if (!state.lastResult || !state.lastResult.negative) {
          toast("Nothing to copy yet.", "error"); return;
        }
        copyToClipboard(state.lastResult.negative).then(function (ok) {
          toast(ok ? "Negative prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyNaturalBtn) {
      copyNaturalBtn.addEventListener("click", function () {
        PF.Share.copyNatural().then(function (ok) {
          toast(ok ? "Natural language prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyMjBtn) {
      copyMjBtn.addEventListener("click", function () {
        PF.Share.copyMidjourney().then(function (ok) {
          toast(ok ? "Midjourney prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copySdxlBtn) {
      copySdxlBtn.addEventListener("click", function () {
        PF.Share.copySDXL().then(function (ok) {
          toast(ok ? "SDXL prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyRunwayBtn) {
      copyRunwayBtn.addEventListener("click", function () {
        PF.Share.copyRunway().then(function (ok) {
          toast(ok ? "Runway prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyPikaBtn) {
      copyPikaBtn.addEventListener("click", function () {
        PF.Share.copyPika().then(function (ok) {
          toast(ok ? "Pika prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copySoraBtn) {
      copySoraBtn.addEventListener("click", function () {
        PF.Share.copySora().then(function (ok) {
          toast(ok ? "Sora prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyKlingBtn) {
      copyKlingBtn.addEventListener("click", function () {
        PF.Share.copyKling().then(function (ok) {
          toast(ok ? "Kling prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    if (copyLumaBtn) {
      copyLumaBtn.addEventListener("click", function () {
        PF.Share.copyLuma().then(function (ok) {
          toast(ok ? "Luma prompt copied." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    // PF-L5: Copy All (prompt + negative + settings)
    const copyAllBtn = $("#copyAllBtn");
    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        PF.Share.copyAll().then(function (ok) {
          toast(ok ? "All copied (prompt + negative + settings)." : "Copy failed.", ok ? "success" : "error");
        });
      });
    }

    $("#saveFavoriteBtn").addEventListener("click", function () {
      if (!state.lastResult) return;
      if (History.isFavorite(state.lastResult.id)) {
        History.removeFromFavorites(state.lastResult.id);
        toast("Removed from favorites.");
      } else {
        History.addToFavorites({
          id: state.lastResult.id,
          prompt: state.lastResult.prompt,
          negative: state.lastResult.negative,
          state: state,
          timestamp: state.lastResult.timestamp || Date.now()
        });
        toast("Saved to favorites.", "success");
      }
      renderFavorites();
      renderHistory();
    });

    $("#saveHistoryBtn").addEventListener("click", function () {
      if (!state.lastResult) return;
      History.addToHistory({
        id: state.lastResult.id,
        prompt: state.lastResult.prompt,
        negative: state.lastResult.negative,
        state: state,
        timestamp: state.lastResult.timestamp || Date.now()
      });
      renderHistory();
      toast("Saved to history.", "success");
    });

    $("#clearHistoryBtn").addEventListener("click", function () {
      if (confirm("Clear all history? This cannot be undone.")) {
        History.clearHistory();
        renderHistory();
        toast("History cleared.");
      }
    });
    $("#clearFavoritesBtn").addEventListener("click", function () {
      if (confirm("Clear all favorites? This cannot be undone.")) {
        History.clearFavorites();
        renderFavorites();
        toast("Favorites cleared.");
      }
    });

    // PF-L5: Export/Import/Share buttons
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        PF.Share.exportToFile();
      });
    }

    if (importBtn && importFileInput) {
      importBtn.addEventListener("click", function () {
        importFileInput.click();
      });
      importFileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;
        PF.Share.importFromFile(file).catch(function (err) {
          toast("Import failed: " + err.message, "error");
        });
        importFileInput.value = "";
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        PF.Share.copyShareLink();
      });
    }

    // PF-L6: History search & filter toolbar
    const historySearch = $("#historySearch");
    const historyFilterMode = $("#historyFilterMode");
    const historyFilterPreset = $("#historyFilterPreset");

    function refreshHistoryPresets() {
      if (!historyFilterPreset) return;
      const presets = History.getHistoryPresets();
      const currentValue = historyFilterPreset.value;
      historyFilterPreset.innerHTML = '<option value="">All Presets</option>';
      presets.forEach(function (preset) {
        const opt = document.createElement("option");
        opt.value = preset;
        opt.textContent = preset;
        historyFilterPreset.appendChild(opt);
      });
      // Restore selection if still valid
      if (presets.includes(currentValue)) {
        historyFilterPreset.value = currentValue;
      }
    }

    function applyHistoryFilters() {
      const query = historySearch ? historySearch.value : "";
      const modeFilter = historyFilterMode ? historyFilterMode.value : "";
      const presetFilter = historyFilterPreset ? historyFilterPreset.value : "";
      renderHistory(query, modeFilter, presetFilter);
      refreshHistoryPresets();
    }

    if (historySearch) {
      historySearch.addEventListener("input", applyHistoryFilters);
    }
    if (historyFilterMode) {
      historyFilterMode.addEventListener("change", applyHistoryFilters);
    }
    if (historyFilterPreset) {
      historyFilterPreset.addEventListener("change", applyHistoryFilters);
    }

    // Initial preset population
    refreshHistoryPresets();
  }

  /* ===========================================================
     Footer year
     =========================================================== */
  function setYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ===========================================================
     Boot — waits for async data load (pf:data-ready)
     =========================================================== */
  async function boot() {
    // Initialize i18n first (PF-L4)
    await i18n.init();

    // Wire language toggle button
    const langToggle = document.getElementById("langToggle");
    if (langToggle) {
      langToggle.addEventListener("click", function () {
        i18n.toggleLanguage();
      });
    }

    // PF-L7: Initialize auto-translate toggle
    const toggle1 = $("#autoTranslateToggle1");
    const toggle2 = $("#autoTranslateToggle2");
    const savedAutoTranslate = global.PF.Translate ? global.PF.Translate.getEnabled() : true;
    state.autoTranslate = savedAutoTranslate;

    function syncAutoTranslateToggles(checked) {
      if (toggle1) toggle1.checked = checked;
      if (toggle2) toggle2.checked = checked;
    }

    function onAutoTranslateChange(e) {
      const checked = e.target.checked;
      state.autoTranslate = checked;
      if (global.PF.Translate) global.PF.Translate.setEnabled(checked);
      syncAutoTranslateToggles(checked);
    }

    syncAutoTranslateToggles(savedAutoTranslate);
    if (toggle1) toggle1.addEventListener("change", onAutoTranslateChange);
    if (toggle2) toggle2.addEventListener("change", onAutoTranslateChange);

    initComboboxes();
    bindInputs();
    initColorPalette();
    initEffects();
    initComposition();
    initRendering();
    initExpansion();
    initAiPreset();
    initAspectRatios();
    initWatermarkPosition();   // Issue #8
    initSubjects();            // Issue #10
    initMotionStrength();      // PF-L2 Video
    initLoop();                // PF-L2 Video
    initDropzone("subject-dropzone", "subject-file", "subject-previews", "subjectImages");
    initDropzone("background-dropzone", "background-file", "background-previews", "backgroundImages");
    wireButtons();
    initNav();
    setYear();
    renderHistory();
    renderFavorites();

    // Output Mode Toggle (PF-L2) — must run after all UI is initialized
    initOutputMode();

    // PF-L5: Wire internal functions for share.js
    if (window.PF && window.PF.Share && window.PF.Share.wireInternalFunctions) {
      window.PF.Share.wireInternalFunctions({
        syncUIFromState: syncUIFromState,
        renderOutput: renderOutput,
        renderHistory: renderHistory,
        renderFavorites: renderFavorites,
        toast: toast
      });
    }

    // PF-L5: Initialize share from URL hash
    if (window.PF && window.PF.Share && window.PF.Share.initShareFromHash) {
      window.PF.Share.initShareFromHash();
    }

    // Keyboard: Ctrl/Cmd+Enter generates
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doGenerate();
      }
    });

    // Welcome toast (localized)
    setTimeout(function () { toast(i18n.t("toast.welcome")); }, 500);
  }

  function startApp() {
    if (window.PF_DATA) {
      // Data already loaded (sync fallback or very fast)
      boot();
    } else {
      // Wait for async loader
      window.addEventListener("pf:data-ready", function onDataReady(e) {
        window.removeEventListener("pf:data-ready", onDataReady);
        boot();
      });
      window.addEventListener("pf:data-error", function onDataError(e) {
        window.removeEventListener("pf:data-error", onDataError);
        toast("Failed to load data: " + e.detail.message, "error");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
  } else {
    startApp();
  }

  // Expose for debugging
  global.PF.app = { state: state, generate: doGenerate };

})(typeof window !== "undefined" ? window : this);
