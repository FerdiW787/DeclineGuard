import { useEffect, useState } from "react";
import Grainient from "./Grainient";

export function HomeGrainient() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Grainient
      color1="#bbf7d0"
      color2="#34d399"
      color3="#ffffff"
      timeSpeed={reduced ? 0 : 0.1}
      colorBalance={0.12}
      warpStrength={0.35}
      warpFrequency={0.85}
      warpSpeed={reduced ? 0 : 0.55}
      warpAmplitude={180}
      blendAngle={8}
      blendSoftness={0.62}
      rotationAmount={48}
      noiseScale={0.85}
      grainAmount={0.035}
      grainScale={2.6}
      grainAnimated={false}
      contrast={1.04}
      gamma={1.06}
      saturation={0.92}
      centerX={0.0}
      centerY={0.14}
      zoom={1.08}
    />
  );
}
