import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import "./CRTWarp.css";

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uCurvature;
uniform float uScanlineStrength;
uniform float uScanlineFrequency;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uBloom;
uniform float uBloomRadius;
uniform float uNoise;
uniform float uVignette;
uniform float uBrightness;
uniform float uPixelation;
uniform float uRgbShift;
uniform vec2 uPointer;
uniform float uMouseStrength;
uniform float uMouseReact;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 crtCurve(vec2 uv, float radius) {
  vec2 p = (uv - 0.5) * 2.0;
  float safeRadius = max(radius, 1.415);
  float cornerScale = safeRadius / sqrt(max(safeRadius * safeRadius - 2.0, 0.001));
  p = safeRadius * p / sqrt(max(safeRadius * safeRadius - dot(p, p), 0.001));
  p /= cornerScale;
  return p * 0.5 + 0.5;
}

float referencePlasma(vec2 uv, float t) {
  float frequencyScale = max(uWaveFrequency / 2.2, 0.001);
  uv = (uv - 0.5) * frequencyScale + 0.5;

  float scanline = 0.5 - 0.5 * cos(uv.y * 3.14159265 * uScanlineFrequency);
  scanline = mix(1.0, scanline, uScanlineStrength);

  uv *= vec2(80.0, 24.0);
  uv = ceil(uv);
  uv /= vec2(80.0, 24.0);

  float amplitude = uWaveAmplitude / 0.28;
  float field = 0.0;
  field += 0.7 * sin(0.5 * uv.x + t / 5.0);
  field += 3.0 * sin(1.6 * uv.y + t / 5.0);
  field += sin(10.0 * (uv.y * sin(t / 2.0) + uv.x * cos(t / 5.0)) + t / 2.0);

  float cx = uv.x + 0.5 * sin(t / 2.0);
  float cy = uv.y + 0.5 * cos(t / 4.0);
  field += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + t);
  field += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field += 0.3 * sin(0.5 * uv.y + uv.x + sin(t));

  return scanline * floor(3.0 * (0.5 + 0.499 * sin(field * amplitude))) / 3.0;
}

