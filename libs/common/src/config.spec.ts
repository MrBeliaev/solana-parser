import { Config, envSchema, loadConfig } from './config';

describe('config', () => {
  const originalEnv: NodeJS.ProcessEnv = process.env;

  const validEnv: Record<string, string> = {
    RPC_WS_URL: 'wss://api.mainnet-beta.solana.com',
    RPC_HTTP_URL: 'https://api.mainnet-beta.solana.com',
  };

  beforeEach(() => {
    process.env = { ...validEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses a valid env and applies the documented defaults', () => {
    const config: Config = loadConfig();

    expect(config.RPC_WS_URL).toBe(validEnv.RPC_WS_URL);
    expect(config.RPC_HTTP_URL).toBe(validEnv.RPC_HTTP_URL);
    expect(config.RPC_COMMITMENT).toBe('confirmed');
    expect(config.KAFKA_BROKERS).toBe('localhost:9092');
    expect(config.CLICKHOUSE_URL).toBe('http://localhost:8123');
    expect(config.CLICKHOUSE_DB).toBe('solana');
    expect(config.CLICKHOUSE_USER).toBe('default');
    expect(config.CLICKHOUSE_PASSWORD).toBe('mypassword');
    expect(config.BATCH_MAX_ROWS).toBe(1000);
    expect(config.FLUSH_INTERVAL_MS).toBe(2000);
    expect(config.API_PORT).toBe(4000);
  });

  it('coerces numeric overrides from string env vars', () => {
    process.env.BATCH_MAX_ROWS = '500';
    process.env.FLUSH_INTERVAL_MS = '1500';
    process.env.API_PORT = '5000';

    const config: Config = loadConfig();

    expect(config.BATCH_MAX_ROWS).toBe(500);
    expect(config.FLUSH_INTERVAL_MS).toBe(1500);
    expect(config.API_PORT).toBe(5000);
  });

  it('throws when a required var (RPC_WS_URL) is missing', () => {
    delete process.env.RPC_WS_URL;

    expect(() => loadConfig()).toThrow();
  });

  it('throws when a required var (RPC_HTTP_URL) is missing', () => {
    delete process.env.RPC_HTTP_URL;

    expect(() => loadConfig()).toThrow();
  });

  it('rejects an invalid URL for a required var', () => {
    process.env.RPC_WS_URL = 'not-a-url';

    const result: ReturnType<typeof envSchema.safeParse> = envSchema.safeParse(process.env);

    expect(result.success).toBe(false);
  });
});
