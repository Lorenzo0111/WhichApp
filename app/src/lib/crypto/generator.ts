import { PrivateKey, PublicKey } from "./types";
import { gcd, generatePrime, modInverse } from "./utils";

/**
 * Genera una coppia di chiavi RSA (pubblica e privata)
 * @param bitLength - La lunghezza in bit della chiave (default: 1024)
 * @returns Un oggetto contenente la chiave pubblica e privata
 */
export async function generateKeys(bitLength = 1024): Promise<{
  publicKey: PublicKey;
  privateKey: PrivateKey;
}> {
  // Ogni primo deve essere lungo la metà dei bit totali
  const halfBits = bitLength / 2;

  let p: bigint, q: bigint, phi: bigint;

  // Genera due primi distinti p e q
  do {
    p = await generatePrime(halfBits);
    q = await generatePrime(halfBits);
  } while (p === q);

  // Calcola il modulo n = p * q
  const n = p * q;

  // Calcola phi(n) = (p-1)(q-1)
  phi = (p - 1n) * (q - 1n);

  // Esponente pubblico standard (65537 è un numero primo di Fermat)
  let e = 65537n;

  // Genera un esponente pubblico e coprimo con phi(n)
  while (gcd(e, phi) !== 1n) {
    e = await generatePrime(halfBits);
  }

  // Calcola d come inverso modulare
  const d = modInverse(e, phi);

  if (!d) throw new Error("Failed to generate private key");

  return {
    publicKey: { e: e.toString(), n: n.toString() },
    privateKey: { d: d.toString(), n: n.toString() },
  };
}
