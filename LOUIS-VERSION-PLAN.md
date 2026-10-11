# PromptForge-Louis — Analysis & Customization Plan
> Product Owner: Lin (หลิน) | Date: 2026-10-09 | Branch: `feat/louis-version-plan`
> Upstream: https://github.com/AzkiVIP/PromptForge (MIT — credit + LICENSE retained, see below)

## 0. วิธีรัน Local (Repo นี้รันได้แล้ว)

ต้นฉบับเป็น **static site ล้วน ไม่มี build step** — เปิดได้ 2 วิธี:

```bash
cd /home/lu5her/01-Projects/PromptForge-Louis
python3 -m http.server 8080
# → http://localhost:8080
```

หรือดับเบิลคลิกเปิด `index.html` ตรง ๆ ก็ได้ (แต่บางฟีเจอร์เช่น `manifest.json`/PWA ควรเสิร์ฟผ่าน http จะชัวร์กว่า)

## 1. Stack + โครงสร้างเดิม (ที่วิเคราะห์แล้ว)

| ชั้น | ไฟล์ | ขนาด | หน้าที่ |
|---|---|---|---|
| HTML | `index.html` | 698 บรรทัด | 14 accordion sections (01 Project Type → 14 Additional Description) + Output panel (Prompt/Negative/Meta/History/Favorites) |
| Data | `js/data.js` | 618 บรรทัด | Option libraries ทั้งหมด (`window.PF_DATA`): PROJECT_TYPE / ART_STYLE / CAMERA_ANGLE / LIGHTING / BACKGROUND / MOOD / TYPOGRAPHY / EFFECTS / ASPECT_RATIOS / COMPOSITION / RENDERING_QUALITY / PROMPT_EXPANSION / AI_PRESETS (5 ตัว: ChatGPT Images, Flux, SDXL, Midjourney, Gemini) / WATERMARK / SUBJECT_IMPORTANCE + **EN→Indonesian dictionary (hardcode ~200 คำ) + ENRICHMENT_RULES 14 ข้อ + NEGATIVE_BASE** |
| Engine | `js/generator.js` | 380 บรรทัด | `buildPayload → composeNatural / composeTagList / composeMidjourney + buildNegative` — rule-based enrichment, quality boost ตาม expansion level, negative sync ตาม mood |
| App | `js/app.js` | 1282 บรรทัด | Central `state` (ทุก field เริ่ม null/empty) + ComboBox wiring + color modes + copy/toast |
| History | `js/history.js` | 116 บรรทัด | localStorage `promptforge.history.v1` (cap 50, de-dupe 5 ล่าสุด) + `promptforge.favorites.v1` (cap 200) |
| UI | `js/combobox.js` + `js/accordion.js` | 400+98 บรรทัด | Custom combobox (single/multi) + accordion |
| Data (JSON) | `data/*.json` | 4 ไฟล์ | presets/moods/styles/poster-types — **ซ้ำซ้อนกับ `data.js` บางส่วน** (มีแค่ subset: camera/lighting/bg/effects/negative/palette/aspect/composition/quality/presets/expansion) |
| CSS | `css/` 3 ไฟล์ | ~1338 บรรทัด | style + components + responsive (dark theme) |
| SEO/PWA | `manifest.json`, `sitemap.xml`, `robots.txt`, `SEO.md` | — | พร้อม deploy GitHub Pages |

State หลัก (`app.js`): projectType{Category,Preset,Custom}, subjects[], artStyle, cameraAngle, lighting, colorMode/colors[], background, mood, typography, effects[]+customEffects, watermark{Position,Text}, aspectRatio/customResolution, composition, renderingQuality, promptExpansion, aiPreset, additionalDescription → lastResult

## 2. จุดแข็ง / จุดอ่อนของต้นฉบับ

**จุดแข็ง (เก็บไว้):**
1. Zero-dependency, zero-build — โคลนแล้วรันได้ทันที, deploy ฟรี (GitHub Pages)
2. Generator engine คิดมาดี: enrichment rules + quality scaling + preset-aware composers (natural vs tag-list vs MJ params) + negative sync
3. History/Favorites localStorage พร้อม de-dupe + cap — privacy-friendly (ไม่ส่งข้อมูลออกนอกเครื่อง)
4. Custom combobox รองรับ single/multi + custom free-text ทุก field — ยืดหยุ่นสูง
5. SEO/PWA ครบ (manifest, sitemap, OG image)

