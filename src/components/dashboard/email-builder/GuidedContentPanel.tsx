import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Bold, Upload } from "lucide-react";
import {
  IMAGE_CROP_HEIGHT_MAX,
  IMAGE_CROP_HEIGHT_MIN,
  IMAGE_ZOOM_MAX,
  IMAGE_ZOOM_MIN,
  wrapSelectionWithBold,
  type GuidedContent,
} from "@/lib/emailBuilder";
import {
  EMAIL_IMAGE_ACCEPT,
  assertEmailImageFile,
  readFileAsDataUrl,
} from "@/lib/uploadEmailHeaderImage";

type Props = {
  subject: string;
  content: GuidedContent;
  onChangeSubject: (subject: string) => void;
  onChangeContent: (content: GuidedContent) => void;
  /** Persist a local file to HTTPS so recovery emails can send it. */
  onUploadImage?: (file: File) => Promise<string>;
};

const TOKENS: { token: string; label: string }[] = [
  { token: "{{firstName}}", label: "First name" },
  { token: "{{product}}", label: "Product" },
  { token: "{{amount}}", label: "Amount" },
];

/**
 * Guided, constrained content editor. The layout is fixed and proven — the
 * merchant personalises copy, the CTA label, and two optional pieces (a header
 * image — including crop height/zoom — and a secondary text link). No free-form
 * blocks, margins, or colors.
 */
