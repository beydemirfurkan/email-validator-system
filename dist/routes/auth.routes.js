"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const response_utils_1 = require("../utils/response.utils");
const validation_1 = require("../types/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.authRoutes = router;
const registerLimiter = rate_limiter_middleware_1.RateLimiterMiddleware.create({
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Too many registration attempts, please try again later'
});
const loginLimiter = rate_limiter_middleware_1.RateLimiterMiddleware.create({
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts, please try again later'
});
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const validatedData = validation_1.userRegistrationSchema.parse(req.body);
        const { name, email, password } = validatedData;
        const existingUser = await connection_1.db.select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email.toLowerCase()))
            .limit(1);
        if (existingUser.length > 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('User with this email already exists', 400));
        }
        const hashedPassword = await auth_middleware_1.AuthMiddleware.hashPassword(password);
        const newUser = {
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        };
        const createdUsers = await connection_1.db.insert(schema_1.users).values(newUser).returning({
            id: schema_1.users.id,
            name: schema_1.users.name,
            email: schema_1.users.email,
            isActive: schema_1.users.isActive,
            createdAt: schema_1.users.createdAt
        });
        const user = createdUsers[0];
        const token = auth_middleware_1.AuthMiddleware.generateToken(user.id);
        return res.status(201).json(response_utils_1.ResponseUtils.success({
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
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('Registration error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Registration failed', error));
    }
});
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const validatedData = validation_1.userLoginSchema.parse(req.body);
        const { email, password } = validatedData;
        const userRecords = await connection_1.db.select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email.toLowerCase()))
            .limit(1);
        const user = userRecords[0];
        if (!user || !user.isActive) {
            return res.status(401).json(response_utils_1.ResponseUtils.error('Invalid email or password', 401));
        }
        const isValidPassword = await auth_middleware_1.AuthMiddleware.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json(response_utils_1.ResponseUtils.error('Invalid email or password', 401));
        }
        const token = auth_middleware_1.AuthMiddleware.generateToken(user.id);
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isActive: user.isActive
            },
            token
        }));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('Login error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Login failed', error));
    }
});
router.get('/profile', auth_middleware_1.AuthMiddleware.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        return res.json(response_utils_1.ResponseUtils.success({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isActive: user.isActive
            }
        }));
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch profile', error));
    }
});
router.put('/profile', auth_middleware_1.AuthMiddleware.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Name is required'));
        }
        const updatedUsers = await connection_1.db.update(schema_1.users)
            .set({
            name: name.trim()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id))
            .returning({
            id: schema_1.users.id,
            name: schema_1.users.name,
            email: schema_1.users.email,
            isActive: schema_1.users.isActive
        });
        const updatedUser = updatedUsers[0];
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Profile updated successfully',
            user: updatedUser
        }));
    }
    catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to update profile', error));
    }
});
router.put('/password', auth_middleware_1.AuthMiddleware.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Current password and new password are required'));
        }
        if (newPassword.length < 8) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('New password must be at least 8 characters long'));
        }
        const userRecords = await connection_1.db.select()
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id))
            .limit(1);
        const currentUser = userRecords[0];
        if (!currentUser) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('User not found', 404));
        }
        const isValidPassword = await auth_middleware_1.AuthMiddleware.verifyPassword(currentPassword, currentUser.password);
        if (!isValidPassword) {
            return res.status(401).json(response_utils_1.ResponseUtils.error('Current password is incorrect', 401));
        }
        const hashedNewPassword = await auth_middleware_1.AuthMiddleware.hashPassword(newPassword);
        await connection_1.db.update(schema_1.users)
            .set({
            password: hashedNewPassword,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, user.id));
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Password changed successfully'
        }));
    }
    catch (error) {
        console.error('Password change error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to change password', error));
    }
});
router.post('/refresh', auth_middleware_1.AuthMiddleware.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const token = auth_middleware_1.AuthMiddleware.generateToken(user.id);
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Token refreshed successfully',
            token
        }));
    }
    catch (error) {
        console.error('Token refresh error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to refresh token', error));
    }
});
//# sourceMappingURL=auth.routes.js.map