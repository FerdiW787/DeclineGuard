import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { StoredRole } from "./lib/admin";
import {
  collectWebhookSecrets,
  verifySvixPayload,
} from "./lib/svixVerify";

type ClerkWebhookMessage = {
  type: string;
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    /** Only Backend API / Dashboard can set private_metadata — never trust public_metadata for roles. */
    private_metadata?: {
      role?: "user" | "staff" | "admin" | "standard";
    };
  };
};

function roleFromClerkMetadata(
  role: string | undefined,
): StoredRole {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  // Legacy "standard" and anything else → merchant user
  return "user";
}

export const handleClerkWebhook = httpAction(
  async (ctx: ActionCtx, request: Request) => {
    // Dual-secret rotation: accept signatures from current or previous secret.
    const secrets = collectWebhookSecrets(
      process.env.CLERK_WEBHOOK_SECRET,
      process.env.CLERK_WEBHOOK_SECRET_PREVIOUS,
    );

    if (secrets.length === 0) {
      return new Response("CLERK_WEBHOOK_SECRET is not set", { status: 500 });
    }

    const payload = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    let msg: ClerkWebhookMessage;

    try {
      msg = verifySvixPayload(
        payload,
        {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        },
        secrets,
      ) as ClerkWebhookMessage;
    } catch {
      return new Response("Error verifying webhook", { status: 400 });
    }

    if (msg.type === "user.deleted") {
      await ctx.runMutation(internal.functions.user.deleteUserByClerkId, {
        clerkUserId: msg.data.id,
      });
      return new Response("Webhook received", { status: 200 });
    }

    if (msg.type === "user.updated" || msg.type === "user.created") {
      const { id, first_name, last_name, image_url, private_metadata } =
        msg.data;
      const userName = `${first_name || ""} ${last_name || ""}`.trim() || "User";
      const role = roleFromClerkMetadata(private_metadata?.role);

      await ctx.runMutation(internal.functions.user.upsertUser, {
        userId: id,
        userName,
        userProfilePic: image_url,
        role,
      });
    }

    return new Response("Webhook received", { status: 200 });
  },
);
