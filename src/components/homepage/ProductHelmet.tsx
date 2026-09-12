/** Helmet + fallen spear props for the product section left side. */
export function ProductHelmet({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-[1] overflow-visible ${className}`}
    >
      {/*
        Stood at 5% from the left, then fell left —
        leans along the left edge behind the helmet (~80% tall).
      */}
      <div
        className="absolute bottom-0 left-[5%] z-0 h-[80%] w-auto origin-bottom"
        style={{ transform: "rotate(-36deg)" }}
      >
        <img
          src="/mascot/sections/product-spear.png?v=2"
          alt=""
          width={85}
          height={1483}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-auto max-w-none select-none object-contain object-bottom opacity-80"
        />
      </div>

      {/* Helmet sits in the bottom-left corner, in front of the spear */}
      <div className="absolute bottom-0 left-0 z-[1] h-[33%] w-[25%] overflow-visible">
        <img
          src="/mascot/sections/product-helmet.png?v=4"
          alt=""
          width={669}
          height={774}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full origin-bottom-left rotate-[14deg] translate-x-[2%] translate-y-[6%] select-none object-contain object-left-bottom opacity-90"
        />
      </div>
    </div>
  );
}
