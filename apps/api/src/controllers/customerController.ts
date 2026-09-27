import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Customer } from '../models/Customer';
import { AuditLog } from '../models/AuditLog';
import { parseCustomerBuffer } from '../utils/excelParser';
import { validateAndNormalizePhone } from '../utils/phoneValidator';
import { OptInStatus, AuditAction } from '@whatsflow/shared';
import * as XLSX from 'xlsx';

export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { page = '1', limit = '50', search, optInStatus } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: any = { userId };

  if (optInStatus && Object.values(OptInStatus).includes(optInStatus as OptInStatus)) {
    query.optInStatus = optInStatus;
  }

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    query.$or = [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
  }

  const [customers, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Customer.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      customers: customers.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        phone: c.phone,
        email: c.email,
        optInStatus: c.optInStatus,
        attributes: c.attributes instanceof Map ? Object.fromEntries(c.attributes) : c.attributes,
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }
  });
};

export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { name, phone, email, optInStatus = OptInStatus.NOT_OPTED_IN, attributes = {} } = req.body;

  if (!name || !phone) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name and phone are required' }
    });
    return;
  }

  const phoneValidation = validateAndNormalizePhone(phone);
  if (!phoneValidation.isValid || !phoneValidation.e164Format) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PHONE', message: phoneValidation.error || 'Invalid phone format' }
    });
    return;
  }

  const normalizedPhone = phoneValidation.e164Format;
  const existing = await Customer.findOne({ userId, phone: normalizedPhone });
  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_PHONE', message: 'Customer with this phone number already exists' }
    });
    return;
  }

  const customer = await Customer.create({
    userId,
    name,
    phone: normalizedPhone,
    email: email || undefined,
    optInStatus,
    optInTimestamp: optInStatus === OptInStatus.OPTED_IN ? new Date() : undefined,
    optInSource: 'MANUAL_ENTRY',
    attributes: new Map(Object.entries(attributes))
  });

  res.status(201).json({
    success: true,
    data: customer
  });
};

export const getCustomerById = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const customer = await Customer.findOne({ _id: req.params.id, userId });
  if (!customer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.json({ success: true, data: customer });
};

export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { name, email, optInStatus, attributes } = req.body;

  const customer = await Customer.findOne({ _id: req.params.id, userId });
  if (!customer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }

  if (name) customer.name = name;
  if (email !== undefined) customer.email = email;
  if (optInStatus) {
    customer.optInStatus = optInStatus;
    if (optInStatus === OptInStatus.OPTED_IN) {
      customer.optInTimestamp = new Date();
    }
  }
  if (attributes) {
    customer.attributes = new Map(Object.entries(attributes));
  }

  await customer.save();
  res.json({ success: true, data: customer });
};

export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const deleted = await Customer.findOneAndDelete({ _id: req.params.id, userId });
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.json({ success: true, message: 'Customer deleted successfully' });
};

export const importCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'FILE_MISSING', message: 'Please upload an Excel or CSV file' }
    });
    return;
  }

  const { mapping, defaultOptInStatus, defaultCountry } = req.body;
  const parsedMapping = mapping ? JSON.parse(mapping) : undefined;

  const parseResult = parseCustomerBuffer(
    req.file.buffer,
    parsedMapping,
    defaultOptInStatus || OptInStatus.NOT_OPTED_IN,
    defaultCountry || 'IN'
  );

  let insertedCount = 0;
  let dbDuplicates = 0;

  for (const c of parseResult.validCustomers) {
    try {
      const existing = await Customer.findOne({ userId, phone: c.phone });
      if (existing) {
        dbDuplicates++;
        parseResult.errors.push({
          rowNumber: 0,
          name: c.name,
          phone: c.phone,
          error: 'Already exists in your customer database'
        });
        continue;
      }

      await Customer.create({
        userId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        optInStatus: c.optInStatus,
        optInTimestamp: c.optInStatus === OptInStatus.OPTED_IN ? new Date() : undefined,
        optInSource: 'EXCEL_IMPORT',
        attributes: new Map(Object.entries(c.attributes))
      });
      insertedCount++;
    } catch (err: any) {
      dbDuplicates++;
    }
  }

  await AuditLog.create({
    userId,
    action: AuditAction.CUSTOMERS_IMPORTED,
    resource: 'Customer',
    metadata: {
      totalRows: parseResult.totalRows,
      importedCount: insertedCount,
      errorsCount: parseResult.errors.length
    },
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    data: {
      detectedColumns: parseResult.detectedColumns,
      totalRows: parseResult.totalRows,
      validCount: insertedCount,
      invalidCount: parseResult.invalidCount,
      duplicateCount: parseResult.duplicateCount + dbDuplicates,
      missingPhoneCount: parseResult.missingPhoneCount,
      errors: parseResult.errors
    }
  });
};

export const exportCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const customers = await Customer.find({ userId }).sort({ createdAt: -1 });

  const rows = customers.map((c) => {
    const attrs = c.attributes instanceof Map ? Object.fromEntries(c.attributes) : (c.attributes || {});
    return {
      Name: c.name,
      Phone: c.phone,
      Email: c.email || '',
      OptInStatus: c.optInStatus,
      Source: c.source,
      CreatedAt: c.createdAt.toISOString(),
      ...attrs
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="customers_export.xlsx"');
  res.send(buffer);
};