**จุดอ่อน (ต้องแก้ในเวอร์ชันเรา):**
1. **Data ซ้ำซ้อน 2 แหล่ง** (`data.js` vs `data/*.json` ไม่ตรงกัน) — เสี่ยงแก้ที่ไม่ครบ, ไม่มี single source of truth
2. **EN→Indonesian dictionary hardcode ในโค้ด** — ถ้าจะทำไทยต้องรื้อ; ควรเป็น i18n JSON แยกภาษา UI ออกจากภาษา prompt
3. **Image-only** — ไม่มีแนวคิด video (duration/motion/camera movement) เลย; AI presets มีแค่ 5 ตัวสาย image
4. **app.js 1282 บรรทัดไฟล์เดียว** — wiring ทุก section รวมกัน แยกเทส/แก้ยาก
5. **History ค้นหาไม่ได้** (ไม่มี search/filter), ไม่มี export/import/share — ล็อกอินเครื่องเดียวหายคือหายเลย
6. Copy มีแค่ปุ่มเดียวต่อ block — ไม่มี one-click แยกตาม model syntax (MJ `--ar` vs SDXL tags)
7. Rebrand: ชื่อ/logo/accent + ภาษา + SEO ยังเป็นของต้นฉบับทั้งหมด

## 3. แผน Customization เป็นเวอร์ชัน Louis

### 3.1 Rebrand (P0 — เร็ว, ทำก่อน)
- ชื่อ: `PromptForge-Louis` / โลโก้ใหม่ใน `assets/` + `favicon` + `og-image.png`
- Accent color + ฟอนต์ที่รองรับไทย (เช่น Noto Sans Thai / IBM Plex Sans Thai) ใน CSS variables
- `README.md`, `manifest.json`, `SEO.md`, `sitemap.xml` เปลี่ยนเป็นของเรา + **คง `LICENSE` (MIT) + credit block "Based on PromptForge by AzkiVIP" ใน README + footer**

### 3.2 โครงสร้างโค้ดใหม่ — Single Source of Truth (P0)
```
data/
  shared/   art-styles.json  lighting.json  backgrounds.json  moods.json
            color-palettes.json  effects.json  enrichments.json  negatives.json
  image/    project-types.json  camera-angles.json  aspect-ratios.json
            rendering-quality.json  ai-presets-image.json
  video/    camera-movements.json  transitions.json  durations.json
            fps-options.json  motion-strength.json  ai-presets-video.json
  i18n/     en.json  th.json   (UI strings — แยกจาก prompt language)
js/  state.js  generator-image.js  generator-video.js  generator-shared.js  history-v2.js  share.js
```
- `js/data.js` เดิม → เหลือแค่ loader (fetch JSON + expose `PF_DATA`) + migration shim
- `data/*.json` เดิม 4 ไฟล์ → ย้ายเข้าโครงใหม่แล้วลบของเก่า (กันแก้ซ้ำซ้อน)
- คง vanilla static (ไม่ขึ้น Vite) — เหตุผล: deploy ง่ายเหมือนเดิม, ทีมแก้ได้โดยไม่ต้องรู้ build; ถ้าไฟล์ JS เกิน ~2000 บรรทัดรวมค่อยพิจารณา ES modules (importmap, ยังไม่ต้อง build)

### 3.3 i18n ไทย–อังกฤษ (P1)
- `data/i18n/{en,th}.json` เก็บเฉพาะ **UI strings** (labels, placeholders, buttons)
- **Prompt output ยังเป็นภาษาอังกฤษเสมอ** (model เข้าใจดีที่สุด) — เอา EN→ID dictionary เดิมออก แล้วแทนด้วยโน้ต "พิมพ์ subject ภาษาไทยได้ ระบบแนบคำแปลอังกฤษกำกับ" (phase หลังค่อยต่อ LibreTranslate API แบบ opt-in)
- Toggle TH/EN มุมขวาบน เก็บใน localStorage

