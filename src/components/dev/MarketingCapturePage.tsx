import { MarketingProductPreview } from "@/components/homepage/marketing/MarketingProductPreview";

/** Dev-only full-width views for capturing marketing screenshots after login. */
export default function MarketingCapturePage() {
  return (
    <main className="min-h-screen bg-[#ececee] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-[1400px] space-y-16">
        <header className="rounded-xl border border-black/10 bg-white p-6">
          <h1 className="font-display text-2xl tracking-tight">
            Marketing capture
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/55">
            Full-width product previews for screenshots. Log into your dashboard
            separately if you need live store data — these frames use demo data
            with real charts and components.
          </p>
        </header>

        {(
          [
            ["dashboard", "Overview"],
            ["recoveries", "Recoveries"],
            ["sequences", "Sequences"],
            ["customizations", "Customizations"],
          ] as const
        ).map(([tab, label]) => (
          <section key={tab} id={tab}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-black/45">
              {label}
            </h2>
            <MarketingProductPreview tab={tab} frameSize="hero" />
          </section>
        ))}
      </div>
    </main>
  );
}
