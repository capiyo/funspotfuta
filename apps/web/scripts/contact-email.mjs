const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
export function isValidContactEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (!email || /\b(?:TODO|TYPE\s+REAL)\b/i.test(email) || !EMAIL_PATTERN.test(email)) return false;
  const local = email.slice(0, email.lastIndexOf('@'));
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..') || email.length > 254) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (/(?:^|\.)(?:invalid|test|example|localhost)$/.test(domain)) return false;
  if (/(?:^|\.)example\.(?:com|org|net)$/.test(domain)) return false;
  return true;
}
