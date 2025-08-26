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
export declare class MxCache {
    private readonly cache;
    private readonly statistics;
    private readonly options;
    constructor(options?: CacheOptions);
    get(domain: string): any | null;
    set(domain: string, result: any, ttl?: number): void;
    cleanExpired(): number;
    flush(): void;
    getStatistics(): CacheStatistics;
    getCachedDomains(): string[];
    has(domain: string): boolean;
    delete(domain: string): boolean;
    getSize(): number;
    getMaxSize(): number;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
}
export {};
//# sourceMappingURL=mx-cache.service.d.ts.map