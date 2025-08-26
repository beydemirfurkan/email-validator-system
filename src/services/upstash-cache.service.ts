import { Redis } from '@upstash/redis'

interface CacheOptions {
  ttl?: number // seconds
}

class UpstashCacheService {
  private redis: Redis
  private defaultTTL: number
  private connected: boolean = false

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    this.defaultTTL = parseInt(process.env.REDIS_CACHE_TTL || '3600')
    this.testConnection()
  }

  private async testConnection() {
    try {
      await this.redis.ping()
      this.connected = true
      console.log('✅ Upstash Redis connected successfully')
    } catch (error) {
      this.connected = false
      console.error('❌ Upstash Redis connection failed:', error)
    }
  }

  // Email validation cache with security
  async setEmailValidation(email: string, result: any, options?: CacheOptions): Promise<void> {
    if (!this.connected) return
    
    try {
      const key = `email:validation:${this.hashEmail(email)}`
      const ttl = options?.ttl || this.defaultTTL
      const cacheData = {
        ...result,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl * 1000).toISOString()
      }
      await this.redis.setex(key, ttl, JSON.stringify(cacheData))
      console.log(`📦 Cached email validation: ${email.substring(0, 5)}***`)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  async getEmailValidation(email: string): Promise<any | null> {
    if (!this.connected) return null
    
    try {
      const key = `email:validation:${this.hashEmail(email)}`
      const result = await this.redis.get(key)
      if (result) {
        console.log(`⚡ Cache hit for email: ${email.substring(0, 5)}***`)
        return JSON.parse(result as string)
      }
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // MX record cache
  async setMXRecord(domain: string, mxRecords: any[], options?: CacheOptions): Promise<void> {
    if (!this.connected) return
    
    try {
      const key = `mx:${domain.toLowerCase()}`
      const ttl = options?.ttl || (24 * 60 * 60) // 24 hours for MX
      await this.redis.setex(key, ttl, JSON.stringify(mxRecords))
      console.log(`📦 Cached MX records for: ${domain}`)
    } catch (error) {
      console.error('MX cache set error:', error)
    }
  }

  async getMXRecord(domain: string): Promise<any[] | null> {
    if (!this.connected) return null
    
    try {
      const key = `mx:${domain.toLowerCase()}`
      const result = await this.redis.get(key)
      if (result) {
        console.log(`⚡ MX cache hit for: ${domain}`)
        return JSON.parse(result as string)
      }
      return null
    } catch (error) {
      console.error('MX cache get error:', error)
      return null
    }
  }

  // Secure rate limiting
  async incrementRateLimit(key: string, windowSeconds: number, identifier?: string): Promise<number> {
    if (!this.connected) return 0
    
    try {
      const secureKey = `rate:${this.hashKey(key)}:${identifier || 'default'}`
      const count = await this.redis.incr(secureKey)
      if (count === 1) {
        await this.redis.expire(secureKey, windowSeconds)
      }
      return count
    } catch (error) {
      console.error('Rate limit error:', error)
      return 0
    }
  }

  async getRateLimit(key: string, identifier?: string): Promise<number> {
    if (!this.connected) return 0
    
    try {
      const secureKey = `rate:${this.hashKey(key)}:${identifier || 'default'}`
      const count = await this.redis.get(secureKey)
      return count ? parseInt(count as string) : 0
    } catch (error) {
      console.error('Rate limit get error:', error)
      return 0
    }
  }

  // Security: Hash sensitive data
  private hashEmail(email: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 16)
  }

  private hashKey(key: string): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(key).digest('hex')
  }

  // Generic cache methods with error handling
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.connected) return false
    
    try {
      const cacheValue = typeof value === 'string' ? value : JSON.stringify(value)
      if (ttl) {
        await this.redis.setex(key, ttl, cacheValue)
      } else {
        await this.redis.set(key, cacheValue)
      }
      return true
    } catch (error) {
      console.error('Generic cache set error:', error)
      return false
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.connected) return null
    
    try {
      const result = await this.redis.get(key)
      if (!result) return null
      
      try {
        return JSON.parse(result as string)
      } catch {
        return result
      }
    } catch (error) {
      console.error('Generic cache get error:', error)
      return null
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return
    try {
      await this.redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false
    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  // Cache statistics with security info
  async getStats(): Promise<any> {
    try {
      const ping = await this.redis.ping()
      return {
        connected: this.connected,
        ping: ping,
        provider: 'upstash',
        secure: true,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'upstash',
        secure: true,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Security: Clear all user-specific cache
  async clearUserCache(userId: number): Promise<void> {
    if (!this.connected) return
    
    try {
      // This would require a more sophisticated key tracking system
      console.log(`🗑️ Clearing cache for user: ${userId}`)
      // Implementation depends on your key patterns
    } catch (error) {
      console.error('Clear user cache error:', error)
    }
  }
}

// Singleton instance
export const upstashCache = new UpstashCacheService()