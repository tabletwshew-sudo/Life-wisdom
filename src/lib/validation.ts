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

export const REPEATS = ['once', 'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'yearly'] as const

export const taskSchema = z
  .object({
    title: z
      .string()
      .transform((v) => cleanText(v, 80))
      .pipe(z.string().min(1, 'Give the task a name')),
    notes: z.string().transform((v) => cleanText(v, 2000)),
    emoji: z
      .string()
      .transform((v) => cleanText(v, 16))
      .pipe(z.string().min(1, 'Pick an emoji')),
    category_id: z.string().uuid().nullable(),
    colour: hexColour.nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    due_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable(),
    repeat: z.enum(REPEATS),
    repeat_days: z.array(z.number().int().min(0).max(6)),
    repeat_until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    completion_mode: z.enum(['any', 'each']),
    points: z.number().int().min(0).max(100),
    reminder_minutes: z.number().int().min(0).max(10080).nullable(),
  })
  .refine((t) => t.repeat !== 'weekdays' || t.repeat_days.length > 0, { message: 'Pick at least one day', path: ['repeat_days'] })
  .refine((t) => !t.repeat_until || t.repeat_until >= t.start_date, { message: '“Until” must be after the start date', path: ['repeat_until'] })

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date')
const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .nullable()

export const eventSchema = z
  .object({
    title: z
      .string()
      .transform((v) => cleanText(v, 100))
      .pipe(z.string().min(1, 'Give the event a name')),
    type_id: z.string().uuid().nullable(),
    start_date: isoDate,
    end_date: isoDate,
    all_day: z.boolean(),
    start_time: hhmm,
    end_time: hhmm,
    location: z.string().transform((v) => cleanText(v, 300)),
    notes: z.string().transform((v) => cleanText(v, 2000)),
    colour: hexColour.nullable(),
    repeat: z.enum(['once', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly']),
    repeat_until: isoDate.nullable(),
    reminder_minutes: z.number().int().min(0).max(20160).nullable(),
  })
  .refine((e) => e.end_date >= e.start_date, { message: 'The end date is before the start', path: ['end_date'] })
  .refine((e) => e.all_day || !!e.start_time, { message: 'Pick a start time (or make it all day)', path: ['start_time'] })
  .refine((e) => e.all_day || !e.end_time || e.end_date > e.start_date || e.end_time >= e.start_time!, {
    message: 'The end time is before the start',
    path: ['end_time'],
  })
  .refine((e) => !e.repeat_until || e.repeat_until >= e.start_date, { message: '“Until” must be after the start', path: ['repeat_until'] })
