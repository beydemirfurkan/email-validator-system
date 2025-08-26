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
declare class DatabaseConnectionPool {
    private connections;
    private available;
    private pending;
    private config;
    private destroyed;
    private reapTimer?;
    private stats;
    constructor(config?: Partial<ConnectionPoolConfig>);
    private createConnection;
    acquire(): Promise<Database.Database>;
    release(connection: Database.Database): void;
    private destroyConnection;
    private reapIdleConnections;
    destroy(): Promise<void>;
    getStats(): {
        totalConnections: number;
        availableConnections: number;
        pendingRequests: number;
        activeConnections: number;
        created: number;
        acquired: number;
        released: number;
        destroyed: number;
        timeouts: number;
    };
    healthCheck(): Promise<{
        healthy: boolean;
        stats: any;
        issues: string[];
    }>;
}
declare const connectionPool: DatabaseConnectionPool;
declare class PooledDatabase {
    withConnection<T>(operation: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T>;
    transaction<T>(operation: (tx: any) => Promise<T>): Promise<T>;
    getPoolStats(): {
        totalConnections: number;
        availableConnections: number;
        pendingRequests: number;
        activeConnections: number;
        created: number;
        acquired: number;
        released: number;
        destroyed: number;
        timeouts: number;
    };
    healthCheck(): Promise<{
        healthy: boolean;
        stats: any;
        issues: string[];
    }>;
    destroy(): Promise<void>;
}
export declare const pooledDb: PooledDatabase;
export declare const db: import("drizzle-orm/better-sqlite3").BetterSQLite3Database<typeof schema> & {
    $client: Database.Database;
};
export { connectionPool };
//# sourceMappingURL=connection-pool.d.ts.map