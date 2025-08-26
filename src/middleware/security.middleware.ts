import helmet from 'helmet'
import { Request, Response, NextFunction } from 'express'

export class SecurityMiddleware {
  // Helmet configuration for production
  static helmet() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      
      // Cross Origin Embedder Policy
      crossOriginEmbedderPolicy: false, // API doesn't need this
      
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      
      // Frame Options
      frameguard: { action: 'deny' },
      
      // Hide Powered By
      hidePoweredBy: true,
      
      // HSTS (HTTP Strict Transport Security)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      
      // IE No Open
      ieNoOpen: true,
      
      // No Sniff
      noSniff: true,
      
      // Origin Agent Cluster
      originAgentCluster: true,
      
      // Permitted Cross Domain Policies
      permittedCrossDomainPolicies: false,
      
      // Referrer Policy
      referrerPolicy: { policy: 'no-referrer' },
      
      // X-XSS-Protection
      xssFilter: true,
    })
  }

  // Additional security headers
  static additionalHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // API-specific security headers
      res.setHeader('X-API-Version', '2.0.0')
      res.setHeader('X-Rate-Limit-Policy', 'fair-use')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.setHeader('Surrogate-Control', 'no-store')
      
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY')
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff')
      
      // Custom security headers for API
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive')
      
      next()
    }
  }

  // IP Whitelisting (optional)
  static ipWhitelist(allowedIPs: string[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (allowedIPs.length === 0) {
        return next()
      }

      const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']
      
      if (!clientIP || !allowedIPs.includes(clientIP as string)) {
        return res.status(403).json({
          success: false,
          error: 'IP address not whitelisted',
          timestamp: new Date().toISOString()
        })
      }
      
      next()
    }
  }
}