interface CacheEntry {
  result: any;
  timestamp: number;
  ttl: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

interface CacheOptions {
  enabled?: boolean;
  defaultTtl?: number;
  maxSize?: number;
  cleanupEnabled?: boolean;
  cleanupProbability?: number;
}

const DEFAULT_CLEANUP_PROBABILITY = 0.1;

export class MxCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly statistics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private readonly options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      enabled: options.enabled !== false,
      defaultTtl: options.defaultTtl || 300000, // 5 minutes
      maxSize: options.maxSize || 1000,
      cleanupEnabled: options.cleanupEnabled !== false,
      cleanupProbability: options.cleanupProbability ?? DEFAULT_CLEANUP_PROBABILITY,
    };
  }

  get(domain: string): any | null {
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

    // LRU: Move to end by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.statistics.hits++;
    return entry.result;
  }

  set(domain: string, result: any, ttl?: number): void {
    if (!this.options.enabled) {
      return;
    }

    const key = domain.toLowerCase();

    // Check cache size limit
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      // LRU eviction: Remove least recently used entry
      const lruKey = this.cache.keys().next().value;
      if (lruKey) {
        this.cache.delete(lruKey);
        this.statistics.evictions++;
      }
    }

    // Periodic cleanup of expired entries
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

  cleanExpired(): number {
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

  flush(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.statistics.evictions += size;
  }

  getStatistics(): CacheStatistics {
    const totalRequests = this.statistics.hits + this.statistics.misses;
    return {
      hits: this.statistics.hits,
      misses: this.statistics.misses,
      evictions: this.statistics.evictions,
      size: this.cache.size,
      hitRate: totalRequests > 0 ? (this.statistics.hits / totalRequests) * 100 : 0,
    };
  }

  getCachedDomains(): string[] {
    return Array.from(this.cache.keys());
  }

  has(domain: string): boolean {
    const key = domain.toLowerCase();
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.statistics.evictions++;
      return false;
    }
    
    return true;
  }

  delete(domain: string): boolean {
    const key = domain.toLowerCase();
    const existed = this.cache.has(key);
    
    if (existed) {
      this.cache.delete(key);
      this.statistics.evictions++;
    }
    
    return existed;
  }

  getSize(): number {
    return this.cache.size;
  }

  getMaxSize(): number {
    return this.options.maxSize;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    
    if (!enabled) {
      this.flush();
    }
  }
}