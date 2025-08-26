import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
declare class PooledDatabase {
    private db;
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
        stats: {
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
        issues: string[];
    }>;
    destroy(): Promise<void>;
}
export declare const pooledDb: PooledDatabase;
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export declare const connectionPool: {
    getStats: () => {
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
    healthCheck: () => Promise<{
        healthy: boolean;
        stats: {
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
        issues: string[];
    }>;
    destroy: () => Promise<void>;
};
export {};
//# sourceMappingURL=connection-pool.d.ts.map