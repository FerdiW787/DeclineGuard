/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clerk from "../clerk.js";
import type * as crons from "../crons.js";
import type * as functions_admin from "../functions/admin.js";
import type * as functions_billing from "../functions/billing.js";
import type * as functions_adminActions from "../functions/adminActions.js";
import type * as functions_adminTakeover from "../functions/adminTakeover.js";
import type * as functions_adminTakeoverActions from "../functions/adminTakeoverActions.js";
import type * as functions_brandImportActions from "../functions/brandImportActions.js";
import type * as functions_devSeed from "../functions/devSeed.js";
import type * as functions_featureRequests from "../functions/featureRequests.js";
import type * as functions_feeBilling from "../functions/feeBilling.js";
import type * as functions_feeBillingActions from "../functions/feeBillingActions.js";
import type * as functions_lemonSqueezy from "../functions/lemonSqueezy.js";
import type * as functions_lemonSqueezyActions from "../functions/lemonSqueezyActions.js";
import type * as functions_previewSequence from "../functions/previewSequence.js";
import type * as functions_previewSequenceEmails from "../functions/previewSequenceEmails.js";
import type * as functions_rateLimit from "../functions/rateLimit.js";
import type * as functions_recoveries from "../functions/recoveries.js";
import type * as functions_recoveryEmails from "../functions/recoveryEmails.js";
import type * as functions_recoverySettings from "../functions/recoverySettings.js";
import type * as functions_support from "../functions/support.js";
import type * as functions_supportAccess from "../functions/supportAccess.js";
import type * as functions_user from "../functions/user.js";
import type * as http from "../http.js";
import type * as lemonWebhook from "../lemonWebhook.js";
import type * as lib_accountGuard from "../lib/accountGuard.js";
import type * as lib_billingPlan from "../lib/billingPlan.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_brandImport_brandKit from "../lib/brandImport/brandKit.js";
import type * as lib_brandImport_browserCapture from "../lib/brandImport/browserCapture.js";
import type * as lib_brandImport_buttons from "../lib/brandImport/buttons.js";
import type * as lib_brandImport_colors from "../lib/brandImport/colors.js";
import type * as lib_brandImport_domain from "../lib/brandImport/domain.js";
import type * as lib_brandImport_extract from "../lib/brandImport/extract.js";
import type * as lib_emailBlockValidators from "../lib/emailBlockValidators.js";
import type * as lib_emailBlocks from "../lib/emailBlocks.js";
import type * as lib_emailFonts from "../lib/emailFonts.js";
import type * as lib_feeBilling from "../lib/feeBilling.js";
import type * as lib_lsCrypto from "../lib/lsCrypto.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_recoveryEmailFrom from "../lib/recoveryEmailFrom.js";
import type * as lib_recoveryEmailTemplate from "../lib/recoveryEmailTemplate.js";
import type * as lib_safeUrl from "../lib/safeUrl.js";
import type * as lib_storageOwnership from "../lib/storageOwnership.js";
import type * as lib_svixVerify from "../lib/svixVerify.js";
import type * as resendWebhook from "../resendWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clerk: typeof clerk;
  crons: typeof crons;
  "functions/admin": typeof functions_admin;
  "functions/billing": typeof functions_billing;
  "functions/adminActions": typeof functions_adminActions;
  "functions/adminTakeover": typeof functions_adminTakeover;
  "functions/adminTakeoverActions": typeof functions_adminTakeoverActions;
  "functions/brandImportActions": typeof functions_brandImportActions;
  "functions/devSeed": typeof functions_devSeed;
  "functions/featureRequests": typeof functions_featureRequests;
  "functions/feeBilling": typeof functions_feeBilling;
  "functions/feeBillingActions": typeof functions_feeBillingActions;
  "functions/lemonSqueezy": typeof functions_lemonSqueezy;
  "functions/lemonSqueezyActions": typeof functions_lemonSqueezyActions;
  "functions/previewSequence": typeof functions_previewSequence;
  "functions/previewSequenceEmails": typeof functions_previewSequenceEmails;
  "functions/rateLimit": typeof functions_rateLimit;
  "functions/recoveries": typeof functions_recoveries;
  "functions/recoveryEmails": typeof functions_recoveryEmails;
  "functions/recoverySettings": typeof functions_recoverySettings;
  "functions/support": typeof functions_support;
  "functions/supportAccess": typeof functions_supportAccess;
  "functions/user": typeof functions_user;
  http: typeof http;
  lemonWebhook: typeof lemonWebhook;
  "lib/accountGuard": typeof lib_accountGuard;
  "lib/billingPlan": typeof lib_billingPlan;
  "lib/admin": typeof lib_admin;
  "lib/brandImport/brandKit": typeof lib_brandImport_brandKit;
  "lib/brandImport/browserCapture": typeof lib_brandImport_browserCapture;
  "lib/brandImport/buttons": typeof lib_brandImport_buttons;
  "lib/brandImport/colors": typeof lib_brandImport_colors;
  "lib/brandImport/domain": typeof lib_brandImport_domain;
  "lib/brandImport/extract": typeof lib_brandImport_extract;
  "lib/emailBlockValidators": typeof lib_emailBlockValidators;
  "lib/emailBlocks": typeof lib_emailBlocks;
  "lib/emailFonts": typeof lib_emailFonts;
  "lib/feeBilling": typeof lib_feeBilling;
  "lib/lsCrypto": typeof lib_lsCrypto;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/recoveryEmailFrom": typeof lib_recoveryEmailFrom;
  "lib/recoveryEmailTemplate": typeof lib_recoveryEmailTemplate;
  "lib/safeUrl": typeof lib_safeUrl;
  "lib/storageOwnership": typeof lib_storageOwnership;
  "lib/svixVerify": typeof lib_svixVerify;
  resendWebhook: typeof resendWebhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
