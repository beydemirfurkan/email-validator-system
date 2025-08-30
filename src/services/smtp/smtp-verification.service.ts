/**
 * Core SMTP Email Verification Service
 * Handles SMTP-based email verification with connection pooling
 */

import { promises as dns } from 'dns';
import { SMTPClient } from './smtp-client.service';
import { getGlobalConnectionPool } from './connection-pool.service';
import { classifySmtpResponse, type SmtpClassification } from './message-analyzer.service';
import { getGlobalSMTPRotationService } from './smtp-rotation.service';
import { appConfig } from '../../config/app-config';

interface SmtpVerificationOptions {
  heloDomain?: string;
  from?: string;
  maxRetries?: number;
  verbose?: boolean;
  starttls?: 'on' | 'off' | 'auto';
  enableConnectionPooling?: boolean;
}

interface SmtpVerificationResult {
  status: 'ok' | 'tempfail' | 'permfail' | 'error';
  code?: number;
  reason: string;
  transcript?: string[];
  classification?: SmtpClassification;
  pooled?: boolean;
  host?: string;
  port?: number;
}

interface MxRecord {
  priority: number;
  exchange: string;
}

export class SMTPVerificationService {
  private rotationService = getGlobalSMTPRotationService();

  private getDefaultOptions(targetDomain?: string): SmtpVerificationOptions {
    const rotatedConfig = this.rotationService.getSMTPConfig(targetDomain);
    return rotatedConfig;
  }

