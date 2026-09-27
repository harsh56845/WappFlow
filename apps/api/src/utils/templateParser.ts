export function extractTemplateVariables(bodyText: string): string[] {
  const matches = bodyText.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g);
  if (!matches) return [];
  const uniqueVars = new Set<string>();
  for (const match of matches) {
    const varName = match.replace(/[{}]/g, '').trim();
    if (varName) {
      uniqueVars.add(varName);
    }
  }
  return Array.from(uniqueVars);
}

export function personalizeMessage(
  templateBody: string,
  customer: {
    name: string;
    phone: string;
    email?: string;
    attributes?: Record<string, string> | Map<string, string>;
  }
): string {
  let personalized = templateBody;

  // Standard variables
  personalized = personalized.replace(/\{\{Name\}\}/gi, customer.name || '');
  personalized = personalized.replace(/\{\{Phone\}\}/gi, customer.phone || '');
  personalized = personalized.replace(/\{\{Email\}\}/gi, customer.email || '');

  // Custom attributes (OrderID, Amount, Date, etc.)
  if (customer.attributes) {
    const attrMap =
      customer.attributes instanceof Map
        ? customer.attributes
        : new Map(Object.entries(customer.attributes));

    for (const [key, value] of attrMap.entries()) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      personalized = personalized.replace(regex, value ?? '');
    }
  }

  // Clean any remaining unmatched variables to empty string or label
  personalized = personalized.replace(/\{\{[^}]+\}\}/g, '');

  return personalized;
}
