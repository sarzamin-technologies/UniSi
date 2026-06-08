import IORedis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL is not set");

export const connection = new IORedis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // family: 0 lets Node resolve both IPv4 and IPv6 — required for Railway's
  // IPv6-only private network (*.railway.internal).
  family: 0,
});
