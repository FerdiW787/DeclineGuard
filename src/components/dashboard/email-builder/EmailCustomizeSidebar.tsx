import type { StylingMode } from "@/lib/emailLayoutPresets";
import { Panel } from "../dashboardUi";
import type { ShortCopyField, ShortCopyValues } from "@/lib/emailBlockCopy";

type ColorKey =
  | "brandColor"
  | "ctaBackgroundColor"
  | "ctaTextColor"
  | "linkColor"
  | "mutedTextColor"
  | "emailBackgroundColor"
  | "emailTextColor";

type ColorValues = Record<ColorKey, string>;

type Props = {
  stylingMode: StylingMode;
  colors: ColorValues;
  onColorChange: (key: ColorKey, value: string) => void;
  copy: ShortCopyValues;
  onCopyChange: (field: ShortCopyField, value: string) => void;
  dayLabel: string;
};

const COLOR_FIELDS: { key: ColorKey; label: string }[] = [
  { key: "brandColor", label: "Primary" },
  { key: "ctaBackgroundColor", label: "Button" },
  { key: "ctaTextColor", label: "Button text" },
  { key: "linkColor", label: "Links" },
  { key: "mutedTextColor", label: "Muted text" },
  { key: "emailBackgroundColor", label: "Email background" },
  { key: "emailTextColor", label: "Email text" },
];

export default function EmailCustomizeSidebar({
  stylingMode,
  colors,
  onColorChange,
  copy,
  onCopyChange,
  dayLabel,
}: Props) {
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Colors
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8a8f98]">
          {stylingMode === "preset"
            ? "Edits apply when you switch to Configured. The layout stays."
            : "These are your store tokens."}
        </p>
        <div className="mt-3 space-y-2">
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={colors[field.key]}
              onChange={(value) => onColorChange(field.key, value)}
            />
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Short copy
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8a8f98]">
          Overrides for {dayLabel} only. Day 0 / 2 / 5 share the same layout.
        </p>
        <div className="mt-3 space-y-2.5">
          <TextField
            label="Subject"
            value={copy.subject}
            onChange={(value) => onCopyChange("subject", value)}
          />
          <TextField
            label="Headline"
            value={copy.headline}
            onChange={(value) => onCopyChange("headline", value)}
          />
          <TextField
            label="Body"
            value={copy.body}
            multiline
            onChange={(value) => onCopyChange("body", value)}
          />
          <TextField
            label="Button"
            value={copy.cta}
            onChange={(value) => onCopyChange("cta", value)}
          />
          <TextField
            label="Link"
            value={copy.link}
            onChange={(value) => onCopyChange("link", value)}
          />
        </div>
      </Panel>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hex = /^#([0-9a-fA-F]{6})$/.test(value) ? value : "#0c0c0c";
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-black/8 px-2.5 py-2">
      <span className="text-[12px] font-medium text-[#08090a]">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-black/10 bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-[5.5rem] rounded-md border border-black/10 px-1.5 py-1 font-mono text-[11px] outline-none focus:border-black/25"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const fieldClass =
    "w-full rounded-md border border-black/8 bg-[#f7f8f8] px-2.5 py-1.5 text-[13px] outline-none focus:border-black/20";
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-black/50">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={fieldClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </label>
  );
}
