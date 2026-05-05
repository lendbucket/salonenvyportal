import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.BANK_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("BANK_ENCRYPTION_KEY env var is missing — cannot encrypt/decrypt bank fields")
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(`BANK_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}) — regenerate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
  }
  return key
}

/**
 * Encrypts a plaintext bank field with AES-256-GCM.
 * Returns format: {iv_base64}:{authTag_base64}:{ciphertext_base64}
 */
export function encryptBankField(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

/**
 * Decrypts an encrypted bank field produced by encryptBankField().
 */
export function decryptBankField(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted bank field format — expected iv:authTag:ciphertext")
  }
  const iv = Buffer.from(parts[0], "base64")
  const authTag = Buffer.from(parts[1], "base64")
  const ciphertext = Buffer.from(parts[2], "base64")
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}

/**
 * Checks if a value looks like an encrypted bank field (iv:authTag:ciphertext format).
 * Used to handle both encrypted and legacy plain-text rows during migration.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false
  const parts = value.split(":")
  if (parts.length !== 3) return false
  // Each segment should be valid base64 of roughly expected lengths
  try {
    const iv = Buffer.from(parts[0], "base64")
    const tag = Buffer.from(parts[1], "base64")
    return iv.length === IV_LENGTH && tag.length === AUTH_TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Returns masked account number: "••••" + last 4 chars.
 */
export function maskAccountNumber(plaintext: string): string {
  if (plaintext.length <= 4) return plaintext
  return "\u2022\u2022\u2022\u2022" + plaintext.slice(-4)
}
