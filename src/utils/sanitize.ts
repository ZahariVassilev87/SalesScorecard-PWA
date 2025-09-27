// Input sanitization utility using DOMPurify
import DOMPurify from 'dompurify';

// Configure DOMPurify for our use case
const config = {
  ALLOWED_TAGS: [], // No HTML tags allowed by default
  ALLOWED_ATTR: [], // No attributes allowed by default
  KEEP_CONTENT: true, // Keep text content but strip tags
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'meta', 'iframe'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover']
};

// Sanitize text input (removes all HTML tags)
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(input, config).trim();
};

// Sanitize HTML input (allows safe HTML tags)
export const sanitizeHTML = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const htmlConfig = {
    ...config,
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'b', 'i'],
    ALLOWED_ATTR: []
  };
  
  return DOMPurify.sanitize(input, htmlConfig);
};

// Sanitize object properties recursively
export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeText(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

// Sanitize form data
export const sanitizeFormData = (formData: FormData): FormData => {
  const sanitized = new FormData();
  
  // Use Array.from to convert the iterator to an array
  Array.from(formData.entries()).forEach(([key, value]) => {
    const sanitizedKey = sanitizeText(key);
    const sanitizedValue = typeof value === 'string' ? sanitizeText(value) : value;
    sanitized.append(sanitizedKey, sanitizedValue);
  });
  
  return sanitized;
};

// Validate email format
export const sanitizeEmail = (email: string): string => {
  const sanitized = sanitizeText(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  
  return sanitized.toLowerCase();
};

// Validate and sanitize numeric input
export const sanitizeNumber = (input: string | number): number => {
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : input;
  }
  
  const sanitized = sanitizeText(input.toString());
  const number = parseFloat(sanitized);
  
  return isNaN(number) ? 0 : number;
};

// Validate and sanitize date input
export const sanitizeDate = (input: string): string => {
  const sanitized = sanitizeText(input);
  const date = new Date(sanitized);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  
  return sanitized;
};

// Validate and sanitize URL
export const sanitizeURL = (url: string): string => {
  const sanitized = sanitizeText(url);
  
  try {
    const urlObj = new URL(sanitized);
    // Only allow HTTPS URLs
    if (urlObj.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed');
    }
    return sanitized;
  } catch {
    throw new Error('Invalid URL format');
  }
};

// Sanitize evaluation data
export const sanitizeEvaluationData = (data: any): any => {
  const sanitized = sanitizeObject(data);
  
  // Additional validation for evaluation-specific fields
  if (sanitized.customerName) {
    sanitized.customerName = sanitizeText(sanitized.customerName);
  }
  
  if (sanitized.comments) {
    sanitized.comments = sanitizeText(sanitized.comments);
  }
  
  if (sanitized.example) {
    sanitized.example = sanitizeText(sanitized.example);
  }
  
  if (sanitized.visitDate) {
    sanitized.visitDate = sanitizeDate(sanitized.visitDate);
  }
  
  if (sanitized.scores) {
    sanitized.scores = sanitizeObject(sanitized.scores);
  }
  
  return sanitized;
};

// Sanitize user input
export const sanitizeUserInput = (data: any): any => {
  const sanitized = sanitizeObject(data);
  
  if (sanitized.email) {
    sanitized.email = sanitizeEmail(sanitized.email);
  }
  
  if (sanitized.displayName) {
    sanitized.displayName = sanitizeText(sanitized.displayName);
  }
  
  if (sanitized.password) {
    // Don't sanitize passwords, just validate they exist
    if (typeof sanitized.password !== 'string' || sanitized.password.length < 1) {
      throw new Error('Password is required');
    }
  }
  
  return sanitized;
};

// Export DOMPurify instance for advanced usage
export { DOMPurify };