## 4. UX สำหรับ Video / Image Toggle (สำคัญ — Louis ขอ)

### 4.1 Pattern ที่เลือก: **Section 00 — Output Mode (Segmented Control ติดบนสุด)**
- เปิดเว็บมาเจอ `00 · Output Mode: [🖼️ Image | 🎬 Video]` เป็น segmented control เต็มความกว้าง เหนือ accordion 01
- เลือกแล้ว: (a) sections ที่ไม่เกี่ยวถูกซ่อนพร้อม animation, (b) AI preset list สลับชุด (image 5 ตัว ↔ video 5 ตัว), (c) output panel เปลี่ยน label + suffix hint, (d) state เก็บ `outputMode` และคงค่าฝั่งที่ซ่อนไว้ (สลับกลับมาไม่หาย)
- ทำไมไม่ใช้ modal ตอนเข้าเว็บ: กวนใจ + แชร์ URL แล้วต้องข้าม modal ทุกครั้ง; segmented control แชร์ state ผ่าน URL hash ได้ (`#m=video`) และสลับโหมดทดลองได้ในคลิกเดียว

### 4.2 Field Matrix — 14 Sections เดิม × 2 โหมด

| # | Section เดิม | Image | Video | หมายเหตุ |
|---|---|---|---|---|
| 00 | **Output Mode (ใหม่)** | — | — | segmented control, มีผลทั้งฟอร์ม |
| 01 | Project Type | ✅ shared | ✅ shared | เพิ่มหมวด video: YouTube Shorts / TikTok / Cinematic B-roll / Product Teaser / MV |
| 02 | Subject | ✅ shared | ✅ shared | เหมือนเดิม |
| 03 | Art Style | ✅ shared | ✅ shared | เหมือนเดิม |
| 04 | Camera Angle | ✅ image-only | 🔀 → **Camera Movement** | video ใช้: Static / Pan L-R / Tilt / Dolly-in / Dolly-out / Orbit / Crane-up / Handheld shake / FPV dive |
| 05 | Lighting | ✅ shared | ✅ shared | เหมือนเดิม |
| 06 | Color Palette | ✅ shared | ✅ shared | เหมือนเดิม |
| 07 | Background | ✅ shared | ✅ shared | เหมือนเดิม |
| 08 | Mood | ✅ shared | ✅ shared | เหมือนเดิม |
| 09 | Typography | ✅ shared | ⚠️ collapsed by default | วิดีโอมี title card ได้แต่ไม่บ่อย → พับไว้ |
| 10 | Effects | ✅ shared | ✅ shared | เพิ่ม video FX: slow-motion, timelapse, light-leak transition, film grain motion |
| 11 | Watermark | ✅ shared | ⚠️ collapsed by default | เหตุผลเดียวกับ typography |
| 12 | Aspect Ratio | ✅ (1:1/4:5/2:3/3:2/21:9/A4/A3) | ✅ (**16:9 / 9:16** ขึ้นก่อน + 1:1) | video ตัด A4/A3 ออก |
| 13a | Advanced: Composition | ✅ shared | ✅ shared | — |
| 13b | Rendering Quality | ✅ (Standard→Masterpiece) | 🔀 → **Quality+FPS hint** | video ไม่ใช้ `--q/--stylize`; แสดงเป็น quality label ใน prompt ธรรมชาติ |
| 13c | AI Preset | ✅ ชุด image (5) | ✅ ชุด video (5, ดู §5) | สลับตามโหมด |
| **V1** | **Duration (ใหม่, video-only)** | — | ✅ 2s / 3s / 5s / 10s + custom | วางหลัง Aspect (12) |
| **V2** | **FPS (ใหม่, video-only)** | — | ✅ 24 / 30 / 60 | วางคู่ Duration |
| **V3** | **Motion Strength (ใหม่)** | — | ✅ Subtle / Normal / Dynamic + Loop toggle | วางคู่ Camera Movement |
| **V4** | **Transition (ใหม่)** | — | ✅ Cut / Fade / Dissolve / Morph / Whip-pan / None | เฉพาะ multi-scene; optional |
| 14 | Additional Description | ✅ shared | ✅ shared | เหมือนเดิม |

