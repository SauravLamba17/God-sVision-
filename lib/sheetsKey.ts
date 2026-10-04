import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

// Per-user Google Sheets API keys. Only the SHA-256 is stored (User.sheetsKeyHash);
// the raw key is shown to its owner once on /sheets.
export const hashSheetsKey = (raw: string) => crypto.createHash('sha256').update(raw).digest()

export const newSheetsKey = () => 'gv_' + crypto.randomBytes(24).toString('hex')

/**
 * True if `raw` is some user's current key. Looked up by hash through the
 * unique index — the lookup compares hashes, never the secret itself.
 * The shared GV_SHEETS_API_KEY is still accepted (constant-time) so sheets set
 * up before per-user keys keep working.
 */
export async function isValidSheetsKey(raw: string | null): Promise<boolean> {
  if (!raw) return false
  const hash = hashSheetsKey(raw)
  const owner = await prisma.user.findUnique({ where: { sheetsKeyHash: hash.toString('hex') }, select: { id: true } })
  if (owner) return true
  // ponytail: temporary fallback for pre-existing sheets — delete this block and
  // unset GV_SHEETS_API_KEY once users have moved to their own keys.
  const shared = process.env.GV_SHEETS_API_KEY
  return !!shared && crypto.timingSafeEqual(hash, hashSheetsKey(shared))
}
