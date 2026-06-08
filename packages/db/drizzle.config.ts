import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://unisi:unisi@localhost:5432/unisi",
  },
  strict: true,
  verbose: true,
} satisfies Config;
