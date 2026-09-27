import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WhatsAppConfig } from '../models/WhatsAppConfig';
import { AuditLog } from '../models/AuditLog';
import { WhatsAppService } from '../services/whatsappService';
import { encrypt } from '../utils/crypto';
import { AuditAction } from '@whatsflow/shared';

export const getWhatsAppConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const config = await WhatsAppConfig.findOne({ userId });

  if (!config) {
    res.json({
      success: true,
      data: {
        isConfigured: false,
        businessAccountId: '',
        phoneNumberId: '',
        webhookVerifyToken: 'whatsflow_verify_token_secure',
        displayPhoneNumber: ''
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      isConfigured: true,
      businessAccountId: config.businessAccountId,
      phoneNumberId: config.phoneNumberId,
      webhookVerifyToken: config.webhookVerifyToken,
      displayPhoneNumber: config.displayPhoneNumber
    }
  });
};

export const updateWhatsAppConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { businessAccountId, phoneNumberId, accessToken, webhookVerifyToken } = req.body;

  if (!businessAccountId || !phoneNumberId || !accessToken) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Business Account ID, Phone Number ID, and Access Token are required' }
    });
    return;
  }

  const encryptedAccessToken = encrypt(accessToken);

  const config = await WhatsAppConfig.findOneAndUpdate(
    { userId },
    {
      businessAccountId,
      phoneNumberId,
      encryptedAccessToken,
      webhookVerifyToken: webhookVerifyToken || 'whatsflow_verify_token_secure',
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  await AuditLog.create({
    userId,
    action: AuditAction.WHATSAPP_CONFIG_UPDATED,
    resource: 'WhatsAppConfig',
    resourceId: config._id.toString(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    message: 'WhatsApp configuration updated successfully'
  });
};

export const testConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const config = await WhatsAppConfig.findOne({ userId });

  const credentials = {
    phoneNumberId: config?.phoneNumberId || req.body.phoneNumberId || '105948372615243',
    accessToken: config ? config.getAccessToken() : req.body.accessToken || 'eaab_demo',
    businessAccountId: config?.businessAccountId || req.body.businessAccountId
  };

  const testResult = await WhatsAppService.testConnection(credentials);

  if (testResult.success) {
    res.json({
      success: true,
      data: testResult
    });
  } else {
    res.status(400).json({
      success: false,
      error: { code: 'WHATSAPP_CONNECTION_FAILED', message: testResult.error || 'Connection test failed' }
    });
  }
};
