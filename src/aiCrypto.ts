export interface EncryptedSecret {
  version: 1
  algorithm: 'AES-GCM'
  ciphertext: string
  salt: string
  iv: string
}

const PBKDF2_ITERATIONS = 120_000

function cryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('WebCrypto is unavailable in this browser.')
  return subtle
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase) throw new Error('A local unlock passphrase is required.')
  const material = await cryptoSubtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return cryptoSubtle().deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(secret: string, passphrase: string): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ciphertext = await cryptoSubtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(secret),
  )
  return {
    version: 1,
    algorithm: 'AES-GCM',
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  }
}

export async function decryptSecret(encrypted: EncryptedSecret, passphrase: string): Promise<string> {
  if (encrypted.version !== 1 || encrypted.algorithm !== 'AES-GCM') throw new Error('Unsupported encrypted secret format.')
  const salt = base64ToBytes(encrypted.salt)
  const iv = base64ToBytes(encrypted.iv)
  const key = await deriveKey(passphrase, salt)
  try {
    const plaintext = await cryptoSubtle().decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(encrypted.ciphertext),
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error('The local unlock passphrase is incorrect.')
  }
}

