import { httpRouter } from "convex/server";
import { handleClerkWebhook } from "./clerk";
import { handleDodoWebhook } from "./dodoWebhook";
import { handleLemonSqueezyWebhook } from "./lemonWebhook";
import { handleResendWebhook } from "./resendWebhook";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

http.route({
  path: "/lemonsqueezy",
  method: "POST",
  handler: handleLemonSqueezyWebhook,
});

http.route({
  path: "/dodo",
  method: "POST",
  handler: handleDodoWebhook,
});

http.route({
  path: "/resend",
  method: "POST",
  handler: handleResendWebhook,
});

export default http;
