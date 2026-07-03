import { z } from 'zod';

/**
 * Validates every environment variable listed in `.env.example`.
 * Vars with a default value there get a matching `.default(...)`; the two
 * RPC URLs have no default in `.env.example` and are therefore required.
 */
/* eslint-disable-next-line @typescript-eslint/typedef -- annotating would mean hand-duplicating
   zod's inferred shape, defeating the point of the `z.infer<>` below */
export const envSchema = z.object({
  RPC_WS_URL: z.url(),
  RPC_HTTP_URL: z.url(),
  RPC_COMMITMENT: z.string().default('confirmed'),

  KAFKA_BROKERS: z.string().default('localhost:9092'),

  CLICKHOUSE_URL: z.url().default('http://localhost:8123'),
  CLICKHOUSE_DB: z.string().default('solana'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().default('mypassword'),

  BATCH_MAX_ROWS: z.coerce.number().int().positive().default(1000),
  FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(2000),

  API_PORT: z.coerce.number().int().positive().default(4000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig (): Config {
  return envSchema.parse(process.env);
}
