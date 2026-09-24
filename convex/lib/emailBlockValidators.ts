import { v } from "convex/values";

const blockAlign = v.union(
  v.literal("left"),
  v.literal("center"),
  v.literal("right"),
);

const textBlock = v.object({
  id: v.string(),
  type: v.literal("text"),
  html: v.string(),
  fontSize: v.number(),
  color: v.union(v.literal("default"), v.literal("muted"), v.literal("link")),
  hexColor: v.optional(v.string()),
  bold: v.optional(v.boolean()),
  italic: v.optional(v.boolean()),
  underline: v.optional(v.boolean()),
  align: blockAlign,
  marginTop: v.number(),
  marginBottom: v.number(),
});

const imageBlock = v.object({
  id: v.string(),
  type: v.literal("image"),
  src: v.string(),
  alt: v.string(),
  width: v.number(),
  align: blockAlign,
  heightPx: v.optional(v.number()),
  zoom: v.optional(v.number()),
  radius: v.optional(v.number()),
  cropTop: v.optional(v.number()),
  cropBottom: v.optional(v.number()),
  cropLeft: v.optional(v.number()),
  cropRight: v.optional(v.number()),
  shadow: v.optional(v.boolean()),
  shadowColor: v.optional(v.string()),
  border: v.optional(v.boolean()),
  borderColor: v.optional(v.string()),
  borderWidth: v.optional(v.number()),
  shape: v.optional(
    v.union(
      v.literal("square"),
      v.literal("circle"),
      v.literal("pill"),
      v.literal("star"),
      v.literal("triangle"),
    ),
  ),
  fit: v.optional(v.union(v.literal("adjust"), v.literal("stretch"))),
  panX: v.optional(v.number()),
  offsetX: v.optional(v.number()),
  marginTop: v.number(),
  marginBottom: v.number(),
});

const buttonBlock = v.object({
  id: v.string(),
  type: v.literal("button"),
  label: v.string(),
  backgroundColor: v.string(),
  align: blockAlign,
  marginTop: v.number(),
  marginBottom: v.number(),
});

const spacerBlock = v.object({
  id: v.string(),
  type: v.literal("spacer"),
  height: v.number(),
  marginTop: v.number(),
  marginBottom: v.number(),
});

const dividerBlock = v.object({
  id: v.string(),
  type: v.literal("divider"),
  marginTop: v.number(),
  marginBottom: v.number(),
});

const linkRowBlock = v.object({
  id: v.string(),
  type: v.literal("linkRow"),
  prefix: v.string(),
  linkLabel: v.string(),
  suffix: v.string(),
  marginTop: v.number(),
  marginBottom: v.number(),
});

export const emailBlockValidator = v.union(
  textBlock,
  imageBlock,
  buttonBlock,
  spacerBlock,
  dividerBlock,
  linkRowBlock,
);

export const editableCopyFieldsValidator = v.object({
  subject: v.optional(v.string()),
  headline: v.optional(v.string()),
  body: v.optional(v.string()),
  cta: v.optional(v.string()),
  blocks: v.optional(v.array(emailBlockValidator)),
  linkColor: v.optional(v.string()),
  emailPadding: v.optional(v.number()),
  shellBackground: v.optional(v.string()),
  shellBorderColor: v.optional(v.string()),
  shellBorder: v.optional(v.boolean()),
  shellBorderWidth: v.optional(v.number()),
  shellRadius: v.optional(v.number()),
});

export const emailCopyValidator = v.object({
  gentle: v.optional(editableCopyFieldsValidator),
  direct: v.optional(editableCopyFieldsValidator),
  urgent: v.optional(editableCopyFieldsValidator),
});
