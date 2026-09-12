export type PourFrom = "top" | "left" | "bottom" | "right";

export type FluidPulseKind = "focus" | "type" | "hover" | "submit";

export type FluidHandle = {
  destroy: () => void;
};

type BootOpts = {
  pourFrom?: PourFrom;
  /** Listen for form pulses (same look as homepage fluid) */
  reactive?: boolean;
  /** Skip soft pour / translucent edge — solid fill for hard-clipped accents */
  hardFill?: boolean;
  /**
   * Keep the last frame readable via toDataURL / toBlob (e.g. chart pattern fills).
   * Slightly more GPU memory — only enable when you need to sample the canvas.
   */
  capture?: boolean;
  /** Lower resolution + capped FPS for large surfaces (e.g. chart fills) */
  lite?: boolean;
  /** White glitter particles — defaults on for full fluid, off for lite/reactive */
  sparks?: boolean;
  /**
   * Play the pour, then freeze the last frame and stop the rAF loop.
   * Keeps the candy look with near-zero ongoing GPU cost (ideal for nav pills).
   */
  settleMs?: number;
};

const MAX_POPS = 5;
/** How long a pond ripple lives (seconds) */
const POP_LIFE = 1.55;

/** Rock-in-a-pond ripple — expands outward from a random impact */
type Pop = {
  x: number;
  y: number;
  born: number;
  strength: number;
};

type PulseState = {
  pops: Pop[];
};

const pulseByCanvas = new WeakMap<HTMLCanvasElement, PulseState>();

function ensurePulse(canvas: HTMLCanvasElement): PulseState {
  let state = pulseByCanvas.get(canvas);
  if (!state) {
    state = { pops: [] };
    pulseByCanvas.set(canvas, state);
  }
  return state;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function popAge(pop: Pop, now: number): number {
  return (now - pop.born) * 0.001;
}

function spawnPop(state: PulseState, strength: number, now: number): void {
  const pop: Pop = {
    x: randRange(0.1, 0.9),
    y: randRange(0.1, 0.9),
    born: now,
    strength,
  };
  if (state.pops.length < MAX_POPS) {
    state.pops.push(pop);
    return;
  }
  // Replace the oldest ripple
  let oldest = 0;
  for (let i = 1; i < state.pops.length; i++) {
    const a = state.pops[i];
    const b = state.pops[oldest];
    if (!a || !b) continue;
    if (a.born < b.born) oldest = i;
  }
  state.pops[oldest] = pop;
}

/** Drop a rock into the pond — expanding ripples at a random spot. */
export function pulseAuthFluid(kind: FluidPulseKind): void {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "aside canvas[data-fluid][data-fluid-reactive='1']",
  );
  if (!canvas || canvas.dataset.fluidLive !== "1") return;

  const state = ensurePulse(canvas);
  const now = performance.now();
  const strength =
    kind === "submit"
      ? randRange(0.75, 1)
      : kind === "focus"
        ? randRange(0.55, 0.85)
        : kind === "type"
          ? randRange(0.4, 0.7)
          : randRange(0.35, 0.6);

  const count =
    kind === "submit" ? 2 : kind === "focus" && Math.random() < 0.3 ? 2 : 1;

  for (let i = 0; i < count; i++) {
    spawnPop(state, strength * (i === 0 ? 1 : randRange(0.55, 0.85)), now);
  }
}

/** Drop finished ripples. */
function tickPulse(state: PulseState, now: number): void {
  for (let i = state.pops.length - 1; i >= 0; i--) {
    const pop = state.pops[i];
    if (!pop || popAge(pop, now) > POP_LIFE) {
      state.pops.splice(i, 1);
    }
  }
}

function maxPopStrength(state: PulseState, now: number): number {
  let m = 0;
  for (const pop of state.pops) {
    const age = popAge(pop, now);
    const env =
      Math.min(1, age / 0.08) * (1 - Math.min(1, Math.max(0, (age - 0.9) / 0.65)));
    const s = pop.strength * env;
    if (s > m) m = s;
  }
  return m;
}

function pourMode(pourFrom: PourFrom): number {
  switch (pourFrom) {
    case "left":
      return 1;
    case "bottom":
      return 2;
    case "right":
      return 3;
    case "top":
    default:
      return 0;
  }
}

