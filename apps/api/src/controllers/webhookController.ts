import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Campaign } from '../models/Campaign';
import { Customer } from '../models/Customer';
import { AuditLog } from '../models/AuditLog';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { MessageStatus, OptInStatus, AuditAction } from '@whatsflow/shared';

export const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'whatsflow_verify_token_secure')) {
    logger.info('Meta WhatsApp Webhook verified successfully');
    res.status(200).send(challenge);
    return;
  }

  logger.warn({ token }, 'WhatsApp Webhook verification failed');
  res.sendStatus(403);
};

export const receiveWebhook = async (req: Request, res: Response): Promise<void> => {
  const body = req.body;

  // Acknowledge receipt immediately to Meta
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  try {
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const val = change.value;
        if (!val) continue;

        // 1. Process Message Status Updates (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const statusObj of val.statuses) {
            const wamid = statusObj.id;
            const metaStatus = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
            const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

            const message = await Message.findOne({ whatsappMessageId: wamid });
            if (!message) continue;

            const campaign = await Campaign.findById(message.campaignId);

            if (metaStatus === 'delivered' && message.status !== MessageStatus.DELIVERED && message.status !== MessageStatus.READ) {
              message.status = MessageStatus.DELIVERED;
              message.deliveredAt = timestamp;
              await message.save();

              if (campaign) {
                await Campaign.findByIdAndUpdate(campaign._id, { $inc: { deliveredCount: 1 } });
              }
            } else if (metaStatus === 'read' && message.status !== MessageStatus.READ) {
              message.status = MessageStatus.READ;
              message.readAt = timestamp;
              await message.save();

              if (campaign) {
                await Campaign.findByIdAndUpdate(campaign._id, { $inc: { readCount: 1 } });
              }
            } else if (metaStatus === 'failed') {
              message.status = MessageStatus.FAILED;
              message.failedAt = timestamp;
              message.errorCode = statusObj.errors?.[0]?.code?.toString() || 'META_DELIVERY_FAILURE';
              message.errorMessage = statusObj.errors?.[0]?.title || 'Message delivery failed';
              await message.save();

              if (campaign) {
                await Campaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1 } });
              }
            }
          }
        }

        // 2. Process Inbound Messages (Opt-Out handling: STOP, UNSUBSCRIBE, CANCEL)
        if (Array.isArray(val.messages)) {
          for (const incoming of val.messages) {
            const fromPhone = '+' + incoming.from;
            const textBody = incoming.text?.body?.trim().toUpperCase();

            if (textBody && ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT'].includes(textBody)) {
              logger.info({ fromPhone, textBody }, 'Inbound customer opt-out received');

              const customer = await Customer.findOneAndUpdate(
                { phone: fromPhone },
                { optInStatus: OptInStatus.OPTED_OUT },
                { new: true }
              );

              if (customer) {
                await AuditLog.create({
                  userId: customer.userId,
                  action: AuditAction.CUSTOMER_OPTED_OUT,
                  resource: 'Customer',
                  resourceId: customer._id.toString(),
                  metadata: { phone: fromPhone, keyword: textBody },
                  timestamp: new Date()
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error processing WhatsApp webhook event');
  }
};
