# Family Hub — security and privacy

This page explains how Family Hub protects your family's data, what you can check yourself, and the known limits.

## At a glance

| Layer | Protection | Where |
|---|---|---|
| In transit | HTTPS everywhere (TLS 1.2+). HSTS, a strict Content-Security-Policy, and no framing | Vercel, `vercel.json`, Supabase API |
| At rest | Database, file storage and backups encrypted on disk with AES-256 | Supabase (provider guarantee) |
| Access control | **Row Level Security on every table.** You can only read or write data of a family you belong to | `supabase/migrations/*.sql` |
| Roles | Admins and members. What members may add is set by admins. Membership changes go only through checked server functions | migrations 1–4 |
| End-to-end encryption (optional) | Chore notes, event notes and locations, and recipe notes are encrypted **on your device** (AES-256-GCM) | `src/lib/crypto/e2ee.ts` |
| Photos | Private storage bucket. Only your family can view them, through links that expire after 1 hour | migration 4 |
| Secrets | No secret keys in the website. Server secrets live in Supabase Edge Function secrets and Vault | `.env.example`, README step 7 |
| Input | Checked in the app (Zod) **and** cleaned in the database: lengths, control characters, formats, `https` links only | `src/lib/validation.ts`, triggers |
| Abuse | Invite codes lock an account out after 10 wrong guesses in an hour. Invite codes can be regenerated | `join_family()` |

## Encryption in transit (HTTPS)

- **Vercel** serves the site only over HTTPS, with free automatic certificates. `vercel.json` adds `Strict-Transport-Security` (2 years, preload), a `Content-Security-Policy` that only allows the site itself and your Supabase project, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a permissions policy.
- **Supabase** APIs (database, login, storage, realtime) are HTTPS/WSS only.
- **Web Push** messages are encrypted end-to-end to each device (RFC 8291) and signed (VAPID, RFC 8292), so Apple and Google's push services can't read them.

## Encryption at rest

Supabase encrypts all customer data at rest with **AES-256**: the Postgres database, file storage (recipe photos) and backups. It's a guarantee of the hosting provider, so you can't switch it on or off, or see it directly. It's described in Supabase's security documentation (supabase.com/security and the "Security" guides), and covered by Supabase's SOC 2 Type 2 audit. The audit report is available from Supabase on request (paid plans).

Disk encryption protects against stolen disks and backups. It **doesn't** stop someone with database access (for example, a Supabase staff member or an attacker with your service key) from reading data. That's why the optional end-to-end encryption exists.

## What you can verify yourself

1. **Security self-check.** In Supabase → SQL Editor, run [`supabase/setup/security-check.sql`](supabase/setup/security-check.sql). It confirms:
   - Row Level Security is on for **every** table
   - signed-out visitors can't reach any table
   - the photo bucket is private
   - when encryption is on, no plain text is left in encrypted families

   (The `join_attempts` table deliberately has RLS but no policies, so nobody can read it.)
2. **HTTPS and headers.** Open your site address in a browser and check the padlock. Or paste the address into securityheaders.com: you should see HSTS, CSP, X-Frame-Options and the other headers listed above.
3. **Database connections use TLS.** In Supabase go to **Project Settings** → **Database** → **SSL Configuration**, and turn on **Enforce SSL on incoming connections**. Family Hub itself only talks to Supabase over HTTPS, so this just locks down direct database connections.
4. **End-to-end encryption.** With encryption on, open Supabase → **Table Editor** → `tasks` (or `events` or `recipes`). The `notes` and `location` columns show `enc:v1:…`, never your words.
5. **The automated tests.** They check all of this against a real database (see "Tests" below).

## Row Level Security (RLS)

