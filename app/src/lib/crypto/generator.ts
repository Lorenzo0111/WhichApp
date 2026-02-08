import { PrivateKey, PublicKey } from "./types";
import { gcd, generatePrime, modInverse } from "./utils";

/**
 * Generate a pair of RSA keys (public and private)
 * @param bitLength - The length in bits of the key (default: 1024)
 * @returns An object containing the public and private keys
 */
export async function generateKeys(bitLength = 1024): Promise<{
  publicKey: PublicKey;
  privateKey: PrivateKey;
}> {
  // Each prime must be half the total number of bits
  const halfBits = bitLength / 2;

  let p: bigint, q: bigint, phi: bigint;

  // Generate two distinct primes p and q
  do {
    p = await generatePrime(halfBits);
    q = await generatePrime(halfBits);
  } while (p === q);

  // Calculate the modulo n = p * q
  const n = p * q;

  // Calculate phi(n) = (p-1)(q-1)
  phi = (p - 1n) * (q - 1n);

  // Standard public exponent (65537 is a Fermat prime)
  let e = 65537n;

  // Generate a public exponent that is coprime with phi(n)
  while (gcd(e, phi) !== 1n) {
    e = await generatePrime(halfBits);
  }

  // Calculate d as the modular inverse
  const d = modInverse(e, phi);

  if (!d) throw new Error("Failed to generate private key");

  return {
    publicKey: { e: e.toString(), n: n.toString() },
    privateKey: { d: d.toString(), n: n.toString() },
  };
}
