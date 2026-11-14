# 🏠 Family Hub

A free family organiser for chores, a shared calendar, meals and shopping. It works in any web browser, and you can install it on an iPhone from Safari with **Add to Home Screen**. You don't need an App Store listing or a paid Apple Developer account.

> **Build status:** Phases 1–3 of 6 are finished: sign-in, families and invites, the installable app, **chores**
> (repeating tasks, ticks, crosses, NEW badges, points and streaks) and the **shared calendar**. Food, Notifications and Encryption arrive in later phases.

---

## What you'll need (all free)

| Service | What it does | Cost |
|---|---|---|
| [GitHub](https://github.com) | Stores the code | Free |
| [Supabase](https://supabase.com) | Database, logins and live sync | Free plan |
| [Vercel](https://vercel.com) | Hosts the website and gives you a web address | Free "Hobby" plan |

You don't need to install anything on your computer to get it running.

---

## Step 1: Create your free Supabase project (about 5 minutes)

1. Go to **https://supabase.com** and click **Start your project**. Sign up, using "Continue with GitHub" if you like.
2. Click **New project**.
   - **Name:** `family-hub`
   - **Database password:** click *Generate a password* and save it in your password manager. The app doesn't need it, but you might later.
   - **Region:** pick the one closest to you, for example *West EU (London)*.
   - Click **Create new project** and wait about a minute.

## Step 2: Set up the database

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Open the first file in [`supabase/migrations/`](supabase/migrations/) in this repository. On GitHub, click the file, then the **Copy raw file** button.
4. Paste it into the SQL Editor and click **Run** (bottom right). You should see *"Success. No rows returned"*.
5. Click **+ New query** again and repeat for the **next** file. Run them **in order**:

   | Order | File | Adds |
   |---|---|---|
   | 1 | `20261114000100_core.sql` | Families, members, invites |
   | 2 | `20261114000200_tasks.sql` | Chores, categories, ticks |
   | 3 | `20261114000300_events.sql` | Calendar events, event types, attendees |

> Later phases add more files. Each time you update, run only the new file(s), in order. Running a file twice is safe.

### Turn off email confirmation (important)
Supabase's built-in email sender only delivers to people on your Supabase team, so other family members would never get the confirmation email.

1. Go to **Authentication** → **Sign In / Providers** → **Email**.
2. Switch **Confirm email** **off** and click **Save**.

(If you'd like confirmation and password-reset emails for everyone, see *Optional: real emails* at the bottom.)

### Copy your two keys
1. Click the **Connect** button at the top of the project (or go to **Project Settings** → **API Keys**).
2. Copy:
   - the **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - the **anon** or **publishable** key, a long string

These two values are safe to put in a website. The database rules (Row Level Security) decide what each person can see.
**Never** copy the `service_role` or `secret` key anywhere.

## Step 3: Put the website online with Vercel (about 5 minutes)

1. Go to **https://vercel.com/signup**, choose **Hobby**, and **Continue with GitHub**.
2. Click **Add New…** → **Project**, find the `family-hub` repository and click **Import**.
3. Vercel detects **Vite** automatically. Open **Environment Variables** and add both of these:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | your anon / publishable key from Step 2 |

4. Click **Deploy**. After a minute or two you'll get a web address such as **`https://family-hub-abc123.vercel.app`**. 🎉
5. **Back in Supabase:** go to **Authentication** → **URL Configuration**:
   - set **Site URL** to your Vercel address
   - under **Redirect URLs**, add `https://YOUR-ADDRESS.vercel.app/**`

Every time new code is pushed to GitHub, Vercel updates the site automatically.

## Step 4: Open it on any device

Type your Vercel address into any browser: phone, tablet or computer. Create your account, then **Start new** family.
On a phone you'll see tabs along the bottom. On a tablet or computer, the menu is on the left.

## Step 5: Install it on your iPhone

1. Open your Family Hub address in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open Family Hub from its new icon. It opens full-screen like a normal app.

Android, Windows and Mac: in Chrome or Edge, use the install icon in the address bar, or **More → Install the app**.

## Step 6: Invite your family

1. Go to **More** → **Members & invite**.
2. Tap **Share** to send the invite link by message or WhatsApp, or read out the 8-character code.
3. Each person opens the link, creates their own account (each person needs their own email address), and they're in.
4. New people join as **Members**. To make another parent an **Admin**, tap their name and choose **Make admin**.
5. Choose what Members are allowed to add in **More** → **Family settings**.

Tap **Make a new code** at any time to stop the old link working.

## Using chores (Tasks)

- **Add a chore:** tap the big **+** button (on a computer, **New task**). Choose an emoji, who it's for, how often it repeats, a time, a category or colour, a reminder, points and notes.
  - **Repeat options:** once, every day, some days (pick weekdays), weekly, fortnightly, monthly, or yearly.
  - **More than one person:** choose *Each person does it* (everyone gets their own tick, like "make your bed") or *Anyone can do it* (one tick for all, like "take out the bins").
- **Tick it off:** tap the circle, or **swipe the card right**. Tap again to undo. Everyone sees ticks appear live.
- **What the symbols mean** (each has an icon as well as a colour):
  - ✅ **Green tick:** done. Tap the chore to see who did it and when.
  - ❌ **Red cross:** the day ended and it wasn't done. Crosses stay in the history.
  - ✨ **NEW:** someone added or assigned it to you in the last week. It disappears once you've seen it.
- **Views:** **By day** (swipe the week strip or use the arrows), **By person** (progress, 🔥 streaks and ⭐ points this week), or **All** (every chore and how it repeats). Tap the people and category buttons to filter.
- **Kids (Members)** can only tick their own chores. Admins can tick anyone's. Admins choose whether kids may add chores in **More** → **Family settings**.
- **Editing a repeating chore** never changes the past. If you change *when* it happens or *who* does it, history up to yesterday stays as it was.
- **Deleting a repeating chore** gives you two options: *Stop from today* keeps past ticks and crosses, or *Delete everything*.
- **Trying it out:** on an empty Tasks page, an admin can tap **Add example chores**.
- **Categories:** go to **More** → **Chore categories** to add, rename or recolour them.
- **Crossed-out days:** in the week strip, a day that ended with something missed is crossed out completely with a big ✕.

## Using the calendar

- **Views:** **Day**, **Week**, **Month** and **Year**. Swipe left or right on a phone or tablet, or use the ‹ › arrows. **Today** jumps back.
- **Tap a day** to see everything on it, with an **Add event** button. In Year view, tap a month name to open it.
- **Add an event:** tap **+** (on a computer, **New event**). Set a title, type, all day or start and end times, end date for trips, who's going, location, repeat (weekly, fortnightly, monthly, yearly…), reminder, colour and notes.
  - **Birthday** automatically becomes all-day and yearly. Set the date of birth as the start and the calendar shows the age, e.g. *Sam's birthday (12)*.
  - Delete **just one** date of a repeating event (e.g. no football this week) or **every time**.
- **Event types:** Birthday, Party, Dinner, Holiday / trip, Appointment, School, Sport and Other. Add your own in **More** → **Event types**.
- **Calendar options** (the sliders button):
  - **Colour by person** (each person's colour, split into stripes when several people go) or by **type / category**.
  - **Show chores on the calendar:** chores appear with ✅ ticks, ❌ crosses and ✨ NEW. A day that ended with something missed is crossed out.
- New or newly-invited events show ✨ **NEW** until you've seen them.
- Kids (Members) can add events only if an admin allows it in **More** → **Family settings**.

## Step 7: Push notifications on iPhone
*Arrives in Phase 5.* It needs iOS 16.4 or newer, and the app must be installed to the Home Screen (Step 5).

---

## Roles

| | Admin (parents) | Member (kids) |
|---|---|---|
| See everything in the family | ✅ | ✅ |
| Tick off their own tasks | ✅ | ✅ |
| Create and assign tasks, events, recipes | ✅ | Only if an admin allows it |
| Invite, remove and promote people | ✅ | ❌ |
| See the invite code | ✅ | ❌ |
| Change family settings or delete the family | ✅ | ❌ |

## Security and privacy

- **HTTPS only.** Vercel serves the site over HTTPS, and `vercel.json` adds strict security headers (HSTS, a Content-Security-Policy and no framing).
- **Encrypted at rest.** Supabase stores the database and its backups on AES-256 encrypted disks. More details and how to verify this are in Phase 6.
- **Row Level Security** is on for every table. A person can only read or change data in a family they belong to. The automated tests in `tests/integration/` prove that one family can't see another family's data.
- **Input checking.** Everything you type is checked in the app *and* cleaned in the database (length limits and control characters removed).
- **No secrets in the code.** The website only contains the public anon key. Secrets live in environment variables, and `.env.example` shows the names.
- **Wrong invite codes.** After 10 wrong codes in an hour, that account is blocked from trying again for an hour.
- **Export or delete.** You can export or delete all family data from **More** → **Privacy & your data**.

---

## Optional: real emails (password reset and confirmation)
Supabase's free built-in email only reaches members of your Supabase team. To email everyone for free:
1. Sign up at **https://resend.com** (the free plan sends 3,000 emails a month) and verify your domain, or use their test domain.
2. In Supabase, go to **Project Settings** → **Authentication** → **SMTP Settings**, enable custom SMTP and enter Resend's SMTP details.

Without this, if a family member forgets their password, the project owner can go to Supabase → **Authentication** → **Users**, find that person, and delete them. The person then signs up again and rejoins with the invite code.

## Free plan notes
- **Inactivity pause:** a free Supabase project pauses after about **7 days with no activity**. Everyday family use keeps it awake. If it does pause, open the Supabase dashboard and click **Restore**.
- **Free limits:** 500 MB of database and 1 GB of file storage, which is plenty for a family.

---

## For developers

```bash
npm install
npx supabase start          # local Supabase in Docker (first run downloads images)
cp .env.example .env.local  # then paste the local URL and key printed by `supabase start`
npm run dev                 # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/`, including the PWA icons and splash screens |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | RLS, permission and recurrence tests against the local Supabase |
| `npm run db:reset` | Recreate the local database from `supabase/migrations` |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |

### Folder structure
```
public/                 logo.svg (source for every icon), theme script
pwa-assets.config.ts    generates the iPhone icons and splash screens at build time
src/
  auth/                 sign-in session
  family/               current family, members, permissions and live sync
  components/ui/        Button, Field, Sheet (bottom sheet), Avatar, pickers…
  components/layout/    AppShell (bottom tabs on phones, side nav on larger screens)
  features/tasks/       Tasks page, task sheets, rows, data hooks
  features/calendar/    Calendar page, Day/Week/Month/Year views, event sheets
  pages/                one file per screen
  lib/                  Supabase client, validation, colours, dates, generated DB types
  lib/tasks/            recurrence + status rules (pure functions, unit-tested)
  lib/calendar/         event expansion, multi-day spans, month grids (unit-tested)
  sw.ts                 service worker (offline support, and push later)
supabase/migrations/    the database schema and RLS policies (run in order)
tests/integration/      RLS tests against a real Supabase
vercel.json             hosting, security headers and SPA routing
```

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, vite-plugin-pwa (Workbox), TanStack Query (with an offline cache), Supabase (Auth, Postgres, Realtime) and Motion.

### How repeating chores work (technical)
A task stores a repeat rule. Each day the rule matches is an *occurrence*. Ticking writes a row to `task_completions` for that date (and person), so each day is independent. A past occurrence with no completion is *missed*. Because status is worked out from the rule and the ticks, history needs no background job and never gets lost. The rule exists in TypeScript (`src/lib/tasks/recurrence.ts`) and in SQL (`public.occurs_on`), and an integration test checks that they agree on every day across three years. The server also refuses ticks for days a task isn't due, for future days, and for other people's tasks.
