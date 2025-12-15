/**
 * Browser-compatible encoding utilities
 *
 * WHY: Buffer is a Node.js API not available in browsers
 * HOW: Use Web APIs (btoa, Uint8Array) for base64 and bs58 library for base58
 */

import bs58 from 'bs58';

/**
 * Convert Uint8Array to base64 string (browser-compatible)
 * Used for Cosmos wallet signatures
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Convert Uint8Array to regular array, then to binary string, then to base64
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

/**
 * Convert base64 string to Uint8Array (browser-compatible)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.codePointAt(0)!);
}

/**
 * Convert Uint8Array to base58 string
 * Used for Solana wallet signatures
 */
export function uint8ArrayToBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

/**
 * Convert base58 string to Uint8Array
 */
export function base58ToUint8Array(base58String: string): Uint8Array {
  return bs58.decode(base58String);
}
