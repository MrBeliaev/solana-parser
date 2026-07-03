import { createClient } from '@clickhouse/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main(): Promise<void> {
  const url = process.env['CLICKHOUSE_URL'] ?? 'http://localhost:8123';
  const database = process.env['CLICKHOUSE_DB'] ?? 'solana';
  const username = process.env['CLICKHOUSE_USER'] ?? 'default';
  const password = process.env['CLICKHOUSE_PASSWORD'] ?? '';

  const client = createClient({
    url,
    database,
    username,
    password,
  });

  const schemaDir = path.join(__dirname, '..', 'sql', 'schema');
  const files = fs
    .readdirSync(schemaDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s) in ${schemaDir}`);

  try {
    for (const file of files) {
      const filePath = path.join(schemaDir, file);
      const query = fs.readFileSync(filePath, 'utf-8');

      console.log(`Applying ${file}...`);
      await client.command({ query });
      console.log(`Applied ${file}`);
    }

    console.log('Migration complete.');
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
