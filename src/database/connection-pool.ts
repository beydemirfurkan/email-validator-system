import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

interface ConnectionPoolConfig {
  maxConnections: number;
  acquireTimeoutMs: number;
  createTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
}

class DatabaseConnectionPool {
  private connections: Database.Database[] = [];
  private available: Database.Database[] = [];
  private pending: Array<{
    resolve: (connection: Database.Database) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private config: ConnectionPoolConfig;
  private destroyed = false;
  private reapTimer?: NodeJS.Timeout;
  private stats = {
    created: 0,
    acquired: 0,
    released: 0,
    destroyed: 0,
    timeouts: 0
  };

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections || 20, // Increased for better concurrency
      acquireTimeoutMs: config.acquireTimeoutMs || 15000, // Reduced timeout for faster failure
      createTimeoutMs: config.createTimeoutMs || 5000, // Faster connection creation
      idleTimeoutMs: config.idleTimeoutMs || 180000, // 3 minutes - faster cleanup
      reapIntervalMs: config.reapIntervalMs || 30000, // 30 seconds - more frequent cleanup
      ...config
    };

    // Start reaper to clean up idle connections
    this.reapTimer = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapIntervalMs);
  }

  private createConnection(): Database.Database {
    const db = new Database(process.env.DATABASE_PATH || './database.sqlite');
    
    // Optimize SQLite settings for high-performance concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 2000'); // Doubled cache size
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 536870912'); // 512MB - doubled memory mapping
    db.pragma('foreign_keys = ON');
    
    // Increased busy timeout for better concurrency handling
    db.pragma('busy_timeout = 10000'); // 10 seconds
    
    // Enable automatic index creation for better query performance
    db.pragma('automatic_index = ON');
    
    this.stats.created++;
    return db;
  }

  async acquire(): Promise<Database.Database> {
    if (this.destroyed) {
      throw new Error('Connection pool has been destroyed');
    }

    // Try to get an available connection
    const available = this.available.pop();
    if (available) {
      this.stats.acquired++;
      return available;
    }

    // Create new connection if under limit
    if (this.connections.length < this.config.maxConnections) {
      try {
        const connection = this.createConnection();
        this.connections.push(connection);
        this.stats.acquired++;
        return connection;
      } catch (error) {
        throw new Error(`Failed to create database connection: ${error}`);
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.pending.push({ resolve, reject, timestamp });

      // Set timeout
      setTimeout(() => {
        const index = this.pending.findIndex(p => p.timestamp === timestamp);
        if (index !== -1) {
          this.pending.splice(index, 1);
          this.stats.timeouts++;
          reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMs}ms`));
        }
      }, this.config.acquireTimeoutMs);
    });
  }

  release(connection: Database.Database): void {
    if (this.destroyed) {
      this.destroyConnection(connection);
      return;
    }

    // Check if there are pending requests
    const pending = this.pending.shift();
    if (pending) {
      pending.resolve(connection);
      return;
    }

    // Add to available pool
    this.available.push(connection);
    this.stats.released++;
  }

  private destroyConnection(connection: Database.Database): void {
    try {
      connection.close();
      this.stats.destroyed++;
    } catch (error) {
      console.error('Error destroying database connection:', error);
    }

    // Remove from connections array
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    // Remove from available array
    const availableIndex = this.available.indexOf(connection);
    if (availableIndex !== -1) {
      this.available.splice(availableIndex, 1);
    }
  }

  private reapIdleConnections(): void {
    if (this.destroyed) return;

    const now = Date.now();
    const idleThreshold = now - this.config.idleTimeoutMs;

    // Keep minimum 2 connections
    const minConnections = Math.min(2, this.config.maxConnections);
    
    while (
      this.available.length > 0 && 
      this.connections.length > minConnections
    ) {
      const connection = this.available.pop()!;
      this.destroyConnection(connection);
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    
    this.destroyed = true;

    // Clear reap timer
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = undefined;
    }

    // Reject pending requests
    this.pending.forEach(({ reject }) => {
      reject(new Error('Connection pool is being destroyed'));
    });
    this.pending = [];

    // Close all connections
    const destroyPromises = this.connections.map(connection => {
      return new Promise<void>((resolve) => {
        try {
          connection.close();
          resolve();
        } catch (error) {
          console.error('Error closing database connection:', error);
          resolve();
        }
      });
    });

    await Promise.all(destroyPromises);
    
    this.connections = [];
    this.available = [];
    
    console.log('Database connection pool destroyed');
  }

  getStats() {
    return {
      ...this.stats,
      totalConnections: this.connections.length,
      availableConnections: this.available.length,
      pendingRequests: this.pending.length,
      activeConnections: this.connections.length - this.available.length
    };
  }

  // Health check for monitoring
  async healthCheck(): Promise<{
    healthy: boolean;
    stats: any;
    issues: string[];
  }> {
    const issues: string[] = [];
    const stats = this.getStats();

    // Check for common issues
    if (stats.pendingRequests > 0) {
      issues.push(`${stats.pendingRequests} pending connection requests`);
    }

    if (stats.timeouts > 0) {
      issues.push(`${stats.timeouts} connection timeouts occurred`);
    }

    if (stats.activeConnections === this.config.maxConnections) {
      issues.push('Connection pool at maximum capacity');
    }

    // Try to acquire and release a connection
    try {
      const testConnection = await this.acquire();
      this.release(testConnection);
    } catch (error) {
      issues.push(`Failed to acquire test connection: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      stats,
      issues
    };
  }
}

// Global connection pool instance with optimized defaults
const connectionPool = new DatabaseConnectionPool({
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  acquireTimeoutMs: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '15000'),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '180000')
});

// Optimized database wrapper with connection pooling
class PooledDatabase {
  async withConnection<T>(
    operation: (db: ReturnType<typeof drizzle>) => Promise<T>
  ): Promise<T> {
    const connection = await connectionPool.acquire();
    
    try {
      const db = drizzle(connection, { schema });
      return await operation(db);
    } finally {
      connectionPool.release(connection);
    }
  }

  async transaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    const connection = await connectionPool.acquire();
    
    try {
      const db = drizzle(connection, { schema });
      return await db.transaction(operation);
    } finally {
      connectionPool.release(connection);
    }
  }

  getPoolStats() {
    return connectionPool.getStats();
  }

  async healthCheck() {
    return connectionPool.healthCheck();
  }

  async destroy() {
    return connectionPool.destroy();
  }
}

export const pooledDb = new PooledDatabase();

// For backward compatibility, export a simple db instance too
const simpleConnection = new Database(process.env.DATABASE_PATH || './database.sqlite');
simpleConnection.pragma('journal_mode = WAL');
simpleConnection.pragma('synchronous = NORMAL');
simpleConnection.pragma('foreign_keys = ON');

export const db = drizzle(simpleConnection, { schema });

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down database connection pool...');
  await connectionPool.destroy();
  simpleConnection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down database connection pool...');
  await connectionPool.destroy();
  simpleConnection.close();
  process.exit(0);
});

export { connectionPool };