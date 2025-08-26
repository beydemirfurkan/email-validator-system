import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                email: string;
                name: string;
                isActive: boolean;
            };
            apiKey?: {
                id: number;
                userId: number;
                keyName: string;
                rateLimit: number;
            };
        }
    }
}
export declare class AuthMiddleware {
    static authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    static optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    static authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void>;
    static generateToken(userId: number): string;
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
}
//# sourceMappingURL=auth.middleware.d.ts.map