export default function GuidedContentPanel({
  subject,
  content,
  onChangeSubject,
  onChangeContent,
  onUploadImage,
}: Props) {
  const patch = (next: Partial<GuidedContent>) =>
    onChangeContent({ ...content, ...next });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-black/6 px-4 py-3 dark:border-white/10">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
          Content
        </p>
        <p className="mt-1 text-[12px] leading-snug text-black/50">
          Personalise the copy. The layout, branding, and links stay
          on-brand automatically.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Field label="Subject line">
          <input
            type="text"
            value={subject}
            onChange={(e) => onChangeSubject(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Headline">
          <input
            type="text"
            value={content.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="Short intro line"
            className={inputClass}
          />
        </Field>

        <MessageField
          value={content.body}
          onChange={(body) => patch({ body })}
        />

        <Field label="Button label">
          <input
            type="text"
            value={content.ctaLabel}
            onChange={(e) => patch({ ctaLabel: e.target.value })}
            className={inputClass}
          />
          <span className="block text-[11px] leading-relaxed text-black/40">
            Links to the customer’s secure billing page automatically.
          </span>
        </Field>

        <ToggleSection
          label="Header image"
          enabled={content.image.enabled}
          onToggle={(enabled) =>
            patch({ image: { ...content.image, enabled } })
          }
        >
          <HeaderImageSource
            src={content.image.src}
            onChangeSrc={(src) =>
              patch({ image: { ...content.image, src } })
            }
            onUploadImage={onUploadImage}
          />
          <Field label="Alt text">
            <input
              type="text"
              value={content.image.alt}
              onChange={(e) =>
                patch({ image: { ...content.image, alt: e.target.value } })
              }
              placeholder="Describe the image"
              className={inputClass}
            />
          </Field>
          <RangeField
            label="Height"
            value={content.image.heightPx}
            min={IMAGE_CROP_HEIGHT_MIN}
            max={IMAGE_CROP_HEIGHT_MAX}
            step={4}
            display={`${Math.round(content.image.heightPx)} px`}
            onChange={(heightPx) =>
              patch({ image: { ...content.image, heightPx } })
            }
          />
          <RangeField
            label="Zoom"
            value={content.image.zoom}
            min={IMAGE_ZOOM_MIN}
            max={IMAGE_ZOOM_MAX}
            step={0.05}
            display={`${content.image.zoom.toFixed(1)}×`}
            onChange={(zoom) => patch({ image: { ...content.image, zoom } })}
          />
        </ToggleSection>

        <ToggleSection
          label="Secondary link"
          enabled={content.secondaryLink.enabled}
          onToggle={(enabled) =>
            patch({
              secondaryLink: { ...content.secondaryLink, enabled },
            })
          }
        >
          <Field label="Before link">
            <input
              type="text"
              value={content.secondaryLink.prefix}
              onChange={(e) =>
                patch({
                  secondaryLink: {
                    ...content.secondaryLink,
                    prefix: e.target.value,
                  },
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Link text">
            <input
              type="text"
              value={content.secondaryLink.label}
              onChange={(e) =>
                patch({
                  secondaryLink: {
                    ...content.secondaryLink,
                    label: e.target.value,
                  },
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="After link">
            <input
              type="text"
              value={content.secondaryLink.suffix}
              onChange={(e) =>
                patch({
                  secondaryLink: {
                    ...content.secondaryLink,
                    suffix: e.target.value,
                  },
                })
              }
              className={inputClass}
            />
          </Field>
        </ToggleSection>
      </div>
    </div>
  );
}

function MessageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const bold = () => {
    const el = ref.current;
    if (!el) return;
    const { text, start, end } = wrapSelectionWithBold(
      value,
      el.selectionStart,
      el.selectionEnd,
    );
    onChange(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  const insertToken = (token: string) => {
    const el = ref.current;
    if (!el) {
      onChange(`${value}${value ? " " : ""}${token}`);
      return;
    }
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const next = value.slice(0, s) + token + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      bold();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-black/55">Message</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={bold}
            title="Bold (⌘B)"
            aria-label="Bold selection"
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-black/50 transition-colors hover:bg-black/5 hover:text-black"
          >
            <Bold className="size-3.5" />
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={5}
        className={`${inputClass} resize-none leading-relaxed`}
      />
      <div className="flex flex-wrap gap-1">
        {TOKENS.map(({ token, label }) => (
          <button
            key={token}
            type="button"
            onClick={() => insertToken(token)}
            className="inline-flex cursor-pointer items-center rounded-full border border-black/10 bg-black/[0.02] px-2 py-0.5 text-[10px] font-semibold text-black/55 transition-colors hover:border-black/20 hover:text-black"
          >
            + {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-black/40">
        Wrap text in <span className="font-mono">**bold**</span> or use the
        button. Variables fill in per customer.
      </p>
    </div>
  );
}

function ToggleSection({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-black/8 dark:border-white/10">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-pressed={enabled}
      >
        <span className="text-[12px] font-semibold text-black dark:text-white">
          {label}
        </span>
        <Switch on={enabled} />
      </button>
      {enabled ? (
        <div className="space-y-3 border-t border-black/6 px-3 py-3 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-teal-600" : "bg-black/15 dark:bg-white/20"
      }`}
    >
      <span
        className={`inline-block size-3 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

function HeaderImageSource({
  src,
  onChangeSrc,
  onUploadImage,
}: {
  src: string;
  onChangeSrc: (src: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const applyFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      assertEmailImageFile(file);
      setUploading(true);
      if (onUploadImage) {
        onChangeSrc(await onUploadImage(file));
      } else {
        onChangeSrc(await readFileAsDataUrl(file));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void applyFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-md border border-dashed px-3 py-3 transition-colors ${
          dragging
            ? "border-black/30 bg-black/[0.04]"
            : "border-black/12 bg-black/[0.015]"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={EMAIL_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => void applyFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-black/75 transition-colors hover:border-black/20 hover:text-black disabled:cursor-wait disabled:opacity-60"
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : "Upload from computer"}
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-black/40">
          JPG, PNG, WebP, or GIF · under 2.5 MB
        </p>
      </div>
      {src.trim() ? (
        <div className="overflow-hidden rounded-md border border-black/8">
          <img
            src={src}
            alt=""
            className="h-16 w-full object-cover object-center"
          />
        </div>
      ) : null}
      <Field label="Or paste a URL">
        <input
          type="url"
          value={src}
          onChange={(e) => {
            setError(null);
            onChangeSrc(e.target.value);
          }}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>
      {error ? (
        <p className="text-[11px] leading-relaxed text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-black/55">{label}</span>
      {children}
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-black/55">{label}</span>
        <span className="text-[11px] tabular-nums text-black/45">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[#08090a]"
      />
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25";
