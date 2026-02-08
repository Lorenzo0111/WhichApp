import * as Crypto from "expo-crypto";

/**
 * Convert an array of bytes to a bigint
 * @param bytes - The array of bytes to convert
 * @returns The converted bigint
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = "0x";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex === "0x" ? 0n : BigInt(hex);
}

/**
 * Convert a bigint to an array of bytes
 * @param num - The bigint to convert
 * @returns The converted array of bytes
 */
export function bigIntToBytes(num: bigint): Uint8Array {
  if (num === 0n) return new Uint8Array([0]);

  let hex = num.toString(16);

  // Ensure the length is even
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Generate a large random number
 * @param bits - The number of bits of the random number
 * @returns A large random number
 */
function getRandomBigInt(bits: number): bigint {
  // Calculate the number of bytes needed for the random number (8 bits per byte)
  const bytes = Math.ceil(bits / 8);

  // Generate the random bytes
  const randomBytes = Crypto.getRandomBytes(bytes);

  // Convert the bytes to a bigint
  return bytesToBigInt(randomBytes);
}

/**
 * Calculate (base^exp) % mod in the modulus
 * Yield control back to the event loop periodically to avoid blocking
 *
 * @param base The base
 * @param exp  The exponent
 * @param mod  The modulo
 * @param async - If true, the function is executed asynchronously
 * @return The number raised to the exponent in the modulus
 */
export async function modPow(
  base: bigint,
  exp: bigint,
  mod: bigint,
  { async }: { async?: boolean } = { async: true },
): Promise<bigint> {
  // Final result initialized to 1
  let result = 1n;

  // Reduce the base in the modulus
  base = base % mod;

  // If the base is 0, the result will be 0
  if (base == 0n) return 0n;

  let iterationCount = 0;

  // Iterate until the exponent is 0
  while (exp > 0) {
    // If the exponent is odd
    if (exp % 2n == 1n) {
      // Multiply the result by the reduced base in the modulus m
      result = (result * base) % mod;
    }

    // Square the base and reduce it in the modulus m
    base = (base * base) % mod;

    // Divide the exponent by 2
    exp = exp / 2n;

    // Every 1000 iterations, yield the thread to avoid blocking
    iterationCount++;
    if (iterationCount % 1000 === 0 && async) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return result;
}

/**
 * Check if a number is prime using the Fermat primality test
 * Before performing these checks, it is checked if the number is even to avoid extra iterations
 * It is also checked if the number is 2 and 3 as it is known that they are prime
 *
 * @param number The number to check
 * @return true if it is prime
 */
export async function isPrime(number: bigint, bits: number): Promise<boolean> {
  if (number <= 1) return false;
  if (number == 2n || number == 3n) return true;
  if (number % 2n == 0n) return false;

  // Number of iterations. The higher it is, the less the probability of a false positive
  const k = 10n;

  // Each iteration chooses a random base with 2 <= base <= number-2
  for (let i = 0n; i < k; i++) {
    const a = 2n + getRandomBigInt(bits - 2);

    // Formula: a^(p-1) mod p
    const result = await modPow(a, number - 1n, number);

    // If the result is not 1, then the number is certainly composite
    if (result != 1n) return false;
  }

  return true;
}

/**
 * Generate a random prime number of a certain bit length
 * @param bits - The number of bits of the prime number to generate
 * @returns A random prime number
 */
export async function generatePrime(bits: number): Promise<bigint> {
  while (true) {
    const number = getRandomBigInt(bits);
    if (await isPrime(number, bits)) return number;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * Calculate the greatest common divisor of two numbers
 * @param a - The first number
 * @param b - The second number
 * @returns The greatest common divisor of the two numbers
 */
export function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Calculate the modular inverse of `a` modulo `m`.
 * Returns `x` such that (a * x) % m === 1n
 *
 * @param a - The number to calculate the inverse of
 * @param m - The modulus
 * @returns The modular inverse, or null if it does not exist (when gcd(a, m) !== 1)
 */
export function modInverse(a: bigint, m: bigint): bigint | null {
  // Normalize a to handle negative values
  a = ((a % m) + m) % m;

  // Extended Euclidean algorithm
  let [oldR, r] = [a, m];
  let [oldS, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  // If gcd !== 1, the inverse does not exist
  if (oldR !== 1n) return null;

  // Ensure the result is positive
  return ((oldS % m) + m) % m;
}
