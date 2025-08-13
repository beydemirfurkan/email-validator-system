/**
 * MX Record Cache implementation for Email Validation
 * Provides TTL-based caching of MX records to improve performance
 */

// Default probability of running cleanup on each set operation (10%)
const CLEANUP_PROBABILITY = 0.1;

/**
 * MX Record Cache with TTL support and statistics
 */
class MxCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.statistics = {
            hits: 0,
            misses: 0,
            evictions: 0,
        };
        this.options = {
            enabled: options.enabled !== false, // Default: true
            defaultTtl: options.defaultTtl || 300000, // Default: 5 minutes
            maxSize: options.maxSize || 1000, // Default: 1000 entries
            cleanupEnabled: options.cleanupEnabled !== false, // Default: true
            cleanupProbability: options.cleanupProbability ?? CLEANUP_PROBABILITY, // Default: 0.1 (10%)
        };
    }

    /**
     * Get MX records from cache if available and not expired
     * @param {string} domain - The domain to look up
     * @returns {Object|null} Cached MX result or null if not found/expired
     */
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

        // Check if entry has expired
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            // Entry expired, remove it
            this.cache.delete(key);
            this.statistics.evictions++;
            this.statistics.misses++;
            return null;
        }

        // LRU: Move to end (most recently used) by deleting and re-inserting
        this.cache.delete(key);
        this.cache.set(key, entry);

        this.statistics.hits++;
        return entry.result;
    }

    /**
     * Store MX result in cache
     * @param {string} domain - The domain to cache
     * @param {Object} result - The MX lookup result to cache
     * @param {number} [ttl] - Optional TTL in milliseconds (uses default if not provided)
     */
    set(domain, result, ttl) {
        if (!this.options.enabled) {
            return;
        }

        const key = domain.toLowerCase();

        // Check cache size limit
        if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
            // LRU eviction: Remove least recently used entry (first in Map)
            const lruKey = this.cache.keys().next().value;
            if (lruKey) {
                this.cache.delete(lruKey);
                this.statistics.evictions++;
            }
        }

        // Add periodic cleanup of expired entries to prevent memory accumulation
        if (
            this.options.cleanupEnabled &&
            this.cache.size > 0 &&
            Math.random() < this.options.cleanupProbability
        ) {
            this.cleanExpired();
        }

        this.cache.set(key, {
            result,
            timestamp: Date.now(),
            ttl: ttl !== undefined ? ttl : this.options.defaultTtl,
        });
    }

    /**
     * Clear all entries from the cache
     */
    flush() {
        const previousSize = this.cache.size;
        this.cache.clear();
        this.statistics.evictions += previousSize;
    }

    /**
     * Clear specific domain from cache
     * @param {string} domain - The domain to remove from cache
     * @returns {boolean} true if entry was removed, false if not found
     */
    delete(domain) {
        const deleted = this.cache.delete(domain.toLowerCase());
        if (deleted) {
            this.statistics.evictions++;
        }
        return deleted;
    }

    /**
     * Get current cache statistics
     * @returns {Object} Cache statistics including hit rate
     */
    getStatistics() {
        const total = this.statistics.hits + this.statistics.misses;
        const hitRate = total > 0 ? (this.statistics.hits / total) * 100 : 0;

        return {
            ...this.statistics,
            size: this.cache.size,
            hitRate: parseFloat(hitRate.toFixed(2)),
        };
    }

    /**
     * Reset cache statistics (does not clear cache entries)
     */
    resetStatistics() {
        this.statistics.hits = 0;
        this.statistics.misses = 0;
        this.statistics.evictions = 0;
    }

    /**
     * Check if caching is enabled
     * @returns {boolean} true if cache is enabled
     */
    isEnabled() {
        return this.options.enabled;
    }

    /**
     * Clean up expired entries from cache
     * @returns {number} Number of entries removed
     */
    cleanExpired() {
        if (!this.options.enabled) {
            return 0;
        }

        const now = Date.now();
        const expiredKeys = [];

        // Collect expired keys first to avoid iteration issues
        for (const [domain, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                expiredKeys.push(domain);
            }
        }

        // Delete expired entries
        for (const domain of expiredKeys) {
            this.cache.delete(domain);
            this.statistics.evictions++;
        }

        return expiredKeys.length;
    }

    /**
     * Get cache configuration options
     * @returns {Object} Current cache options
     */
    getOptions() {
        return { ...this.options };
    }

    /**
     * Get all cached domains (for debugging)
     * @returns {string[]} Array of cached domain names
     */
    getCachedDomains() {
        return Array.from(this.cache.keys());
    }
}

// Export both the class and a global instance
module.exports = {
    MxCache,
    globalMxCache: new MxCache()
};