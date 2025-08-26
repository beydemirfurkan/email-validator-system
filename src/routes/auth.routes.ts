import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../database/connection';
import { users, NewUser } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimiterMiddleware } from '../middleware/rate-limiter.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { userRegistrationSchema, userLoginSchema } from '../types/validation';
import { ZodError } from 'zod';

const router = Router();

// Rate limiters for auth endpoints
const registerLimiter = RateLimiterMiddleware.create({
  maxRequests: 5, // 5 registration attempts per hour per IP
  windowMs: 60 * 60 * 1000,
  message: 'Too many registration attempts, please try again later'
});

const loginLimiter = RateLimiterMiddleware.create({
  maxRequests: 10, // 10 login attempts per 15 minutes per IP
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts, please try again later'
});

// POST /api/auth/register - User registration
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const validatedData = userRegistrationSchema.parse(req.body);
    const { name, email, password } = validatedData;

    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json(
        ResponseUtils.error('User with this email already exists', 400)
      );
    }

    // Hash password and create user
    const hashedPassword = await AuthMiddleware.hashPassword(password);
    const newUser: NewUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isActive: true
    };

    const createdUsers = await db.insert(users).values(newUser).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt
    });

    const user = createdUsers[0]!;

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user.id);

    return res.status(201).json(ResponseUtils.success({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      token
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', ')
        )
      );
    }

    console.error('Registration error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Registration failed', error as Error)
    );
  }
});

// POST /api/auth/login - User login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const validatedData = userLoginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user by email
    const userRecords = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    const user = userRecords[0];

    if (!user || !user.isActive) {
      return res.status(401).json(
        ResponseUtils.error('Invalid email or password', 401)
      );
    }

    // Verify password
    const isValidPassword = await AuthMiddleware.verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json(
        ResponseUtils.error('Invalid email or password', 401)
      );
    }

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user.id);

    return res.json(ResponseUtils.success({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      },
      token
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', ')
        )
      );
    }

    console.error('Login error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Login failed', error as Error)
    );
  }
});

// GET /api/auth/profile - Get user profile (requires authentication)
router.get('/profile', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    return res.json(ResponseUtils.success({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    }));
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch profile', error as Error)
    );
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json(
        ResponseUtils.validationError('Name is required')
      );
    }

    // Update user
    const updatedUsers = await db.update(users)
      .set({ 
        name: name.trim(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive
      });

    const updatedUser = updatedUsers[0];

    return res.json(ResponseUtils.success({
      message: 'Profile updated successfully',
      user: updatedUser
    }));
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to update profile', error as Error)
    );
  }
});

// PUT /api/auth/password - Change password
router.put('/password', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(
        ResponseUtils.validationError('Current password and new password are required')
      );
    }

    if (newPassword.length < 8) {
      return res.status(400).json(
        ResponseUtils.validationError('New password must be at least 8 characters long')
      );
    }

    // Get current user with password
    const userRecords = await db.select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const currentUser = userRecords[0];
    
    if (!currentUser) {
      return res.status(404).json(
        ResponseUtils.error('User not found', 404)
      );
    }

    // Verify current password
    const isValidPassword = await AuthMiddleware.verifyPassword(currentPassword, currentUser.password);
    
    if (!isValidPassword) {
      return res.status(401).json(
        ResponseUtils.error('Current password is incorrect', 401)
      );
    }

    // Hash new password
    const hashedNewPassword = await AuthMiddleware.hashPassword(newPassword);

    // Update password
    await db.update(users)
      .set({ 
        password: hashedNewPassword,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, user.id));

    return res.json(ResponseUtils.success({
      message: 'Password changed successfully'
    }));
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to change password', error as Error)
    );
  }
});

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Generate new JWT token
    const token = AuthMiddleware.generateToken(user.id);

    return res.json(ResponseUtils.success({
      message: 'Token refreshed successfully',
      token
    }));
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to refresh token', error as Error)
    );
  }
});

export { router as authRoutes };