void main() {
  vec2 uv = vUv;
  if (uPixelation > 1.001) {
    vec2 cells = max(uResolution / uPixelation, vec2(1.0));
    uv = (floor(uv * cells) + 0.5) / cells;
  }

  float curveRadius = 1.1 + 0.42 / max(uCurvature, 0.001);
  if (uMouseReact > 0.5) {
    curveRadius *= exp(-uPointer.y * uMouseStrength * 0.4);
  }
  vec2 curvedUv = crtCurve(uv, curveRadius);
  if (uMouseReact > 0.5) {
    curvedUv.x -= uPointer.x * uMouseStrength * 0.035;
  }

  float signal = referencePlasma(curvedUv, uTime);
  float radius = 0.01 * uBloomRadius;
  float glow = signal * 0.2;
  glow += referencePlasma(curvedUv + vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv - vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(radius, -radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(-radius, radius), uTime) * 0.08;

  float redSignal = referencePlasma(curvedUv + vec2(uRgbShift, 0.0), uTime);
  float blueSignal = referencePlasma(curvedUv - vec2(uRgbShift, 0.0), uTime);
  vec3 channelSignal = vec3(redSignal, signal, blueSignal);
  vec3 waveColor = uColor * (0.3 + signal * 0.7 + glow * uBloom * 0.65);
  waveColor += (channelSignal - signal) * 0.42;

  float edge = clamp(1.0 - dot(vUv - 0.5, vUv - 0.5) * 2.0, 0.0, 1.0);
  float edgeFade = mix(1.0, smoothstep(0.0, 1.0, edge), uVignette);
  float waveMask = clamp(signal * 0.82 + glow * 0.52, 0.0, 1.0) * edgeFade;

  float grain = hash21(gl_FragCoord.xy + vec2(fract(uTime) * 173.0));
  waveColor = max(waveColor * uBrightness, vec3(0.0));
  vec3 color = mix(uBackgroundColor, waveColor, waveMask);
  color += (grain - 0.5) * uNoise;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

export type CRTWarpProps = {
  color?: string;
  backgroundColor?: string;
  speed?: number;
  curvature?: number;
  scanlineStrength?: number;
  scanlineFrequency?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  bloom?: number;
  bloomRadius?: number;
  noise?: number;
  vignette?: number;
  brightness?: number;
  pixelation?: number;
  rgbShift?: number;
  mouseReact?: boolean;
  mouseStrength?: number;
  dpr?: number;
  fps?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
};

type WarpUniforms = {
  uResolution: { value: THREE.Vector2 };
  uTime: { value: number };
  uSpeed: { value: number };
  uColor: { value: THREE.Color };
  uBackgroundColor: { value: THREE.Color };
  uCurvature: { value: number };
  uScanlineStrength: { value: number };
  uScanlineFrequency: { value: number };
  uWaveAmplitude: { value: number };
  uWaveFrequency: { value: number };
  uBloom: { value: number };
  uBloomRadius: { value: number };
  uNoise: { value: number };
  uVignette: { value: number };
  uBrightness: { value: number };
  uPixelation: { value: number };
  uRgbShift: { value: number };
  uPointer: { value: THREE.Vector2 };
  uMouseStrength: { value: number };
  uMouseReact: { value: number };
};

export default function CRTWarp({
  color = "#c6fe1e",
  backgroundColor = "#00160d",
  speed = 0.5,
  curvature = 0.25,
  scanlineStrength = 0.25,
  scanlineFrequency = 200,
  waveAmplitude = 0.3,
  waveFrequency = 2.5,
  bloom = 1.5,
  bloomRadius = 1,
  noise = 0.1,
  vignette = 0,
  brightness = 1.25,
  pixelation = 1,
  rgbShift = 0.015,
  mouseReact = true,
  mouseStrength = 0.5,
  dpr = 1,
  fps = 30,
  paused = false,
  className,
  style,
}: CRTWarpProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<WarpUniforms | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const pausedRef = useRef(paused);
  const pointerTargetRef = useRef(new THREE.Vector2(0, 0));
  const pointerCurrentRef = useRef(new THREE.Vector2(0, 0));
  const visibleRef = useRef(true);
  const fpsRef = useRef(fps);
  const lastFrameRef = useRef(0);
  const scrollingRef = useRef(false);
  const scrollIdleTimerRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    fpsRef.current = Math.max(1, fps);
  }, [fps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms: WarpUniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSpeed: { value: 0.5 },
      uColor: { value: new THREE.Color("#c755f7") },
      uBackgroundColor: { value: new THREE.Color("#05010a") },
      uCurvature: { value: 0.25 },
      uScanlineStrength: { value: 0.25 },
      uScanlineFrequency: { value: 200 },
      uWaveAmplitude: { value: 0.3 },
      uWaveFrequency: { value: 2.5 },
      uBloom: { value: 1.5 },
      uBloomRadius: { value: 1 },
      uNoise: { value: 0.1 },
      uVignette: { value: 0 },
      uBrightness: { value: 1.25 },
      uPixelation: { value: 1 },
      uRgbShift: { value: 0.015 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uMouseStrength: { value: 0.5 },
      uMouseReact: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });
    uniformsRef.current = uniforms;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const resize = (): void => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();

    const markScrolling = (): void => {
      scrollingRef.current = true;
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = window.setTimeout(() => {
        scrollingRef.current = false;
      }, 160);
    };

    const render = (now: number): void => {
      if (!visibleRef.current || document.hidden) {
        frameRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(render);
      if (pausedRef.current || scrollingRef.current) return;
      const interval = 1000 / fpsRef.current;
      if (now - lastFrameRef.current < interval) return;
      lastFrameRef.current = now - ((now - lastFrameRef.current) % interval);
      const delta = Math.min(clock.getDelta(), 0.1);
      uniforms.uTime.value += delta * uniforms.uSpeed.value;
      pointerCurrentRef.current.lerp(pointerTargetRef.current, 0.08);
      uniforms.uPointer.value.copy(pointerCurrentRef.current);
      renderer.render(scene, camera);
    };

    const startLoop = (): void => {
      if (frameRef.current !== 0) return;
      frameRef.current = requestAnimationFrame(render);
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting ?? false;
      if (visibleRef.current) startLoop();
    });
    visibilityObserver.observe(container);

    const onVisibility = (): void => {
      if (!document.hidden && visibleRef.current) startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", markScrolling, { passive: true, capture: true });
    window.addEventListener("wheel", markScrolling, { passive: true, capture: true });
    window.addEventListener("touchmove", markScrolling, { passive: true, capture: true });

    startLoop();

    const onPointerMove = (event: PointerEvent): void => {
      const rect = container.getBoundingClientRect();
      pointerTargetRef.current.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1),
      );
    };
    const onPointerLeave = (): void => {
      pointerTargetRef.current.set(0, 0);
    };
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.clearTimeout(scrollIdleTimerRef.current);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", markScrolling, true);
      window.removeEventListener("wheel", markScrolling, true);
      window.removeEventListener("touchmove", markScrolling, true);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      uniformsRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const uniforms = uniformsRef.current;
    const renderer = rendererRef.current;
    if (!uniforms || !renderer) return;
    uniforms.uColor.value.set(color);
    uniforms.uBackgroundColor.value.set(backgroundColor);
    uniforms.uSpeed.value = speed;
    uniforms.uCurvature.value = curvature;
    uniforms.uScanlineStrength.value = scanlineStrength;
    uniforms.uScanlineFrequency.value = scanlineFrequency;
    uniforms.uWaveAmplitude.value = waveAmplitude;
    uniforms.uWaveFrequency.value = waveFrequency;
    uniforms.uBloom.value = bloom;
    uniforms.uBloomRadius.value = bloomRadius;
    uniforms.uNoise.value = noise;
    uniforms.uVignette.value = vignette;
    uniforms.uBrightness.value = brightness;
    uniforms.uPixelation.value = pixelation;
    uniforms.uRgbShift.value = rgbShift;
    uniforms.uMouseReact.value = mouseReact ? 1 : 0;
    uniforms.uMouseStrength.value = mouseStrength;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
    const container = containerRef.current;
    if (container) {
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false);
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    }
  }, [
    backgroundColor,
    bloom,
    bloomRadius,
    brightness,
    color,
    curvature,
    dpr,
    mouseReact,
    mouseStrength,
    noise,
    pixelation,
    rgbShift,
    scanlineFrequency,
    scanlineStrength,
    speed,
    fps,
    vignette,
    waveAmplitude,
    waveFrequency,
  ]);

  return (
    <div
      ref={containerRef}
      className={`crt-warp-container${className ? ` ${className}` : ""}`}
      style={style}
    />
  );
}
