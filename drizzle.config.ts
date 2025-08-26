import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator'
  },
  migrations: {
    table: 'drizzle_migrations',
    schema: 'public'
  }
});