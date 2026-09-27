import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { env } from '../config/env';
import { RegisterSchema, LoginSchema, AuditAction, UserRole } from '@whatsflow/shared';

const generateTokens = (id: string, email: string, role: UserRole) => {
  const accessToken = jwt.sign({ id, email, role }, env.JWT_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign({ id, email, role }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const validated = RegisterSchema.parse(req.body);
  const existingUser = await User.findOne({ email: validated.email.toLowerCase() });

  if (existingUser) {
    res.status(400).json({
      success: false,
      error: { code: 'USER_EXISTS', message: 'User with this email already exists' }
    });
    return;
  }

  const passwordHash = await bcrypt.hash(validated.password, 10);
  const user = await User.create({
    name: validated.name,
    email: validated.email.toLowerCase(),
    passwordHash,
    companyName: validated.companyName,
    phone: validated.phone,
    role: UserRole.ADMIN // First user or standard registration default
  });

  const tokens = generateTokens(user._id.toString(), user.email, user.role);

  await AuditLog.create({
    userId: user._id,
    action: AuditAction.USER_REGISTERED,
    resource: 'User',
    resourceId: user._id.toString(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    success: true,
    data: {
      user: user.toAuthJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  });
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const validated = LoginSchema.parse(req.body);
  const user = await User.findOne({ email: validated.email.toLowerCase() });

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
    return;
  }

  const isMatch = await user.comparePassword(validated.password);
  if (!isMatch) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
    return;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = generateTokens(user._id.toString(), user.email, user.role);

  await AuditLog.create({
    userId: user._id,
    action: AuditAction.USER_LOGIN,
    resource: 'User',
    resourceId: user._id.toString(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    data: {
      user: user.toAuthJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  });
};

export const refresh = async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({
      success: false,
      error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Refresh token is required' }
    });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string; email: string; role: UserRole };
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    const tokens = generateTokens(user._id.toString(), user.email, user.role);
    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' }
    });
  }
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    return;
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  res.json({
    success: true,
    data: { user: user.toAuthJSON() }
  });
};

export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};
