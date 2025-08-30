/**
 * SMTP Connection Pooling System
 * Manages reusable SMTP connections for performance optimization
 */

import { SMTPClient } from './smtp-client.service';

interface ConnectionPoolOptions {
  maxConnectionsPerPool?: number;
  connectionTimeout?: number;
  maxIdleTime?: number;
  enablePooling?: boolean;
}

interface PooledConnection extends SMTPClient {
  _poolKey?: string;
  _checkedOut?: number;
  _pooled?: boolean;
  _lastUsed?: number;
}

interface ConnectionPool {
  available: PooledConnection[];
  inUse: Set<PooledConnection>;
  created: number;
}

interface PoolStats {
  totalPools: number;
  totalConnections: number;
  availableConnections: number;
  inUseConnections: number;
}

export class SMTPConnectionPool {
  private pools: Map<string, ConnectionPool>;
  private options: Required<ConnectionPoolOptions>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: ConnectionPoolOptions = {}) {
    this.pools = new Map();
    this.options = {
      maxConnectionsPerPool: options.maxConnectionsPerPool || 3,
      connectionTimeout: options.connectionTimeout || 30000,
      maxIdleTime: options.maxIdleTime || 60000, // 1 minute
      enablePooling: options.enablePooling !== false,
      ...options,
    };

    // Cleanup idle connections periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  private getPoolKey(host: string, port: number): string {
    return `${host}:${port}`;
  }

  async getConnection(host: string, port: number, clientOptions: any = {}): Promise<PooledConnection> {
    if (!this.options.enablePooling) {
      return new SMTPClient(host, port, clientOptions) as PooledConnection;
    }

    const poolKey = this.getPoolKey(host, port);

    if (!this.pools.has(poolKey)) {
      this.pools.set(poolKey, {
        available: [],
        inUse: new Set(),
        created: 0,
      });
    }

    const pool = this.pools.get(poolKey)!;

    // Try to get an available connection
    while (pool.available.length > 0) {
      const conn = pool.available.pop()!;

      if (await this.testConnection(conn)) {
        pool.inUse.add(conn);
        conn._poolKey = poolKey;
        conn._checkedOut = Date.now();
        return conn;
      } else {
        this.closeConnection(conn);
      }
    }

    // Create new connection if under limit
    if (pool.created < this.options.maxConnectionsPerPool) {
      const conn = new SMTPClient(host, port, {
        ...clientOptions,
        readTimeout: this.options.connectionTimeout,
      }) as PooledConnection;

      try {
        await conn.connect();
        pool.created++;
        pool.inUse.add(conn);
        conn._poolKey = poolKey;
        conn._checkedOut = Date.now();
        conn._pooled = true;
        return conn;
      } catch (error) {
        this.closeConnection(conn);
        throw error;
      }
    }

    // Pool is full, create non-pooled connection
    return new SMTPClient(host, port, clientOptions) as PooledConnection;
  }

  private async testConnection(conn: PooledConnection): Promise<boolean> {
    const socket = (conn as any).socket;
    if (!socket || socket.destroyed || socket.readyState !== 'open') {
      return false;
    }

    try {
      // Gentle connection test - just check if socket is responsive
      // NOOP might be too aggressive for some servers
      if (Date.now() - (conn._lastUsed || 0) < 30000) {
        // If connection was used recently, assume it's still good
        return true;
      }

      // For older connections, test with NOOP
      const res = await Promise.race([
        conn.sendCommand('NOOP'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]) as { code: number };

      return res.code >= 200 && res.code < 400;
    } catch (error) {
      return false;
    }
  }

  releaseConnection(conn: PooledConnection): void {
    if (!conn._pooled || !conn._poolKey) {
      this.closeConnection(conn);
      return;
    }

    const pool = this.pools.get(conn._poolKey);
    if (!pool) {
      this.closeConnection(conn);
      return;
    }

    pool.inUse.delete(conn);

    const socket = (conn as any).socket;
    if (socket && !socket.destroyed) {
      conn._lastUsed = Date.now();
      pool.available.push(conn);
    } else {
      this.closeConnection(conn);
      pool.created = Math.max(0, pool.created - 1);
    }
  }

  private closeConnection(conn: PooledConnection): void {
    try {
      conn.close();
    } catch (error) {
      // Ignore close errors
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const maxIdleTime = this.options.maxIdleTime;

    for (const [poolKey, pool] of this.pools.entries()) {
      const toRemove: number[] = [];
      for (let i = pool.available.length - 1; i >= 0; i--) {
        const conn = pool.available[i];
        if (conn && now - (conn._lastUsed || 0) > maxIdleTime) {
          toRemove.push(i);
          this.closeConnection(conn);
          pool.created = Math.max(0, pool.created - 1);
        }
      }

      toRemove.forEach(index => {
        if (pool.available[index]) {
          pool.available.splice(index, 1);
        }
      });

      if (pool.available.length === 0 && pool.inUse.size === 0) {
        this.pools.delete(poolKey);
      }
    }
  }

  close(): void {
    for (const [poolKey, pool] of this.pools.entries()) {
      pool.available.forEach(conn => this.closeConnection(conn));
      pool.inUse.forEach(conn => this.closeConnection(conn));
    }
    this.pools.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getStats(): PoolStats {
    const stats: PoolStats = {
      totalPools: this.pools.size,
      totalConnections: 0,
      availableConnections: 0,
      inUseConnections: 0,
    };

    for (const pool of this.pools.values()) {
      stats.availableConnections += pool.available.length;
      stats.inUseConnections += pool.inUse.size;
      stats.totalConnections += pool.created;
    }

    return stats;
  }
}

// Global connection pool instance
let globalConnectionPool: SMTPConnectionPool | null = null;

export function getGlobalConnectionPool(): SMTPConnectionPool | null {
  return globalConnectionPool;
}

export function initializeConnectionPool(options: ConnectionPoolOptions = {}): SMTPConnectionPool {
  globalConnectionPool = new SMTPConnectionPool(options);
  return globalConnectionPool;
}

export function resetGlobalConnectionPool(): void {
  if (globalConnectionPool) {
    globalConnectionPool.close();
  }
  globalConnectionPool = null;
}