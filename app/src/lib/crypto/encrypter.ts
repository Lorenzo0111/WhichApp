import { PrivateKey, PublicKey } from "./types";
import { bigIntToBytes, bytesToBigInt, modPow } from "./utils";

/**
 * Cifra una stringa usando la chiave pubblica RSA
 *
 * @param message - Il messaggio da cifrare
 * @param publicKey - La chiave pubblica RSA
 * @param async - Se true, la funzione è eseguita in modo asincrono
 * @returns Una stringa base64 contenente i chunk cifrati separati da ":"
 */
export async function encryptString(
  message: string,
  publicKey: PublicKey,
  { async }: { async?: boolean } = { async: true }
): Promise<string> {
  const e = BigInt(publicKey.e);
  const n = BigInt(publicKey.n);

  // Converte il messaggio in byte
  const messageBytes = new TextEncoder().encode(message);

  // Il chunk deve essere più piccolo di n
  const chunkSize = Math.max(1, Math.ceil(n.toString(16).length / 2) - 1);

  // Divide il messaggio in chunk di dimensione chunkSize
  const encryptedChunks: string[] = [];

  for (let i = 0; i < messageBytes.length; i += chunkSize) {
    // Estrae il chunk
    const chunk = messageBytes.slice(i, i + chunkSize);

    // Converte il chunk in bigint
    const m = bytesToBigInt(chunk);

    // Cifra: c = m^e mod n
    const c = await modPow(m, e, n, { async });

    // Converte in base64 e aggiunge alla lista
    const encryptedBytes = bigIntToBytes(c);
    const base64 = btoa(String.fromCharCode(...encryptedBytes));
    encryptedChunks.push(base64);
  }

  // Unisce i chunk con ":"
  return encryptedChunks.join(":");
}

/**
 * Decifra una stringa usando la chiave privata RSA
 *
 * @param encrypted - La stringa cifrata (formato: chunk base64 separati da ":")
 * @param privateKey - La chiave privata RSA
 * @param async - Se true, la funzione è eseguita in modo asincrono
 * @returns La stringa originale
 */
export async function decryptString(
  encrypted: string,
  privateKey: PrivateKey,
  { async }: { async?: boolean } = { async: true }
): Promise<string> {
  const d = BigInt(privateKey.d);
  const n = BigInt(privateKey.n);

  // Divide la stringa cifrata nei chunk
  const encryptedChunks = encrypted.split(":");

  // Decifra ogni chunk
  const decryptedBytes: number[] = [];

  for (const chunk of encryptedChunks) {
    // Decodifica il base64
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Converte in bigint
    const c = bytesToBigInt(bytes);

    // Decifra: m = c^d mod n
    const m = await modPow(c, d, n, { async });

    // Converte in byte e aggiunge alla lista
    const mBytes = bigIntToBytes(m);
    decryptedBytes.push(...mBytes);
  }

  // Converte i byte in stringa
  return new TextDecoder().decode(new Uint8Array(decryptedBytes));
}
