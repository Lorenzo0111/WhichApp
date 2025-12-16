export const PRIVATE_KEY_PREFIX = "WHICHAPP_PRIVATE_KEY:";
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const PRIVATE_KEY_D = (userId?: string) => `private_key_${userId}_d`;
export const PRIVATE_KEY_N = (userId?: string) => `private_key_${userId}_n`;