- Every table has RLS on. Policies use helper functions (`is_family_member`, `is_family_admin`, `can_add`, `can_manage_task`, …) that check the signed-in user's membership.
- Tables are mostly read by the whole family. Writes depend on role and ownership. People's **own** data can only be seen by them: notifications, notification settings, push devices, private keys, and the "already seen" marks behind NEW badges.
- Server-managed values (who ticked something and when, who created it, which family it belongs to) are set by database triggers, so they can't be faked from the app.
- Signed-out visitors (`anon`) have **no** access to any table or function.

## End-to-end encryption (optional, admins turn it on)

**Algorithms** (Web Crypto API only, no third-party crypto code):

| Purpose | Algorithm |
|---|---|
| Encrypting text fields | AES-256-GCM, random 96-bit IV per value, field name bound as associated data |
| Family key | AES-256, one per family |
| Sharing the family key | RSA-OAEP-3072 with SHA-256 (each member has a key pair) |
| Protecting your private key | PBKDF2-SHA-256, 600,000 iterations, random salt, then AES-256-GCM key wrap |
| Recovery code | about 118 bits of randomness, put through the same PBKDF2 and AES-GCM wrap |

**How keys flow:**
- When you sign up or sign in, your device creates or unlocks your personal key using your password. The password itself is never stored or sent anywhere except to Supabase's login.
- An admin's device shares the family key with each member by encrypting it to that member's public key. This happens automatically.
- The unlocked keys stay on your device in IndexedDB. The private key is stored as a *non-extractable* key, so page code can use it but can't copy its raw bytes. Signing out wipes them.

**What is encrypted:**
- chore notes
- event notes and locations
- recipe notes

**What isn't:**
- titles, dates, times, emoji, who is assigned, categories, recipe ingredients and steps, and shopping items

Those stay readable to the server so that calendars, reminders, push notifications, search and the shopping list keep working.

**Protects against:**
- a database leak, a stolen backup or a leaked service key
- Supabase staff, or anyone with database access, reading private notes

**Doesn't protect against:**
- a compromised or unlocked device
- malicious code deployed to your website: anyone who can change your Vercel site or GitHub repo could ship code that reads notes after they're decrypted. Protect those accounts with two-factor authentication.
- people inferring things from the unencrypted metadata listed above

**Trade-offs:**
- **Forgotten password:** after a password reset, the person gets a new key pair. An admin's app re-shares the family key automatically. Until then their notes show 🔒.
- **Lost access for everyone:** if every admin loses access *and* the recovery code is lost, encrypted notes can't be recovered by anyone.
- **Removing a member:** this deletes their copy of the family key. Anything already on their device may remain. The key isn't automatically changed (rotated); that's listed as a future upgrade.
- **Push notifications:** they never include encrypted text. The server skips any value starting with `enc:`.

## Secrets

| Secret | Where it lives | In the website? |
|---|---|---|
| Supabase anon or publishable key | Vercel env `VITE_SUPABASE_ANON_KEY` | Yes, by design. It only allows what RLS allows |
| VAPID public key | Vercel env `VITE_VAPID_PUBLIC_KEY` | Yes, it's public |
| Supabase service-role key | Supabase only (auto-provided to Edge Functions) | **Never** |
| VAPID private key, `CRON_SECRET` | Supabase Edge Function secrets, and Vault for the scheduler | **Never** |
| Supabase access token (deploys) | GitHub Actions secret | **Never** |

`.env.local` and `supabase/functions/.env.local` are git-ignored, and `.env.example` lists the names only.

## Tests

- `npm test`: unit tests for the encryption, Web Push encryption and signing, repeat rules, done/missed/NEW rules, reminders, ingredients and validation.
- `npm run test:integration`: runs against a real local Supabase (`npx supabase start`). It proves:
  - one family can't see or change another family's data, in any table or in storage
  - members' and admins' permissions work as described
  - private keys and notifications stay private
  - ciphertext is stored unchanged and no plain text reaches the database

  As a check on the tests themselves, switching RLS off on any table makes them fail.

## Reporting a problem

If you find a security issue, please don't post it publicly. Contact the person who runs your Family Hub.
