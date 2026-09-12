import { CornerWarriorShell, CORNER_WARRIOR_IMG_CLASS } from "./CornerWarrior";

const THINKING = "/mascot/warrior/thinking-profile.png";

type Props = {
  className?: string;
};

/**
 * Side-profile thinking warrior — same corner spot as Overview / Sequences.
 */
export default function RecoveriesWarrior({ className = "" }: Props) {
  return (
    <CornerWarriorShell className={className}>
      <img
        src={THINKING}
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
