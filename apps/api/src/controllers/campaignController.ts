import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Campaign } from '../models/Campaign';
import { Customer } from '../models/Customer';
import { MessageTemplate } from '../models/MessageTemplate';
import { Message } from '../models/Message';
import { AuditLog } from '../models/AuditLog';
import { addCampaignToQueue } from '../queues/campaignQueue';
import { personalizeMessage } from '../utils/templateParser';
import { CampaignStatus, MessageStatus, OptInStatus, TemplateStatus, AuditAction } from '@whatsflow/shared';

export const getCampaigns = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const campaigns = await Campaign.find({ userId }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: campaigns.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      templateId: c.templateId.toString(),
      templateName: c.templateName,
      audience: c.audience,
      totalRecipients: c.totalRecipients,
      pendingCount: c.pendingCount,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      readCount: c.readCount,
      failedCount: c.failedCount,
      excludedCount: c.excludedCount,
      status: c.status,
      scheduledAt: c.scheduledAt?.toISOString(),
      startedAt: c.startedAt?.toISOString(),
      completedAt: c.completedAt?.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    }))
  });
};

export const createCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { name, templateId, audience = 'ALL', confirmedConsent, scheduledAt } = req.body;

  if (!name || !templateId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Campaign name and template ID are required' }
    });
    return;
  }

  // Enforce mandatory WhatsApp policy consent confirmation
  if (!confirmedConsent) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CONSENT_REQUIRED',
        message: 'You must confirm permission to message recipients in accordance with WhatsApp business policies.'
      }
    });
    return;
  }

  // Validate template approval status
  const template = await MessageTemplate.findOne({ _id: templateId, userId });
  if (!template) {
    res.status(404).json({ success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } });
    return;
  }

  if (template.whatsappTemplateStatus !== TemplateStatus.APPROVED) {
    res.status(400).json({
      success: false,
      error: {
        code: 'TEMPLATE_NOT_APPROVED',
        message: `Template cannot be used because its status is ${template.whatsappTemplateStatus}. WhatsApp requires approved templates for business-initiated campaigns.`
      }
    });
    return;
  }

  // Filter audience: strictly exclude OPTED_OUT (Global suppression)
  const query: any = { userId, optInStatus: { $ne: OptInStatus.OPTED_OUT } };
  const excludedCount = await Customer.countDocuments({ userId, optInStatus: OptInStatus.OPTED_OUT });
  const customers = await Customer.find(query);

  if (customers.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_RECIPIENTS', message: 'No eligible recipients found. All contacts are opted-out or empty.' }
    });
    return;
  }

  const campaign = await Campaign.create({
    userId,
    name,
    templateId: template._id,
    templateName: template.name,
    audience,
    totalRecipients: customers.length,
    pendingCount: customers.length,
    excludedCount,
    status: scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
  });

  // Pre-create message records for idempotency (campaignId + customerId)
  const messageDocs = customers.map((cust) => ({
    campaignId: campaign._id,
    customerId: cust._id,
    userId,
    customerName: cust.name,
    phone: cust.phone,
    templateId: template._id,
    personalizedContent: personalizeMessage(template.body, cust),
    status: MessageStatus.PENDING
  }));

  await Message.insertMany(messageDocs);

  await AuditLog.create({
    userId,
    action: AuditAction.CAMPAIGN_CREATED,
    resource: 'Campaign',
    resourceId: campaign._id.toString(),
    metadata: { totalRecipients: customers.length, excludedCount },
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    success: true,
    data: {
      id: campaign._id.toString(),
      name: campaign.name,
      totalRecipients: campaign.totalRecipients,
      excludedCount: campaign.excludedCount,
      status: campaign.status
    }
  });
};

export const startCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const campaign = await Campaign.findOne({ _id: req.params.id, userId });

  if (!campaign) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }

  if (campaign.status === CampaignStatus.RUNNING) {
    res.status(400).json({ success: false, error: { code: 'ALREADY_RUNNING', message: 'Campaign is already running' } });
    return;
  }

  campaign.status = CampaignStatus.RUNNING;
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();

  await addCampaignToQueue(campaign._id.toString(), userId!);

  await AuditLog.create({
    userId,
    action: AuditAction.CAMPAIGN_STARTED,
    resource: 'Campaign',
    resourceId: campaign._id.toString(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    message: 'Campaign launched and processing queued'
  });
};

export const pauseCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId, status: CampaignStatus.RUNNING },
    { status: CampaignStatus.PAUSED },
    { new: true }
  );

  if (!campaign) {
    res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Campaign cannot be paused' } });
    return;
  }

  res.json({ success: true, message: 'Campaign paused' });
};

export const resumeCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId, status: CampaignStatus.PAUSED },
    { status: CampaignStatus.RUNNING },
    { new: true }
  );

  if (!campaign) {
    res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Campaign cannot be resumed' } });
    return;
  }

  await addCampaignToQueue(campaign._id.toString(), userId!);
  res.json({ success: true, message: 'Campaign resumed' });
};

export const cancelCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId },
    { status: CampaignStatus.CANCELLED },
    { new: true }
  );

  if (!campaign) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }

  res.json({ success: true, message: 'Campaign cancelled' });
};

export const getCampaignMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { status, search } = req.query;

  const query: any = { campaignId: req.params.id, userId };
  if (status && status !== 'ALL') {
    query.status = status;
  }
  if (search) {
    const regex = new RegExp(search as string, 'i');
    query.$or = [{ customerName: regex }, { phone: regex }];
  }

  const messages = await Message.find(query).sort({ createdAt: -1 }).limit(200);
  res.json({
    success: true,
    data: messages
  });
};
