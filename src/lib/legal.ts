/**
 * DeclineGuard — legal entity & contact details.
 *
 * Fill every [PLACEHOLDER] before launch. German Impressum (§ 5 DDG) and GDPR
 * Art. 13 notices are incomplete until these are real.
 */
export const legal = {
  brandName: "DeclineGuard",
  /** Full legal name, e.g. "Example GmbH" */
  legalName: "[LEGAL ENTITY NAME]",
  /** e.g. GmbH, UG (haftungsbeschränkt), Einzelunternehmen */
  legalForm: "[LEGAL FORM]",
  /** Street + number */
  streetAddress: "[STREET ADDRESS]",
  postalCode: "[POSTAL CODE]",
  city: "[CITY]",
  country: "[COUNTRY]",
  /** Managing director / Geschäftsführer (required for DE companies) */
  representatives: "[MANAGING DIRECTOR(S)]",
  /** Handelsregister court + number, if registered */
  registerCourt: "[REGISTER COURT, e.g. Amtsgericht …]",
  registerNumber: "[HRB / HRA NUMBER]",
  /** USt-IdNr. if applicable */
  vatId: "[VAT ID / USt-IdNr.]",
  /** Public contact */
  supportEmail: "[support@yourdomain.com]",
  privacyEmail: "[privacy@yourdomain.com]",
  legalEmail: "[legal@yourdomain.com]",
  phone: "[PHONE — optional but recommended for Impressum]",
  /** Production site URL once live */
  siteUrl: "[https://yourdomain.com]",
  /** Governing law / venue — adjust to your incorporation */
  governingLaw: "[GOVERNING LAW, e.g. laws of the Federal Republic of Germany]",
  venue: "[EXCLUSIVE VENUE, e.g. courts of Berlin, Germany]",
  /** Effective date of these policies */
  effectiveDate: "21 July 2026",
  lastUpdated: "21 July 2026",
} as const;

export function legalAddressBlock(): string {
  return [
    legal.legalName,
    legal.streetAddress,
    `${legal.postalCode} ${legal.city}`,
    legal.country,
  ].join("\n");
}

export const subprocessors = [
  {
    name: "Clerk, Inc.",
    purpose: "Authentication, session management, account security",
    location: "USA (with SCCs / appropriate safeguards as per Clerk DPA)",
    data: "Account identifiers, name, email, auth metadata, session data",
  },
  {
    name: "Convex, Inc.",
    purpose: "Application database, file storage, backend compute, webhooks",
    location: "EU (eu-west-1 for current deployment) / as configured",
    data: "Account data, store connection metadata, recovery records, activity logs",
  },
  {
    name: "Resend, Inc.",
    purpose: "Transactional recovery email delivery",
    location: "USA (with SCCs / appropriate safeguards as per Resend DPA)",
    data: "Recipient email, name, email content related to failed payments",
  },
  {
    name: "Lemon Squeezy, LLC (via merchant connection)",
    purpose: "Merchant payment platform; source of webhook events and update-payment links",
    location: "USA / as per Lemon Squeezy terms",
    data: "Store and subscription/payment-failure metadata provided via API/webhooks",
  },
  {
    name: "Google LLC",
    purpose: "Optional Google OAuth sign-in; font delivery (Google Fonts)",
    location: "USA / global",
    data: "OAuth profile basics if Google sign-in is used; IP/browser data for font requests",
  },
  {
    name: "Cloudflare, Inc. (via Clerk)",
    purpose: "Bot / challenge protection for authentication flows",
    location: "Global edge",
    data: "Security challenge / request metadata as part of auth",
  },
] as const;

export const legalNav = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/dpa", label: "DPA / AVV" },
  { href: "/legal/cookies", label: "Cookies" },
] as const;
