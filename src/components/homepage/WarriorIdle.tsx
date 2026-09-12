type Props = {
  className?: string;
  imgClassName?: string;
  alt?: string;
};

/** Static warrior — idle frame only (no hover animation, no extra assets). */
export function WarriorIdle({
  className = "",
  imgClassName = "",
  alt = "DeclineGuard guardian",
}: Props) {
  return (
    <div className={`pointer-events-none ${className}`}>
      <img
        src="/mascot/warrior/00.png"
        alt={alt}
        width={1024}
        height={1536}
        fetchPriority="high"
        decoding="async"
        draggable={false}
        className={`select-none ${imgClassName}`}
      />
    </div>
  );
}
