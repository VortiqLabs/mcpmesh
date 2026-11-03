import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/mcp_mesh';

export const db = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
