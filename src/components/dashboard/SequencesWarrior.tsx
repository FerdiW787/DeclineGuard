import { useEffect, useState } from "react";
import { CornerWarriorShell, CORNER_WARRIOR_IMG_CLASS } from "./CornerWarrior";

const FINGER_FRAMES = {
  1: "/mascot/warrior/fingers-1.png",
  2: "/mascot/warrior/fingers-2.png",
  3: "/mascot/warrior/fingers-3.png",
} as const;

export type FingerCount = keyof typeof FINGER_FRAMES;

type Props = {
  /** 1 / 2 / 3 — matches Email 1 / 2 / 3 on Sequences */
  fingers: FingerCount;
  className?: string;
};

function preload(src: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/**
 * Same corner spot as Overview wave warrior.
 * Shows 1 / 2 / 3 fingers for the selected sequence email.
 */
export default function SequencesWarrior({
  fingers,
  className = "",
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    for (const src of Object.values(FINGER_FRAMES)) preload(src);
    setReady(true);
  }, []);

  return (
    <CornerWarriorShell className={className}>
      {([1, 2, 3] as const).map((n) => {
        const src = FINGER_FRAMES[n];
        const active = n === fingers;
        return (
          <img
            key={src}
            src={src}
            alt=""
            width={1024}
            height={1536}
            decoding="async"
            draggable={false}
            className={`${CORNER_WARRIOR_IMG_CLASS} ${
              ready && active ? "opacity-100" : "opacity-0"
            }`}
          />
        );
      })}
    </CornerWarriorShell>
  );
}
