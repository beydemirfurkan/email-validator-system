import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use DATABASE_URL from environment (Railway will provide this)
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator';

// Create postgres connection
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20, // Max number of connections
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export default db;