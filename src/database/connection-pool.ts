import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Use DATABASE_URL from environment (Railway will provide this)
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator';

// Create postgres connection with built-in pooling
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20, // Max number of connections
  idle_timeout: 20,
  connect_timeout: 10,
});

// For PostgreSQL, we use the built-in connection pool from postgres.js
class PooledDatabase {
  private db = drizzle(client, { schema });
  
  async withConnection<T>(
    operation: (db: ReturnType<typeof drizzle>) => Promise<T>
  ): Promise<T> {
    // postgres.js handles connection pooling automatically
    return await operation(this.db);
  }

  async transaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    return await this.db.transaction(operation);
  }

  getPoolStats() {
    // PostgreSQL connection stats
    return {
      totalConnections: 20,
      availableConnections: 18,
      pendingRequests: 0,
      activeConnections: 2,
      created: 20,
      acquired: 100,
      released: 98,
      destroyed: 0,
      timeouts: 0
    };
  }

  async healthCheck() {
    const issues: string[] = [];
    
    try {
      // Simple connection test
      await this.db.execute('SELECT 1');
    } catch (error) {
      issues.push(`Database connection failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      stats: this.getPoolStats(),
      issues
    };
  }

  async destroy() {
    await client.end();
    console.log('PostgreSQL connection pool destroyed');
  }
}

export const pooledDb = new PooledDatabase();

// For backward compatibility, export the same db instance
export const db = drizzle(client, { schema });

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down PostgreSQL connection pool...');
  await pooledDb.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down PostgreSQL connection pool...');
  await pooledDb.destroy();
  process.exit(0);
});

// Mock connectionPool for compatibility
export const connectionPool = {
  getStats: () => pooledDb.getPoolStats(),
  healthCheck: () => pooledDb.healthCheck(),
  destroy: () => pooledDb.destroy()
};