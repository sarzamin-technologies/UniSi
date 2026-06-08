import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  bigserial,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ----- Enums -----

export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "in_progress",
  "completed",
  "declined",
  "expired",
]);

export const submitterStatus = pgEnum("submitter_status", [
  "pending",
  "opened",
  "completed",
  "declined",
]);

export const aiCallKind = pgEnum("ai_call_kind", [
  "detect_fields",
  "draft_template",
  "extract_structured",
  "answer_signer_question",
  "template_chat",
]);

export const attachmentKind = pgEnum("attachment_kind", [
  "template_document",
  "submission_document",
  "completed_document",
  "audit_trail",
  "field_attachment",
  "preview",
]);

export const webhookEventType = pgEnum("webhook_event_type", [
  "submission.created",
  "submitter.opened",
  "submitter.signed",
  "submission.completed",
  "submission.declined",
]);

// ----- Account / Identity (Agnic) -----

export const account = pgTable("account", {
  id: uuid("id").defaultRandom().primaryKey(),
  agnicSubject: text("agnic_subject").notNull().unique(),
  name: text("name"),
  email: text("email"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One-to-one with account. Owner Agnic refresh+access tokens, encrypted at rest.
// Worker jobs (PDF stamping is fine, but AI jobs like detect_fields) refresh through this row.
export const accountAgnicCreds = pgTable("account_agnic_creds", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => account.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scopes: text("scopes").notNull().default("payments:sign balance:read"),
  needsReauth: boolean("needs_reauth").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Public REST API tokens (separate from Agnic identity).
export const apiToken = pgTable(
  "api_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenHashIdx: uniqueIndex("api_token_hash_idx").on(t.tokenHash),
  }),
);

// ----- Templates -----

export const template = pgTable(
  "template",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    fields: jsonb("fields").notNull().default(sql`'[]'::jsonb`),
    submitterRoles: jsonb("submitter_roles").notNull().default(sql`'[]'::jsonb`),
    documents: jsonb("documents").notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by").references(() => account.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountCreatedIdx: index("template_account_created_idx").on(t.accountId, t.createdAt),
  }),
);

// ----- Submissions -----

export const submission = pgTable(
  "submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    templateId: uuid("template_id").references(() => template.id, { onDelete: "set null" }),
    status: submissionStatus("status").notNull().default("pending"),
    templateSnapshot: jsonb("template_snapshot").notNull(),
    /** Filled by AI extraction once stamping completes; included in webhook payload. */
    extractedData: jsonb("extracted_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    accountStatusIdx: index("submission_account_status_idx").on(t.accountId, t.status, t.createdAt),
  }),
);

export const submitter = pgTable(
  "submitter",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .references(() => submission.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(),
    slug: text("slug").notNull(),
    email: text("email"),
    name: text("name"),
    status: submitterStatus("status").notNull().default("pending"),
    fieldValues: jsonb("field_values").notNull().default(sql`'{}'::jsonb`),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    ip: text("ip"),
    ua: text("ua"),
  },
  (t) => ({
    slugIdx: uniqueIndex("submitter_slug_idx").on(t.slug),
    submissionIdx: index("submitter_submission_idx").on(t.submissionId),
  }),
);

// Optional link from submitter → verified Agnic identity (only if signer logged in for AI Q&A).
// Strengthens audit non-repudiation beyond email-only.
export const submitterAgnic = pgTable("submitter_agnic", {
  submitterId: uuid("submitter_id")
    .primaryKey()
    .references(() => submitter.id, { onDelete: "cascade" }),
  agnicSubject: text("agnic_subject").notNull(),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

// ----- Audit (append-only, hash-chained) -----

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .references(() => submission.id, { onDelete: "cascade" })
      .notNull(),
    submitterId: uuid("submitter_id").references(() => submitter.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
    /** Monotonic insertion order. `ts` alone ties at sub-millisecond, which
     * would make chain verification non-deterministic; `seq` gives a stable
     * total order matching the order events were appended. */
    seq: bigserial("seq", { mode: "number" }).notNull(),
  },
  (t) => ({
    submissionTsIdx: index("audit_event_submission_ts_idx").on(t.submissionId, t.ts),
    submissionSeqIdx: index("audit_event_submission_seq_idx").on(t.submissionId, t.seq),
  }),
);

// ----- Storage / Attachments -----

export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    kind: attachmentKind("kind").notNull(),
    blobSha256: text("blob_sha256").notNull(),
    s3Key: text("s3_key").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    mime: text("mime").notNull(),
    filename: text("filename"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountKindIdx: index("attachment_account_kind_idx").on(t.accountId, t.kind),
    sha256Idx: index("attachment_sha256_idx").on(t.blobSha256),
  }),
);

// ----- Webhooks -----

export const webhookEndpoint = pgTable("webhook_endpoint", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .references(() => account.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default(sql`'[]'::jsonb`),
  secret: text("secret").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .references(() => webhookEndpoint.id, { onDelete: "cascade" })
      .notNull(),
    event: webhookEventType("event").notNull(),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    endpointIdx: index("webhook_delivery_endpoint_idx").on(t.endpointId, t.createdAt),
    pendingIdx: index("webhook_delivery_pending_idx").on(t.nextRetryAt),
  }),
);

// ----- AI -----

// Owner-side AI calls (worker-driven). Signer-side spend lives on the signer's
// own Agnic account — we don't track it here.
export const aiCallLog = pgTable(
  "ai_call_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => account.id, { onDelete: "cascade" })
      .notNull(),
    kind: aiCallKind("kind").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    usd: text("usd"), // string for precision; convert at boundaries
    status: text("status").notNull(), // "ok" | "402" | "error"
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountTsIdx: index("ai_call_log_account_ts_idx").on(t.accountId, t.createdAt),
  }),
);

// Signer-paid Q&A conversation. No usd column — that's between the signer and Agnic.
export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submitterId: uuid("submitter_id")
      .references(() => submitter.id, { onDelete: "cascade" })
      .notNull(),
    documentId: uuid("document_id").references(() => attachment.id, { onDelete: "set null" }),
    messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    submitterIdx: index("ai_conversation_submitter_idx").on(t.submitterId),
  }),
);

// ----- Type exports -----

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type AccountAgnicCreds = typeof accountAgnicCreds.$inferSelect;
export type Template = typeof template.$inferSelect;
export type Submission = typeof submission.$inferSelect;
export type Submitter = typeof submitter.$inferSelect;
export type AuditEvent = typeof auditEvent.$inferSelect;
export type Attachment = typeof attachment.$inferSelect;
