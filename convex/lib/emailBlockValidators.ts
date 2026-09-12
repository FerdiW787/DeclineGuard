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
});

export const emailCopyValidator = v.object({
  gentle: v.optional(editableCopyFieldsValidator),
  direct: v.optional(editableCopyFieldsValidator),
  urgent: v.optional(editableCopyFieldsValidator),
});
