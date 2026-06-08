/**
 * Thin BullMQ producer used by API routes to enqueue jobs into queues that
 * apps/worker consumes. We keep queue names duplicated as constants here
 * (instead of importing from the worker) so the web app doesn't depend on
 * worker source.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";

let _connection: IORedis | undefined;
function connection(): IORedis {
  if (_connection) return _connection;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  // family: 0 lets Node resolve IPv4 + IPv6 — required for Railway's IPv6-only
  // private network (*.railway.internal).
  _connection = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, family: 0 });
  return _connection;
}

export const QueueNames = {
  pdfStamp: "pdf-stamp",
  email: "email",
  detectFields: "ai-detect-fields",
  draftTemplate: "ai-draft-template",
  webhookDelivery: "webhook-deliver",
} as const;

const _producers = new Map<string, Queue>();

export function producer(name: string): Queue {
  let q = _producers.get(name);
  if (!q) {
    q = new Queue(name, { connection: connection() });
    _producers.set(name, q);
  }
  return q;
}
