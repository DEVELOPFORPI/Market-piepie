/**
 * Mask external links and contact info in text
 */

const phonePattern = /(\d{2,3})-?(\d{3,4})-?(\d{4})/g;
const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
const urlPattern = /(https?:\/\/[^\s]+)/g;

/**
 * Mask phone numbers, emails, and external URLs in user text
 */
export const maskSensitiveContent = (text: string): string => {
  let masked = text;

  masked = masked.replace(phonePattern, (_match, p1, _p2, p3) => {
    return `${p1}-****-${p3}`;
  });

  masked = masked.replace(emailPattern, (match) => {
    const [local, domain] = match.split('@');
    const maskedLocal = local.length > 2 
      ? `${local.substring(0, 2)}***` 
      : '***';
    return `${maskedLocal}@${domain}`;
  });

  masked = masked.replace(urlPattern, (match) => {
    if (match.includes(window.location.hostname) || match.startsWith('/')) {
      return match;
    }
    return '[external link]';
  });

  return masked;
};

/**
 * Whether the text contains a phone number, email, or URL
 */
export const hasSensitiveContent = (text: string): boolean => {
  return phonePattern.test(text) || emailPattern.test(text) || urlPattern.test(text);
};


