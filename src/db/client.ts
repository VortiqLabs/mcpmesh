import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX, application_name: 'mcp-mesh-relay' });
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error));
export const db = drizzle(pool, { schema });
