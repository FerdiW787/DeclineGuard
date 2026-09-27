type Props = {
  html: string;
  background?: string;
  title?: string;
  className?: string;
};

/** Studio preview — same HTML the send/preview APIs build. */
export default function EmailLayoutPreview({
  html,
  background = "#f7f5f2",
  title = "Recovery email preview",
  className,
}: Props) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      className={className}
      style={{
        display: "block",
        width: "100%",
        minHeight: 720,
        border: 0,
        background,
      }}
    />
  );
}
