import * as XLSX from 'xlsx';
import { validateAndNormalizePhone } from './phoneValidator';
import { OptInStatus } from '@whatsflow/shared';

export interface ColumnMapping {
  name: string;
  phone: string;
  email?: string;
  optInStatus?: string;
  [key: string]: string | undefined;
}

export interface ParseResult {
  detectedColumns: string[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  missingPhoneCount: number;
  validCustomers: Array<{
    name: string;
    phone: string;
    email?: string;
    optInStatus: OptInStatus;
    attributes: Record<string, string>;
  }>;
  errors: Array<{
    rowNumber: number;
    phone?: string;
    name?: string;
    error: string;
  }>;
}

export function parseCustomerBuffer(
  buffer: Buffer,
  mapping?: Partial<ColumnMapping>,
  defaultOptInStatus: OptInStatus = OptInStatus.NOT_OPTED_IN,
  defaultCountry: string = 'IN'
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawData || rawData.length === 0) {
    return {
      detectedColumns: [],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      missingPhoneCount: 0,
      validCustomers: [],
      errors: [{ rowNumber: 1, error: 'The uploaded file is empty' }]
    };
  }

  const detectedColumns = Object.keys(rawData[0]);

  // Auto-detect column mapping if not provided
  const phoneCol =
    mapping?.phone ||
    detectedColumns.find((c) => /phone|mobile|contact|cell|number/i.test(c)) ||
    'Phone';

  const nameCol =
    mapping?.name ||
    detectedColumns.find((c) => /name|customer|full_name/i.test(c)) ||
    'Name';

  const emailCol =
    mapping?.email ||
    detectedColumns.find((c) => /email|mail/i.test(c));

  const optInCol =
    mapping?.optInStatus ||
    detectedColumns.find((c) => /optin|opt_in|consent|subscribed/i.test(c));

  const validCustomers: ParseResult['validCustomers'] = [];
  const errors: ParseResult['errors'] = [];
  const seenPhones = new Set<string>();

  let duplicateCount = 0;
  let missingPhoneCount = 0;
  let invalidCount = 0;

  rawData.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based, accounting for header row
    const rawPhone = row[phoneCol];
    const rawName = row[nameCol] || `Customer ${rowNumber}`;
    const rawEmail = emailCol ? String(row[emailCol] || '').trim() : undefined;

    // Missing phone check
    if (!rawPhone || String(rawPhone).trim() === '') {
      missingPhoneCount++;
      errors.push({
        rowNumber,
        name: String(rawName),
        error: `Missing phone number in column '${phoneCol}'`
      });
      return;
    }

    // Phone validation and normalization
    const phoneValidation = validateAndNormalizePhone(rawPhone, defaultCountry);
    if (!phoneValidation.isValid || !phoneValidation.e164Format) {
      invalidCount++;
      errors.push({
        rowNumber,
        phone: String(rawPhone),
        name: String(rawName),
        error: phoneValidation.error || 'Invalid phone number'
      });
      return;
    }

    const normalizedPhone = phoneValidation.e164Format;

    // Duplicate check within sheet
    if (seenPhones.has(normalizedPhone)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        phone: normalizedPhone,
        name: String(rawName),
        error: `Duplicate phone number: ${normalizedPhone}`
      });
      return;
    }

    seenPhones.add(normalizedPhone);

    // Opt-In determination
    let rowOptInStatus = defaultOptInStatus;
    if (optInCol && row[optInCol]) {
      const val = String(row[optInCol]).trim().toUpperCase();
      if (['YES', 'TRUE', '1', 'OPTED_IN', 'AGREED'].includes(val)) {
        rowOptInStatus = OptInStatus.OPTED_IN;
      } else if (['NO', 'FALSE', '0', 'OPTED_OUT', 'STOP', 'UNSUBSCRIBE'].includes(val)) {
        rowOptInStatus = OptInStatus.OPTED_OUT;
      }
    }

    // Capture other columns as dynamic attributes (e.g. OrderID, Amount, Date)
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key !== phoneCol && key !== nameCol && key !== emailCol && key !== optInCol) {
        attributes[key] = String(value ?? '');
      }
    }

    validCustomers.push({
      name: String(rawName).trim(),
      phone: normalizedPhone,
      email: rawEmail || undefined,
      optInStatus: rowOptInStatus,
      attributes
    });
  });

  return {
    detectedColumns,
    totalRows: rawData.length,
    validCount: validCustomers.length,
    invalidCount,
    duplicateCount,
    missingPhoneCount,
    validCustomers,
    errors
  };
}
