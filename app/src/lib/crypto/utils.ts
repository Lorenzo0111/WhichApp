import * as Crypto from "expo-crypto";

/**
 * Converte un array di byte in un bigint
 * @param bytes - L'array di byte da convertire
 * @returns Il bigint convertito
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = "0x";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex === "0x" ? 0n : BigInt(hex);
}

/**
 * Converte un bigint in un array di byte
 * @param num - Il bigint da convertire
 * @returns L'array di byte convertito
 */
export function bigIntToBytes(num: bigint): Uint8Array {
  if (num === 0n) return new Uint8Array([0]);

  let hex = num.toString(16);

  // Assicura che la lunghezza sia pari
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
 * Genera un grande numero casuale
 * @param bits - Il numero di bit del numero casuale
 * @returns Un grande numero casuale
 */
function getRandomBigInt(bits: number): bigint {
  // Calcola il numero di byte necessario per il numero casuale (8 bit per byte)
  const bytes = Math.ceil(bits / 8);

  // Genera i byte casuali
  const randomBytes = Crypto.getRandomBytes(bytes);

  // Converte i byte in un bigint
  return bytesToBigInt(randomBytes);
}

/**
 * Calcola (base^exp) % mod nel modulo
 * Yield control back to the event loop periodically to avoid blocking
 *
 * @param base La base
 * @param exp  L'esponente
 * @param mod  Il modulo
 * @param async - Se true, la funzione è eseguita in modo asincrono
 * @return Il numero elevato all'esponente nel modulo
 */
export async function modPow(
  base: bigint,
  exp: bigint,
  mod: bigint,
  { async }: { async?: boolean } = { async: true }
): Promise<bigint> {
  // Risultato finale inizializzato a 1
  let result = 1n;

  // Ridurre la base nel modulo
  base = base % mod;

  // Se la base è 0, il risultato sarà 0
  if (base == 0n) return 0n;

  let iterationCount = 0;

  // Itera finché l'esponente non è 0
  while (exp > 0) {
    // Se l'esponente è dispari
    if (exp % 2n == 1n) {
      // Moltiplica il risultato per la base ridotto nel modulo m
      result = (result * base) % mod;
    }

    // Eleva la base al quadrato e la riduce nel modulo m
    base = (base * base) % mod;

    // Divide l'esponente per 2
    exp = exp / 2n;

    // Ogni 1000 iterazioni, rilascia il thread per evitare blocchi
    iterationCount++;
    if (iterationCount % 1000 === 0 && async) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return result;
}

/**
 * Controlla se un numero è primo utilizzando l'algoritmo di controllo di Fermat
 * Prima di effettuare questi controlli viene verificato se il numero è pari per evitare iterazioni extra
 * Viene inoltre controllato se il numero è 2 e 3 in quanto è noto che sono primi
 *
 * @param numero Il numero da controllare
 * @return true se è primo
 */
export async function isPrime(numero: bigint, bits: number): Promise<boolean> {
  if (numero <= 1) return false;
  if (numero == 2n || numero == 3n) return true;
  if (numero % 2n == 0n) return false;

  // Numero di iterazioni. Più è alto meno sono le probabilità di un falso positivo
  const k = 10n;

  // Ogni iterazione sceglie una base casuale con 2 <= base <= numero-2
  for (let i = 0n; i < k; i++) {
    const a = 2n + getRandomBigInt(bits - 2);

    // Formula: a^(p-1) mod p
    const result = await modPow(a, numero - 1n, numero);

    // Se il risultato non è 1 allora il numero è sicuramente composto
    if (result != 1n) return false;
  }

  return true;
}

/**
 * Genera un numero primo casuale di una certa lunghezza in bit
 * @param bits - Il numero di bit del numero primo da generare
 * @returns Un numero primo casuale
 */
export async function generatePrime(bits: number): Promise<bigint> {
  while (true) {
    const numero = getRandomBigInt(bits);
    if (await isPrime(numero, bits)) return numero;
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * Calcola il massimo comun divisore di due numeri
 * @param a - Il primo numero
 * @param b - Il secondo numero
 * @returns Il massimo comun divisore dei due numeri
 */
export function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Calcola l'inverso modulare di `a` modulo `m`.
 * Restituisce `x` tale che (a * x) % m === 1n
 *
 * @param a - Il numero di cui calcolare l'inverso
 * @param m - Il modulo
 * @returns L'inverso modulare, oppure null se non esiste (quando gcd(a, m) !== 1)
 */
export function modInverse(a: bigint, m: bigint): bigint | null {
  // Normalizza a per gestire valori negativi
  a = ((a % m) + m) % m;

  // Algoritmo Esteso di Euclide
  let [oldR, r] = [a, m];
  let [oldS, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  // Se gcd !== 1, l'inverso non esiste
  if (oldR !== 1n) return null;

  // Assicura che il risultato sia positivo
  return ((oldS % m) + m) % m;
}