### 4.3 Wireframe (text) — โหมด Image
```
[Header: logo PromptForge-Louis | TH/EN toggle]
[00 Output Mode: (● Image) (○ Video)]
[01 Project Type ▾] [02 Subject ▾] [03 Art Style ▾] [04 Camera Angle ▾]
[05 Lighting ▾] [06 Color Palette ▾] [07 Background ▾] [08 Mood ▾]
[09 Typography ▾] [10 Effects ▾] [11 Watermark ▾]
[12 Aspect Ratio: 1:1 4:5 16:9 9:16 2:3 3:2 21:9 (+custom px)]
[13 Advanced: composition | quality | expansion | AI preset(image×5)]
[14 Additional Description ............]
[Generate]  →  [Prompt (+copy MJ/SDXL/natural)] [Negative + copy] [meta chips]
              [History + search] [Favorites]
```

### 4.4 Wireframe (text) — โหมด Video
```
[Header: เหมือนเดิม]
[00 Output Mode: (○ Image) (● Video)]
[01 Project Type (มีหมวด Shorts/TikTok/B-roll) ▾] [02 Subject ▾] [03 Art Style ▾]
[V0 Camera Movement: Static Pan Tilt Dolly-in Orbit Crane Handheld FPV ▾]  ← แทน 04
[05 Lighting ▾] [06 Color Palette ▾] [07 Background ▾] [08 Mood ▾]
[10 Effects (+slow-mo/timelapse) ▾]
[V1 Duration: 2s 3s 5s 10s custom] [V2 FPS: 24 30 60]
[V3 Motion: Subtle Normal Dynamic] [Loop: off/on] [V4 Transition: ...]  ← section ใหม่ "Motion & Time"
[09 Typography (collapsed)] [11 Watermark (collapsed)]
[12 Aspect: 16:9 9:16 1:1] [13 Advanced: composition | expansion | AI preset(video×5)]
[14 Additional Description ............]
[Generate]  →  [Video Prompt: "..., slow dolly-in, 5s, 24fps, --motion normal" + copy per model]
              [Negative (video-tuned: warping, morphing faces, flicker...)] [meta: duration/fps/motion]
```

## 5. Prompt Suffix / Model Presets (Video vs Image)

### Image (คงเดิม 5 + ปรับนิดหน่อย)
| Preset | Suffix / Syntax |
|---|---|
| ChatGPT Images / Flux / Gemini | natural language + `Aspect ratio: X.` |
| SDXL | tag-list + `, masterpiece, best quality, highly detailed` / negative ยาวเดิม |
| Midjourney | natural + `--q/--stylize/--ar W:H --v 6 --style raw` |

### Video (ใหม่ 5)
| Preset | Suffix / Syntax | Negative เสริม |
|---|---|---|
| Runway Gen-3 | `, camera: slow dolly-in, motion: normal, duration 5s, 24fps, aspect 16:9` + `--style cinematic` ถ้ามี | `warping, morphing, flicker, extra limbs, inconsistent face` |
| Pika | `/create + motion strength:X + --ar 16:9 --fps 24 --dur 5s` | เดียวกับ Runway + `sudden cuts` |
| Sora (concept) | natural paragraph ลงท้าย `Duration: 5 seconds, 24 fps, 16:9, seamless loop: no.` | `physics violations, teleporting objects` |
| Kling | natural + `, professional cinematography, 5s, 30fps` | `blurry motion, frame blending artifacts` |
| Luma Dream Machine | natural + ` --motion {subtle\|normal\|dynamic}` | `temporal flicker, shape-shifting` |

Engine: เพิ่ม `composeVideo(payload, videoState)` ต่อจาก `composeNatural` — ประกบ motion/timeประโยคก่อน quality tail; negative ใช้ `NEGATIVE_VIDEO_BASE` ชุดใหม่แยกจาก `NEGATIVE_BASE` เดิม

## 6. Improvements เพิ่มเติม (มุม Product Owner — 7 ข้อ)

