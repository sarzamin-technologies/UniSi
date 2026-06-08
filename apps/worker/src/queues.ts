import { Queue } from "bullmq";
import { connection } from "./redis";

/**
 * Queue registry — keep all BullMQ queue names in one place so producers and
 * consumers can't drift apart.
 */
export const Queues = {
  pdfStamp: "pdf-stamp",
  detectFields: "ai-detect-fields",
  draftTemplate: "ai-draft-template",
  extractStructured: "ai-extract-structured",
  email: "email",
  webhookDelivery: "webhook-deliver",
} as const;

export type QueueName = (typeof Queues)[keyof typeof Queues];

/** Lazy queue producers, shared across the process. */
const _producers = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = _producers.get(name);
  if (!q) {
    q = new Queue(name, { connection });
    _producers.set(name, q);
  }
  return q;
}
