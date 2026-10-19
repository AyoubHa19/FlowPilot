/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as buildings from "../buildings.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as documentsNode from "../documentsNode.js";
import type * as gmail from "../gmail.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as inbox from "../inbox.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_validators from "../lib/validators.js";
import type * as model_documents from "../model/documents.js";
import type * as model_embeddings from "../model/embeddings.js";
import type * as model_gmailApi from "../model/gmailApi.js";
import type * as model_importRows from "../model/importRows.js";
import type * as model_inbox from "../model/inbox.js";
import type * as model_mime from "../model/mime.js";
import type * as model_properties from "../model/properties.js";
import type * as model_search from "../model/search.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as tenants from "../tenants.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  buildings: typeof buildings;
  crons: typeof crons;
  documents: typeof documents;
  documentsNode: typeof documentsNode;
  gmail: typeof gmail;
  http: typeof http;
  imports: typeof imports;
  inbox: typeof inbox;
  "lib/auth": typeof lib_auth;
  "lib/crypto": typeof lib_crypto;
  "lib/validators": typeof lib_validators;
  "model/documents": typeof model_documents;
  "model/embeddings": typeof model_embeddings;
  "model/gmailApi": typeof model_gmailApi;
  "model/importRows": typeof model_importRows;
  "model/inbox": typeof model_inbox;
  "model/mime": typeof model_mime;
  "model/properties": typeof model_properties;
  "model/search": typeof model_search;
  seed: typeof seed;
  seedData: typeof seedData;
  tenants: typeof tenants;
  users: typeof users;
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

export declare const components: {
  importPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"importPool">;
  documentPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"documentPool">;
};
