/**
 * Legacy Clerk actor-token handoff page.
 * Model B no longer signs the Admin in as the merchant — start takeover
 * from the inbox and go straight to /a/dashboard while staying Admin.
 */
export default function TakeoverHandoff() {
  return (
    <div className="ln-surface flex min-h-screen items-center justify-center bg-[#08090a] px-6 text-[#f7f8f8]">
      <div className="max-w-md text-center">
        <p className="ln-h1 text-2xl tracking-tight">Takeover handoff moved</p>
        <p className="mt-3 text-sm leading-relaxed text-[#8a8a8e]">
          Admin takeover no longer uses Clerk impersonation. Start it from the
          Support inbox — you’ll stay signed in as Admin and work on the
          merchant’s dashboard directly.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/a/admin"
            className="rounded-full bg-[#f7f8f8] px-4 py-2.5 text-sm font-semibold text-[#08090a]"
          >
            Admin console
          </a>
          <a
            href="/a/dashboard"
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
