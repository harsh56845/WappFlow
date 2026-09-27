import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js';
import { env } from '../config/env';

export interface PhoneValidationResult {
  isValid: boolean;
  e164Format?: string;
  nationalFormat?: string;
  country?: string;
  error?: string;
}

export function validateAndNormalizePhone(
  rawPhone: string | number | undefined | null,
  defaultCountry: string = env.DEFAULT_COUNTRY || 'IN'
): PhoneValidationResult {
  if (!rawPhone) {
    return { isValid: false, error: 'Phone number is missing or empty' };
  }

  const phoneStr = String(rawPhone).trim();
  if (phoneStr.length < 5) {
    return { isValid: false, error: 'Phone number is too short' };
  }

  try {
    const parsed = parsePhoneNumberWithError(phoneStr, defaultCountry as CountryCode);
    if (!parsed.isValid()) {
      return { isValid: false, error: 'Invalid phone number format or digits' };
    }

    return {
      isValid: true,
      e164Format: parsed.number, // e.g. +919876543210
      nationalFormat: parsed.formatNational(),
      country: parsed.country
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'Could not parse phone number'
    };
  }
}
