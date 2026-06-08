import { eq, and, sql } from "drizzle-orm";
import {
  getDb,
  webhookEndpoint,
  webhookDelivery,
  type Submission,
  type Submitter,
} from "@unisi/db";
import { producer, QueueNames } from "./queues";

type EventType =
  | "submission.created"
  | "submitter.opened"
  | "submitter.signed"
  | "submission.completed"
  | "submission.declined";

interface EmitInput {
  accountId: string;
  event: EventType;
  data: Record<string, unknown>;
}

/**
 * Persist a delivery row per matching endpoint and enqueue them. We persist
 * first so retries are durable across worker restarts.
 */
export async function emitWebhook(input: EmitInput): Promise<void> {
  const db = getDb();
  const endpoints = await db
    .select()
    .from(webhookEndpoint)
    .where(
      and(
        eq(webhookEndpoint.accountId, input.accountId),
        eq(webhookEndpoint.active, true),
        sql`${webhookEndpoint.events}::jsonb ? ${input.event}`,
      ),
    );

  if (endpoints.length === 0) return;

  const payload = {
    event: input.event,
    timestamp: new Date().toISOString(),
    data: input.data,
  };

  for (const ep of endpoints) {
    const [delivery] = await db
      .insert(webhookDelivery)
      .values({ endpointId: ep.id, event: input.event, payload })
      .returning({ id: webhookDelivery.id });
    if (!delivery) continue;
    await producer(QueueNames.webhookDelivery).add(
      "deliver",
      { deliveryId: delivery.id },
      { attempts: 8, backoff: { type: "exponential", delay: 30_000 } },
    );
  }
}

/** Build a stable submission payload — same shape across all events. */
export function submissionPayload(sub: Submission, submitters: Submitter[]) {
  return {
    submission: {
      id: sub.id,
      status: sub.status,
      template_id: sub.templateId,
      created_at: sub.createdAt,
      completed_at: sub.completedAt,
    },
    submitters: submitters.map((s) => ({
      id: s.id,
      role: s.role,
      email: s.email,
      name: s.name,
      status: s.status,
      completed_at: s.completedAt,
    })),
  };
}
