export type AuthPondPulseKind =
  | "focus"
  | "type"
  | "hover"
  | "submit"
  | "paste";

const MAX_RIPPLES = 6;
const MAX_LETTERS = 3;
const RIPPLE_LIFE = 1.15;
const LETTER_LIFE = 1.45;
const LETTER_TEX_SIZE = 160;

type Ripple = {
  x: number;
  y: number;
  born: number;
  strength: number;
  seed: number;
};

type LetterSplash = {
  x: number;
  y: number;
  born: number;
  strength: number;
  seed: number;
  /** Atlas / texture slot 0..MAX_LETTERS-1 */
  slot: number;
};

type PondState = {
  ripples: Ripple[];
  letters: LetterSplash[];
};

type PondRuntime = {
  spawnLetter: (char: string) => void;
  spawnEye: (kind: AuthPondEyeKind) => void;
};

const stateByCanvas = new WeakMap<HTMLCanvasElement, PondState>();
const runtimeByCanvas = new WeakMap<HTMLCanvasElement, PondRuntime>();

function ensureState(canvas: HTMLCanvasElement): PondState {
  let state = stateByCanvas.get(canvas);
  if (!state) {
    state = { ripples: [], letters: [] };
    stateByCanvas.set(canvas, state);
  }
  if (!state.letters) state.letters = [];
  return state;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function rippleAge(r: { born: number }, now: number): number {
  return (now - r.born) * 0.001;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const MIN_SPAWN_DIST = 0.38;

function pickSpawnPoint(
  state: PondState,
  now: number,
): { x: number; y: number } {
  const avoid = [
    ...state.ripples.filter((r) => rippleAge(r, now) < 1.2),
    ...state.letters.filter((r) => rippleAge(r, now) < 1.2),
  ].sort((a, b) => b.born - a.born);
  const last = avoid[0];

  let x = 0.5;
  let y = 0.5;
  let bestScore = -1;

  for (let attempt = 0; attempt < 28; attempt++) {
    let cx = randRange(0.06, 0.94);
    let cy = randRange(0.08, 0.92);
    if (
      cx > 0.34 &&
      cx < 0.66 &&
      cy > 0.3 &&
      cy < 0.7 &&
      Math.random() < 0.55
    ) {
      if (Math.random() < 0.5)
        cx = Math.random() < 0.5 ? randRange(0.05, 0.3) : randRange(0.7, 0.95);
      else
        cy = Math.random() < 0.5 ? randRange(0.06, 0.26) : randRange(0.74, 0.94);
    }

    let nearest = Infinity;
    for (const r of avoid) {
      nearest = Math.min(nearest, dist2(cx, cy, r.x, r.y));
    }
    if (last) {
      const fromLast = Math.sqrt(dist2(cx, cy, last.x, last.y));
      if (fromLast < MIN_SPAWN_DIST) continue;
      nearest = Math.min(nearest, fromLast * fromLast);
    }

    if (nearest > bestScore) {
      bestScore = nearest;
      x = cx;
      y = cy;
    }
  }

  return { x, y };
}

function pushRipple(state: PondState, ripple: Ripple): void {
  if (state.ripples.length < MAX_RIPPLES) {
    state.ripples.push(ripple);
    return;
  }
  let oldest = 0;
  for (let i = 1; i < state.ripples.length; i++) {
    const a = state.ripples[i];
    const b = state.ripples[oldest];
    if (a && b && a.born < b.born) oldest = i;
  }
  state.ripples[oldest] = ripple;
}

function spawnRipple(
  state: PondState,
  strength: number,
  now: number,
  at?: { x: number; y: number },
): void {
  const pos = at ?? pickSpawnPoint(state, now);
  pushRipple(state, {
    x: pos.x,
    y: pos.y,
    born: now,
    strength,
    seed: Math.random(),
  });
}

function paintLetterGlyph(ctx: CanvasRenderingContext2D, char: string): void {
  const s = LETTER_TEX_SIZE;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Soft stone silhouette — blurry edge for flowy water
  ctx.filter = "blur(5px)";
  const isUpper =
    char.length === 1 &&
    char === char.toUpperCase() &&
    char !== char.toLowerCase();
  const size = Math.floor(s * (isUpper ? 0.78 : 0.72));
  ctx.font = `700 ${size}px Syne, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(char, s / 2, s * (isUpper ? 0.54 : 0.56));
  ctx.filter = "none";
}

export type AuthPondEyeKind = "eye-open" | "eye-closed";

/** Soft eye blob — ripple seed, not a hard icon. */
function paintEyeGlyph(
  ctx: CanvasRenderingContext2D,
  kind: AuthPondEyeKind,
): void {
  const s = LETTER_TEX_SIZE;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.filter = "blur(6px)";

  const cx = s / 2;
  const cy = s / 2;
  const eyeW = s * 0.38;
  const eyeH = s * 0.22;
  ctx.lineWidth = s * 0.085;

  if (kind === "eye-open") {
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.bezierCurveTo(
      cx - eyeW * 0.35,
      cy - eyeH,
      cx + eyeW * 0.35,
      cy - eyeH,
      cx + eyeW,
      cy,
    );
    ctx.bezierCurveTo(
      cx + eyeW * 0.35,
      cy + eyeH,
      cx - eyeW * 0.35,
      cy + eyeH,
      cx - eyeW,
      cy,
    );
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - eyeW, cy);
    ctx.quadraticCurveTo(cx, cy - eyeH * 0.9, cx + eyeW, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - eyeW * 0.85, cy + eyeH * 0.1);
    ctx.quadraticCurveTo(cx, cy + eyeH * 0.35, cx + eyeW * 0.85, cy + eyeH * 0.1);
    ctx.stroke();
  }
  ctx.filter = "none";
}

/** Drop a candy-fluid rock into the white pond (circular / click interactions). */
export function pulseAuthPond(kind: AuthPondPulseKind): void {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "canvas[data-auth-pond][data-pond-live='1']",
  );
  if (!canvas) return;

  const state = ensureState(canvas);
  const now = performance.now();

  if (kind === "paste") {
    spawnRipple(state, 1.65, now, { x: 0.5, y: 0.5 });
    return;
  }

  const strength =
    kind === "submit"
      ? randRange(0.85, 1)
      : kind === "focus"
        ? randRange(0.55, 0.8)
        : kind === "type"
          ? randRange(0.4, 0.65)
          : randRange(0.35, 0.55);

  const count = kind === "submit" ? 2 : 1;

  for (let i = 0; i < count; i++) {
    spawnRipple(state, strength * (i === 0 ? 1 : randRange(0.55, 0.85)), now);
  }
}

/** @deprecated All interactions use circular ripples now. */
export function pulseAuthPondLetter(_char: string): void {
  pulseAuthPond("type");
}

/** @deprecated All interactions use circular ripples now. */
export function pulseAuthPondEye(_kind: AuthPondEyeKind): void {
  pulseAuthPond("hover");
}

const VS = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FS = `
  precision mediump float;
  uniform vec2 u_res;
  uniform float u_time;
  uniform vec4 u_r0;
  uniform vec4 u_r1;
  uniform vec4 u_r2;
  uniform vec4 u_r3;
  uniform vec4 u_r4;
  uniform vec4 u_r5;
  uniform float u_s0;
  uniform float u_s1;
  uniform float u_s2;
  uniform float u_s3;
  uniform float u_s4;
  uniform float u_s5;

  uniform sampler2D u_letter0;
  uniform sampler2D u_letter1;
  uniform sampler2D u_letter2;
  uniform vec4 u_l0;
  uniform vec4 u_l1;
  uniform vec4 u_l2;
  uniform float u_ls0;
  uniform float u_ls1;
  uniform float u_ls2;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = m * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  vec3 candyFluid(vec2 pc, float t) {
    pc *= 1.55;
    pc += vec2(sin(t * 1.1 + pc.y * 1.2), cos(t * 0.85 + pc.x * 1.0)) * 0.14;
    pc += vec2(cos(t * 0.55), sin(t * 0.7)) * 0.06;

    vec2 q = vec2(
      fbm(pc + vec2(0.0, t * 1.15)),
      fbm(pc + vec2(5.2, 1.3) - t * 1.1)
    );
    vec2 r = vec2(
      fbm(pc + 1.9 * q + vec2(1.7, 9.2) + t * 0.8),
      fbm(pc + 1.9 * q + vec2(8.3, 2.8) - t * 0.7)
    );
    float f = fbm(pc + 2.4 * r + vec2(t * 0.2, -t * 0.16));

    vec3 cream = vec3(1.0, 0.97, 0.82);
    vec3 lemon = vec3(1.0, 0.9, 0.22);
    vec3 gold = vec3(1.0, 0.78, 0.12);
    vec3 pink = vec3(1.0, 0.55, 0.85);
    vec3 lilac = vec3(0.92, 0.7, 1.0);
    vec3 orchid = vec3(0.82, 0.38, 0.98);
    vec3 purple = vec3(0.58, 0.2, 0.95);
    vec3 deep = vec3(0.4, 0.1, 0.75);

    vec3 fluid = mix(cream, lemon, smoothstep(0.02, 0.4, f));
    fluid = mix(fluid, gold, smoothstep(0.2, 0.65, q.y) * 0.9);
    fluid = mix(fluid, pink, smoothstep(0.25, 0.7, q.x) * 0.45);
    fluid = mix(fluid, lilac, smoothstep(0.1, 0.5, r.x) * 0.8);
    fluid = mix(fluid, orchid, smoothstep(0.25, 0.75, r.y) * 0.75);
    fluid = mix(fluid, purple, smoothstep(0.4, 0.9, q.x) * 0.7);
    fluid = mix(fluid, deep, smoothstep(0.55, 0.95, f) * 0.4);

    float blob = smoothstep(0.55, 0.85, fbm(pc * 0.9 + t * 0.3));
    fluid = mix(fluid, lemon, blob * 0.35);
    fluid += lemon * 0.28 * smoothstep(0.35, 0.9, q.y)
      * (0.45 + 0.55 * sin(t * 3.2 + f * 9.0));

    float luma = dot(fluid, vec3(0.299, 0.587, 0.114));
    fluid = mix(vec3(luma), fluid, 1.18);
    return clamp(fluid, 0.0, 1.0);
  }

  vec4 waveOf(vec2 p, float aspect, vec4 r) {
    float age = r.z;
    float str = r.w;
    if (str < 0.01 || age > 1.1) return vec4(0.0);

    vec2 o = vec2(r.x * aspect, r.y);
    vec2 pd = p - o;
    float dist = length(pd);
    vec2 nrm = pd * inversesqrt(dot(pd, pd) + 0.0003);

    float maxR = 0.2 + str * 0.2;
    if (dist > maxR + 0.04) return vec4(0.0);

    float env = smoothstep(0.0, 0.025, age) * (1.0 - smoothstep(0.55, 1.1, age));
    float radial = 1.0 - smoothstep(maxR * 0.5, maxR, dist);
    float damp = env * str * radial * exp(-age * 1.35);

    float front = age * 0.36;
    float crest = exp(-pow((dist - front) * 16.0, 2.0));
    float crest2 = exp(-pow((dist - front * 0.72) * 14.0, 2.0)) * 0.7;
    float crest3 = exp(-pow((dist - front * 0.48) * 12.0, 2.0)) * 0.45;

    float phase = dist * 38.0 - age * 20.0;
    float rings =
      sin(phase) * exp(-abs(dist - front) * 6.5) * 1.05
      + sin(phase * 0.72 + 0.8) * exp(-abs(dist - front * 0.78) * 5.5) * 0.75
      + sin(phase * 0.48 + 1.4) * exp(-abs(dist - front * 0.52) * 4.8) * 0.5
      + sin(dist * 22.0 - age * 14.0) * exp(-dist * 2.8) * exp(-age * 0.85) * 0.35;

    float core = exp(-dist * dist * 55.0) * exp(-age * 2.6) * 1.15;
    float height = (core + crest * 1.25 + crest2 * 0.7 + crest3 * 0.4 + rings) * damp;
    float ink =
      (core * 1.05 + crest * 1.05 + crest2 * 0.65 + crest3 * 0.4 + abs(rings) * 0.85)
      * damp;
    float amp = (rings * 0.85 + crest * 0.95 + crest2 * 0.5) * damp;
    vec2 disp = nrm * amp * 0.07;

    return vec4(height, clamp(ink, 0.0, 1.0), disp);
  }

  // Soft letter field with living fluid warp
  float letterField(sampler2D tex, vec2 local, float seed, float tw) {
    vec2 flow = vec2(
      fbm(local * 1.25 + vec2(seed * 5.5, tw * 0.55)),
      fbm(local * 1.25 + vec2(2.2 + seed * 3.9, -tw * 0.48))
    ) - 0.5;
    vec2 q = local + flow * 0.2;
    float ang = (fbm(q * 0.8 + seed) - 0.5) * 0.45;
    float ca = cos(ang);
    float sa = sin(ang);
    q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    vec2 tuv = q * 0.5 + 0.5;
    tuv.y = 1.0 - tuv.y;
    if (tuv.x < -0.1 || tuv.x > 1.1 || tuv.y < -0.1 || tuv.y > 1.1) return 0.0;
    float a = texture2D(tex, clamp(tuv, 0.0, 1.0)).r;
    float n = fbm(q * 1.9 + tw * 0.25 + seed);
    return smoothstep(0.08, 0.72, a) * (0.7 + 0.4 * n);
  }

  // Letter-shaped stone: ripples flow outward from the silhouette like real water
  vec2 letterWave(sampler2D tex, vec2 p, float aspect, vec4 L, float seed) {
    float age = L.z;
    float str = L.w;
    if (str < 0.01 || age > 1.35) return vec2(0.0);

    vec2 o = vec2(L.x * aspect, L.y);
    float glyphSize = 0.3 + str * 0.045;
    vec2 local = (p - o) / glyphSize;

    float tw = u_time * 0.65 + seed * 9.0;
    // Pond current — warps where ripples travel
    vec2 current = vec2(
      fbm(local * 0.9 + vec2(tw * 0.4, seed)),
      fbm(local * 0.9 + vec2(seed * 2.0, -tw * 0.35))
    ) - 0.5;
    vec2 flowLocal = local + current * (0.08 + age * 0.12);

    float r = length(flowLocal);
    if (r > 1.45) return vec2(0.0);

    float field = letterField(tex, flowLocal, seed, tw);

    // Silhouette radius along this ray (soft stone edge)
    float ang = atan(flowLocal.y, flowLocal.x);
    ang += (fbm(vec2(ang * 0.65, seed * 4.0 + tw * 0.25)) - 0.5) * 0.55;
    vec2 dir = vec2(cos(ang), sin(ang));
    float extent = 0.0;
    for (int i = 0; i < 16; i++) {
      float t = float(i) * 0.04;
      float f = letterField(tex, dir * t + current * 0.06, seed, tw);
      // Soft accumulation — fuzzy edge instead of hard cutoff
      extent = mix(extent, t, smoothstep(0.18, 0.42, f));
    }
    extent *= 0.88 + 0.22 * fbm(dir * 1.6 + vec2(seed, tw * 0.2));
    // Edge breathes a little (flowy stone)
    extent *= 1.0 + 0.06 * sin(tw * 2.2 + ang * 3.0 + seed * 5.0);

    float sd = r - extent;

    float env =
      smoothstep(0.0, 0.05, age)
      * (1.0 - smoothstep(0.7, 1.35, age))
      * exp(-age * 0.75);
    float damp = env * str;

    // Soft impact bloom on the stone (dissolves into the pond)
    float impact = field * exp(-age * 2.2) * (0.85 + 0.25 * fbm(flowLocal * 2.0 + tw));

    // Expanding wavefront from the silhouette — uneven / watery
    float front = age * 0.34 + 0.04 * fbm(flowLocal + tw * 0.5);
    float outside = max(sd, 0.0);
    // Stretch rings with current so they don't stay perfect offset-curves
    outside += dot(current, dir) * 0.08 * age;

    float crestW = 12.0 + 3.0 * fbm(vec2(ang, tw));
    float crest = exp(-pow((outside - front) * crestW, 2.0));
    float crest2 = exp(-pow((outside - front * 0.72) * 10.5, 2.0)) * 0.58;
    float crest3 = exp(-pow((outside - front * 0.48) * 9.0, 2.0)) * 0.34;

    float phase =
      outside * (32.0 + 4.0 * fbm(flowLocal + seed))
      - age * (16.0 + 2.0 * sin(seed * 6.0))
      + seed * 3.0
      + fbm(flowLocal * 1.5 - tw) * 2.5;
    float rings =
      sin(phase) * exp(-outside * 2.4) * exp(-age * 0.65) * 0.85
      + sin(phase * 0.62 + 1.1) * exp(-outside * 1.9) * exp(-age * 0.85) * 0.5
      + sin(phase * 1.35 - age * 8.0) * exp(-outside * 3.0) * exp(-age * 1.1) * 0.28;

    // Soft wet lip along the stone edge
    float lip = exp(-pow(sd * 7.5, 2.0)) * exp(-age * 1.7) * 0.55;
    // Trailing wake / foam inside the dissolving letter
    float wake = field * (1.0 - exp(-age * 1.2)) * exp(-age * 1.5) * 0.25
      * (0.5 + 0.5 * sin(phase * 0.4));

    float ink =
      impact * 0.7
      + wake
      + lip * 0.5
      + crest * 0.95
      + crest2 * 0.55
      + crest3 * 0.32
      + abs(rings) * 0.65;
    ink *= damp;

    float height =
      (impact * 0.4 + lip * 0.35 + wake * 0.3
        + crest * 1.05 + crest2 * 0.55 + rings)
      * damp;

    float reach = extent + front + 0.28 + age * 0.05;
    float gate = 1.0 - smoothstep(reach, reach + 0.28, r);
    ink *= gate;
    height *= gate;

    return vec2(height, clamp(ink, 0.0, 1.0));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float aspect = u_res.x / max(u_res.y, 1.0);
    vec2 p = uv * vec2(aspect, 1.0);
    float t = u_time * 0.42;

    vec4 w0 = waveOf(p, aspect, u_r0);
    vec4 w1 = waveOf(p, aspect, u_r1);
    vec4 w2 = waveOf(p, aspect, u_r2);
    vec4 w3 = waveOf(p, aspect, u_r3);
    vec4 w4 = waveOf(p, aspect, u_r4);
    vec4 w5 = waveOf(p, aspect, u_r5);

    vec2 warp = w0.zw + w1.zw + w2.zw + w3.zw + w4.zw + w5.zw;

    vec2 lw0 = letterWave(u_letter0, p, aspect, u_l0, u_ls0);
    vec2 lw1 = letterWave(u_letter1, p, aspect, u_l1, u_ls1);
    vec2 lw2 = letterWave(u_letter2, p, aspect, u_l2, u_ls2);

    // Circles + letter-shaped splashes share one wave field
    float height =
      w0.x + w1.x + w2.x + w3.x + w4.x + w5.x
      + lw0.x + lw1.x + lw2.x;
    float energy = abs(height);
    float collide =
      abs(w0.x) * abs(w1.x) + abs(w0.x) * abs(w2.x) + abs(w0.x) * abs(w3.x)
      + abs(w0.x) * abs(w4.x) + abs(w0.x) * abs(w5.x)
      + abs(w1.x) * abs(w2.x) + abs(w1.x) * abs(w3.x) + abs(w1.x) * abs(w4.x)
      + abs(w1.x) * abs(w5.x) + abs(w2.x) * abs(w3.x) + abs(w2.x) * abs(w4.x)
      + abs(w2.x) * abs(w5.x) + abs(w3.x) * abs(w4.x) + abs(w3.x) * abs(w5.x)
      + abs(w4.x) * abs(w5.x)
      + abs(lw0.x) * (abs(w0.x) + abs(w1.x) + abs(lw1.x) + abs(lw2.x))
      + abs(lw1.x) * (abs(w0.x) + abs(lw2.x))
      + abs(lw2.x) * abs(w0.x);
    collide = clamp(collide * 3.0, 0.0, 1.0);

    float letterInk = lw0.y + lw1.y + lw2.y;
    float ink = clamp(
      w0.y + w1.y + w2.y + w3.y + w4.y + w5.y
        + letterInk
        + energy * 0.4
        + collide * 0.5,
      0.0,
      1.0
    );

    float tw =
      w0.y + w1.y + w2.y + w3.y + w4.y + w5.y
      + lw0.y + lw1.y + lw2.y + 0.0001;
    float seed =
      (w0.y * u_s0 + w1.y * u_s1 + w2.y * u_s2
      + w3.y * u_s3 + w4.y * u_s4 + w5.y * u_s5
      + lw0.y * u_ls0 + lw1.y * u_ls1 + lw2.y * u_ls2) / tw;

    float colorAspect = 4.5;
    vec2 sampleP = p + warp;
    vec2 pc = vec2(sampleP.x * (colorAspect / max(aspect, 0.001)), sampleP.y);
    pc += vec2(seed * 6.2, seed * 3.7);
    pc += vec2(
      fbm(sampleP * 2.0 + t) - 0.5,
      fbm(sampleP * 2.0 + 4.1 - t) - 0.5
    ) * (0.2 + ink * 0.25);

    vec3 candy = candyFluid(pc, t);
    candy = mix(candy, vec3(1.0, 0.9, 0.22), energy * 0.12);
    candy = mix(candy, vec3(0.92, 0.7, 1.0), collide * 0.18);

    vec3 white = vec3(1.0);
    float show = smoothstep(0.0, 0.32, ink) * ink;
    vec3 col = mix(white, candy, clamp(show, 0.0, 1.0));
    col = mix(col, white, 0.12 * (1.0 - ink));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export type AuthPondHandle = { destroy: () => void };

export function bootAuthPond(canvas: HTMLCanvasElement): AuthPondHandle | null {
  if (canvas.dataset.pondLive === "1") return null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    canvas.dataset.pondLive = "1";
    return { destroy: () => undefined };
  }

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vsh = compile(gl.VERTEX_SHADER, VS);
  const fsh = compile(gl.FRAGMENT_SHADER, FS);
  if (!vsh || !fsh) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uRs = [
    gl.getUniformLocation(prog, "u_r0"),
    gl.getUniformLocation(prog, "u_r1"),
    gl.getUniformLocation(prog, "u_r2"),
    gl.getUniformLocation(prog, "u_r3"),
    gl.getUniformLocation(prog, "u_r4"),
    gl.getUniformLocation(prog, "u_r5"),
  ];
  const uSs = [
    gl.getUniformLocation(prog, "u_s0"),
    gl.getUniformLocation(prog, "u_s1"),
    gl.getUniformLocation(prog, "u_s2"),
    gl.getUniformLocation(prog, "u_s3"),
    gl.getUniformLocation(prog, "u_s4"),
    gl.getUniformLocation(prog, "u_s5"),
  ];
  const uLetters = [
    gl.getUniformLocation(prog, "u_letter0"),
    gl.getUniformLocation(prog, "u_letter1"),
    gl.getUniformLocation(prog, "u_letter2"),
  ];
  const uLs = [
    gl.getUniformLocation(prog, "u_l0"),
    gl.getUniformLocation(prog, "u_l1"),
    gl.getUniformLocation(prog, "u_l2"),
  ];
  const uLSeeds = [
    gl.getUniformLocation(prog, "u_ls0"),
    gl.getUniformLocation(prog, "u_ls1"),
    gl.getUniformLocation(prog, "u_ls2"),
  ];

  const letterCanvases = Array.from({ length: MAX_LETTERS }, () => {
    const c = document.createElement("canvas");
    c.width = LETTER_TEX_SIZE;
    c.height = LETTER_TEX_SIZE;
    return c;
  });
  const letterTextures = letterCanvases.map((c, i) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    const loc = uLetters[i];
    if (loc) gl.uniform1i(loc, i);
    return tex;
  });

  const uploadGlyphSlot = (
    slot: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const c = letterCanvases[slot];
    const tex = letterTextures[slot];
    if (!c || !tex) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paint(ctx);
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  };

  ensureState(canvas);

  const claimLetterSlot = (state: PondState): number => {
    const used = new Set(state.letters.map((l) => l.slot));
    let slot = 0;
    if (state.letters.length >= MAX_LETTERS) {
      let oldest = 0;
      for (let i = 1; i < state.letters.length; i++) {
        const a = state.letters[i];
        const b = state.letters[oldest];
        if (a && b && a.born < b.born) oldest = i;
      }
      slot = state.letters[oldest]?.slot ?? 0;
      state.letters.splice(oldest, 1);
    } else {
      for (let i = 0; i < MAX_LETTERS; i++) {
        if (!used.has(i)) {
          slot = i;
          break;
        }
      }
    }
    return slot;
  };

  const spawnGlyph = (
    paint: (ctx: CanvasRenderingContext2D) => void,
    strength: number,
  ) => {
    const state = ensureState(canvas);
    const now = performance.now();
    const pos = pickSpawnPoint(state, now);
    const slot = claimLetterSlot(state);
    uploadGlyphSlot(slot, paint);
    state.letters.push({
      x: pos.x,
      y: pos.y,
      born: now,
      strength,
      seed: Math.random(),
      slot,
    });
  };

  const spawnLetter = (char: string) => {
    spawnGlyph((ctx) => paintLetterGlyph(ctx, char), randRange(0.75, 0.95));
  };

  const spawnEye = (kind: AuthPondEyeKind) => {
    spawnGlyph((ctx) => paintEyeGlyph(ctx, kind), randRange(0.85, 1.05));
  };

  runtimeByCanvas.set(canvas, { spawnLetter, spawnEye });

  let raf = 0;
  let running = true;
  let visible = true;
  let pageVisible = !document.hidden;
  let lastDraw = 0;
  const frameMs = 1000 / 30;
  const idleFrameMs = 1000 / 12;
  const RES_SCALE = 0.55;
  const start = performance.now();

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * RES_SCALE));
    canvas.height = Math.max(1, Math.floor(h * RES_SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (now: number) => {
    const state = ensureState(canvas);
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i];
      if (!r || rippleAge(r, now) > RIPPLE_LIFE) state.ripples.splice(i, 1);
    }
    for (let i = state.letters.length - 1; i >= 0; i--) {
      const r = state.letters[i];
      if (!r || rippleAge(r, now) > LETTER_LIFE) state.letters.splice(i, 1);
    }

    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) * 0.001);

    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = state.ripples[i];
      const loc = uRs[i];
      const sLoc = uSs[i];
      if (loc) {
        gl.uniform4f(
          loc,
          r?.x ?? 0,
          r?.y ?? 0,
          r ? rippleAge(r, now) : 0,
          r?.strength ?? 0,
        );
      }
      if (sLoc) gl.uniform1f(sLoc, r?.seed ?? 0);
    }

    // Bind letter uniforms by slot (0..2)
    const bySlot: Array<LetterSplash | undefined> = [undefined, undefined, undefined];
    for (const L of state.letters) {
      bySlot[L.slot] = L;
    }
    for (let i = 0; i < MAX_LETTERS; i++) {
      const L = bySlot[i];
      const loc = uLs[i];
      const sLoc = uLSeeds[i];
      const tLoc = uLetters[i];
      if (tLoc) gl.uniform1i(tLoc, i);
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, letterTextures[i] ?? null);
      if (loc) {
        gl.uniform4f(
          loc,
          L?.x ?? 0,
          L?.y ?? 0,
          L ? rippleAge(L, now) : 0,
          L?.strength ?? 0,
        );
      }
      if (sLoc) gl.uniform1f(sLoc, L?.seed ?? 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (reduced || !visible || !pageVisible) return;
    const state = stateByCanvas.get(canvas);
    const active =
      !!state && (state.ripples.length > 0 || state.letters.length > 0);
    const budget = active ? frameMs : idleFrameMs;
    if (now - lastDraw < budget) return;
    lastDraw = now;
    draw(now);
  };

  const onVisibility = () => {
    pageVisible = !document.hidden;
    if (pageVisible && visible && !reduced) lastDraw = 0;
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
    },
    { threshold: 0.01 },
  );
  io.observe(canvas);

  resize();
  draw(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    draw(performance.now());
    lastDraw = performance.now();
  });
  ro.observe(canvas);

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  if (!reduced) raf = requestAnimationFrame(frame);

  canvas.dataset.pondLive = "1";

  return {
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      runtimeByCanvas.delete(canvas);
      for (const tex of letterTextures) {
        if (tex) gl.deleteTexture(tex);
      }
      gl.deleteProgram(prog);
      gl.deleteShader(vsh);
      gl.deleteShader(fsh);
      gl.deleteBuffer(buf);
      delete canvas.dataset.pondLive;
    },
  };
}

export function autoBootAuthPond(): void {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "canvas[data-auth-pond]:not([data-pond-live='1'])",
  );
  if (canvas) bootAuthPond(canvas);
}
