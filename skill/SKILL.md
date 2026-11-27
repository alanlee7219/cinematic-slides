---
name: cinematic-webgl-slides
description: Use when asked for a cinematic, animated HTML presentation (WebGL scene per slide, shader transitions), built as one offline file from the alanlee7219/cinematic-slides template.
---

# Cinematic WebGL slides

Build the deck as **one self-contained `index.html`**: raw WebGL2 + GLSL ES 3.00, Canvas 2D text, no libraries, no build step, no network at runtime. Always start from the template engine in `alanlee7219/cinematic-slides`; never rebuild the engine from scratch.

Use this only when the user wants this cinematic style. For an ordinary editable deck, use the normal slide tools instead.

## Get the template
1. Attach the repo (`add_repo` owner `alanlee7219`, repo `cinematic-slides`, read access) and clone it, or ask the user to attach `index.html`.
2. Copy `index.html`, `tests/` and `package.json` into the working folder.
3. Reference decks are for ideas only. Never copy their code, slide text, fonts, images or audio.

## Design concept
Three layers, always in this order:
1. **Scene**: one full-screen procedural fragment shader per slide (`bg`). It sets the mood and never carries information.
2. **Typography**: kicker, title and bullets drawn with Canvas 2D at device resolution, uploaded as a premultiplied texture and composited inside the scene shader (`withText()`), so text stays sharp.
3. **Transition**: a shader that reads the outgoing frame (`tA`), the incoming frame (`tB`) and progress `uP` 0 → 1. `tr` sits on the **outgoing** slide.

Restraint rules (these matter more than the shaders):
- One idea per slide. Titles ≤ 14 CJK characters (≈ 28 Latin); use `\n` for hero line breaks.
- ≤ 5 bullets, one line each on desktop. Each bullet is one step reveal.
- Strong contrast: dark scenes get light text with a soft shadow, light scenes get dark text with a white halo (`DARK` map). The shader adds a scrim behind the text zone.
- Backgrounds drift slowly. Big, fast motion only happens inside transitions, which last 1.1–2.2 s.
- Choose transitions by meaning. Save the loud ones (`slam`, `glitch`, `tear`) for real section changes.
- First slide is a hero (`layout: 'hero'` + `sub`); the last slide is a hero call to action.
- Write slide text in the user's language (default: Traditional Chinese, Cantonese tone, technical terms in English). Write speaker notes for every slide.

## Picking scenes and transitions
| Slide purpose | Scene | Transition out |
| --- | --- | --- |
| Opening, big vision | `space` | `portal` |
| Calm concept, "the idea" | `mountains` | `fold` |
| Writing, documents, process | `paper` | `tear` / `fold` |
| Fundamentals, "how it works" | `moon` | `wash` |
| Warm explanation, formula, story | `ocean` | `slam` |
| Busy system, many parts, data | `city` | `glitch` |
| Code, logs, engineering | `terminal` | `line` |
| Flow, rhythm, gentle progress | `aurora` | `dissolve` |
| Clarity, contrast, rules | `dunes` | `flaps` |
| Reliability, fallback, pause | `clouds` | `fade` |
| Performance, energy, numbers | `synthwave` | `wash` / `slam` |
| Creativity, extension, craft | `marble` | `fold` |
| Closing, thanks, call to action | `bokeh` | (last slide) |

Light scenes: `paper`, `dunes`, `clouds`. All others are dark. Use each scene at most twice per deck.

## Workflow
1. Edit `DECK_TITLE` and `SLIDES` at the top of the script:
   ```js
   { id: 'pricing', layout: 'list', bg: 'synthwave', tr: 'slam', accent: '#ff6ad5',
     kicker: 'Pricing', title: '三個 plan，一個價',
     body: ['Free：…', 'Pro：…', 'Team：…'],
     notes: 'Speaker notes, shown with N.' }
   ```
   - `id`: `[a-z0-9_]+`, unique; used in `#id-step` deep links.
   - `layout: 'hero'` uses `sub`; `'list'` uses `body` (each item is one step).
   - `accent`: hex colour for the kicker, bullets and transition rims. Pick a dark accent on light scenes.
2. Pick `bg` and `tr` from the table.
3. Preview a transition: `index.html?q=1&tr=wash&p=0.5&a=3&b=4` freezes the move from slide index 3 to 4 at p = 0.5 (indexes start at 0). `?q=1` locks full resolution.
4. Run the tests and look at every screenshot yourself.
5. Deliver the single `index.html` file. If the user wants a link, push it to their repo and enable GitHub Pages (Settings → Pages → branch `main`, root). Pages on a private repo needs a paid GitHub plan.

