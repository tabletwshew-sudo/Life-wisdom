import { z } from 'zod'

/** Remove control characters and trim. Used on every free-text input. */
export function cleanText(value: string, maxLen: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen)
}

const name = z
  .string()
  .transform((v) => cleanText(v, 40))
  .pipe(z.string().min(1, 'Please enter a name').max(40, 'Keep it under 40 characters'))

export const emailSchema = z.string().trim().toLowerCase().email('That doesn’t look like an email address')

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer')

export const signUpSchema = z.object({
  displayName: name,
  email: emailSchema,
  password: passwordSchema,
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Please enter your password'),
})

export const familyNameSchema = z
  .string()
  .transform((v) => cleanText(v, 60))
  .pipe(z.string().min(1, 'Please give your family a name').max(60))

export const inviteCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/, 'Invite codes are 8 letters and numbers'))

export const profileSchema = z.object({
  displayName: name,
  emoji: z
    .string()
    .transform((v) => cleanText(v, 16))
    .pipe(z.string().min(1, 'Pick an emoji')),
})

export const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

/** Returns the first error message from a Zod result, or null. */
export function firstError(result: { success: boolean; error?: z.ZodError }): string | null {
  if (result.success || !result.error) return null
  return result.error.issues[0]?.message ?? 'Please check your details'
}

/** Field → message map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
