import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  ImageIcon,
  Minus,
  MousePointerClick,
  Plus,
  Square,
  Trash2,
  Type,
  Link2,
} from "lucide-react";
import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "../../../../convex/lib/brandImport/colors";
import {
  BLOCK_TYPE_META,
  collectEmailColors,
  createEmptyBlock,
  imageCropPreviewStyles,
  markersToHtml,
  resolveTextBlockColor,
  styleEmailAnchors,
  textBlockFaceStyle,
  wrapSelectionWithBold,
  type EmailBlock,
  type EmailBlockType,
  resolveShellBackground,
  resolveShellBorder,
  resolveShellBorderColor,
  resolveShellBorderWidth,
  resolveShellRadius,
  type EmailDocument,
} from "@/lib/emailBuilder";
import { applyCopyVars } from "@/lib/recoveryEmailCopy";
import EmailStoreHeader from "../EmailStoreHeader";
import { useEmailFontLoader } from "../useEmailFontLoader";

function isDarkShell(hex: string): boolean {
  const m = hex.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);
  if (!m?.[1]) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}
import {
  DEFAULT_EMAIL_FONT,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";
import TextFormatToolbar from "./TextFormatToolbar";
import TextBlockEditBar from "./TextBlockEditBar";
import EmailShellEditBar from "./EmailShellEditBar";
import EmailShellRadiusHandles from "./EmailShellRadiusHandles";
import ImageBlockHandles from "./ImageBlockHandles";
import ImageBlockEditBar from "./ImageBlockEditBar";
import InlineRichText from "./InlineRichText";

type Vars = { product: string; amount: string; firstName?: string };
type Device = "desktop" | "mobile";

export type EmailSelectionApi = {
  clear: () => boolean;
};

type Props = {
  document: EmailDocument;
  device: Device;
  /** Preview-only: hides all editing affordances (guided mode). */
  readOnly?: boolean;
  /** Focus-mode: hover a block and edit it in place. */
  inlineEdit?: boolean;
  /** Lets the parent clear the current shell / block selection synchronously. */
  selectionApiRef?: MutableRefObject<EmailSelectionApi>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChangeBlocks?: (blocks: EmailBlock[]) => void;
  onPatchDocument?: (patch: Partial<EmailDocument>) => void;
  onChangeSubject?: (subject: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  storeName: string;
  storeLogoUrl: string | null;
  primary: string;
  secondary: string;
  emailFont?: EmailFontId;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  /** Brand-level link color — overrides document.linkColor when set */
  linkColor?: string | null;
  /** When set, overrides device max-width (resizable preview frame). */
  frameWidth?: number | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  senderLine: string;
  customerFirstName: string;
  vars: Vars;
  showDeclineGuardBadge: boolean;
  /** Inbox From / Subject chrome above the message. */
  showInboxMeta?: boolean;
  frameClassName?: string;
  footerSupport: string;
  socialLinks: readonly (readonly [string, string])[];
};

const ADDABLE: EmailBlockType[] = [
  "text",
  "image",
  "button",
  "spacer",
  "divider",
];

/** Sentinel index for the persistent "Add block" button at the very end. */
const ADD_END = -2;

export default function EmailBuilderCanvas({
  document,
  device,
  readOnly = false,
  inlineEdit = false,
  selectionApiRef,
  selectedId = null,
  onSelect,
  onChangeBlocks,
  onPatchDocument,
  onDuplicateBlock,
  onRemoveBlock,
  onUploadImage,
  storeName,
  storeLogoUrl,
  primary,
  secondary,
  emailFont = DEFAULT_EMAIL_FONT,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  linkColor: linkColorProp,
  frameWidth = null,
  emailBackgroundColor,
  emailTextColor,
  senderLine,
  customerFirstName,
  vars,
  showDeclineGuardBadge,
  showInboxMeta = true,
  frameClassName,
  footerSupport,
  socialLinks,
}: Props) {
  useEmailFontLoader(emailFont);
  const shellBg = resolveShellBackground(
    document,
    emailBackgroundColor?.trim() || "#ffffff",
  );
  const shellBorderOn = resolveShellBorder(document);
  const shellBorderColor = resolveShellBorderColor(document, primary);
  const shellBorderWidth = resolveShellBorderWidth(document);
  const shellRadius = resolveShellRadius(document);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hoveringShell, setHoveringShell] = useState(false);
  const [shellSelected, setShellSelected] = useState(false);
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    emailTextColor?.trim() || "#0c0c0c",
    secondary?.trim() || "#6b6b70",
  );
  const shellText = hierarchy.bodyText;
  const mutedSecondary = hierarchy.mutedText;
  const darkShell = isDarkShell(shellBg);
  const footerMuted = darkShell ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const footerFaint = darkShell ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const footerRule = darkShell
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.08)";
  const footerSocial = darkShell
    ? "rgba(255,255,255,0.7)"
    : "rgba(0,0,0,0.7)";
  const effectiveLinkColor =
    linkColorProp?.trim() || document.linkColor?.trim() || primary;
  const ctaBg = ctaBackgroundColor?.trim() || primary;
  const ctaFg = ensureCtaLabelContrast(
    ctaBg,
    ctaTextColor?.trim() || "#ffffff",
  );
  const ctaRadius =
    typeof ctaBorderRadiusPx === "number"
      ? Math.max(0, Math.min(9999, ctaBorderRadiusPx))
      : 12;
  const emailColors = collectEmailColors(document, [
    primary,
    secondary,
    shellBg,
    shellText,
    mutedSecondary,
    effectiveLinkColor,
    ctaBg,
    ctaFg,
    shellBorderColor,
  ]);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlinePickedId, setInlinePickedId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const activeSelectedId = inlineEdit ? inlinePickedId : selectedId;

  useEffect(() => {
    if (!inlineEdit) {
      setInlinePickedId(null);
      setEditingId(null);
      setAddAt(null);
      setShellSelected(false);
      setHoveringShell(false);
    }
  }, [inlineEdit]);

  const selectedRef = useRef(false);
  selectedRef.current = Boolean(
    inlineEdit && (shellSelected || inlinePickedId || editingId),
  );

  useLayoutEffect(() => {
    if (!selectionApiRef) return;
    selectionApiRef.current = {
      clear: () => {
        if (!selectedRef.current) return false;
        selectedRef.current = false;
        setInlinePickedId(null);
        setEditingId(null);
        setAddAt(null);
        setShellSelected(false);
        setHoveringShell(false);
        onSelect?.(null);
        return true;
      },
    };
    return () => {
      selectionApiRef.current = { clear: () => false };
    };
  }, [selectionApiRef, onSelect]);

  const patchBlock = useCallback(
    (id: string, patch: Partial<EmailBlock>) => {
      onChangeBlocks?.(
        document.blocks.map((b) =>
          b.id === id ? ({ ...b, ...patch, type: b.type, id: b.id } as EmailBlock) : b,
        ),
      );
    },
    [document.blocks, onChangeBlocks],
  );

  const insertAt = (index: number, type: EmailBlockType) => {
    const block = createEmptyBlock(type);
    const next = [...document.blocks];
    next.splice(index, 0, block);
    onChangeBlocks?.(next);
    onSelect?.(block.id);
    setInlinePickedId(block.id);
    if (type === "text") setEditingId(block.id);
    setAddAt(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = document.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= document.blocks.length) return;
    const next = [...document.blocks];
    const [item] = next.splice(idx, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChangeBlocks?.(next);
  };

  const onDragStart = (id: string) => {
    dragId.current = id;
  };

  const onDropOn = (targetId: string) => {
    const fromId = dragId.current;
    dragId.current = null;
    if (!fromId || fromId === targetId) return;
    const from = document.blocks.findIndex((b) => b.id === fromId);
    const to = document.blocks.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...document.blocks];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChangeBlocks?.(next);
  };

  const subject = applyCopyVars(document.subject, vars);

  const defaultMax =
    device === "mobile" ? 380 : 512; /* 32rem */
  const maxWidth =
    typeof frameWidth === "number" && Number.isFinite(frameWidth)
      ? Math.max(240, Math.round(frameWidth))
      : defaultMax;

  const showShellChrome = Boolean(inlineEdit && (hoveringShell || shellSelected));

  return (
    <div
      className="mx-auto w-full transition-[max-width] duration-300 ease-out"
      style={{ maxWidth }}
      onClick={() => {
        if (readOnly) return;
        onSelect?.(null);
        setInlinePickedId(null);
        setEditingId(null);
        setAddAt(null);
        setShellSelected(false);
      }}
    >
      <div
        ref={cardRef}
        className={`dg-keep-light overflow-hidden bg-white shadow-[0_24px_60px_-36px_rgba(0,0,0,0.4)] ${frameClassName ?? ""}`}
        style={{
          background: shellBg,
          borderStyle: "solid",
          borderWidth: shellBorderOn ? shellBorderWidth : 0,
          borderColor: shellBorderColor,
          borderRadius: shellRadius,
        }}
        onPointerMove={(e) => {
          if (!inlineEdit) return;
          const t = e.target;
          if (!(t instanceof HTMLElement)) return;
          if (t.closest("[data-email-block]")) {
            setHoveringShell(false);
            return;
          }
          setHoveringShell(true);
        }}
        onPointerLeave={(e) => {
          const next = e.relatedTarget;
          if (
            next instanceof HTMLElement &&
            next.closest("[data-shell-handle], [data-image-handle]")
          ) {
            return;
          }
          setHoveringShell(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!inlineEdit || readOnly) return;
          const t = e.target;
          if (t instanceof HTMLElement && t.closest("[data-email-block]")) {
            return;
          }
          setShellSelected(true);
          setInlinePickedId(null);
          setEditingId(null);
          onSelect?.(null);
        }}
      >
        {showInboxMeta ? (
          <div className="border-b border-black/6 bg-[#fafafa] px-5 py-3">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
              From
            </p>
            <p className="truncate text-[12px] font-medium text-black/70">
              {senderLine}
            </p>
            <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
              Subject
            </p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-black">
              {subject}
            </p>
          </div>
        ) : null}

        <div
          data-email-column=""
          className="px-6 py-8 md:px-8"
          style={{
            paddingLeft: document.emailPadding,
            paddingRight: document.emailPadding,
            fontFamily: emailFontFamily(emailFont),
            background: shellBg,
            color: shellText,
          }}
        >
          <EmailStoreHeader
            storeName={storeName}
            storeLogoUrl={storeLogoUrl}
            primary={primary}
            emailFont={emailFont}
            textColor={shellText}
          />

          <p
            className="mb-4 text-[17px] font-semibold tracking-tight"
            style={{ color: shellText }}
          >
            Hi {customerFirstName},
          </p>

          {!readOnly && !inlineEdit ? (
            <AddGap
              open={addAt === 0}
              suppressed={addAt != null && addAt !== 0}
              onOpen={() => setAddAt(0)}
              onClose={() => setAddAt(null)}
              onPick={(t) => insertAt(0, t)}
            />
          ) : null}

          {document.blocks.map((block, index) => (
            <div key={block.id}>
              <CanvasBlock
                block={block}
                readOnly={readOnly}
                inlineEdit={inlineEdit}
                selected={activeSelectedId === block.id}
                editing={editingId === block.id}
                primary={primary}
                ctaBackgroundColor={ctaBg}
                ctaTextColor={ctaFg}
                ctaBorderRadiusPx={ctaRadius}
                linkColor={effectiveLinkColor}
                mutedColor={mutedSecondary}
                bodyTextColor={shellText}
                emailColors={emailColors}
                vars={vars}
                onSelect={() => {
                  setShellSelected(false);
                  if (inlineEdit) {
                    setInlinePickedId(block.id);
                  }
                  onSelect?.(block.id);
                  setAddAt(null);
                }}
                onStartEdit={() => {
                  onSelect?.(block.id);
                  setEditingId(block.id);
                }}
                onStopEdit={() => setEditingId(null)}
                onPatch={(patch) => patchBlock(block.id, patch)}
                onMoveUp={() => move(block.id, -1)}
                onMoveDown={() => move(block.id, 1)}
                onDuplicate={() => onDuplicateBlock?.(block.id)}
                onRemove={() => {
                  setInlinePickedId(null);
                  setEditingId(null);
                  onSelect?.(null);
                  onRemoveBlock?.(block.id);
                }}
                onUploadImage={onUploadImage}
                canMoveUp={index > 0}
                canMoveDown={index < document.blocks.length - 1}
                onDragStart={() => onDragStart(block.id)}
                onDrop={() => onDropOn(block.id)}
              />
              {!readOnly && !inlineEdit ? (
                <AddGap
                  open={addAt === index + 1}
                  suppressed={addAt != null && addAt !== index + 1}
                  onOpen={() => setAddAt(index + 1)}
                  onClose={() => setAddAt(null)}
                  onPick={(t) => insertAt(index + 1, t)}
                />
              ) : null}
            </div>
          ))}

          {/* Persistent, discoverable add affordance (sentinel -2) */}
          {!readOnly && !inlineEdit ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddAt(addAt === ADD_END ? null : ADD_END);
                }}
                className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-2.5 text-[11px] font-semibold transition-colors ${
                  addAt === ADD_END
                    ? "border-teal-500/40 bg-teal-50/60 text-teal-700"
                    : "border-black/12 text-black/40 hover:border-black/25 hover:text-black/70"
                }`}
              >
                <Plus className="size-3.5" />
                Add block
              </button>
              {addAt === ADD_END ? (
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <BlockPalette
                    onPick={(t) => insertAt(document.blocks.length, t)}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <hr className="my-8" style={{ borderColor: footerRule }} />

          <p
            className="font-display text-[1.65rem] font-bold leading-none tracking-[-0.03em]"
            style={{ color: shellText }}
          >
            {storeName}
          </p>
          <p
            className="mt-2.5 text-[12px] leading-relaxed"
            style={{ color: footerMuted }}
          >
            Questions or feedback? Drop us a line at{" "}
            <span style={{ color: effectiveLinkColor }} className="underline">
              {footerSupport}
            </span>
            .
          </p>
          {socialLinks.length > 0 ? (
            <p
              className="mt-4 flex flex-wrap gap-3.5 text-[12px] font-medium"
              style={{ color: footerSocial }}
            >
              {socialLinks.map(([label]) => (
                <span key={label}>{label}</span>
              ))}
            </p>
          ) : (
            <p className="mt-4 text-[11px]" style={{ color: footerFaint }}>
              Socials appear here when you add them.
            </p>
          )}
          <p className="mt-5 text-[11px]" style={{ color: footerFaint }}>
            © {new Date().getFullYear()} {storeName}
          </p>
          {showDeclineGuardBadge ? (
            <p
              className="mt-6 border-t pt-4 text-center text-[11px]"
              style={{ borderColor: footerRule, color: footerFaint }}
            >
              Recovery sent by{" "}
              <span
                className="font-semibold"
                style={{ color: effectiveLinkColor }}
              >
                DeclineGuard
              </span>
            </p>
          ) : null}
        </div>
      </div>
      {showShellChrome ? (
        <EmailShellRadiusHandles
          radius={shellRadius}
          anchorRef={cardRef}
          onChange={(next) => onPatchDocument?.({ shellRadius: next })}
        />
      ) : null}
      {inlineEdit && shellSelected ? (
        <EmailShellEditBar
          background={shellBg}
          borderColor={shellBorderColor}
          borderOn={shellBorderOn}
          borderWidth={shellBorderWidth}
          radius={shellRadius}
          brandColor={primary}
          emailColors={emailColors}
          anchorRef={cardRef}
          onPatch={(patch) => onPatchDocument?.(patch)}
        />
      ) : null}
    </div>
  );
}

function AddGap({
  open,
  suppressed,
  onOpen,
  onClose,
  onPick,
}: {
  open: boolean;
  /** Another add menu is open — hide this gap entirely so it can't cover the dropdown. */
  suppressed: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (t: EmailBlockType) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (suppressed || !open) {
      if (suppressed) {
        setHovered(false);
        setX(null);
      }
    }
  }, [suppressed, open]);

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressed) return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 28;
    const next = Math.min(
      rect.width - pad,
      Math.max(pad, e.clientX - rect.left),
    );
    setX(next);
  };

  const visible = !suppressed && (open || hovered);

  return (
    <div
      ref={trackRef}
      className={`relative h-0 ${open ? "z-50" : suppressed ? "z-0" : "z-20"}`}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => {
        if (!suppressed) setHovered(true);
      }}
      onMouseLeave={() => {
        if (!open) {
          setHovered(false);
          setX(null);
        }
      }}
      onMouseMove={onMove}
    >
      {/* Tall invisible hit strip so the gap is easy to catch */}
      <div
        className={`absolute inset-x-0 top-1/2 h-5 -translate-y-1/2 ${
          suppressed ? "pointer-events-none" : ""
        }`}
      />

      <div
        className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-100 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: x ?? "50%" }}
      >
        <button
          type="button"
          onClick={() => (open ? onClose() : onOpen())}
          className={`inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold text-black/50 shadow-sm transition-colors hover:border-black/20 hover:text-black ${
            suppressed
              ? "pointer-events-none"
              : "pointer-events-auto cursor-pointer"
          }`}
          aria-label="Add block"
          tabIndex={suppressed ? -1 : 0}
        >
          <Plus className="size-3" />
          Add
        </button>
        {open ? (
          <div className="pointer-events-auto absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2">
            <BlockPalette onPick={onPick} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Grid of insertable block types with icon + label + description. */
function BlockPalette({ onPick }: { onPick: (t: EmailBlockType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border border-black/10 bg-white p-1.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.4)]">
      {ADDABLE.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          className="dg-interactive flex items-start gap-2 rounded-md px-2 py-1.5 text-left"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-black/[0.05] text-black/55">
            <BlockTypeIcon type={type} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-black">
              {BLOCK_TYPE_META[type].label}
            </span>
            <span className="block truncate text-[10px] text-black/40">
              {BLOCK_TYPE_META[type].description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof ChevronUp;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex size-6 items-center justify-center rounded transition-colors disabled:opacity-25 ${
        danger
          ? "cursor-pointer text-black/45 hover:bg-red-50 hover:text-red-600"
          : "cursor-pointer text-black/45 hover:bg-black/5 hover:text-black"
      } disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function BlockTypeIcon({ type }: { type: EmailBlockType }) {
  switch (type) {
    case "text":
      return <Type className="size-3" />;
    case "image":
      return <ImageIcon className="size-3" />;
    case "button":
      return <Square className="size-3" />;
    case "spacer":
      return <MousePointerClick className="size-3" />;
    case "divider":
      return <Minus className="size-3" />;
    case "linkRow":
      return <Link2 className="size-3" />;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function CanvasBlock({
  block,
  readOnly,
  inlineEdit,
  selected,
  editing,
  primary,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  linkColor,
  mutedColor,
  bodyTextColor,
  emailColors,
  vars,
  onSelect,
  onStartEdit,
  onStopEdit,
  onPatch,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onUploadImage,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDrop,
}: {
  block: EmailBlock;
  readOnly: boolean;
  inlineEdit: boolean;
  selected: boolean;
  editing: boolean;
  primary: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  linkColor: string;
  mutedColor: string;
  bodyTextColor: string;
  emailColors: string[];
  vars: Vars;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onPatch: (patch: Partial<EmailBlock>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && block.type === "text" && textRef.current) {
      textRef.current.focus();
      const len = textRef.current.value.length;
      textRef.current.setSelectionRange(len, len);
    }
  }, [editing, block.type]);

  const handleBold = () => {
    if (block.type !== "text" || !textRef.current) return;
    const el = textRef.current;
    const { text, start, end } = wrapSelectionWithBold(
      block.html,
      el.selectionStart,
      el.selectionEnd,
    );
    onPatch({ html: text });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  const insertToken = (token: string) => {
    if (block.type !== "text" || !textRef.current) {
      if (block.type === "text") {
        onPatch({ html: `${block.html}${block.html ? " " : ""}${token}` });
      }
      return;
    }
    const el = textRef.current;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const next = block.html.slice(0, s) + token + block.html.slice(e);
    onPatch({ html: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      handleBold();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onStopEdit();
    }
  };

  const shell = (
    e: ReactMouseEvent,
    opts?: { doubleEdit?: boolean },
  ) => {
    e.stopPropagation();
    onSelect();
    if (opts?.doubleEdit) onStartEdit();
  };

  const dragProps = readOnly
    ? {}
    : {
        draggable: true,
        onDragStart: (e: DragEvent) => {
          e.stopPropagation();
          onDragStart();
          e.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop();
        },
      };

  if (readOnly || inlineEdit) {
    const live = Boolean(inlineEdit && !readOnly);
    const isText = block.type === "text";
    const chrome = live && isText;
    const faceFallbacks = {
      body: bodyTextColor,
      muted: mutedColor,
      link: linkColor,
    };
    return (
      <div
        data-email-block={block.id}
        className="relative"
        style={{
          marginTop: block.marginTop,
          marginBottom: block.marginBottom,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {chrome && selected && block.type === "text" ? (
          <TextBlockEditBar
            block={block}
            activeColor={resolveTextBlockColor(block, faceFallbacks)}
            brandColor={primary}
            emailColors={emailColors}
            anchorRef={chromeRef}
            onPatch={(patch) => onPatch(patch)}
          />
        ) : null}
        {live && selected && block.type === "image" ? (
          <>
            <ImageBlockHandles
              block={block}
              anchorRef={imageWrapRef}
              onPatch={(patch) => onPatch(patch)}
            />
            <ImageBlockEditBar
              block={block}
              brandColor={primary}
              emailColors={emailColors}
              anchorRef={imageWrapRef}
              onPatch={(patch) => onPatch(patch)}
              onRemove={onRemove}
              onUploadImage={onUploadImage}
            />
          </>
        ) : null}
        <div
          ref={chromeRef}
          role={chrome ? "group" : undefined}
          aria-label={chrome ? "Text block" : undefined}
          className={
            chrome
              ? `border-2 p-1 transition-colors duration-150 ${
                  selected
                    ? "border-[#2563eb]"
                    : "border-transparent hover:border-[#2563eb]"
                }`
              : "relative"
          }
          onClick={(e) => {
            if (!chrome) return;
            e.stopPropagation();
            onSelect();
          }}
        >
          <BlockContent
            block={block}
            editing={false}
            inlineEdit={live}
            selected={selected}
            textRef={textRef}
            imageWrapRef={imageWrapRef}
            primary={primary}
            ctaBackgroundColor={ctaBackgroundColor}
            ctaTextColor={ctaTextColor}
            ctaBorderRadiusPx={ctaBorderRadiusPx}
            linkColor={linkColor}
            mutedColor={mutedColor}
            bodyTextColor={bodyTextColor}
            emailColors={emailColors}
            vars={vars}
            onPatch={onPatch}
            onStopEdit={onStopEdit}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      data-email-block={block.id}
      className={`group/block relative rounded-md transition-[box-shadow,background] ${
        selected
          ? "bg-teal-500/[0.04] ring-2 ring-teal-500/40 ring-offset-2"
          : "hover:bg-black/[0.015]"
      }`}
      onClick={(e) => shell(e)}
      onDoubleClick={(e) => shell(e, { doubleEdit: block.type === "text" })}
    >
      {selected ? (
        <span className="pointer-events-none absolute -top-2.5 left-2 z-20 rounded bg-teal-600 px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
          {BLOCK_TYPE_META[block.type].label}
        </span>
      ) : null}

      {selected && !editing ? (
        <div
          className="absolute -top-3.5 right-1.5 z-20 flex items-center gap-0.5 rounded-md border border-black/10 bg-white px-0.5 py-0.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)]"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="flex size-6 cursor-grab items-center justify-center rounded text-black/35 hover:bg-black/5 hover:text-black/60"
            aria-hidden
            title="Drag to reorder"
          >
            <GripVertical className="size-3.5" />
          </span>
          <ToolbarBtn
            icon={ChevronUp}
            label="Move up"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          />
          <ToolbarBtn
            icon={ChevronDown}
            label="Move down"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          />
          <ToolbarBtn icon={Copy} label="Duplicate" onClick={onDuplicate} />
          <ToolbarBtn
            icon={Trash2}
            label="Delete"
            danger
            onClick={onRemove}
          />
        </div>
      ) : null}

      {selected && block.type === "text" && editing ? (
        <div
          className="absolute -top-10 left-0 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <TextFormatToolbar onBold={handleBold} onInsertToken={insertToken} />
        </div>
      ) : null}

      <div
        style={{
          marginTop: block.marginTop,
          marginBottom: block.marginBottom,
        }}
      >
        <BlockContent
          block={block}
          editing={editing}
          inlineEdit={false}
          selected={selected}
          textRef={textRef}
          imageWrapRef={imageWrapRef}
          primary={primary}
          ctaBackgroundColor={ctaBackgroundColor}
          ctaTextColor={ctaTextColor}
          ctaBorderRadiusPx={ctaBorderRadiusPx}
          linkColor={linkColor}
          mutedColor={mutedColor}
          bodyTextColor={bodyTextColor}
          emailColors={emailColors}
          vars={vars}
          onPatch={onPatch}
          onStopEdit={onStopEdit}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

/** Shared per-type rendering used by both the editor and the preview. */
function BlockContent({
  block,
  editing,
  inlineEdit,
  selected,
  textRef,
  imageWrapRef,
  primary,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  linkColor,
  mutedColor,
  bodyTextColor,
  emailColors,
  vars,
  onPatch,
  onStopEdit,
  onKeyDown,
}: {
  block: EmailBlock;
  editing: boolean;
  inlineEdit: boolean;
  selected: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
  imageWrapRef?: RefObject<HTMLDivElement | null>;
  primary: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  linkColor: string;
  mutedColor: string;
  bodyTextColor: string;
  emailColors: string[];
  vars: Vars;
  onPatch: (patch: Partial<EmailBlock>) => void;
  onStopEdit: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  if (block.type === "text") {
    const face = textBlockFaceStyle(block, {
      body: bodyTextColor,
      muted: mutedColor,
      link: linkColor,
    });
    if (inlineEdit) {
      return (
        <InlineRichText
          value={block.html}
          onChange={(html) => onPatch({ html })}
          editable={selected}
          showSelectionMenu
          brandColor={primary}
          emailColors={emailColors}
          linkColor={linkColor}
          className="min-h-[1.4em] w-full px-1 py-0.5"
          style={face}
        />
      );
    }
    return editing ? (
      <textarea
        ref={textRef}
        value={block.html}
        onChange={(e) => onPatch({ html: e.target.value })}
        onBlur={() => onStopEdit()}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        rows={Math.max(2, block.html.split("\n").length + 1)}
        className="w-full resize-none border-0 bg-transparent p-1 text-[15px] leading-relaxed outline-none"
        style={face}
      />
    ) : (
      <p
        style={face}
        dangerouslySetInnerHTML={{
          __html: styleEmailAnchors(
            markersToHtml(applyCopyVars(block.html, vars)),
            linkColor,
          ),
        }}
      />
    );
  }

  if (block.type === "image") {
    const crop = imageCropPreviewStyles(block);
    return block.src.trim() ? (
      <div style={{ textAlign: "left" }}>
        <div
          ref={imageWrapRef}
          style={{
            ...crop.wrap,
            display: "inline-block",
            maxWidth: "100%",
          }}
        >
          <img
            src={block.src}
            alt={block.alt || ""}
            draggable={false}
            style={crop.img}
          />
        </div>
      </div>
    ) : (
      <div
        ref={imageWrapRef}
        className="rounded-md border border-dashed border-black/15 bg-black/[0.02] px-4 py-10 text-center"
        style={{
          ...crop.wrap,
          display: "inline-block",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <ImageIcon className="mx-auto size-5 text-black/30" />
        <p className="mt-2 text-[12px] font-medium text-black/45">
          Add an image to show it here
        </p>
      </div>
    );
  }

  if (block.type === "button") {
    const bg = /^#[0-9a-fA-F]{6}$/.test(block.backgroundColor)
      ? block.backgroundColor
      : ctaBackgroundColor || primary;
    const label = ensureCtaLabelContrast(bg, ctaTextColor);
    return (
      <div style={{ textAlign: block.align }}>
        <span
          className={`inline-flex px-5 py-2.5 text-xs font-semibold transition-[box-shadow] duration-150 ${
            inlineEdit
              ? "cursor-text outline-none hover:shadow-[0_0_0_3px_rgba(8,9,10,0.08)]"
              : ""
          }`}
          style={{
            background: bg,
            color: label,
            borderRadius: ctaBorderRadiusPx,
          }}
          contentEditable={inlineEdit}
          suppressContentEditableWarning
          spellCheck={inlineEdit}
          onBlur={
            inlineEdit
              ? (e) => {
                  const next = e.currentTarget.textContent?.trim() ?? "";
                  if (next && next !== block.label) onPatch({ label: next });
                }
              : undefined
          }
        >
          {block.label}
        </span>
      </div>
    );
  }

  if (block.type === "spacer") {
    return (
      <div
        className="flex items-center justify-center border border-dashed border-black/10 bg-black/[0.02] text-[10px] font-medium text-black/35"
        style={{ height: Math.max(block.height, 16) }}
      >
        {block.height}px
      </div>
    );
  }

  if (block.type === "divider") {
    return <hr className="border-black/8" />;
  }

  if (block.type === "linkRow") {
    return (
      <p
        className={`text-[13px] leading-relaxed ${inlineEdit ? "px-1 py-0.5" : ""}`}
        style={{ color: mutedColor }}
      >
        <EditableSpan
          enabled={inlineEdit}
          value={block.prefix}
          onChange={(prefix) => onPatch({ prefix })}
        />
        <EditableSpan
          enabled={inlineEdit}
          value={block.linkLabel}
          onChange={(linkLabel) => onPatch({ linkLabel })}
          className="underline"
          style={{ color: linkColor }}
        />
        <EditableSpan
          enabled={inlineEdit}
          value={block.suffix}
          onChange={(suffix) => onPatch({ suffix })}
        />
      </p>
    );
  }

  const _exhaustive: never = block;
  return _exhaustive;
}

function EditableSpan({
  enabled,
  value,
  onChange,
  className,
  style,
}: {
  enabled: boolean;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  if (!enabled) {
    return (
      <span className={className} style={style}>
        {value}
      </span>
    );
  }
  return (
    <span
      className={`cursor-text rounded-sm outline-none hover:bg-black/[0.04] ${className ?? ""}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? "";
        if (next !== value) onChange(next);
      }}
    >
      {value}
    </span>
  );
}
