const WARRIOR_FIST = "/mascot/fists/warrior-fist.png?v=refmatch1";
const NATURAL_FIST = "/mascot/fists/natural-fist.png?v=refmatch1";

/**
 * Matching engraved fists flanking guardian copy.
 * Anchored to the text column edges; GSAP scrub closes a small gap on scroll.
 * Outer wrappers own vertical centering (CSS); inner nodes take the X scrub.
 */
export function GuardianFists() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center px-5 md:px-6">
        {/* Same width as copy — fists dock to these edges */}
        <div className="relative h-0 w-full max-w-xl">
          <div className="absolute top-0 right-full mr-2 -translate-y-1/2 md:mr-4">
            <img
              src={WARRIOR_FIST}
              alt=""
              width={1073}
              height={454}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="dg-fist-left h-[min(22vh,11rem)] w-auto max-w-[min(42vw,22rem)] origin-right select-none object-contain object-right opacity-60 [mask-image:linear-gradient(to_right,transparent_0%,black_22%,black_100%)] md:h-[min(26vh,13rem)] md:max-w-[min(38vw,24rem)] md:opacity-70"
            />
          </div>
          <div className="absolute top-0 left-full ml-2 -translate-y-1/2 md:ml-4">
            <img
              src={NATURAL_FIST}
              alt=""
              width={1240}
              height={425}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="dg-fist-right h-[min(22vh,11rem)] w-auto max-w-[min(42vw,22rem)] origin-left select-none object-contain object-left opacity-60 [mask-image:linear-gradient(to_left,transparent_0%,black_22%,black_100%)] md:h-[min(26vh,13rem)] md:max-w-[min(38vw,24rem)] md:opacity-70"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
