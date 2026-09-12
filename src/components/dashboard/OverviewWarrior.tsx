import { CornerWarriorShell, CORNER_WARRIOR_IMG_CLASS } from "./CornerWarrior";

const IDLE = "/mascot/warrior/wave-front.png";

type Props = {
  /** Kept for call-site compat — always viewport-pinned */
  fixed?: boolean;
  className?: string;
};

/**
 * Homepage Roman warrior — slides in from the right on Overview enter.
 */
export default function OverviewWarrior({ className = "" }: Props) {
  return (
    <CornerWarriorShell className={className}>
      <img
        src={IDLE}
        alt=""
        width={1024}
        height={1536}
        decoding="async"
        draggable={false}
        className={CORNER_WARRIOR_IMG_CLASS}
      />
    </CornerWarriorShell>
  );
}
