import { PrivateKey, PublicKey } from "./types";
import { bigIntToBytes, bytesToBigInt, modPow } from "./utils";

/**
 * Encrypt a string using the public RSA key
 *
 * @param message - The message to encrypt
 * @param publicKey - The public RSA key
 * @param async - If true, the function is executed asynchronously
 * @returns A base64 string containing the encrypted chunks separated by ":"
 */
export async function encryptString(
  message: string,
  publicKey: PublicKey,
  { async }: { async?: boolean } = { async: true },
): Promise<string> {
  const e = BigInt(publicKey.e);
  const n = BigInt(publicKey.n);

  // Convert the message to bytes
  const messageBytes = new TextEncoder().encode(message);

  // The chunk must be smaller than n
  const chunkSize = Math.max(1, Math.ceil(n.toString(16).length / 2) - 1);

  // Divide the message into chunks of size chunkSize
  const encryptedChunks: string[] = [];

  for (let i = 0; i < messageBytes.length; i += chunkSize) {
    // Extract the chunk
    const chunk = messageBytes.slice(i, i + chunkSize);

    // Convert the chunk to bigint
    const m = bytesToBigInt(chunk);

    // Encrypt: c = m^e mod n
    const c = await modPow(m, e, n, { async });

    // Convert to base64 and add to the list
    const encryptedBytes = bigIntToBytes(c);
    const base64 = btoa(String.fromCharCode(...encryptedBytes));
    encryptedChunks.push(base64);
  }

  // Join the chunks with ":"
  return encryptedChunks.join(":");
}

/**
 * Decrypt a string using the private RSA key
 *
 * @param encrypted - The encrypted string (format: chunk base64 separated by ":")
 * @param privateKey - The private RSA key
 * @param async - If true, the function is executed asynchronously
 * @returns The original string
 */
export async function decryptString(
  encrypted: string,
  privateKey: PrivateKey,
  { async }: { async?: boolean } = { async: true },
): Promise<string> {
  const d = BigInt(privateKey.d);
  const n = BigInt(privateKey.n);

  // Divide the encrypted string into chunks
  const encryptedChunks = encrypted.split(":");

  // Decrypt each chunk
  const decryptedBytes: number[] = [];

  for (const chunk of encryptedChunks) {
    // Decode the base64
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Convert to bigint
    const c = bytesToBigInt(bytes);

    // Decrypt: m = c^d mod n
    const m = await modPow(c, d, n, { async });

    // Convert to byte and add to the list
    const mBytes = bigIntToBytes(m);
    decryptedBytes.push(...mBytes);
  }

  // Convert the bytes to a string
  return new TextDecoder().decode(new Uint8Array(decryptedBytes));
}
