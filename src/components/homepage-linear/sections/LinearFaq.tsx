import { ChevronRight } from "lucide-react";
import { homeFaqs } from "@/components/homepage/HomePageBento";

export function LinearFaq() {
  return (
    <section id="faq" className="ln-section scroll-mt-28 py-24 md:py-32">
      <div className="ln-container">
        <p className="ln-eyebrow ln-reveal">FAQs</p>

        <div className="ln-reveal mt-8 grid gap-10 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-20">
          <div>
            <h2 className="text-[clamp(1.75rem,3vw,2.35rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
              Questions and answers
            </h2>
            <p className="mt-4 text-sm text-[#8a8a8e]">
              Can&apos;t find the answer?{" "}
              <a href="/features" className="text-white underline">
                Request a feature
              </a>
            </p>
          </div>

          <div className="min-w-0 border-t border-white/10">
            {homeFaqs.map((item) => (
              <details
                key={item.q}
                className="group border-b border-white/10"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 py-5 text-[15px] font-medium tracking-tight text-white [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 shrink-0 text-[#8a8a8e] transition-transform duration-200 group-open:rotate-90" />
                  <span className="min-w-0 flex-1">{item.q}</span>
                </summary>
                <p className="pb-5 pl-7 text-sm leading-relaxed text-[#8a8a8e] md:text-[15px]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
