import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { normalizeRole, roleValidator } from "../lib/admin";
import {
  recoveryFeePercent,
  resolvePlan,
} from "../lib/accountGuard";
import { planValidator } from "../schema";
import { archiveMerchantData } from "./lemonSqueezy";

export const ensureCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existing) {
      // Soft-migrate legacy "standard" → "user" on touch
      if (existing.role === "standard") {
        await ctx.db.patch(existing._id, { role: "user" });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      userId: identity.subject,
      userName: identity.name ?? identity.nickname ?? "User",
      userProfilePic: identity.pictureUrl ?? null,
      role: "user",
      accountStatus: "active",
    });
  },
});

export const upsertUser = internalMutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    userProfilePic: v.union(v.string(), v.null()),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role =
      args.role === "standard" ? "user" : (args.role as "user" | "staff" | "admin");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userName: args.userName,
        userProfilePic: args.userProfilePic,
        role,
      });
    } else {
      await ctx.db.insert("users", {
        userId: args.userId,
        userName: args.userName,
        userProfilePic: args.userProfilePic,
        role,
        accountStatus: "active",
      });
    }
    return null;
  },
});

const appRoleValidator = v.union(
  v.literal("user"),
  v.literal("staff"),
  v.literal("admin"),
);

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      userId: v.string(),
      userName: v.string(),
      userProfilePic: v.union(v.string(), v.null()),
      role: appRoleValidator,
      accountStatus: v.union(
        v.literal("active"),
        v.literal("frozen"),
        v.literal("disabled"),
      ),
      frozenReason: v.union(v.string(), v.null()),
      /** Read-only billing plan. Merchants cannot self-set this. */
      plan: planValidator,
      recoveryFeePercent: v.union(v.literal(10), v.literal(4)),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!user) return null;

    const plan = resolvePlan(user);
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      userId: user.userId,
      userName: user.userName,
      userProfilePic: user.userProfilePic,
      role: normalizeRole(user.role),
      accountStatus: user.accountStatus ?? "active",
      frozenReason: user.frozenReason ?? null,
      plan,
      recoveryFeePercent: recoveryFeePercent(plan),
    };
  },
});

export const deleteMyAccount = mutation({
  args: { confirmEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const expected = (identity.email ?? "").trim().toLowerCase();
    const typed = args.confirmEmail.trim().toLowerCase();
    if (expected) {
      if (typed !== expected) {
        throw new Error(
          "Email does not match. Type your sign-in email to confirm.",
        );
      }
    } else if (!typed.includes("@")) {
      throw new Error("Type your sign-in email to confirm.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!user) throw new Error("Account not found");

    await archiveMerchantData(ctx, user._id, "user");
    await ctx.db.delete(user._id);
    return null;
  },
});

export const deleteUserByClerkId = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.clerkUserId))
      .unique();
    if (!user) return null;

    await archiveMerchantData(ctx, user._id, "system");
    await ctx.db.delete(user._id);
    return null;
  },
});