const VS = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FS = `
  precision mediump float;
  uniform vec2 u_res;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_strength;
  uniform float u_intro;
  // 0 = top, 1 = left, 2 = bottom
  uniform float u_pourMode;
  // Soft mouse swirl strength
  uniform float u_pulse;
  // 1 = glitter sparks (homepage); 0 = none (auth panels)
  uniform float u_sparks;
  // Pond ripples: xy = impact uv, z = age (sec), w = strength
  uniform vec4 u_pop0;
  uniform vec4 u_pop1;
  uniform vec4 u_pop2;
  uniform vec4 u_pop3;
  uniform vec4 u_pop4;

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

  // Expanding rings from a rock hitting the pond
  vec2 pondRipple(vec2 p, float aspect, vec4 rp) {
    float age = rp.z;
    float str = rp.w;
    if (str < 0.01 || age > 1.6) return vec2(0.0);
    vec2 o = vec2(rp.x * aspect, rp.y);
    vec2 pd = p - o;
    float dist = length(pd);
    vec2 nrm = pd * inversesqrt(dot(pd, pd) + 0.0003);
    float env = smoothstep(0.0, 0.07, age) * (1.0 - smoothstep(0.85, 1.55, age));
    float wave =
      sin(dist * 22.0 - age * 16.0) * exp(-dist * 2.4) * exp(-age * 0.85)
      + sin(dist * 14.0 - age * 11.0) * exp(-dist * 1.6) * exp(-age * 1.1) * 0.55;
    float front = age * 0.62;
    float crest = exp(-pow((dist - front) * 11.0, 2.0));
    float amp = (wave * 0.55 + crest * 0.7) * env * str;
    return nrm * amp * 0.07;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float aspect = u_res.x / max(u_res.y, 1.0);
    vec2 p = uv * vec2(aspect, 1.0);

    vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
    vec2 d = p - m;
    float md2 = dot(d, d);
    float pull = (u_strength + u_pulse * 0.12) * exp(-md2 * 4.2);
    p -= d * pull * 0.32;
    float ang = pull * 0.7;
    float ca = cos(ang);
    float sa = sin(ang);
    d = p - m;
    p = m + vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);

    // Rock-in-a-pond ripples — rings expand outward from impact
    p += pondRipple(p, aspect, u_pop0);
    p += pondRipple(p, aspect, u_pop1);
    p += pondRipple(p, aspect, u_pop2);
    p += pondRipple(p, aspect, u_pop3);
    p += pondRipple(p, aspect, u_pop4);

    float intro = clamp(u_intro, 0.0, 1.0);
    float tFlow = u_time * 2.15;

    // Distance from pour origin (0 at edge fluid enters from)
    // 0 top, 1 left, 2 bottom, 3 right
    float along = u_pourMode < 0.5
      ? (1.0 - uv.y)
      : (u_pourMode < 1.5
        ? uv.x
        : (u_pourMode < 2.5 ? uv.y : (1.0 - uv.x)));
    float across = u_pourMode < 0.5
      ? uv.x
      : (u_pourMode < 1.5
        ? uv.y
        : (u_pourMode < 2.5 ? uv.x : uv.y));
    float front = intro * 1.08;
    float rip = (
      fbm(vec2(across * 2.8 + tFlow * 0.55, tFlow * 0.3)) * 0.16
      + noise(vec2(across * 8.0 - tFlow, 2.1)) * 0.07
    ) * intro;
    float edge = front + rip;
    float edgeSoft = 0.04 + intro * 0.18;
    float body = intro > 0.001
      ? (1.0 - smoothstep(edge - edgeSoft, edge + 0.06, along))
      : 0.0;

    float stream = smoothstep(0.48, 0.92,
      fbm(vec2(across * 4.5 + tFlow * 0.35, along * 2.2 + 1.0))
    ) * (1.0 - smoothstep(edge - 0.12, edge + 0.1, along))
      * intro * intro;

    float pourMask = clamp(body + stream * 0.7, 0.0, 1.0) * step(0.001, intro);

    float settle = smoothstep(0.5, 0.92, intro);
    float fromTop = step(u_pourMode, 0.5);
    float fromLeft = step(0.5, u_pourMode) * step(u_pourMode, 1.5);
    float fromBottom = step(1.5, u_pourMode) * step(u_pourMode, 2.5);
    float fromRight = step(2.5, u_pourMode);
    float fromSide = fromLeft + fromRight;
    p.y += settle * 0.05 * (fromTop - fromBottom);
    p.x += settle * 0.05 * (fromLeft - fromRight);
    p.x += (fbm(vec2(uv.y * 3.0, tFlow)) - 0.5) * settle * 0.08 * (1.0 - fromSide);
    p.y += (fbm(vec2(uv.x * 3.0, tFlow)) - 0.5) * settle * 0.08 * fromSide;

    float t = u_time * 0.42;
    // Tall auth panels have a tiny aspect (~0.5) vs the homepage strip (~4–6).
    // Resample colors in a fixed wide domain so the candy mix matches the hero.
    float colorAspect = 4.5;
    vec2 pc = vec2(p.x * (colorAspect / max(aspect, 0.001)), p.y);
    pc *= 1.55;
    pc += vec2(sin(t * 1.1 + uv.y * 2.0), cos(t * 0.85 + uv.x * 1.6)) * 0.14;
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

    float tw = noise(uv * 52.0 + vec2(t * 1.4, -t * 0.9));
    float spark = smoothstep(0.84, 0.96, tw)
      * (0.55 + 0.45 * sin(t * 6.0 + f * 12.0))
      * u_sparks;
    // Bright white glitter particles
    fluid += vec3(1.0, 1.0, 1.0) * spark * (0.75 + u_pulse * 0.25);

    fluid += lemon * 0.28 * smoothstep(0.35, 0.9, q.y)
      * (0.45 + 0.55 * sin(t * 3.2 + f * 9.0));

    float reveal = mix(pourMask, 1.0, smoothstep(0.72, 0.98, intro));
    // Only candy fluid — no wash/cream/mud slab under the pour
    vec3 col = fluid;
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.18);
    col = clamp(col, 0.0, 1.0);

    float alpha = clamp(reveal, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/**
 * Boot the candy fluid on a canvas — no React required.
 * Safe to call once; marks the canvas so React hydration won't double-boot.
 */
export function bootFluidGradient(
  canvas: HTMLCanvasElement,
  opts: BootOpts = {},
): FluidHandle | null {
  if (canvas.dataset.fluidLive === "1") return null;

  const pourFrom = opts.pourFrom ?? "top";
  const mode = pourMode(pourFrom);
  const reactive = opts.reactive === true;
  const hardFill = opts.hardFill === true;
  const capture = opts.capture === true;
  const lite = opts.lite === true;
  const sparks = opts.sparks ?? !(lite || reactive);
  const settleMs =
    typeof opts.settleMs === "number" && opts.settleMs > 0
      ? opts.settleMs
      : null;
  /** Need the last frame to stick when we stop the loop */
  const preserveBuffer = capture || settleMs != null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    // Antialias helps the frozen nav pill look crisp; skip elsewhere for cost
    antialias: settleMs != null,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: preserveBuffer,
  });

  if (!gl) {
    canvas.dataset.fluidLive = "1";
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
  const uMouse = gl.getUniformLocation(prog, "u_mouse");
  const uStrength = gl.getUniformLocation(prog, "u_strength");
  const uIntro = gl.getUniformLocation(prog, "u_intro");
  const uPourMode = gl.getUniformLocation(prog, "u_pourMode");
  const uPulse = gl.getUniformLocation(prog, "u_pulse");
  const uSparks = gl.getUniformLocation(prog, "u_sparks");
  const uPop0 = gl.getUniformLocation(prog, "u_pop0");
  const uPop1 = gl.getUniformLocation(prog, "u_pop1");
  const uPop2 = gl.getUniformLocation(prog, "u_pop2");
  const uPop3 = gl.getUniformLocation(prog, "u_pop3");
  const uPop4 = gl.getUniformLocation(prog, "u_pop4");
  const uPops = [uPop0, uPop1, uPop2, uPop3, uPop4];

  if (reactive) ensurePulse(canvas);

  let raf = 0;
  let running = true;
  let visible = true;
  let pageVisible = !document.hidden;

  const bootAt = performance.now();
  // Mid-drift so the field already looks alive as it pours in
  const start = bootAt - 2500;
  const introStart = bootAt;
  // Longer pour reads as a smooth flood instead of a stepped wipe
  const INTRO_DUR = hardFill ? 0 : 0.85;
  // Match device pixels enough to stay sharp; still cheaper than full DPR×1
  // Settle mode is short-lived then static — use sharp resolution for the frozen frame
  const RES_SCALE =
    settleMs != null
      ? Math.min(1.25, (window.devicePixelRatio || 1) * 1)
      : lite
        ? Math.min(0.4, (window.devicePixelRatio || 1) * 0.3)
        : Math.min(1, (window.devicePixelRatio || 1) * 0.75);
  // Cap pour FPS a bit; after freeze there is no loop anyway
  const FRAME_MS = settleMs != null ? 32 : lite ? 48 : 0;
  let lastDrawAt = 0;
  let frozen = false;
  /** Timestamp used for draws after settle — keeps the frozen look stable */
  let frozenAt = 0;

  const resize = () => {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    canvas.width = Math.max(1, Math.floor(w * RES_SCALE));
    canvas.height = Math.max(1, Math.floor(h * RES_SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (now: number) => {
    const drawNow = frozen && frozenAt > 0 ? frozenAt : now;
    const pulse = reactive ? ensurePulse(canvas) : null;
    const popAmt = pulse ? maxPopStrength(pulse, drawNow) : 0;
    if (pulse) tickPulse(pulse, drawNow);

    const t = reduced ? 0 : (drawNow - start) * 0.001;
    const introRaw =
      hardFill || reduced || INTRO_DUR <= 0
        ? 1
        : Math.min(1, ((drawNow - introStart) * 0.001) / INTRO_DUR);
    const intro = hardFill ? 1 : 1 - (1 - introRaw) ** 3;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    // Fixed center — no cursor warp
    gl.uniform2f(uMouse, 0.5, 0.55);
    gl.uniform1f(uStrength, popAmt * 0.15);
    gl.uniform1f(uIntro, intro);
    gl.uniform1f(uPourMode, mode);
    gl.uniform1f(uPulse, popAmt * 0.25);
    gl.uniform1f(uSparks, sparks ? 1 : 0);
    for (let i = 0; i < MAX_POPS; i++) {
      const loc = uPops[i];
      const pop = pulse?.pops[i];
      if (loc) {
        gl.uniform4f(
          loc,
          pop?.x ?? 0,
          pop?.y ?? 0,
          pop ? popAge(pop, drawNow) : 0,
          pop?.strength ?? 0,
        );
      }
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const freeze = (now: number) => {
    if (frozen) return;
    frozenAt = now;
    frozen = true;
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    // One last paint so preserveDrawingBuffer keeps a sharp settled frame
    if (visible && pageVisible) draw(now);
  };

  const frame = (now: number) => {
    if (!running || frozen) return;
    if (settleMs != null && now - bootAt >= settleMs) {
      freeze(now);
      return;
    }
    raf = requestAnimationFrame(frame);
    if (reduced || !visible || !pageVisible) return;
    if (FRAME_MS > 0 && now - lastDrawAt < FRAME_MS) return;
    lastDrawAt = now;
    draw(now);
  };

  const onVisibility = () => {
    pageVisible = !document.hidden;
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
    },
    { threshold: 0.05 },
  );
  io.observe(canvas);

  gl.clearColor(0, 0, 0, 0);
  resize();
  gl.clear(gl.COLOR_BUFFER_BIT);
  draw(performance.now());

  const ro = new ResizeObserver(() => {
    resize();
    // After freeze, still redraw once so a layout change doesn’t blank the pill
    draw(performance.now());
  });
  ro.observe(canvas.parentElement ?? canvas);

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  if (reduced) {
    // No animation — settle immediately on a static frame
    if (settleMs != null) freeze(performance.now());
  } else {
    raf = requestAnimationFrame(frame);
  }

  canvas.dataset.fluidLive = "1";

  return {
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vsh);
      gl.deleteShader(fsh);
      gl.deleteBuffer(buf);
      delete canvas.dataset.fluidLive;
    },
  };
}

function isCanvasDisplayed(canvas: HTMLCanvasElement): boolean {
  // Skip `hidden md:block` auth panels on mobile — boot when they become visible
  if (canvas.offsetParent === null && canvas.getClientRects().length === 0) {
    return false;
  }
  const style = window.getComputedStyle(canvas);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Boot every `[data-fluid]` canvas that isn't live yet (SSR-friendly). */
export function autoBootFluids(): void {
  const nodes = document.querySelectorAll<HTMLCanvasElement>(
    "canvas[data-fluid]:not([data-fluid-live='1'])",
  );
  for (const canvas of nodes) {
    const raw = canvas.dataset.pourFrom;
    const pourFrom: PourFrom =
      raw === "left" || raw === "bottom" || raw === "top" || raw === "right"
        ? raw
        : "top";
    const reactive = canvas.dataset.fluidReactive === "1";

    if (!isCanvasDisplayed(canvas)) {
      if (canvas.dataset.fluidPending === "1") continue;
      canvas.dataset.fluidPending = "1";
      const mq = window.matchMedia("(min-width: 768px)");
      const tryLater = () => {
        if (!isCanvasDisplayed(canvas) || canvas.dataset.fluidLive === "1") {
          return;
        }
        delete canvas.dataset.fluidPending;
        mq.removeEventListener("change", tryLater);
        bootFluidGradient(canvas, { pourFrom, reactive });
      };
      mq.addEventListener("change", tryLater);
      continue;
    }

    bootFluidGradient(canvas, { pourFrom, reactive });
  }
}
