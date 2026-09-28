import type { LayoutPresetId, StylingMode } from "@/lib/emailLayoutPresets";
import { LAYOUT_PRESET_STRUCTURE_META } from "@/lib/emailLayoutPresets";
import { LAYOUT_PRESET_IDS } from "@/lib/emailTheme";
import { cn } from "@/lib/utils";
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
  layoutPresetId: LayoutPresetId;
  onLayoutPresetChange: (id: LayoutPresetId) => void;
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
  layoutPresetId,
  onLayoutPresetChange,
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
          Layout
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6b6f76]">
          Structure for every recovery email. Colors follow{" "}
          {stylingMode === "preset" ? "the selected layout" : "your store"}.
        </p>
        <div className="mt-3 space-y-1" role="listbox" aria-label="Email layout">
          {LAYOUT_PRESET_IDS.map((id) => {
            const meta = LAYOUT_PRESET_STRUCTURE_META[id];
            const active = id === layoutPresetId;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onLayoutPresetChange(id)}
                className={cn(
                  "dg-interactive flex w-full items-start justify-between gap-2 rounded-md border px-2.5 py-2 text-left",
                  active
                    ? "border-black/12 bg-[#f7f8f8]"
                    : "border-transparent",
                )}
              >
                <span className="text-[13px] font-semibold text-[#08090a]">
                  {meta.label}
                </span>
                <span className="max-w-[9rem] text-right text-[11px] leading-snug text-[#8a8f98]">
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

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
          Overrides for {dayLabel} only. Click a block in the email to edit in
          place.
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
