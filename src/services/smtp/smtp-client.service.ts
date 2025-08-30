/**
 * Core SMTP Client Implementation
 * Handles low-level SMTP protocol operations
 */

import * as net from 'net';
import * as tls from 'tls';

interface SMTPClientOptions {
  connectTimeout?: number;
  readTimeout?: number;
  verbose?: boolean;
}

interface SMTPResponse {
  code: number;
  message: string;
  lines: string[];
}

export class SMTPClient {
  private host: string;
  private port: number;
  private connectTimeout: number;
  private readTimeout: number;
  private verbose: boolean;
  private socket: net.Socket | tls.TLSSocket | null;
  private buffer: string;
  private secure: boolean;
  public _usedIP?: string;

  constructor(host: string, port: number = 25, options: SMTPClientOptions = {}) {
    this.host = host;
    this.port = port;
    this.connectTimeout = options.connectTimeout || 15000;
    this.readTimeout = options.readTimeout || 15000;
    this.verbose = options.verbose || false;
    this.socket = null;
    this.buffer = '';
    this.secure = false;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.error(`[${new Date().toISOString()}] ${this.host}:${this.port} - ${message}`);
    }
  }

  private _setReadTimeout(): void {
    if (!this.socket) {
      return;
    }
    this.socket.setTimeout(this.readTimeout, () => this._onTimeout());
  }

  private _onTimeout(): void {
    this.log('Read timeout occurred');
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
    }
  }

  async connect(): Promise<SMTPResponse> {
    this.log('Attempting connection...');
    const result = await new Promise<SMTPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (socket) {
          socket.destroy();
        }
        reject(new Error(`Connect timeout after ${this.connectTimeout}ms`));
      }, this.connectTimeout);

      // Prepare connection options
      const connectOptions: net.NetConnectOpts = { 
        host: this.host, 
        port: this.port 
      };

      const socket = net.connect(connectOptions);
      this.socket = socket;
      socket.setKeepAlive(true);
      
      socket.once('error', (err) => {
        this.log(`Connection error: ${err.message}`);
        clearTimeout(timer);
        reject(new Error(`Connection failed: ${err.message}`));
      });
      
      socket.once('connect', () => {
        this.log('Connected successfully');
      });
      
      socket.once('close', (hadErr) => {
        if (hadErr) {
          this.log('Connection closed with error');
        }
      });

      socket.on('data', (chunk) => {
        this.buffer += chunk.toString('utf8');
      });

      // Wait for 220 banner
      (async () => {
        try {
          const banner = await this._readResponse();
          clearTimeout(timer);
          resolve(banner);
        } catch (e) {
          clearTimeout(timer);
          reject(e);
        }
      })();
    });

    // Set timeout after connection is established
    this._setReadTimeout();
    return result;
  }

  async startTLS(servername: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    
    this.log('Sending STARTTLS command');
    await this.write('STARTTLS');
    const res = await this._readResponse();
    
    if (res.code !== 220) {
      throw new Error(`STARTTLS rejected: ${res.code} ${res.message}`);
    }

    this.log('Upgrading to TLS connection');
    if ((this.socket as any).timeout) {
      this.socket.setTimeout(0);
    }

    const tlsSocket = tls.connect({
      socket: this.socket,
      servername,
      timeout: this.connectTimeout,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        tlsSocket.destroy();
        reject(new Error('TLS handshake timeout'));
      }, this.connectTimeout);

      tlsSocket.once('secureConnect', () => {
        clearTimeout(timer);
        this.log('TLS handshake completed');
        resolve();
      });

      tlsSocket.once('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`TLS error: ${err.message}`));
      });
    });

    this.socket = tlsSocket;
    this.secure = true;
    this.buffer = '';
    this._setReadTimeout();
  }

  async write(line: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.write(line + '\r\n');
  }

  private async _readResponse(): Promise<SMTPResponse> {
    const lines: string[] = [];
    while (true) {
      const chunk = await this._waitForData();
      if (!chunk) {
        throw new Error('Connection closed');
      }
      let consumed = false;
      while (true) {
        const idx = this.buffer.indexOf('\r\n');
        if (idx === -1) {
          break;
        }
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 2);
        lines.push(line);

        const m = line.match(/^(\d{3})([ -])(.*)$/);
        if (m && m[2] === ' ') {
          const code = parseInt(m[1]!, 10);
          const message = lines.map(l => l.replace(/^\d{3}[ -]/, '')).join('\n');
          return { code, message, lines };
        }
        consumed = true;
      }
      if (!consumed) {
        continue;
      }
    }
  }

  private _waitForData(): Promise<boolean> {
    return new Promise(resolve => {
      if (this.buffer.length) {
        return resolve(true);
      }

      const waitTimeout = setTimeout(() => {
        cleanup();
        this.log('Data wait timeout');
        resolve(false);
      }, this.readTimeout);

      const onData = () => {
        cleanup();
        resolve(true);
      };
      const onEnd = () => {
        cleanup();
        resolve(false);
      };
      const onErr = () => {
        cleanup();
        resolve(false);
      };
      const onTimeout = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        clearTimeout(waitTimeout);
        this.socket?.off('data', onData);
        this.socket?.off('end', onEnd);
        this.socket?.off('error', onErr);
        this.socket?.off('timeout', onTimeout);
      };
      this.socket?.once('data', onData);
      this.socket?.once('end', onEnd);
      this.socket?.once('error', onErr);
      this.socket?.once('timeout', onTimeout);
    });
  }

  async sendCommand(cmd: string): Promise<SMTPResponse> {
    await this.write(cmd);
    const res = await this._readResponse();
    return res;
  }

  close(): void {
    try {
      this.socket?.end();
    } catch {}
    try {
      this.socket?.destroy();
    } catch {}
    this.socket = null;
  }
}