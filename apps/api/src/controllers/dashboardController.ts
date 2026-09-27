import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Customer } from '../models/Customer';
import { Campaign } from '../models/Campaign';
import { Message } from '../models/Message';
import { MessageStatus } from '@whatsflow/shared';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  const [totalCustomers, totalCampaigns, sentCount, deliveredCount, readCount, failedCount, recentCampaigns] =
    await Promise.all([
      Customer.countDocuments({ userId }),
      Campaign.countDocuments({ userId }),
      Message.countDocuments({ userId, status: { $in: [MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.READ] } }),
      Message.countDocuments({ userId, status: { $in: [MessageStatus.DELIVERED, MessageStatus.READ] } }),
      Message.countDocuments({ userId, status: MessageStatus.READ }),
      Message.countDocuments({ userId, status: MessageStatus.FAILED }),
      Campaign.find({ userId }).sort({ createdAt: -1 }).limit(5)
    ]);

  res.json({
    success: true,
    data: {
      customers: totalCustomers,
      campaigns: totalCampaigns,
      messagesSent: sentCount,
      messagesDelivered: deliveredCount,
      messagesRead: readCount,
      messagesFailed: failedCount,
      recentCampaigns
    }
  });
};
