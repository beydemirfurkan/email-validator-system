"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionPool = exports.db = exports.pooledDb = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const better_sqlite3_2 = require("drizzle-orm/better-sqlite3");
const schema = __importStar(require("./schema"));
class DatabaseConnectionPool {
    connections = [];
    available = [];
    pending = [];
    config;
    destroyed = false;
    reapTimer;
    stats = {
        created: 0,
        acquired: 0,
        released: 0,
        destroyed: 0,
        timeouts: 0
    };
    constructor(config = {}) {
        this.config = {
            maxConnections: config.maxConnections || 10,
            acquireTimeoutMs: config.acquireTimeoutMs || 30000,
            createTimeoutMs: config.createTimeoutMs || 10000,
            idleTimeoutMs: config.idleTimeoutMs || 300000,
            reapIntervalMs: config.reapIntervalMs || 60000,
            ...config
        };
        this.reapTimer = setInterval(() => {
            this.reapIdleConnections();
        }, this.config.reapIntervalMs);
    }
    createConnection() {
        const db = new better_sqlite3_1.default(process.env.DATABASE_PATH || './database.sqlite');
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = 1000');
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 268435456');
        db.pragma('foreign_keys = ON');
        db.pragma('busy_timeout = 5000');
        this.stats.created++;
        return db;
    }
    async acquire() {
        if (this.destroyed) {
            throw new Error('Connection pool has been destroyed');
        }
        const available = this.available.pop();
        if (available) {
            this.stats.acquired++;
            return available;
        }
        if (this.connections.length < this.config.maxConnections) {
            try {
                const connection = this.createConnection();
                this.connections.push(connection);
                this.stats.acquired++;
                return connection;
            }
            catch (error) {
                throw new Error(`Failed to create database connection: ${error}`);
            }
        }
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            this.pending.push({ resolve, reject, timestamp });
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
    release(connection) {
        if (this.destroyed) {
            this.destroyConnection(connection);
            return;
        }
        const pending = this.pending.shift();
        if (pending) {
            pending.resolve(connection);
            return;
        }
        this.available.push(connection);
        this.stats.released++;
    }
    destroyConnection(connection) {
        try {
            connection.close();
            this.stats.destroyed++;
        }
        catch (error) {
            console.error('Error destroying database connection:', error);
        }
        const index = this.connections.indexOf(connection);
        if (index !== -1) {
            this.connections.splice(index, 1);
        }
        const availableIndex = this.available.indexOf(connection);
        if (availableIndex !== -1) {
            this.available.splice(availableIndex, 1);
        }
    }
    reapIdleConnections() {
        if (this.destroyed)
            return;
        const now = Date.now();
        const idleThreshold = now - this.config.idleTimeoutMs;
        const minConnections = Math.min(2, this.config.maxConnections);
        while (this.available.length > 0 &&
            this.connections.length > minConnections) {
            const connection = this.available.pop();
            this.destroyConnection(connection);
        }
    }
    async destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        if (this.reapTimer) {
            clearInterval(this.reapTimer);
            this.reapTimer = undefined;
        }
        this.pending.forEach(({ reject }) => {
            reject(new Error('Connection pool is being destroyed'));
        });
        this.pending = [];
        const destroyPromises = this.connections.map(connection => {
            return new Promise((resolve) => {
                try {
                    connection.close();
                    resolve();
                }
                catch (error) {
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
    async healthCheck() {
        const issues = [];
        const stats = this.getStats();
        if (stats.pendingRequests > 0) {
            issues.push(`${stats.pendingRequests} pending connection requests`);
        }
        if (stats.timeouts > 0) {
            issues.push(`${stats.timeouts} connection timeouts occurred`);
        }
        if (stats.activeConnections === this.config.maxConnections) {
            issues.push('Connection pool at maximum capacity');
        }
        try {
            const testConnection = await this.acquire();
            this.release(testConnection);
        }
        catch (error) {
            issues.push(`Failed to acquire test connection: ${error}`);
        }
        return {
            healthy: issues.length === 0,
            stats,
            issues
        };
    }
}
const connectionPool = new DatabaseConnectionPool({
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    acquireTimeoutMs: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '300000')
});
exports.connectionPool = connectionPool;
class PooledDatabase {
    async withConnection(operation) {
        const connection = await connectionPool.acquire();
        try {
            const db = (0, better_sqlite3_2.drizzle)(connection, { schema });
            return await operation(db);
        }
        finally {
            connectionPool.release(connection);
        }
    }
    async transaction(operation) {
        const connection = await connectionPool.acquire();
        try {
            const db = (0, better_sqlite3_2.drizzle)(connection, { schema });
            return await db.transaction(operation);
        }
        finally {
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
exports.pooledDb = new PooledDatabase();
const simpleConnection = new better_sqlite3_1.default(process.env.DATABASE_PATH || './database.sqlite');
simpleConnection.pragma('journal_mode = WAL');
simpleConnection.pragma('synchronous = NORMAL');
simpleConnection.pragma('foreign_keys = ON');
exports.db = (0, better_sqlite3_2.drizzle)(simpleConnection, { schema });
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
//# sourceMappingURL=connection-pool.js.map