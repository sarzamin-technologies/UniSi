import { Worker, type Job } from "bullmq";
import { connection } from "./redis";
import { Queues, type QueueName } from "./queues";
import { pdfStampHandler } from "./handlers/pdf-stamp";
import { emailHandler } from "./handlers/email";
import { detectFieldsHandler } from "./handlers/detect-fields";
import { webhookDeliverHandler } from "./handlers/webhook-deliver";
import { draftTemplateHandler } from "./handlers/draft-template";

/**
 * Each queue gets a dedicated Worker so we can scale concurrency per
 * workload (PDF stamping is CPU-heavy, AI calls are I/O-heavy).
 */

type Handler = (job: Job) => Promise<unknown>;

const handlers: Record<QueueName, Handler> = {
  [Queues.pdfStamp]: pdfStampHandler as Handler,
  [Queues.email]: emailHandler as Handler,
  [Queues.detectFields]: detectFieldsHandler as Handler,
  [Queues.draftTemplate]: draftTemplateHandler as Handler,
  // ai:extract-structured runs as a sub-step of pdf:stamp now — leaving the
  // queue registered for future use (e.g. on-demand re-extraction).
  [Queues.extractStructured]: async (job) => {
    console.log(`[ai:extract-structured] received ${job.id}`, job.data);
    throw new Error("ai:extract-structured runs inline in pdf:stamp; standalone use deferred");
  },
  [Queues.webhookDelivery]: webhookDeliverHandler as Handler,
};

const workers = (Object.entries(handlers) as [QueueName, Handler][]).map(
  ([name, handler]) =>
    new Worker(name, handler, {
      connection,
      concurrency: name === Queues.pdfStamp ? 2 : 8,
    }),
);

for (const w of workers) {
  w.on("failed", (job, err) =>
    console.error(`[${w.name}] job ${job?.id} failed:`, err.message),
  );
  w.on("completed", (job) =>
    console.log(`[${w.name}] job ${job.id} completed`),
  );
}

console.log("UniSi worker started, queues:", Object.values(Queues).join(", "));

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, draining workers…`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
