import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

export interface SendMessagePayload {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

export class WhatsAppService {
  private static readonly API_VERSION = env.WHATSAPP_API_VERSION || 'v20.0';

  /**
   * Tests connection with WhatsApp Business Platform Cloud API
   */
  public static async testConnection(creds: WhatsAppCredentials): Promise<{
    success: boolean;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    error?: string;
  }> {
    if (env.DEMO_MODE || !creds.accessToken || creds.accessToken.startsWith('eaab_demo')) {
      logger.info('WhatsApp Service: DEMO_MODE connection test successful');
      return {
        success: true,
        displayPhoneNumber: '+91 98765 43210 (Demo Sandbox)',
        verifiedName: 'WhatsFlow Demo Sandbox',
        qualityRating: 'GREEN'
      };
    }

    try {
      const url = `https://graph.facebook.com/${this.API_VERSION}/${creds.phoneNumberId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        displayPhoneNumber: response.data.display_phone_number,
        verifiedName: response.data.verified_name,
        qualityRating: response.data.quality_rating
      };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message || err.message || 'Failed to connect to WhatsApp Cloud API';
      logger.error({ error: errorMsg }, 'WhatsApp testConnection failed');
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Sends an approved template message through official Cloud API
   */
  public static async sendTemplateMessage(
    creds: WhatsAppCredentials,
    payload: SendMessagePayload
  ): Promise<{
    success: boolean;
    whatsappMessageId?: string;
    error?: string;
  }> {
    // If DEMO_MODE is active or credentials are mock, simulate success
    if (env.DEMO_MODE || !creds.accessToken || creds.accessToken.startsWith('eaab_demo')) {
      const mockMessageId = `wamid.DEMO_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        success: true,
        whatsappMessageId: mockMessageId
      };
    }

    try {
      const url = `https://graph.facebook.com/${this.API_VERSION}/${creds.phoneNumberId}/messages`;
      const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: payload.to.replace(/\+/g, ''), // WhatsApp Cloud API expects numbers without '+'
        type: 'template',
        template: {
          name: payload.templateName,
          language: {
            code: payload.languageCode || 'en_US'
          },
          components: payload.components || []
        }
      };

      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const messageId = response.data?.messages?.[0]?.id;
      return {
        success: true,
        whatsappMessageId: messageId
      };
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const errorMsg = errorData?.message || err.message || 'WhatsApp API request failed';
      logger.error(
        {
          to: payload.to,
          template: payload.templateName,
          errorCode: errorData?.code,
          errorSubcode: errorData?.error_subcode
        },
        'WhatsApp API Send Error'
      );

      return {
        success: false,
        error: errorMsg
      };
    }
  }
}
