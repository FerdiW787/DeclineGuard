import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  normalizeLinkUrl,
  richTextToHtml,
  sanitizeEditorHtml,
} from "@/lib/emailRichText";
import { cn } from "@/lib/utils";
import SelectionFormatMenu from "./SelectionFormatMenu";
import TokenInsertMenu from "./TokenInsertMenu";

type Props = {
  value: string;
  onChange: (next: string) => void;
  editable: boolean;
  showSelectionMenu?: boolean;
  className?: string;
  style?: CSSProperties;
  brandColor?: string;
  emailColors?: string[];
  linkColor?: string;
};

type MenuState = {
  x: number;
  y: number;
  flip: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string | null;
  href: string | null;
};

type TokenMenuState = {
  x: number;
  y: number;
  flipUp: boolean;
};

export default function InlineRichText({
  value,
  onChange,
  editable,
  showSelectionMenu = true,
  className,
  style,
  brandColor,
  emailColors,
  linkColor,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const wasEditable = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const colorOpenRef = useRef(false);
  const linkOpenRef = useRef(false);
  const htmlRef = useRef("");
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [tokenMenu, setTokenMenu] = useState<TokenMenuState | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const resolvedLink = linkColor || brandColor || "#2563eb";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    const html = richTextToHtml(value);
    if (el.innerHTML !== html) el.innerHTML = html;
    htmlRef.current = el.innerHTML;
  }, [value]);

  useLayoutEffect(() => {
    if (editable && !wasEditable.current) {
      ref.current?.focus();
    }
    wasEditable.current = editable;
  }, [editable]);

  useLayoutEffect(() => {
    return () => {
      const raw = htmlRef.current;
      if (!raw) return;
      const next = sanitizeEditorHtml(raw);
      if (richTextToHtml(next) === richTextToHtml(valueRef.current)) return;
      onChangeRef.current(next);
    };
  }, []);

  const commit = () => {
    const el = ref.current;
    if (el) htmlRef.current = el.innerHTML;
    const raw = htmlRef.current;
    if (!raw) return;
    const next = sanitizeEditorHtml(raw);
    if (richTextToHtml(next) === richTextToHtml(valueRef.current)) return;
    onChangeRef.current(next);
  };

  const saveRange = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreRange = () => {
    const range = savedRange.current;
    const el = ref.current;
    if (!range || !el) return;
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const readMenu = (): MenuState | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return null;
    const island = 44;
    const flip = rect.right + 8 + island > window.innerWidth - 8;
    return {
      x: flip ? rect.left - 8 : rect.right + 8,
      y: rect.top,
      flip,
      bold: queryState("bold"),
      italic: queryState("italic"),
      underline: queryState("underline"),
      color: readSelectionColor(),
      href: readSelectionLink(),
    };
  };

  const readTokenMenu = (): TokenMenuState | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    if (!el.contains(sel.anchorNode)) return null;
    if (!isCaretAfterTrailingSpace(el, sel)) return null;
    const caret = collapsedCaretRect(sel, el);
    const menuH = 44;
    const menuW = 280;
    const flipUp = caret.bottom + 8 + menuH > window.innerHeight - 8;
    return {
      x: Math.min(
        Math.max(8, caret.left),
        window.innerWidth - menuW - 8,
      ),
      y: flipUp ? caret.top - 8 : caret.bottom + 8,
      flipUp,
    };
  };

  const syncMenu = () => {
    saveRange();
    const next = readMenu();
    setMenu(next);
    if (next) {
      setTokenMenu(null);
      if (next.href) setLinkValue(next.href);
      return;
    }
    setColorOpen(false);
    setLinkOpen(false);
    colorOpenRef.current = false;
    linkOpenRef.current = false;
    const token = readTokenMenu();
    setTokenMenu(token);
  };

  const run = (cmd: "bold" | "italic" | "underline") => {
    restoreRange();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd, false);
    commit();
    requestAnimationFrame(syncMenu);
  };

  const applyColor = (hex: string | null) => {
    restoreRange();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, hex || "#08090a");
    document.execCommand("styleWithCSS", false, "false");
    commit();
    requestAnimationFrame(syncMenu);
  };

  const applyLink = () => {
    const href = normalizeLinkUrl(linkValue);
    if (!href) return;
    restoreRange();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("createLink", false, href);
    document.execCommand("underline", false);
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, resolvedLink);
    document.execCommand("styleWithCSS", false, "false");
    commit();
    setLinkOpen(false);
    linkOpenRef.current = false;
    requestAnimationFrame(syncMenu);
  };

  const unlink = () => {
    restoreRange();
    document.execCommand("unlink", false);
    commit();
    setLinkOpen(false);
    setLinkValue("");
    linkOpenRef.current = false;
    requestAnimationFrame(syncMenu);
  };

  const insertToken = (token: "{{amount}}" | "{{product}}") => {
    restoreRange();
    document.execCommand("insertText", false, `${token} `);
    commit();
    requestAnimationFrame(syncMenu);
  };

  return (
    <>
      <div
        ref={ref}
        contentEditable={editable}
        suppressContentEditableWarning
        role={editable ? "textbox" : undefined}
        aria-multiline={editable ? true : undefined}
        spellCheck={editable}
        className={cn(className, "dg-email-rich")}
        style={{
          ...style,
          ["--dg-email-link" as string]: resolvedLink,
          outline: "none",
          cursor: editable ? "text" : undefined,
          whiteSpace: "pre-wrap",
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          window.setTimeout(() => {
            if (colorOpenRef.current || linkOpenRef.current) return;
            const sel = window.getSelection();
            if (
              sel &&
              !sel.isCollapsed &&
              ref.current?.contains(sel.anchorNode)
            ) {
              return;
            }
            setMenu(null);
            setTokenMenu(null);
            setColorOpen(false);
            setLinkOpen(false);
            commit();
          }, 0);
        }}
        onClick={(e) => {
          if (e.target instanceof HTMLAnchorElement) e.preventDefault();
        }}
        onInput={() => {
          commit();
          requestAnimationFrame(syncMenu);
        }}
        onMouseUp={syncMenu}
        onKeyUp={syncMenu}
        onSelect={syncMenu}
        onKeyDown={(e) => {
          if (!editable) return;
          if (!(e.metaKey || e.ctrlKey)) return;
          const key = e.key.toLowerCase();
          if (key === "b") {
            e.preventDefault();
            run("bold");
          } else if (key === "i") {
            e.preventDefault();
            run("italic");
          } else if (key === "u") {
            e.preventDefault();
            run("underline");
          } else if (key === "k") {
            e.preventDefault();
            saveRange();
            setLinkOpen(true);
            linkOpenRef.current = true;
            setColorOpen(false);
            colorOpenRef.current = false;
            const next = readMenu();
            if (next) {
              setMenu(next);
              if (next.href) setLinkValue(next.href);
            }
          }
        }}
      />
      {editable && tokenMenu ? (
        <TokenInsertMenu
          x={tokenMenu.x}
          y={tokenMenu.y}
          flipUp={tokenMenu.flipUp}
          onInsertAmount={() => insertToken("{{amount}}")}
          onInsertProduct={() => insertToken("{{product}}")}
        />
      ) : null}
      {editable && showSelectionMenu && menu ? (
        <SelectionFormatMenu
          x={menu.x}
          y={menu.y}
          flip={menu.flip}
          bold={menu.bold}
          italic={menu.italic}
          underline={menu.underline}
          linked={Boolean(menu.href)}
          colorOpen={colorOpen}
          linkOpen={linkOpen}
          linkValue={linkValue}
          activeColor={menu.color}
          brandColor={brandColor}
          emailColors={emailColors}
          onToggle={(cmd) => run(cmd)}
          onToggleColorOpen={() => {
            const next = !colorOpen;
            setColorOpen(next);
            colorOpenRef.current = next;
            setLinkOpen(false);
            linkOpenRef.current = false;
          }}
          onColor={applyColor}
          onToggleLinkOpen={() => {
            const next = !linkOpen;
            setLinkOpen(next);
            linkOpenRef.current = next;
            setColorOpen(false);
            colorOpenRef.current = false;
            if (next && menu.href) setLinkValue(menu.href);
          }}
          onLinkValue={setLinkValue}
          onApplyLink={applyLink}
          onUnlink={unlink}
        />
      ) : null}
    </>
  );
}