  async resolveMxRecords(domain: string): Promise<MxRecord[]> {
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      // Fallback to A record if MX doesn't exist
      try {
        await dns.resolve4(domain);
        return [{ priority: 0, exchange: domain }];
      } catch (aError) {
        throw new Error(`No MX or A records found for domain: ${domain}`);
      }
    }
  }

  async verifySingleHost(
    host: string,
    port: number,
    email: string,
    options: SmtpVerificationOptions = {}
  ): Promise<SmtpVerificationResult> {
    const [, targetDomain] = email.split('@');
    const defaultOptions = this.getDefaultOptions(targetDomain);
    const opts = { ...defaultOptions, ...options };
    const heloDomain = opts.heloDomain!;
    const from = opts.from!;

    // Use connection pooling if enabled
    const usePooling = opts.enableConnectionPooling !== false;
    const connectionPool = getGlobalConnectionPool();
    let client: any = null;
    let isPooledConnection = false;

    try {
      if (usePooling && connectionPool) {
        // Get connection from pool
        client = await connectionPool.getConnection(host, port, opts);
        isPooledConnection = client._pooled || false;

        if (opts.verbose && isPooledConnection) {
          console.log(`Using pooled connection for ${host}:${port}`);
        }

        // If we got a non-pooled connection from pool, connect it
        if (!isPooledConnection) {
          await client.connect();
        }
      } else {
        // Create and connect new connection
        client = new SMTPClient(host, port, opts);
        await client.connect();
      }

      let res = await client.sendCommand(`EHLO ${heloDomain}`);

      // STARTTLS negotiation if server supports and option permits
      const supportsStartTLS = /\bSTARTTLS\b/i.test(res.message);
      if (supportsStartTLS && opts.starttls !== 'off') {
        await client.startTLS(host);
        res = await client.sendCommand(`EHLO ${heloDomain}`); // re-EHLO after TLS
      } else if (!supportsStartTLS && opts.starttls === 'on') {
        throw new Error('STARTTLS required but not supported');
      }

      // MAIL FROM
      res = await client.sendCommand(`MAIL FROM:<${from}>`);
      if (res.code >= 400 && res.code < 500) {
        return {
          status: 'tempfail',
          code: res.code,
          reason: 'MAIL FROM tempfail',
          transcript: res.lines,
          host,
          port,
        };
      }
      if (res.code >= 500) {
        return {
          status: 'permfail',
          code: res.code,
          reason: 'MAIL FROM rejected',
          transcript: res.lines,
          host,
          port,
        };
      }

      // RCPT TO target
      res = await client.sendCommand(`RCPT TO:<${email}>`);
      const classification = classifySmtpResponse(
        res.code,
        res.message,
        res.code >= 200 && res.code < 300 ? 'Accepted' : 'Rejected'
      );

      // Send RSET to clean up the session
      await client.sendCommand('RSET');

      // Only send QUIT if not using pooled connection
      if (!isPooledConnection) {
        await client.sendCommand('QUIT');
      }

      // Prepare result with classification
      let result: SmtpVerificationResult;
      if (res.code >= 200 && res.code < 300) {
        result = {
          status: 'ok',
          code: res.code,
          reason: 'Accepted',
          transcript: res.lines,
          classification: classification,
          pooled: isPooledConnection,
          host,
          port,
        };
      } else if (res.code >= 400 && res.code < 500) {
        result = {
          status: 'tempfail',
          code: res.code,
          reason: 'RCPT tempfail',
          transcript: res.lines,
          classification: classification,
          pooled: isPooledConnection,
          host,
          port,
        };
      } else {
        result = {
          status: 'permfail',
          code: res.code,
          reason: 'RCPT rejected',
          transcript: res.lines,
          classification: classification,
          pooled: isPooledConnection,
          host,
          port,
        };
      }

      return result;
    } catch (e: any) {
      const result: SmtpVerificationResult = {
        status: 'error',
        reason: e.message,
        pooled: isPooledConnection,
        host,
        port,
      };

      return result;
    } finally {
      // Always properly handle connection cleanup
      if (client) {
        if (isPooledConnection && connectionPool) {
          // Return connection to pool
          connectionPool.releaseConnection(client);
          if (opts.verbose) {
            console.log(`Connection returned to pool for ${host}:${port}`);
          }
        } else {
          // Close direct connection
          client.close();
        }
      }
    }
  }

  async verifyEmail(email: string, options: SmtpVerificationOptions = {}): Promise<{
    email: string;
    valid: boolean;
    result: string;
    reason: string;
    smtpCode?: number;
    smtpDetails?: SmtpClassification;
    mxRecords?: string[];
    rotationInfo?: { heloDomain: string; fromAddress: string };
  }> {
    try {
      const [localPart, domain] = email.split('@');
      if (!localPart || !domain) {
        return {
          email,
          valid: false,
          result: 'invalid',
          reason: 'Invalid email format',
        };
      }

      // Resolve MX records
      const mxRecords = await this.resolveMxRecords(domain);
      if (mxRecords.length === 0) {
        return {
          email,
          valid: false,
          result: 'invalid',
          reason: 'No MX records found',
          mxRecords: [],
        };
      }

      const hosts = mxRecords.map(r => r.exchange);
      
      // Get rotation info for logging/debugging
      const rotationInfo = this.rotationService.getRotatedCredentials(domain);

      // Try hosts with retries
      let lastResult: SmtpVerificationResult | null = null;
      
      for (const host of hosts) {
        const port = 25; // Standard SMTP port
        
        for (let attempt = 0; attempt <= (options.maxRetries || appConfig.smtp.maxRetries); attempt++) {
          lastResult = await this.verifySingleHost(host, port, email, options);
          
          if (lastResult.status === 'ok') {
            return {
              email,
              valid: true,
              result: 'valid',
              reason: lastResult.reason,
              smtpCode: lastResult.code,
              smtpDetails: lastResult.classification,
              mxRecords: hosts,
              rotationInfo
            };
          }
          
          if (lastResult.status === 'permfail') {
            return {
              email,
              valid: false,
              result: 'invalid',
              reason: lastResult.reason,
              smtpCode: lastResult.code,
              smtpDetails: lastResult.classification,
              mxRecords: hosts,
              rotationInfo
            };
          }
          
          // For tempfail or error, try again or next host
          if (lastResult.status === 'error' && lastResult.reason.includes('timeout')) {
            break; // Don't retry timeouts on same host
          }
          
          if (attempt < (options.maxRetries || appConfig.smtp.maxRetries)) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (lastResult && (lastResult.status === 'ok' || lastResult.status === 'permfail')) {
          break;
        }
      }

      // All hosts failed or returned tempfail/error
      return {
        email,
        valid: false,
        result: 'unknown',
        reason: lastResult?.reason || 'SMTP verification failed',
        smtpCode: lastResult?.code,
        smtpDetails: lastResult?.classification,
        mxRecords: hosts,
        rotationInfo
      };

    } catch (error: any) {
      return {
        email,
        valid: false,
        result: 'error',
        reason: error.message,
      };
    }
  }
}

export default SMTPVerificationService;