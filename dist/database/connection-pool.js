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
const postgres_1 = __importDefault(require("postgres"));
const postgres_js_1 = require("drizzle-orm/postgres-js");
const schema = __importStar(require("./schema"));
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator';
const client = (0, postgres_1.default)(connectionString, {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
});
class PooledDatabase {
    db = (0, postgres_js_1.drizzle)(client, { schema });
    async withConnection(operation) {
        return await operation(this.db);
    }
    async transaction(operation) {
        return await this.db.transaction(operation);
    }
    getPoolStats() {
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
        const issues = [];
        try {
            await this.db.execute('SELECT 1');
        }
        catch (error) {
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
exports.pooledDb = new PooledDatabase();
exports.db = (0, postgres_js_1.drizzle)(client, { schema });
process.on('SIGINT', async () => {
    console.log('Shutting down PostgreSQL connection pool...');
    await exports.pooledDb.destroy();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Shutting down PostgreSQL connection pool...');
    await exports.pooledDb.destroy();
    process.exit(0);
});
exports.connectionPool = {
    getStats: () => exports.pooledDb.getPoolStats(),
    healthCheck: () => exports.pooledDb.healthCheck(),
    destroy: () => exports.pooledDb.destroy()
};
//# sourceMappingURL=connection-pool.js.map