import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

/**
 * Neck pivot in image space (crest → helmet → collar).
 * Tuned to declineguard-mascot.png (1024×1536).
 */
const ORIGIN_X = "52%";
const ORIGIN_Y = "26.5%";

/**
 * Profile plate: look up/down is mostly in-plane nod (rotation Z).
 * rotateX/Y add Spline-like depth without a 3D runtime.
 */
const MAX_NOD = 16;
const MAX_YAW = 18;
const MAX_PITCH_3D = 8;
const BODY_FOLLOW = 0.3;
const HEAD_Z = 40;

type Props = {
  className?: string;
};

/**
 * Layered Roman guardian — pointer tracking with a Spline-ish 3D feel,
 * two optimized PNGs + CSS 3D (no Spline embed — stays fast).
 *
 * Feel reference:
 * https://community.spline.design/file/67babb82-9cf8-4e62-9811-3c5a342578d6
 */
export function MascotGaze({ className = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const stage = stageRef.current;
      const head = headRef.current;
      const body = bodyRef.current;
      if (!root || !stage || !head || !body) return;

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      if (reduce || !finePointer) return;

      gsap.set([stage, head, body], {
        transformPerspective: 900,
        transformOrigin: `${ORIGIN_X} ${ORIGIN_Y}`,
        force3D: true,
        transformStyle: "preserve-3d",
      });

      const spring = { duration: 0.55, ease: "power3.out" } as const;
      const springBody = { duration: 0.85, ease: "power3.out" } as const;

      const headNod = gsap.quickTo(head, "rotation", spring);
      const headYaw = gsap.quickTo(head, "rotationY", spring);
      const headPitch = gsap.quickTo(head, "rotationX", {
        duration: 0.6,
        ease: "power3.out",
      });
      const headZ = gsap.quickTo(head, "z", {
        duration: 0.7,
        ease: "power3.out",
      });

      const bodyNod = gsap.quickTo(body, "rotation", springBody);
      const bodyYaw = gsap.quickTo(body, "rotationY", springBody);
      const bodyPitch = gsap.quickTo(body, "rotationX", springBody);

      const stageYaw = gsap.quickTo(stage, "rotationY", {
        duration: 1,
        ease: "power3.out",
      });
      const stagePitch = gsap.quickTo(stage, "rotationX", {
        duration: 1.05,
        ease: "power3.out",
      });

      const idle = gsap.to(stage, {
        y: -6,
        duration: 3.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      const clamp = (n: number, min: number, max: number) =>
        Math.min(max, Math.max(min, n));

      const aimAt = (clientX: number, clientY: number) => {
        const rect = root.getBoundingClientRect();
        const neckX = rect.left + rect.width * 0.52;
        const neckY = rect.top + rect.height * 0.265;

        const dx = clientX - neckX;
        const dy = clientY - neckY;

        const xNorm = clamp(dx / (window.innerWidth * 0.38), -1, 1);
        const yNorm = clamp(dy / (window.innerHeight * 0.36), -1, 1);

        const dist = Math.hypot(dx, dy);
        const reach = Math.max(window.innerHeight * 0.65, 360);
        // Floor so cursor near the neck still produces a clear nod
        const influence = clamp(dist / reach, 0.4, 1);
        const eased = Math.sqrt(influence);

        /*
         * Faces left: cursor below → positive Z rotation tips the face down.
         * This is what reads as “looking down” on a flat profile (rotateX alone won’t).
         */
        const nod = clamp(yNorm * MAX_NOD * eased, -MAX_NOD, MAX_NOD);
        const yaw = clamp(-xNorm * MAX_YAW * eased, -MAX_YAW, MAX_YAW);
        const pitch3d = clamp(
          -yNorm * MAX_PITCH_3D * eased,
          -MAX_PITCH_3D,
          MAX_PITCH_3D,
        );
        const engage = clamp(Math.hypot(xNorm, yNorm), 0, 1);

        headNod(nod);
        headYaw(yaw);
        headPitch(pitch3d);
        headZ(engage * HEAD_Z);

        bodyNod(nod * BODY_FOLLOW);
        bodyYaw(yaw * BODY_FOLLOW);
        bodyPitch(pitch3d * BODY_FOLLOW);

        stageYaw(yaw * 0.22);
        stagePitch(pitch3d * 0.35);
      };

      const rest = () => {
        headNod(0);
        headYaw(0);
        headPitch(0);
        headZ(0);
        bodyNod(0);
        bodyYaw(0);
        bodyPitch(0);
        stageYaw(0);
        stagePitch(0);
      };

      let idleResume: number | undefined;
      const onMove = (e: PointerEvent) => {
        idle.pause();
        aimAt(e.clientX, e.clientY);
        window.clearTimeout(idleResume);
        idleResume = window.setTimeout(() => {
          idle.resume();
        }, 1400);
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("mouseleave", rest);

      return () => {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("mouseleave", rest);
        window.clearTimeout(idleResume);
        idle.kill();
      };
    },
    { scope: rootRef },
  );

  const imgClass =
    "pointer-events-none block h-full w-auto max-w-none select-none bg-transparent object-contain object-right";

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-max ${className}`}
      style={{
        perspective: "900px",
        perspectiveOrigin: `${ORIGIN_X} ${ORIGIN_Y}`,
      }}
      aria-hidden
    >
      <div
        ref={stageRef}
        className="relative h-full w-max will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={bodyRef}
          className="relative h-full will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
        >
          <img
            src="/declineguard-mascot-body.webp"
            alt=""
            width={1024}
            height={1536}
            className={imgClass}
            decoding="async"
            draggable={false}
          />
        </div>

        <div
          ref={headRef}
          className="absolute inset-0 will-change-transform"
          style={{ transformStyle: "preserve-3d" }}
        >
          <img
            src="/declineguard-mascot-head.webp"
            alt=""
            width={1024}
            height={1536}
            className={imgClass}
            decoding="async"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
