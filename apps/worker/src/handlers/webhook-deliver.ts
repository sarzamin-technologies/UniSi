import crypto from "node:crypto";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { getDb, webhookEndpoint, webhookDelivery } from "@unisi/db";

interface JobData {
  deliveryId: string;
}

const TIMEOUT_MS = 10_000;
const MAX_BODY = 1_000_000;

/**
 * Sign:  X-UniSi-Signature: t=<unix_ts>,v1=<hex hmac sha256>
 * Body of HMAC: `${t}.${rawBodyJson}` — gives both replay protection and
 * payload integrity.
 */
function signPayload(secret: string, ts: number, payload: string): string {
  const mac = crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${mac}`;
}

export async function webhookDeliverHandler(job: Job<JobData>): Promise<void> {
  const db = getDb();
  const delivery = await db.query.webhookDelivery.findFirst({
    where: eq(webhookDelivery.id, job.data.deliveryId),
  });
  if (!delivery) throw new Error(`delivery ${job.data.deliveryId} missing`);
  if (delivery.deliveredAt) return;

  const endpoint = await db.query.webhookEndpoint.findFirst({
    where: eq(webhookEndpoint.id, delivery.endpointId),
  });
  if (!endpoint || !endpoint.active) {
    await db
      .update(webhookDelivery)
      .set({ lastError: "endpoint_inactive_or_missing" })
      .where(eq(webhookDelivery.id, delivery.id));
    return;
  }

  const payload = JSON.stringify(delivery.payload);
  if (payload.length > MAX_BODY) {
    await db
      .update(webhookDelivery)
      .set({ lastError: "payload_too_large" })
      .where(eq(webhookDelivery.id, delivery.id));
    return;
  }

  const ts = Math.floor(Date.now() / 1000);
  const signature = signPayload(endpoint.secret, ts, payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "UniSi-Webhooks/0.1",
        "X-UniSi-Event": delivery.event,
        "X-UniSi-Signature": signature,
        "X-UniSi-Delivery": delivery.id,
      },
      body: payload,
      signal: controller.signal,
    });

    const ok = res.status >= 200 && res.status < 300;
    await db
      .update(webhookDelivery)
      .set({
        attempts: delivery.attempts + 1,
        lastStatusCode: res.status,
        lastError: ok ? null : `http_${res.status}`,
        deliveredAt: ok ? new Date() : null,
      })
      .where(eq(webhookDelivery.id, delivery.id));

    if (!ok) throw new Error(`endpoint returned ${res.status}`);
  } catch (err) {
    await db
      .update(webhookDelivery)
      .set({
        attempts: delivery.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(webhookDelivery.id, delivery.id));
    throw err; // surfaces to BullMQ for retry/backoff
  } finally {
    clearTimeout(timer);
  }
}
