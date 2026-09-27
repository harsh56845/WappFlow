import { Campaign, ICampaignDocument } from '../models/Campaign';
import { Message, IMessageDocument } from '../models/Message';
import { Customer } from '../models/Customer';
import { MessageTemplate } from '../models/MessageTemplate';
import { WhatsAppConfig } from '../models/WhatsAppConfig';
import { WhatsAppService } from '../services/whatsappService';
import { inMemoryCampaignEmitter, CampaignJobData } from '../queues/campaignQueue';
import { CampaignStatus, MessageStatus, OptInStatus } from '@whatsflow/shared';
import { logger } from '../config/logger';
import { env } from '../config/env';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processCampaignJob({ campaignId, userId }: CampaignJobData): Promise<void> {
  logger.info({ campaignId, userId }, 'Starting campaign processing');

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status === CampaignStatus.CANCELLED) {
    logger.warn({ campaignId }, 'Campaign not found or was cancelled');
    return;
  }

  campaign.status = CampaignStatus.RUNNING;
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();

  const template = await MessageTemplate.findById(campaign.templateId);
  if (!template) {
    logger.error({ campaignId, templateId: campaign.templateId }, 'Template not found for campaign');
    campaign.status = CampaignStatus.FAILED;
    await campaign.save();
    return;
  }

  // Get WhatsApp Credentials if configured
  const config = await WhatsAppConfig.findOne({ userId });
  const credentials = {
    phoneNumberId: config?.phoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID || '1234567890',
    accessToken: config ? config.getAccessToken() : env.WHATSAPP_ACCESS_TOKEN || 'eaab_demo',
    businessAccountId: config?.businessAccountId || env.WHATSAPP_BUSINESS_ACCOUNT_ID
  };

  const pendingMessages = await Message.find({
    campaignId,
    status: { $in: [MessageStatus.PENDING, MessageStatus.QUEUED] }
  });

  logger.info({ count: pendingMessages.length, campaignId }, 'Processing pending messages');

  for (const message of pendingMessages) {
    // Check if campaign was paused or cancelled in between
    const currentCampaignState = await Campaign.findById(campaignId);
    if (
      !currentCampaignState ||
      currentCampaignState.status === CampaignStatus.PAUSED ||
      currentCampaignState.status === CampaignStatus.CANCELLED
    ) {
      logger.info({ campaignId, status: currentCampaignState?.status }, 'Campaign execution interrupted');
      return;
    }

    // Double-check customer opt-in status immediately before sending (Global suppression)
    const customer = await Customer.findById(message.customerId);
    if (!customer || customer.optInStatus === OptInStatus.OPTED_OUT) {
      message.status = MessageStatus.SKIPPED;
      message.errorMessage = 'Customer is opted-out or suppressed';
      await message.save();
      await Campaign.findByIdAndUpdate(campaignId, { $inc: { excludedCount: 1, pendingCount: -1 } });
      continue;
    }

    message.status = MessageStatus.QUEUED;
    await message.save();

    // Call WhatsApp API Service
    const sendResult = await WhatsAppService.sendTemplateMessage(credentials, {
      to: message.phone,
      templateName: template.whatsappTemplateName || template.name.toLowerCase().replace(/\s+/g, '_'),
      languageCode: template.language || 'en_US'
    });

    if (sendResult.success && sendResult.whatsappMessageId) {
      message.status = MessageStatus.SENT;
      message.whatsappMessageId = sendResult.whatsappMessageId;
      message.sentAt = new Date();
      await message.save();

      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { sentCount: 1, pendingCount: -1 }
      });

      // In DEMO_MODE, simulate realistic delivery and read status progression
      if (env.DEMO_MODE || credentials.accessToken.startsWith('eaab_demo')) {
        simulateMessageProgression(message._id.toString(), campaignId);
      }
    } else {
      message.status = MessageStatus.FAILED;
      message.errorCode = 'API_SEND_ERROR';
      message.errorMessage = sendResult.error || 'Failed to dispatch via WhatsApp Cloud API';
      message.failedAt = new Date();
      await message.save();

      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { failedCount: 1, pendingCount: -1 }
      });
    }

    // Safe inter-message throttling (50ms in demo mode or configured rate)
    await sleep(env.DEMO_MODE ? 60 : 100);
  }

  // Check completion
  const remainingPending = await Message.countDocuments({
    campaignId,
    status: { $in: [MessageStatus.PENDING, MessageStatus.QUEUED] }
  });

  if (remainingPending === 0) {
    const finalCampaign = await Campaign.findById(campaignId);
    if (finalCampaign && finalCampaign.status === CampaignStatus.RUNNING) {
      finalCampaign.status = CampaignStatus.COMPLETED;
      finalCampaign.completedAt = new Date();
      await finalCampaign.save();
      logger.info({ campaignId }, 'Campaign completed successfully');
    }
  }
}

// Simulate delivery & read updates in DEMO_MODE
function simulateMessageProgression(messageId: string, campaignId: string) {
  // Simulate Delivery in 1 - 2 seconds
  setTimeout(async () => {
    try {
      const msg = await Message.findById(messageId);
      if (msg && msg.status === MessageStatus.SENT) {
        msg.status = MessageStatus.DELIVERED;
        msg.deliveredAt = new Date();
        await msg.save();
        await Campaign.findByIdAndUpdate(campaignId, { $inc: { deliveredCount: 1 } });

        // Simulate Read in 2 - 3 seconds (90% chance of read)
        if (Math.random() < 0.9) {
          setTimeout(async () => {
            try {
              const readMsg = await Message.findById(messageId);
              if (readMsg && readMsg.status === MessageStatus.DELIVERED) {
                readMsg.status = MessageStatus.READ;
                readMsg.readAt = new Date();
                await readMsg.save();
                await Campaign.findByIdAndUpdate(campaignId, { $inc: { readCount: 1 } });
              }
            } catch (e) {
              // ignore demo simulation errors
            }
          }, 1500 + Math.random() * 2000);
        }
      }
    } catch (e) {
      // ignore demo simulation errors
    }
  }, 1000 + Math.random() * 1500);
}

// Listen to in-memory queue events
export function initCampaignWorker(): void {
  inMemoryCampaignEmitter.on('process-campaign', (data: CampaignJobData) => {
    processCampaignJob(data).catch((err) => {
      logger.error({ err }, 'Error processing campaign in memory worker');
    });
  });
  logger.info('Campaign worker registered and ready');
}
