import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'aethermed-super-secret-hms-saas-jwt-key-2026-pune'
const VAULT_RAW = process.env.SECRET_ENCRYPTION_KEY || 'aethermed-org-credential-vault-key-32b!'
const VAULT_KEY = crypto.createHash('sha256').update(VAULT_RAW).digest()

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function generateStrongPassword(length = 11): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length]
  }
  return out
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function decryptSecret(cipherText?: string | null): string | null {
  if (!cipherText) return null
  try {
    const [ivB64, tagB64, dataB64] = cipherText.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      VAULT_KEY,
      Buffer.from(ivB64, 'base64url')
    )
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  } catch {
    return null
  }
}

export function signToken<T extends object>(
  payload: T,
  expiresInSeconds = 60 * 60 * 24 * 7
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken<T extends object>(token?: string | null): (T & { exp: number }) | null {
  if (!token) return null
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url')
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number }
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}