## Adding a scene
```js
const BG_FOREST = TEXT + `
void main(){
  vec2 p=camP();                 // aspect-correct coords, eased camera on step reveals
  vec3 col=mix(vec3(.02,.05,.03),vec3(.10,.22,.12),vUv.y);
  col+=vec3(.2,.4,.2)*fbm(p*3.+uTime*.01);
  o=vec4(withText(col),1.);      // scrim + text + grain/vignette
}`;
```
Then add `forest: mk(BG_FOREST)` to `buildPrograms().bg`, `forest: true` to `DARK`, a colour to `BG2D` (2D fallback) and a `#over .sw.forest` swatch in the CSS. Use `TEXT + STARS + …` if you need `starLayer()`.

Uniforms: `uTime` (s), `uAsp` (W/H), `uRes` (px), `uAccent` (rgb), `uCam` (0 → 1 across the slide's steps), `uDark`. Helpers: `hash12`, `hash13`, `vnoise`, `vnoise3`, `fbm` (5 octaves), `fbm3` (3 octaves), `fbmv` (3D), `easeIO`, `rot`, `scr`, `camP`, `post`. Portrait phones have `uAsp < 1`: move big objects (sun, moon, planet) below the text block.

## Adding a transition
```js
const TR_IRIS = `
uniform sampler2D tA,tB;
void main(){
  float e=easeIO(uP);
  float r=length((vUv-.5)*vec2(uAsp,1.));
  float m=1.-smoothstep(e*1.2-.03,e*1.2-.01,r);
  vec3 c=mix(texture(tA,vUv).rgb,texture(tB,vUv).rgb,m);
  o=vec4(c,1.);
}`;
```
Then add `iris: { dur: 1.4 }` to `TR` and `iris: mk(TR_IRIS)` to `buildPrograms().tr`.

Contract:
- `uP = 0` must show exactly A and `uP = 1` exactly B; fade every effect envelope to 0 at both ends.
- Going back plays the same shader with A/B swapped and `p = 1 − p`. Check that it still reads as sensible motion.
- `prefers-reduced-motion` forces a 0.45 s fade automatically.

## GLSL safety rules
- `#version 300 es` and `precision highp float;` (already in `HEAD`).
- `smoothstep(e0,e1,x)` only with `e0 < e1`; for the reverse write `1.-smoothstep(e0,e1,x)`.
- Never `pow()` a negative base; never `sqrt` or `log` a negative.
- Guard every division (`x/max(y,1e-4)`) and normalise only non-zero vectors.
- Inside a non-uniform `if`, in loops with `continue`, or after an early `return`, sample with `textureLod(tex,uv,0.)`.
- Loop bounds are compile-time constants, ≤ 48 iterations.
- No NaN or Inf; tone-map or clamp bright additive terms.
- A term that depends only on x (a crest highlight, a shadow edge) draws a vertical line down the whole screen. Fade it with depth.

## Performance budget
- Target 60 fps at 1920×1080 on a mid-range laptop iGPU.
- fbm ≤ 5 octaves (use `fbm3` for secondary detail), ≤ ~15 fbm calls per pixel, no raymarching.
- DPR is capped at 2 and total pixels at `MAX_PIX` (3.2 MP). Slow machines drop internal resolution automatically (−15% after ~2 s below 40 fps, minimum 55%).
- During a transition both slides render offscreen, so it costs about 2× a scene. Keep transition shaders light.
- `index.html` ≤ 250 KB.

## Testing
```sh
node tests/wrap.test.mjs       # CJK line breaking (keep the // wrap:begin and // wrap:end markers)
npm install && npx playwright install chromium
node tests/shots.mjs           # screenshots, error checks, keyboard walk
```
`tests/shots.mjs` launches Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. It screenshots each slide's last step at 1280×720 and 390×844 @2x and each transition at p = 0.25 / 0.5 / 0.75. It fails on console errors, page errors, shader failures or the 2D fallback, and walks the deck with the keyboard. Contact sheets go to `docs/screens/contact-*.jpg`. On Linux, install a CJK font (`fonts-noto-cjk`) first or the text renders as boxes.

If `npm install` is blocked (for example in a sandbox without network), run the same checks with whatever Playwright is installed, such as Python `playwright` with system Chrome and the same flags. Add `?q=1` to every URL so screenshots stay at full resolution.

## QA checklist
- [ ] `node tests/wrap.test.mjs` passes, and the screenshot run has no console, page or shader errors.
- [ ] Every slide is readable on desktop and phone: no text over busy highlights, no lone character on the last line, no clipped bullets.
- [ ] No seams, banding, blank frames or flicker in any scene.
- [ ] Every transition looks right at p = 0.25 / 0.5 / 0.75 and backwards (press ← on the next slide).
- [ ] Deep link `#id-step` reopens the same step after a refresh.
- [ ] N / O / F / ? / M / Esc, swipe and tap zones work.
- [ ] Reduced motion gives short fades; with WebGL2 off, the 2D fallback still shows readable text.
- [ ] The file is offline (no `http` URLs) and ≤ 250 KB, and every slide has speaker notes.