1. **Copy one-click ต่อ model syntax** — ปุ่ม Copy แยก 3 แบบใต้ output (Natural / MJ-params / SDXL-tags; ฝั่ง video แยก Runway/Pika/Sora/Kling/Luma) + ปุ่ม "Copy All (prompt+negative+settings)"
2. **Preset Bundles (one-click looks)** — บันเดิลสำเร็จรูป เช่น "Cinematic Portrait", "Anime Poster", "TikTok Food 9:16", "SaaS Hero" — กดทีเดียวตั้งค่า 8–10 fields พร้อมกัน (เก็บเป็น JSON ใน `data/bundles/*.json`, ปุ่ม Save current as bundle)
3. **Export / Import JSON** — ปุ่ม Export state+history เป็น `.json`, Import กลับมาได้ (ย้ายเครื่องไม่หาย, แชร์ค่ากับเพื่อนได้)
4. **Share URL hash** — เข้ารหัส state เป็น `#s=<base64>` (ฝั่ง video รวม motion params) — เปิดลิงก์แล้วฟอร์ม + output เหมือนเดิมทันที + ปุ่ม Copy Link
5. **History search + filter** — ช่องค้นหา + filter ตาม mode (image/video) + preset + ปุ่ม restore เป็น draft (แก้ต่อได้ ไม่ใช่แค่ดู)
6. **Randomize / Surprise me + Lock** — ปุ่มสุ่มค่าพร้อม 🔒 ล็อก field ที่ไม่อยากเปลี่ยน (เช่น ล็อก subject ไว้แล้วสุ่ม style/lighting) — ช่วยงาน ideation มาก
7. **Prompt quality meter + token estimate** — แถบแสดงความครบของฟอร์ม (ตั้งไปกี่ % ของ 14 ข้อ) + ประมาณ token length เตือนเมื่อยาวเกิน limit ของ model ที่เลือก

## 7. Tickets สำหรับรอบถัดไป (พร้อมสั่ง Pao/An/Mint)

| Ticket | เจ้าของ | งาน | Acceptance |
|---|---|---|---|
| PF-L1 | An | Data split: `data.js` → JSON modules ตาม §3.2 + loader + ลบ `data/*.json` เก่า | `index.html` เปิดผ่าน http แล้ว option ครบเท่าเดิม, ไม่มี regression |
| PF-L2 | Pao | Section 00 Output Mode toggle + `outputMode` ใน state + ซ่อน/แสดง sections ตาม matrix §4.2 (คงค่าฝั่งซ่อน) | สลับโหมดแล้ว fields ถูกชุด, ค่าไม่หาย, `#m=` deep-link ได้ |
| PF-L3 | Pao | Video fields ใหม่ (V0–V4: movement/duration/fps/motion/loop/transition) + `composeVideo` + 5 video presets ตาม §5 | Generate ฝั่ง video ได้ prompt+negative ถูก syntax ครบ 5 models |
| PF-L4 | Mint | Rebrand (logo/assets/fonts TH/accent) + TH/EN toggle (UI strings JSON) | สลับภาษาแล้ว UI เปลี่ยน, prompt ยังอังกฤษ, credit upstream อยู่ครบ |
| PF-L5 | Pao | Improvements ข้อ 1+3+4 (copy-per-model, export/import, share URL) | ปุ่มทำงานจริง + test ด้วย URL ข้าม browser |
| PF-L6 | Pao+Fah | Improvements ข้อ 5+6+7 (search/filter, randomize+lock, meter) + regression test 14 sections เดิม | Fah sign-off ก่อน merge main |

## 8. License & Credit (ห้ามลบ)
- ต้นฉบับ © 2026 PromptForge, MIT License — ไฟล์ `LICENSE` ยังอยู่ครบ ไม่แตะต้อง
- `README.md` + footer ของเวอร์ชัน Louis ต้องมีบรรทัด: `Based on [PromptForge by AzkiVIP](https://github.com/AzkiVIP/PromptForge) (MIT).`
- การเปลี่ยนแปลงทั้งหมดทำบน branch `feat/louis-version-plan` นี้ก่อน merge

---
*Lin ตรวจ scope แล้ว: รอบนี้ส่งแค่แผน + prototype spec (ไม่実装) — ให้ Pao/An/Mint รับ tickets PF-L1…PF-L6 ต่อในรอบถัดไป*
