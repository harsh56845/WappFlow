import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MessageTemplate } from '../models/MessageTemplate';
import { Customer } from '../models/Customer';
import { extractTemplateVariables, personalizeMessage } from '../utils/templateParser';
import { TemplateStatus, TemplateCategory } from '@whatsflow/shared';

export const getTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const templates = await MessageTemplate.find({ userId }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: templates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      category: t.category,
      language: t.language,
      body: t.body,
      variables: t.variables,
      whatsappTemplateName: t.whatsappTemplateName,
      whatsappTemplateStatus: t.whatsappTemplateStatus,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    }))
  });
};

export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { name, category = TemplateCategory.MARKETING, language = 'en_US', body, whatsappTemplateName } = req.body;

  if (!name || !body) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Template name and body are required' }
    });
    return;
  }

  const variables = extractTemplateVariables(body);

  const template = await MessageTemplate.create({
    userId,
    name,
    category,
    language,
    body,
    variables,
    whatsappTemplateName: whatsappTemplateName || name.toLowerCase().replace(/\s+/g, '_'),
    whatsappTemplateStatus: TemplateStatus.APPROVED // Default to approved for testing & demo
  });

  res.status(201).json({
    success: true,
    data: template
  });
};

export const getTemplateById = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const template = await MessageTemplate.findOne({ _id: req.params.id, userId });
  if (!template) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    return;
  }
  res.json({ success: true, data: template });
};

export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { name, category, language, body, whatsappTemplateName, whatsappTemplateStatus } = req.body;

  const template = await MessageTemplate.findOne({ _id: req.params.id, userId });
  if (!template) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    return;
  }

  if (name) template.name = name;
  if (category) template.category = category;
  if (language) template.language = language;
  if (body) {
    template.body = body;
    template.variables = extractTemplateVariables(body);
  }
  if (whatsappTemplateName) template.whatsappTemplateName = whatsappTemplateName;
  if (whatsappTemplateStatus) template.whatsappTemplateStatus = whatsappTemplateStatus;

  await template.save();
  res.json({ success: true, data: template });
};

export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const deleted = await MessageTemplate.findOneAndDelete({ _id: req.params.id, userId });
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    return;
  }
  res.json({ success: true, message: 'Template deleted successfully' });
};

export const previewTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { templateId, bodyText } = req.body;

  let body = bodyText;
  if (templateId) {
    const template = await MessageTemplate.findOne({ _id: templateId, userId });
    if (template) {
      body = template.body;
    }
  }

  if (!body) {
    res.status(400).json({ success: false, error: { code: 'BODY_REQUIRED', message: 'Template body is required' } });
    return;
  }

  // Fetch up to 5 real customers to show dynamic previews
  const sampleCustomers = await Customer.find({ userId }).limit(5);

  const previews = sampleCustomers.map((cust) => ({
    customerId: cust._id.toString(),
    customerName: cust.name,
    phone: cust.phone,
    previewText: personalizeMessage(body, cust)
  }));

  // If no customers yet, return placeholder preview
  if (previews.length === 0) {
    previews.push({
      customerId: 'sample',
      customerName: 'Rahul Sharma',
      phone: '+919876543210',
      previewText: personalizeMessage(body, {
        name: 'Rahul Sharma',
        phone: '+919876543210',
        email: 'rahul@example.com',
        attributes: { OrderID: 'ORD-9842', Amount: '1,499', Date: '2026-09-24' }
      })
    });
  }

  res.json({
    success: true,
    data: {
      variables: extractTemplateVariables(body),
      previews
    }
  });
};
