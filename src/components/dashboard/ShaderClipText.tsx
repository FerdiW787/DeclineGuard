/**
 * Emphasized store / brand word in headings.
 * (Replaces the old candy fluid text-fill shader.)
 */
export default function ShaderClipText({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <em
      className={`relative inline-block pb-[0.06em] font-bold not-italic ${className}`}
    >
      <span
        className="absolute inset-x-[-0.06em] bottom-[0.06em] top-[55%] -z-10 rounded-sm bg-amber-300/55"
        aria-hidden
      />
      {children}
    </em>
  );
}
