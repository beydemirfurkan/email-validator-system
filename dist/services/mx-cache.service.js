"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MxCache = void 0;
const DEFAULT_CLEANUP_PROBABILITY = 0.1;
class MxCache {
    cache = new Map();
    statistics = {
        hits: 0,
        misses: 0,
        evictions: 0,
    };
    options;
    constructor(options = {}) {
        this.options = {
            enabled: options.enabled !== false,
            defaultTtl: options.defaultTtl || 300000,
            maxSize: options.maxSize || 1000,
            cleanupEnabled: options.cleanupEnabled !== false,
            cleanupProbability: options.cleanupProbability ?? DEFAULT_CLEANUP_PROBABILITY,
        };
    }
    get(domain) {
        if (!this.options.enabled) {
            return null;
        }
        const key = domain.toLowerCase();
        const entry = this.cache.get(key);
        if (!entry) {
            this.statistics.misses++;
            return null;
        }
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.statistics.evictions++;
            this.statistics.misses++;
            return null;
        }
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.statistics.hits++;
        return entry.result;
    }
    set(domain, result, ttl) {
        if (!this.options.enabled) {
            return;
        }
        const key = domain.toLowerCase();
        if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
            const lruKey = this.cache.keys().next().value;
            if (lruKey) {
                this.cache.delete(lruKey);
                this.statistics.evictions++;
            }
        }
        if (this.options.cleanupEnabled &&
            this.cache.size > 0 &&
            Math.random() < this.options.cleanupProbability) {
            this.cleanExpired();
        }
        this.cache.set(key, {
            result,
            timestamp: Date.now(),
            ttl: ttl !== undefined ? ttl : this.options.defaultTtl,
        });
    }
    cleanExpired() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                this.statistics.evictions++;
                removed++;
            }
        }
        return removed;
    }
    flush() {
        const size = this.cache.size;
        this.cache.clear();
        this.statistics.evictions += size;
    }
    getStatistics() {
        const totalRequests = this.statistics.hits + this.statistics.misses;
        return {
            hits: this.statistics.hits,
            misses: this.statistics.misses,
            evictions: this.statistics.evictions,
            size: this.cache.size,
            hitRate: totalRequests > 0 ? (this.statistics.hits / totalRequests) * 100 : 0,
        };
    }
    getCachedDomains() {
        return Array.from(this.cache.keys());
    }
    has(domain) {
        const key = domain.toLowerCase();
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.statistics.evictions++;
            return false;
        }
        return true;
    }
    delete(domain) {
        const key = domain.toLowerCase();
        const existed = this.cache.has(key);
        if (existed) {
            this.cache.delete(key);
            this.statistics.evictions++;
        }
        return existed;
    }
    getSize() {
        return this.cache.size;
    }
    getMaxSize() {
        return this.options.maxSize;
    }
    isEnabled() {
        return this.options.enabled;
    }
    setEnabled(enabled) {
        this.options.enabled = enabled;
        if (!enabled) {
            this.flush();
        }
    }
}
exports.MxCache = MxCache;
//# sourceMappingURL=mx-cache.service.js.map