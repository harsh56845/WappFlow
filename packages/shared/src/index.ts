import { z } from 'zod';

// Roles
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

// User Interfaces
export interface IUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// Opt-In Statuses
export enum OptInStatus {
  OPTED_IN = 'OPTED_IN',
  NOT_OPTED_IN = 'NOT_OPTED_IN',
  UNKNOWN = 'UNKNOWN',
  OPTED_OUT = 'OPTED_OUT'
}

// Customer Interface
export interface ICustomer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  attributes: Record<string, string>;
  source: string;
  optInStatus: OptInStatus;
  optInTimestamp?: string;
  optInSource?: string;
  createdAt: string;
  updatedAt: string;
}

// Template Category
export enum TemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION'
}

// Template Status
export enum TemplateStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAUSED = 'PAUSED'
}

// Message Template Interface
export interface IMessageTemplate {
  id: string;
  userId: string;
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  variables: string[];
  whatsappTemplateName?: string;
  whatsappTemplateStatus: TemplateStatus;
  createdAt: string;
  updatedAt: string;
}

// Campaign Status
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Campaign Interface
export interface ICampaign {
  id: string;
  userId: string;
  name: string;
  templateId: string;
  templateName?: string;
  audience: string;
  totalRecipients: number;
  pendingCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  excludedCount: number;
  status: CampaignStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Message Status
export enum MessageStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

// Message Interface
export interface IMessage {
  id: string;
  campaignId: string;
  customerId: string;
  phone: string;
  templateId: string;
  personalizedContent: string;
  whatsappMessageId?: string;
  status: MessageStatus;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// WhatsApp Config Interface
export interface IWhatsAppConfig {
  userId: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  webhookVerifyToken: string;
  isConfigured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Audit Log Action
export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN = 'USER_LOGIN',
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  CAMPAIGN_STARTED = 'CAMPAIGN_STARTED',
  CAMPAIGN_PAUSED = 'CAMPAIGN_PAUSED',
  CAMPAIGN_RESUMED = 'CAMPAIGN_RESUMED',
  CAMPAIGN_CANCELLED = 'CAMPAIGN_CANCELLED',
  CUSTOMERS_IMPORTED = 'CUSTOMERS_IMPORTED',
  CUSTOMER_OPTED_OUT = 'CUSTOMER_OPTED_OUT',
  TEMPLATE_CREATED = 'TEMPLATE_CREATED',
  WHATSAPP_CONFIG_UPDATED = 'WHATSAPP_CONFIG_UPDATED'
}

export interface IAuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

// Auth Zod Schemas
export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().optional(),
  phone: z.string().optional()
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
