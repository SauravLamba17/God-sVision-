import crypto from 'crypto'

// Password-reset tokens are stored as SHA-256 hashes; only the emailed link
// carries the raw token. Hash on write (forgot-password) and on lookup (reset).
export const hashResetToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex')
