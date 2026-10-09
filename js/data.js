/* =========================================================
   PromptForge — data.js (Loader)
   Fetches JSON modules from data/ and exposes window.PF_DATA
   Maintains backward compatibility with the original PF_DATA shape.
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------- Utility: fetch JSON with error handling ---------- */
  async function fetchJSON(path) {
    const resp = await fetch(path, { cache: "no-cache" });
    if (!resp.ok) throw new Error("Failed to load " + path + ": " + resp.status);
    return resp.json();
  }

  /* ---------- Indonesian translation dictionary (unchanged) ---------- */
  const ID_MARKER_WORDS = [
    "yang", "dan", "atau", "di", "ke", "dari", "untuk", "pada", "dengan",
    "adalah", "ini", "itu", "saya", "kamu", "dia", "mereka", "kita",
    "kami", "akan", "sudah", "telah", "bisa", "dapat", "harus", "juga",
    "tidak", "bukan", "jangan", "seorang", "sebuah", "para", "sang",
    "sih", "lah", "kah", "pun", "nya"
  ];

  const EN_ID_DICT = {
    "a": "seorang", "an": "seorang", "the": "", "of": "", "in": "di",
    "on": "di", "at": "di", "with": "dengan", "and": "dan", "or": "atau",
    "to": "ke", "from": "dari", "for": "untuk", "by": "oleh",
    "under": "di bawah", "above": "di atas", "near": "dekat", "far": "jauh",
    "into": "ke dalam", "onto": "ke atas", "over": "di atas", "between": "di antara",
    "through": "melalui", "during": "selama", "before": "sebelum", "after": "setelah",
    "is": "adalah", "are": "adalah", "was": "adalah", "were": "adalah",
    "be": "menjadi", "being": "menjadi", "been": "telah menjadi",
    "has": "memiliki", "have": "memiliki", "had": "memiliki",
    "do": "melakukan", "does": "melakukan", "did": "melakukan",
    "this": "ini", "that": "itu", "these": "ini", "those": "itu",
    "as": "sebagai", "like": "seperti", "than": "dari", "then": "kemudian",
    "but": "tapi", "however": "namun", "because": "karena", "so": "jadi",
    "if": "jika", "when": "ketika", "while": "saat", "where": "di mana",
    "what": "apa", "who": "siapa", "which": "yang mana",
    "warrior": "prajurit", "soldier": "tentara", "knight": "kesatria",
    "king": "raja", "queen": "ratu", "prince": "pangeran", "princess": "putri",
    "wizard": "penyihir", "witch": "penyihir perempuan", "mage": "penyihir",
    "hero": "pahlawan", "villain": "penjahat", "hunter": "pemburu",
    "dragon": "naga", "monster": "monster", "demon": "iblis", "angel": "malaikat",
    "ghost": "hantu", "spirit": "roh", "phoenix": "feniks", "unicorn": "unicorn",
    "wolf": "serigala", "lion": "singa", "tiger": "harimau", "bear": "beruang",
    "eagle": "elang", "hawk": "elang", "owl": "burung hantu", "raven": "gagak",
    "horse": "kuda", "cat": "kucing", "dog": "anjing", "bird": "burung",
    "fish": "ikan", "snake": "ular", "spider": "laba-laba",
    "castle": "kastil", "fortress": "benteng", "tower": "menara", "cave": "gua",
    "city": "kota", "village": "desa", "town": "kota kecil", "kingdom": "kerajaan",
    "forest": "hutan", "jungle": "hutan belantara", "mountain": "gunung",
    "ocean": "samudra", "sea": "laut", "river": "sungai", "lake": "danau",
    "waterfall": "air terjun", "island": "pulau", "desert": "gurun",
    "valley": "lembah", "cliff": "tebing", "rock": "batu", "stone": "batu",
    "tree": "pohon", "flower": "bunga", "grass": "rumput", "leaf": "daun",
    "sky": "langit", "cloud": "awan", "star": "bintang", "moon": "bulan",
    "sun": "matahari", "planet": "planet", "galaxy": "galaksi",
    "fire": "api", "water": "air", "wind": "angin", "earth": "tanah",
    "ice": "es", "snow": "salju", "rain": "hujan", "storm": "badai",
    "thunder": "guntur", "lightning": "kilat", "fog": "kabut", "mist": "kabut",
    "light": "cahaya", "shadow": "bayangan", "darkness": "kegelapan",
    "night": "malam", "day": "siang", "morning": "pagi", "evening": "sore",
    "dawn": "fajar", "dusk": "senja", "midnight": "tengah malam", "noon": "tengah hari",
    "sword": "pedang", "shield": "perisai", "bow": "busur", "arrow": "panah",
    "axe": "kapak", "spear": "tombak", "dagger": "belati", "staff": "tongkat",
    "armor": "baju zirah", "helmet": "helm", "crown": "mahkota", "cape": "jubah",
    "robe": "jubah", "cloak": "mantel",
    "book": "buku", "scroll": "gulungan", "crystal": "kristal", "gem": "permata",
    "gold": "emas", "silver": "perak", "iron": "besi", "steel": "baja",
    "wood": "kayu", "metal": "logam", "glass": "kaca", "silk": "sutra",
    "ship": "kapal", "boat": "perahu", "car": "mobil", "cart": "gerobak",
    "building": "gedung", "bridge": "jembatan", "road": "jalan", "path": "jalur",
    "garden": "taman", "temple": "kuil", "church": "gereja", "shrine": "altar",
    "throne": "tahta", "door": "pintu", "window": "jendela", "wall": "dinding",
    "floor": "lantai", "ceiling": "langit-langit", "roof": "atap",
    "beautiful": "indah", "ugly": "jelek", "dark": "gelap", "bright": "terang",
    "epic": "epik", "mysterious": "misterius", "ancient": "kuno", "modern": "modern",
    "futuristic": "futuristik", "magical": "magis", "mystical": "mistis",
    "powerful": "kuat", "weak": "lemah", "brave": "berani", "cowardly": "penakut",
    "lone": "kesepian", "solitary": "sendiri", "lonely": "kesepian",
    "big": "besar", "small": "kecil", "huge": "raksasa", "tiny": "mungil",
    "giant": "raksasa", "massive": "masif", "old": "tua", "new": "baru",
    "young": "muda", "ancient": "kuno", "fresh": "segar",
    "red": "merah", "blue": "biru", "green": "hijau", "yellow": "kuning",
    "black": "hitam", "white": "putih", "purple": "ungu", "orange": "oranye",
    "pink": "merah muda", "brown": "coklat", "gray": "abu-abu", "grey": "abu-abu",
    "gold": "emas", "silver": "perak", "crimson": "merah tua", "scarlet": "merah cerah",
    "azure": "biru langit", "emerald": "hijau zamrud", "violet": "ungu tua",
    "tall": "tinggi", "short": "pendek", "wide": "lebar", "narrow": "sempit",
    "long": "panjang", "round": "bulat", "square": "persegi", "sharp": "tajam",
    "smooth": "halus", "rough": "kasar", "soft": "lembut", "hard": "keras",
    "warm": "hangat", "cold": "dingin", "hot": "panas", "cool": "sejuk",
    "fast": "cepat", "slow": "lambat", "quick": "cepat", "sudden": "mendadak",
    "standing": "berdiri", "sitting": "duduk", "running": "berlari",
    "walking": "berjalan", "flying": "terbang", "jumping": "melompat",
    "fighting": "bertarung", "holding": "memegang", "looking": "melihat",
    "wearing": "mengenakan", "carrying": "membawa", "wielding": "menggenggam",
    "flying": "terbang", "swimming": "berenang", "climbing": "memanjat",
    "falling": "jatuh", "rising": "naik", "glowing": "bersinar",
    "burning": "membakar", "freezing": "membekukan", "shining": "bersinar",
    "smiling": "tersenyum", "crying": "menangis", "laughing": "tertawa",
    "sleeping": "tidur", "awake": "terjaga",
    "with": "dengan", "without": "tanpa", "having": "memiliki",
    "very": "sangat", "quite": "cukup", "extremely": "sangat",
    "and": "dan", "but": "tapi", "also": "juga",
    "two": "dua", "three": "tiga", "four": "empat", "five": "lima",
    "six": "enam", "seven": "tujuh", "eight": "delapan", "nine": "sembilan",
    "ten": "sepuluh", "many": "banyak", "few": "beberapa", "several": "beberapa",
    "all": "semua", "each": "setiap", "every": "setiap",
    "lone": "kesepian", "alone": "sendirian",
    "cliff": "tebing", "edge": "tepi", "top": "atas", "bottom": "bawah",
    "front": "depan", "back": "belakang", "side": "sisi",
    "inside": "di dalam", "outside": "di luar",
    "wearing": "mengenakan", "holding": "memegang"
  };

  function isIndonesian(text) {
    if (!text) return true;
    var words = text.toLowerCase().split(/[^a-z']+|(?=[A-Z])/).filter(Boolean);
    if (words.length === 0) return true;
    var hits = 0;
    for (var i = 0; i < words.length; i++) {
      if (ID_MARKER_WORDS.indexOf(words[i]) >= 0) hits++;
      if (hits >= 2) return true;
    }
    return false;
  }

  function translateToIndonesian(text) {
    if (!text || !text.trim()) {
      return { translated: text || "", changed: false, untranslated: [] };
    }
    if (isIndonesian(text)) {
      return { translated: text, changed: false, untranslated: [] };
    }
    var untranslated = [];
    var tokens = text.split(/(\s+|[^\w\s'-]+)/);
    var out = tokens.map(function (tok) {
      if (!tok) return tok;
      if (/^[\s]+$/.test(tok) || /^[^\w]+$/.test(tok)) return tok;
      var lower = tok.toLowerCase();
      if (EN_ID_DICT.hasOwnProperty(lower)) {
        var replacement = EN_ID_DICT[lower];
        if (tok[0] && tok[0] === tok[0].toUpperCase() && replacement) {
          replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      }
      untranslated.push(tok);
      return tok;
    });
    var translated = out.join("").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
    return { translated: translated, changed: true, untranslated: untranslated };
  }

  function colorName(hex) {
    const h = hex.replace("#", "").toLowerCase();
    const map = {
      "000000": "black", "ffffff": "white", "ff0000": "red", "00ff00": "green",
      "0000ff": "blue", "ffff00": "yellow", "ff00ff": "magenta", "00ffff": "cyan",
      "3b82f6": "electric blue", "ef4444": "crimson", "10b981": "emerald",
      "f59e0b": "amber", "8b5cf6": "violet", "ec4899": "pink", "14b8a6": "teal",
      "f97316": "orange", "84cc16": "lime", "06b6d4": "sky cyan", "a855f7": "purple"
    };
    if (map[h]) return map[h];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    if (max < 40) return "deep black";
    if (Math.min(r, g, b) > 230) return "soft white";
    if (r > g && r > b) return g > b ? "warm orange-red" : "pure red";
    if (g > r && g > b) return "vivid green";
    if (b > r && b > g) return "deep blue";
    return "neutral grey";
  }

  /* ---------- Main loader ---------- */
  async function loadAllData() {
    const [
      artStylesData,
      lightingData,
      backgroundsData,
      moodsData,
      colorPalettesData,
      effectsData,
      enrichmentsData,
      negativesData,
      projectTypesData,
      cameraAnglesData,
      aspectRatiosData,
      renderingQualityData,
      aiPresetsImageData,
      cameraMovementsData,
      transitionsData,
      durationsData,
      fpsOptionsData,
      motionStrengthData,
      aiPresetsVideoData
    ] = await Promise.all([
      fetchJSON("data/shared/art-styles.json"),
      fetchJSON("data/shared/lighting.json"),
      fetchJSON("data/shared/backgrounds.json"),
      fetchJSON("data/shared/moods.json"),
      fetchJSON("data/shared/color-palettes.json"),
      fetchJSON("data/shared/effects.json"),
      fetchJSON("data/shared/enrichments.json"),
      fetchJSON("data/shared/negatives.json"),
      fetchJSON("data/image/project-types.json"),
      fetchJSON("data/image/camera-angles.json"),
      fetchJSON("data/image/aspect-ratios.json"),
      fetchJSON("data/image/rendering-quality.json"),
      fetchJSON("data/image/ai-presets-image.json"),
      fetchJSON("data/video/camera-movements.json"),
      fetchJSON("data/video/transitions.json"),
      fetchJSON("data/video/durations.json"),
      fetchJSON("data/video/fps-options.json"),
      fetchJSON("data/video/motion-strength.json"),
      fetchJSON("data/video/ai-presets-video.json")
    ]);

    /* ---------- Compose PF_DATA in the exact shape the app expects ---------- */
    global.PF_DATA = {
      /* Project Type */
      PROJECT_TYPE: projectTypesData.projectTypes,

      /* Art Style + Typography + Composition + Watermark + Subject Importance + Prompt Expansion */
      ART_STYLE: artStylesData.artStyles,
      TYPOGRAPHY: artStylesData.typography,
      COMPOSITION: artStylesData.composition,
      WATERMARK_POSITIONS: artStylesData.watermarkPositions,
      SUBJECT_IMPORTANCE: artStylesData.subjectImportance,
      PROMPT_EXPANSION: artStylesData.promptExpansion,

      /* Camera Angle (image) */
      CAMERA_ANGLE: cameraAnglesData.cameraAngles,

      /* Lighting */
      LIGHTING: lightingData.lighting,

      /* Background */
      BACKGROUND: backgroundsData.backgrounds,

      /* Mood */
      MOOD: moodsData.moods,

      /* Effects */
      EFFECTS: effectsData.effects,

      /* Aspect Ratios */
      ASPECT_RATIOS: aspectRatiosData.aspectRatios,

      /* Rendering Quality */
      RENDERING_QUALITY: renderingQualityData.renderingQuality,

      /* AI Presets (image) */
      AI_PRESETS: aiPresetsImageData.aiPresets,

      /* Enrichment Rules */
      ENRICHMENT_RULES: enrichmentsData.enrichmentRules,

      /* Negatives */
      NEGATIVE_BASE: negativesData.negativeBase,
      NEGATIVE_BY_MOOD: negativesData.negativeByMood,
      NEGATIVE_VIDEO_BASE: negativesData.negativeVideoBase || [],

      /* Color palettes (for UI) */
      COLOR_PALETTES: colorPalettesData.palettes,

      /* Video data (stubs for PF-L1, will be wired in PF-L3) */
      CAMERA_MOVEMENTS: cameraMovementsData.cameraMovements,
      TRANSITIONS: transitionsData.transitions,
      DURATIONS: durationsData.durations,
      FPS_OPTIONS: fpsOptionsData.fpsOptions,
      MOTION_STRENGTH: motionStrengthData.motionStrength,
      LOOP_OPTIONS: motionStrengthData.loopOptions,
      AI_PRESETS_VIDEO: aiPresetsVideoData.aiPresets,

      /* Utility functions */
      colorName: colorName,
      translateToIndonesian: translateToIndonesian,
      isIndonesian: isIndonesian
    };

    /* Signal readiness */
    global.dispatchEvent(new CustomEvent("pf:data-ready", { detail: global.PF_DATA }));
  }

  /* Start loading immediately */
  loadAllData().catch(function (err) {
    console.error("[PromptForge] Data load failed:", err);
    global.dispatchEvent(new CustomEvent("pf:data-error", { detail: err }));
  });

})(typeof window !== "undefined" ? window : this);