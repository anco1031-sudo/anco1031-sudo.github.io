/* =========================================================
   PromptForge — generator.js
   Rule-based prompt generation engine.

   NOT a simple string concat. It:
   1. Collects every selected field into a structured state.
   2. Resolves phrase-equivalents for each selected option.
   3. Applies rule-based enrichment triggers (keyword → phrases).
   4. Layers rendering-quality boosts.
   5. Calibrates verbosity by Prompt Expansion level.
   6. Adapts to the chosen AI Preset (natural-language for
      ChatGPT/Flux/Gemini; parameter-tagged for Midjourney;
      tag-list + negative-prompt for SDXL).
   7. Generates a synchronized negative prompt.
   ========================================================= */
(function (global) {
  "use strict";

  const D = global.PF_DATA;

  function uniq(arr) {
    const seen = new Set();
    const out = [];
    arr.forEach(function (x) {
      const k = String(x).toLowerCase().trim();
      if (k && !seen.has(k)) { seen.add(k); out.push(x); }
    });
    return out;
  }

  function findIn(list, value) {
    if (!value) return null;
    return list.find(function (x) { return x.value === value; }) || null;
  }

  /* C3 FIX: Deep-copy state for history serialization (break circular ref with lastResult) */
  function cloneStateForHistory(state) {
    if (!state) return null;
    // Use structuredClone if available (modern browsers), fallback to JSON round-trip
    try {
      const cloned = structuredClone(state);
      // Remove lastResult to break cycle
      delete cloned.lastResult;
      return cloned;
    } catch (e) {
      // Fallback: manual clone excluding lastResult
      const sanitized = {};
      for (const key in state) {
        if (key === 'lastResult') continue;
        const val = state[key];
        if (Array.isArray(val)) {
          sanitized[key] = val.map(v => (v && typeof v === 'object') ? { ...v } : v);
        } else if (val && typeof val === 'object') {
          sanitized[key] = { ...val };
        } else {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }
  }

  /* Lookup phrase across all data lists */
  function phraseFor(kind, value) {
    if (!value) return null;
    let list;
    switch (kind) {
      case "artStyle":    list = D.ART_STYLE; break;
      case "cameraAngle": list = D.CAMERA_ANGLE; break;
      case "lighting":    list = D.LIGHTING; break;
      case "background":  list = D.BACKGROUND; break;
      case "mood":        list = D.MOOD; break;
      case "typography":  list = D.TYPOGRAPHY; break;
      case "effects":     list = D.EFFECTS; break;
      case "composition": list = D.COMPOSITION; break;
      default: return null;
    }
    const found = findIn(list, value);
    return found ? found.phrase : value;
  }

  function projectTypePhrase(category, preset, custom) {
    if (custom && custom.trim()) return custom.trim() + " artwork";
    if (preset) {
      const found = (D.PROJECT_TYPE[category] || []).find(function (p) { return p.value === preset; });
      if (found) return found.phrase;
      return preset.toLowerCase() + " artwork";
    }
    if (category) return category.toLowerCase() + " artwork";
    return null;
  }

  /* Apply rule-based enrichment */
  function applyRules(state) {
    const enrichment = [];
    // Build a haystack of all selected values + phrases
    const haystack = [
      state.projectTypeCustom,
      state.projectTypePreset,
      state.projectTypeCategory,
      state.artStyle,
      state.cameraAngle,
      state.lighting,
      state.background,
      state.mood,
      state.typography,
      (state.subjects || []).map(function (s) { return s.text; }).join(" "),
      state.customEffects
    ].filter(Boolean).join(" ").toLowerCase();

    D.ENRICHMENT_RULES.forEach(function (rule) {
      const hit = rule.triggers.some(function (t) {
        return haystack.includes(t.toLowerCase());
      });
      if (hit) rule.add.forEach(function (p) { enrichment.push(p); });
    });

    return uniq(enrichment);
  }

  /* Build a subject phrase from the multiple-subjects list (English only per §3.3). */
  function buildSubjectPhrase(state) {
    var subjects = state.subjects || [];
    var valid = subjects.filter(function (s) { return s && s.text && s.text.trim(); });
    if (valid.length === 0) return null;
    if (valid.length === 1) {
      return valid[0].text.trim();
    }
    // Multiple subjects: join with importance labels
    var parts = valid.map(function (s, i) {
      var importance = s.importance || (i === 0 ? "Primary" : "Secondary");
      var impPhrase = (D.SUBJECT_IMPORTANCE.find(function (x) { return x.value === importance; }) || {}).phrase || "subject";
      return impPhrase + ": " + s.text.trim();
    });
    return parts.join("; ");
  }

  /* Build the structured prompt payload */
  function buildPayload(state) {
    const parts = {
      subject:   buildSubjectPhrase(state),
      project:   projectTypePhrase(state.projectTypeCategory, state.projectTypePreset, state.projectTypeCustom),
      style:     state.artStyle ? phraseFor("artStyle", state.artStyle) : (state.artStyleCustom || null),
      camera:    state.cameraAngle ? phraseFor("cameraAngle", state.cameraAngle) : (state.cameraAngleCustom || null),
      lighting:  state.lighting ? phraseFor("lighting", state.lighting) : (state.lightingCustom || null),
      bg:        state.background ? phraseFor("background", state.background) : (state.backgroundCustom || null),
      mood:      state.mood ? phraseFor("mood", state.mood) : (state.moodCustom || null),
      typo:      state.typography ? phraseFor("typography", state.typography) : (state.typographyCustom || null),
      effects:   (state.effects || []).map(function (v) { return phraseFor("effects", v); }),
      customEffects: state.customEffects ? state.customEffects.split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean) : [],
      composition: state.composition ? phraseFor("composition", state.composition) : null,
      colors:    state.colors && state.colors.length ? state.colors.slice() : [],
      watermark: buildWatermarkPhrase(state),
      additional: state.additionalDescription && state.additionalDescription.trim() ? state.additionalDescription.trim() : null
    };

    const enrich = applyRules(state);

    // Rendering quality boost
    const rq = findIn(D.RENDERING_QUALITY, state.renderingQuality);
    const rqBoost = rq ? rq.boost.slice() : [];

    // Expansion level
    const exp = (D.PROMPT_EXPANSION.find(function (e) { return e.value === state.promptExpansion; }) || {}).weight || 0;

    return { parts: parts, enrich: enrich, rqBoost: rqBoost, expansion: exp };
  }

  /* Compose watermark instruction phrase */
  function buildWatermarkPhrase(state) {
    var text = state.watermarkText && state.watermarkText.trim();
    if (!text) return null;
    var pos = state.watermarkPosition || "Bottom Right";
    var posPhrase = (D.WATERMARK_POSITIONS.find(function (p) { return p.value === pos; }) || {}).phrase || "bottom-right watermark";
    var customPos = state.watermarkCustomPosition && state.watermarkCustomPosition.trim();
    var phrase = 'watermark text "' + text + '" at ' + posPhrase;
    if (customPos && pos === "Custom Position") {
      phrase += ' (' + customPos + ')';
    }
    return phrase;
  }

  /* Compose natural-language prompt (ChatGPT / Flux / Gemini) */
  function composeNatural(p) {
    const segs = [];
    if (p.parts.project) segs.push(p.parts.project);
    if (p.parts.subject) segs.push("of " + p.parts.subject);
    if (p.parts.style) segs.push("rendered in " + p.parts.style);

    // Pick "a" or "an" based on the next word's first sound
    function article(word) {
      if (!word) return "a";
      const w = String(word).trim().toLowerCase();
      if (/^[aeiou]/.test(w) && !/^(uni|use|eu)/.test(w)) return "an";
      return "a";
    }

    const scene = [];
    if (p.parts.camera) scene.push("shot from " + article(p.parts.camera) + " " + p.parts.camera);
    if (p.parts.lighting) scene.push("lit by " + p.parts.lighting);
    if (p.parts.bg) scene.push("set against " + article(p.parts.bg) + " " + p.parts.bg);
    if (p.parts.mood) scene.push("evoking " + article(p.parts.mood) + " " + p.parts.mood);
    if (scene.length) segs.push(scene.join(", "));

    // Combined effects (built-in + custom)
    var allEffects = (p.parts.effects || []).concat(p.parts.customEffects || []);
    if (allEffects.length) {
      segs.push("with " + allEffects.join(", "));
    }
    if (p.parts.composition) segs.push(p.parts.composition);

    // Colors
    if (p.parts.colors.length) {
      const names = p.parts.colors.map(function (c) { return D.colorName(c); });
      segs.push("using a " + (names.length === 1 ? "single " : "") + "palette of " + names.join(", "));
    }

    if (p.parts.typo) segs.push("with " + p.parts.typo);

    // Enrichment + quality (scaled by expansion)
    const tail = [];
    if (p.expansion >= 1) tail.push.apply(tail, p.enrich);
    if (p.expansion >= 1) tail.push.apply(tail, p.rqBoost);
    if (p.expansion >= 2) tail.push("professional color grading", "tight art direction");
    if (p.expansion >= 3) tail.push("intricate surface detail", "layered depth", "cinematic lens characteristics", "studio-grade post-production");

    if (tail.length) segs.push(uniq(tail).join(", "));

    // Watermark instruction
    if (p.parts.watermark) segs.push(p.parts.watermark);

    // Capitalize first letter, end with period
    let s = segs.filter(Boolean).join(", ").trim();
    if (s) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!/[.!?]$/.test(s)) s += ".";
    }

    // Append additional description verbatim
    if (p.parts.additional) {
      s = s ? s + " " + p.parts.additional : p.parts.additional;
    }
    return s;
  }

  /* Compose tag-list prompt (SDXL / general) */
  function composeTagList(p) {
    const tags = [];
    if (p.parts.project) tags.push(p.parts.project);
    if (p.parts.subject) tags.push(p.parts.subject);
    if (p.parts.style) tags.push(p.parts.style);
    if (p.parts.camera) tags.push(p.parts.camera);
    if (p.parts.lighting) tags.push(p.parts.lighting);
    if (p.parts.bg) tags.push(p.parts.bg);
    if (p.parts.mood) tags.push(p.parts.mood);
    if (p.parts.effects && p.parts.effects.length) tags.push.apply(tags, p.parts.effects);
    if (p.parts.customEffects && p.parts.customEffects.length) tags.push.apply(tags, p.parts.customEffects);
    if (p.parts.composition) tags.push(p.parts.composition);
    if (p.parts.colors.length) {
      const names = p.parts.colors.map(function (c) { return D.colorName(c) + " tones"; });
      tags.push.apply(tags, names);
    }
    if (p.parts.typo) tags.push(p.parts.typo);

    if (p.expansion >= 1) tags.push.apply(tags, p.enrich);
    if (p.expansion >= 1) tags.push.apply(tags, p.rqBoost);
    if (p.expansion >= 2) tags.push("professional color grading", "tight art direction");
    if (p.expansion >= 3) tags.push("intricate surface detail", "layered depth", "cinematic lens characteristics");

    if (p.parts.watermark) tags.push(p.parts.watermark);

    var s = uniq(tags).join(", ");
    if (p.parts.additional) {
      s = s ? s + ". " + p.parts.additional : p.parts.additional;
    }
    return s;
  }

  /* Compose Midjourney-style: natural-ish + --params */
  function composeMidjourney(p, state) {
    let base = composeNatural(p);
    const preset = D.AI_PRESETS.find(function (a) { return a.value === "Midjourney"; });
    // Stylize / quality
    const qualityMap = { Standard: " --q 1", High: " --q 2", Ultra: " --q 2 --stylize 500", Masterpiece: " --q 2 --stylize 750" };
    if (state.renderingQuality && qualityMap[state.renderingQuality]) base += qualityMap[state.renderingQuality];
    // Custom resolution overrides --ar
    if (state.customResolution && state.customResolution.trim()) {
      var cr = state.customResolution.trim().toLowerCase().replace(/\s/g, "");
      // Normalize 1920x1080 / 1920×1080 / 1920*1080 → 1920:1080
      cr = cr.replace(/[x×*]/g, ":");
      if (/^\d+:\d+$/.test(cr)) {
        base += " --ar " + cr;
      } else {
        base += ' --ar ' + cr; // pass through as-is
      }
    } else if (state.aspectRatio) {
      const ar = D.ASPECT_RATIOS.find(function (a) { return a.value === state.aspectRatio; });
      if (ar) {
        const parts = ar.value.split(":");
        if (parts.length === 2) base += " --ar " + parts[0] + ":" + parts[1];
        else base += " --ar 3:4"; // A4/A3 fallback
      }
    }
    base += preset.suffix;
    return base;
  }

  /* Compose video prompt — adds motion/time params before quality tail */
  function composeVideo(p, state) {
    const isVideo = state.outputMode === "video";
    if (!isVideo) return composeNatural(p);

    // Start with natural language base
    let base = composeNatural(p);

    // Get the active video preset for syntax style
    const preset = D.AI_PRESETS_VIDEO.find(function (a) { return a.value === state.aiPreset; });

    // Build motion/time values from user selections
    let cameraMovementPhrase = "";
    if (state.cameraMovement) {
      const cm = (D.CAMERA_MOVEMENTS || []).find(function (c) { return c.value === state.cameraMovement; });
      cameraMovementPhrase = cm ? cm.phrase : state.cameraMovement;
    } else if (state.cameraMovementCustom && state.cameraMovementCustom.trim()) {
      cameraMovementPhrase = state.cameraMovementCustom.trim();
    }

    let durationPhrase = "";
    let durationSeconds = "";
    if (state.duration) {
      const dur = (D.DURATIONS || []).find(function (d) { return d.value === state.duration; });
      durationPhrase = dur ? dur.phrase : state.duration;
      durationSeconds = state.duration.replace("s", "");
    } else if (state.durationCustom && state.durationCustom.trim()) {
      durationPhrase = state.durationCustom.trim() + " seconds";
      durationSeconds = state.durationCustom.trim();
    }

    let fpsPhrase = "";
    let fpsValue = "";
    if (state.fps) {
      const fps = (D.FPS_OPTIONS || []).find(function (f) { return f.value === state.fps; });
      // Minor fix: §5 — 24fps not "24 fps" for Runway/Pika
      fpsPhrase = fps ? fps.phrase.replace(/\s+fps$/, "fps") : state.fps + "fps";
      fpsValue = state.fps;
    }

    let motionStrengthPhrase = "";
    let motionStrengthValue = "";
    if (state.motionStrength) {
      const ms = (D.MOTION_STRENGTH || []).find(function (m) { return m.value === state.motionStrength; });
      motionStrengthPhrase = ms ? ms.phrase : state.motionStrength.toLowerCase();
      motionStrengthValue = state.motionStrength.toLowerCase();
    }

    let loopPhrase = "";
    if (state.loop) {
      const lp = (D.LOOP_OPTIONS || []).find(function (l) { return l.value === state.loop; });
      loopPhrase = lp ? lp.phrase : (state.loop.toLowerCase() === "on" ? "seamless loop" : "no loop");
    }

    let transitionPhrase = "";
    if (state.transition) {
      const tr = (D.TRANSITIONS || []).find(function (t) { return t.value === state.transition; });
      if (tr && tr.value !== "None") transitionPhrase = tr.phrase;
      else if (state.transition !== "None") transitionPhrase = state.transition.toLowerCase() + " transition";
    }

    // Aspect ratio
    let aspectLabel = "";
    let aspectRatioValue = "";
    if (state.customResolution && state.customResolution.trim()) {
      aspectLabel = state.customResolution.trim();
      const arMatch = aspectLabel.match(/(\d+)[:x×*](\d+)/i);
      if (arMatch) aspectRatioValue = arMatch[1] + ":" + arMatch[2];
    } else if (state.aspectRatio) {
      const ar = D.ASPECT_RATIOS.find(function (a) { return a.value === state.aspectRatio; });
      if (ar) {
        aspectLabel = ar.value;
        aspectRatioValue = ar.value;
      }
    }

    // Apply preset-specific syntax
    if (preset) {
      // For presets with paramStyle (Pika, Luma), use their suffix format with placeholder replacement
      if (preset.paramStyle) {
        let suffix = preset.suffix;
        // Replace motion strength placeholder
        if (motionStrengthValue) {
          suffix = suffix.replace(/motion strength:[^\s+]+/i, "motion strength:" + motionStrengthValue)
                         .replace(/--motion\s+\w+/i, "--motion " + motionStrengthValue);
        }
        // Replace duration placeholder
        if (durationSeconds) {
          suffix = suffix.replace(/--dur\s+\d+s?/i, "--dur " + durationSeconds + "s")
                         .replace(/duration\s+\d+s?/i, "duration " + durationSeconds + "s");
        }
        // Replace fps placeholder
        if (fpsValue) {
          suffix = suffix.replace(/--fps\s+\d+/i, "--fps " + fpsValue);
        }
        // Replace aspect ratio placeholder
        if (aspectRatioValue) {
          suffix = suffix.replace(/--ar\s+[\d:]+/i, "--ar " + aspectRatioValue);
        }
        base = base.replace(/[.!?]$/, "") + suffix;
      } else {
        // Natural language presets (Runway, Sora, Kling) — use preset suffix as template
        // Replace placeholders in preset suffix with user selections
        let suffix = preset.suffix || "";
        
        // Runway pattern: ", camera: slow dolly-in, motion: normal, duration 5s, 24fps, aspect 16:9"
        if (cameraMovementPhrase) {
          suffix = suffix.replace(/camera:\s*[^,]+/i, "camera: " + cameraMovementPhrase);
        }
        if (motionStrengthValue) {
          suffix = suffix.replace(/motion:\s*[^,]+/i, "motion: " + motionStrengthValue);
        }
        if (durationSeconds) {
          suffix = suffix.replace(/duration\s*\d+s?/i, "duration " + durationSeconds + "s");
        }
        if (fpsValue) {
          suffix = suffix.replace(/\d+fps/i, fpsValue + "fps");
        }
        if (aspectRatioValue) {
          suffix = suffix.replace(/aspect\s*[\d:]+/i, "aspect " + aspectRatioValue);
        }
        
        // Sora pattern: "Duration: 5 seconds, 24 fps, 16:9, seamless loop: no."
        if (durationPhrase) {
          suffix = suffix.replace(/Duration:\s*[^,]+/i, "Duration: " + durationPhrase);
        }
        if (fpsPhrase) {
          suffix = suffix.replace(/\d+\s*fps/i, fpsPhrase);
        }
        if (aspectRatioValue) {
          suffix = suffix.replace(/\d+:\d+/i, aspectRatioValue);
        }
        if (loopPhrase) {
          suffix = suffix.replace(/seamless loop:\s*\w+/i, "seamless loop: " + (loopPhrase === "seamless loop" ? "yes" : "no"));
        }
        
        // Kling pattern: ", professional cinematography, 5s, 30fps"
        if (durationSeconds) {
          suffix = suffix.replace(/\d+s\b/, durationSeconds + "s");
        }
        if (fpsValue) {
          suffix = suffix.replace(/\d+fps\b/, fpsValue + "fps");
        }

        // Append the processed suffix with proper separator
        if (suffix && suffix.trim()) {
          const trimmedBase = base.replace(/[.!?]$/, "");
          // If suffix doesn't start with comma/space, add one
          const needsSeparator = !/^[,\s]/.test(suffix.trim());
          base = trimmedBase + (needsSeparator ? ", " : "") + suffix.trim();
        } else {
          // Fallback: use our built motion parts
          const fallbackParts = [];
          if (cameraMovementPhrase) fallbackParts.push(cameraMovementPhrase);
          if (durationPhrase) fallbackParts.push(durationPhrase);
          if (fpsPhrase) fallbackParts.push(fpsPhrase);
          if (motionStrengthPhrase) fallbackParts.push("motion: " + motionStrengthPhrase);
          if (loopPhrase) fallbackParts.push(loopPhrase);
          if (transitionPhrase) fallbackParts.push(transitionPhrase);
          if (fallbackParts.length) {
            base = base.replace(/[.!?]$/, "") + ", " + fallbackParts.join(", ") + ".";
          }
        }
      }
    } else {
      // No preset selected — default natural language with motion parts
      const fallbackParts = [];
      if (cameraMovementPhrase) fallbackParts.push(cameraMovementPhrase);
      if (durationPhrase) fallbackParts.push(durationPhrase);
      if (fpsPhrase) fallbackParts.push(fpsPhrase);
      if (motionStrengthPhrase) fallbackParts.push("motion: " + motionStrengthPhrase);
      if (loopPhrase) fallbackParts.push(loopPhrase);
      if (transitionPhrase) fallbackParts.push(transitionPhrase);
      if (fallbackParts.length) {
        base = base.replace(/[.!?]$/, "") + ", " + fallbackParts.join(", ") + ".";
      }
    }

    // Add aspect ratio/resolution note for natural language models (if not already in suffix)
    if (aspectLabel && preset && preset.preferNatural && !/aspect|resolution/i.test(base.slice(-100))) {
      base += " Aspect ratio / resolution: " + aspectLabel + ".";
    } else if (aspectLabel && !preset && !/aspect|resolution/i.test(base.slice(-100))) {
      base += " Aspect ratio / resolution: " + aspectLabel + ".";
    }

    return base;
  }

  /* Negative prompt builder */
  function buildNegative(state, aiPreset) {
    const isVideo = state.outputMode === "video";
    const negBase = isVideo ? (D.NEGATIVE_VIDEO_BASE || D.NEGATIVE_BASE) : D.NEGATIVE_BASE;
    const neg = negBase.slice();
    
    if (state.mood && D.NEGATIVE_BY_MOOD[state.mood]) {
      neg.push.apply(neg, D.NEGATIVE_BY_MOOD[state.mood]);
    }
    if (state.effects && state.effects.length === 0 && !(state.customEffects && state.customEffects.trim())) {
      neg.push("excessive particle effects", "cluttered foreground");
    }
    // If watermark text is set, ensure the negative doesn't include "watermark"
    // (since we want a watermark, we should NOT add it to the negative list)
    var filtered = neg.filter(function (n) { return !/watermark/.test(n); });
    let out = uniq(filtered).join(", ");

    const presetsList = isVideo ? D.AI_PRESETS_VIDEO : D.AI_PRESETS;
    const preset = presetsList.find(function (a) { return a.value === aiPreset; });
    if (preset && preset.negativeSuffix) {
      // If user explicitly wants a watermark, strip "watermark" from negative suffix too
      var suffix = preset.negativeSuffix;
      if (state.watermarkText && state.watermarkText.trim()) {
        suffix = suffix.replace(/,?\s*watermark/gi, "");
      }
      out += suffix;
    }

    return out;
  }

  /* Main entry */
  function generate(state) {
    if (!state) return null;
    const payload = buildPayload(state);
    const isVideo = state.outputMode === "video";
    const presetsList = isVideo ? D.AI_PRESETS_VIDEO : D.AI_PRESETS;
    const preset = presetsList.find(function (a) { return a.value === state.aiPreset; }) || presetsList[0];

    let prompt;
    let aspectTag = "";
    if (state.aspectRatio) {
      const ar = D.ASPECT_RATIOS.find(function (a) { return a.value === state.aspectRatio; });
      if (ar) aspectTag = ar.param;
    }
    // Custom resolution overrides aspect tag
    let resolutionTag = aspectTag;
    if (state.customResolution && state.customResolution.trim()) {
      var cr = state.customResolution.trim().toLowerCase().replace(/\s/g, "").replace(/[x×*]/g, ":");
      if (/^\d+:\d+$/.test(cr)) {
        resolutionTag = "--ar " + cr + " (" + state.customResolution.trim() + ")";
      } else {
        resolutionTag = state.customResolution.trim();
      }
    }

    if (isVideo) {
      // Video mode: use composeVideo
      prompt = composeVideo(payload, state);
    } else if (preset.value === "Midjourney") {
      prompt = composeMidjourney(payload, state);
      // Midjourney already includes --ar inline
    } else if (preset.value === "SDXL") {
      prompt = composeTagList(payload);
      if (resolutionTag) prompt += "  (" + resolutionTag + ")";
      prompt += preset.suffix;
    } else {
      // ChatGPT / Flux / Gemini — natural language
      prompt = composeNatural(payload);
      if (resolutionTag && preset.preferNatural) {
        var ratioLabel = state.customResolution && state.customResolution.trim() ? state.customResolution.trim() : state.aspectRatio;
        prompt += " Aspect ratio / resolution: " + ratioLabel + ".";
      }
    }

    const negative = buildNegative(state, preset.value);

    // Build meta info
    const meta = [];
    if (state.aiPreset) meta.push({ label: "Preset", value: state.aiPreset });
    if (state.customResolution && state.customResolution.trim()) {
      meta.push({ label: "Resolution", value: state.customResolution.trim() });
    } else if (state.aspectRatio) {
      meta.push({ label: "Ratio", value: state.aspectRatio });
    }
    if (state.renderingQuality) meta.push({ label: "Quality", value: state.renderingQuality });
    if (state.promptExpansion) meta.push({ label: "Expansion", value: state.promptExpansion });
    if (payload.enrich.length) meta.push({ label: "Auto-enrichments", value: String(payload.enrich.length) });
    if (state.subjects && state.subjects.filter(function (s) { return s.text && s.text.trim(); }).length) {
      meta.push({ label: "Subjects", value: String(state.subjects.filter(function (s) { return s.text && s.text.trim(); }).length) });
    }
    if (state.watermarkText && state.watermarkText.trim()) meta.push({ label: "Watermark", value: state.watermarkPosition || "Bottom Right" });
    // Video-specific meta
    if (isVideo) {
      if (state.duration) meta.push({ label: "Duration", value: state.duration });
      else if (state.durationCustom) meta.push({ label: "Duration", value: state.durationCustom + "s" });
      if (state.fps) meta.push({ label: "FPS", value: state.fps + " fps" });
      if (state.motionStrength) meta.push({ label: "Motion", value: state.motionStrength });
      if (state.loop) meta.push({ label: "Loop", value: state.loop });
    }

    return {
      prompt: prompt,
      negative: negative,
      meta: meta,
      state: cloneStateForHistory(state),
      timestamp: Date.now()
    };
  }

  global.PF = global.PF || {};
  global.PF.Generator = { generate: generate };

})(typeof window !== "undefined" ? window : this);
