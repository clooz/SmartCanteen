/** 密码强度 0（空/极弱）～ 4（很强） */

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*-_+=?'
const ALL_CHARS = LOWER + UPPER + DIGITS + SYMBOLS

function randInt(maxExclusive: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % maxExclusive
}

function pickFromCharset(charset: string): string {
  return charset[randInt(charset.length)]!
}

function shuffleString(s: string): string {
  const arr = s.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr.join('')
}

export function passwordStrengthScore(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value || value.length === 0) return 0
  let variety = 0
  if (/[a-z]/.test(value)) variety++
  if (/[A-Z]/.test(value)) variety++
  if (/\d/.test(value)) variety++
  if (/[^a-zA-Z0-9]/.test(value)) variety++
  const len = value.length
  if (len < 8 || variety <= 1) return 1
  if (variety === 2) return 2
  if (variety === 3) return 3
  if (len >= 16) return 4
  if (len >= 10) return 4
  return 3
}

export function passwordStrengthMeta(score: number): {
  label: string
  percent: number
  status: 'normal' | 'exception' | 'success'
} {
  const map: Record<number, { label: string; percent: number; status: 'normal' | 'exception' | 'success' }> = {
    0: { label: '', percent: 0, status: 'normal' },
    1: { label: '弱', percent: 25, status: 'exception' },
    2: { label: '中', percent: 50, status: 'normal' },
    3: { label: '强', percent: 75, status: 'success' },
    4: { label: '很强', percent: 100, status: 'success' },
  }
  return map[score] ?? map[0]!
}

/** 满足「含大小写、数字、符号」的高强度随机密码；length 默认 16 */
export function generateStrongPassword(options?: { length?: number; avoid?: string }): string {
  const length = Math.max(8, Math.min(32, options?.length ?? 16))
  const avoid = options?.avoid ?? ''
  let pwd = ''
  let guard = 0
  do {
    pwd = ''
    pwd += pickFromCharset(LOWER)
    pwd += pickFromCharset(UPPER)
    pwd += pickFromCharset(DIGITS)
    pwd += pickFromCharset(SYMBOLS)
    for (let i = pwd.length; i < length; i++) {
      pwd += pickFromCharset(ALL_CHARS)
    }
    pwd = shuffleString(pwd)
    guard++
  } while (pwd === avoid && guard < 32)
  if (pwd === avoid) {
    pwd += pickFromCharset(ALL_CHARS)
    pwd = shuffleString(pwd.slice(0, length))
  }
  return pwd
}

/** 满足保存：至少 8 位，且四类字符中至少三类（降低长度负担，仍保证一定复杂度） */
export function isPasswordStrongEnough(value: string): boolean {
  if (!value || value.length < 8) return false
  let variety = 0
  if (/[a-z]/.test(value)) variety++
  if (/[A-Z]/.test(value)) variety++
  if (/\d/.test(value)) variety++
  if (/[^a-zA-Z0-9]/.test(value)) variety++
  return variety >= 3
}
