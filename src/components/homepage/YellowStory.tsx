import { HeroCustomizeScene } from "./HeroCustomizeScene";
import { HeroDashboardScene } from "./HeroDashboardScene";

export function YellowStory() {
  return (
    <div id="product" className="ln-product-stage scroll-mt-24">
      <div className="ln-mock-col">
        <HeroDashboardScene />
      </div>

      <HeroCustomizeScene />
    </div>
  );
}
