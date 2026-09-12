import { pulseAuthPond, type AuthPondPulseKind } from "@/lib/authPond";
import { pulseAuthFluid, type FluidPulseKind } from "@/lib/fluidGradient";

type AuthPulseKind = AuthPondPulseKind | FluidPulseKind;

/** Pulse whichever auth visual is live (pond page or split fluid panel). */
export function pulseAuthUi(kind: AuthPulseKind): void {
  const pond = document.querySelector(
    "canvas[data-auth-pond][data-pond-live='1']",
  );
  if (pond) {
    pulseAuthPond(kind === "paste" ? "paste" : kind);
    return;
  }
  if (kind === "paste") {
    pulseAuthFluid("submit");
    return;
  }
  pulseAuthFluid(kind);
}