function queryState(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
}

function readSelectionColor(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node && node instanceof HTMLElement) {
    const color = node.style?.color;
    if (color) {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = color;
      const hex = ctx.fillStyle;
      return typeof hex === "string" && hex.startsWith("#") ? hex : null;
    }
    node = node.parentElement;
  }
  return null;
}

function isCaretAfterTrailingSpace(
  root: HTMLElement,
  sel: Selection,
): boolean {
  const range = sel.getRangeAt(0);
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(root);
  beforeRange.setEnd(range.endContainer, range.endOffset);
  const before = beforeRange.toString().replace(/\u00a0/g, " ");
  const afterRange = document.createRange();
  afterRange.selectNodeContents(root);
  afterRange.setStart(range.endContainer, range.endOffset);
  const after = afterRange.toString().replace(/\u00a0/g, " ");
  if (after.replace(/\s/g, "").length > 0) return false;
  return /[^\s][ ]+$/.test(before);
}

function collapsedCaretRect(sel: Selection, fallback: HTMLElement): DOMRect {
  const range = sel.getRangeAt(0);
  const live = range.getBoundingClientRect();
  if (live.height > 0 || live.width > 0) return live;
  const first = range.getClientRects()[0];
  if (first && (first.height > 0 || first.width > 0)) return first;

  const node = range.endContainer;
  const offset = range.endOffset;
  if (node.nodeType === Node.TEXT_NODE && offset > 0) {
    const probe = document.createRange();
    probe.setStart(node, offset - 1);
    probe.setEnd(node, offset);
    const prev = probe.getBoundingClientRect();
    if (prev.height > 0 || prev.width > 0) {
      return new DOMRect(prev.right, prev.top, 0, Math.max(prev.height, 16));
    }
  }

  return fallback.getBoundingClientRect();
}

function readSelectionLink(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node && node instanceof HTMLElement) {
    if (node.tagName === "A") return node.getAttribute("href");
    node = node.parentElement;
  }
  return null;
}
