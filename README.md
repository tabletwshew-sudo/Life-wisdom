# 🏠 Family Hub

A free family organiser for chores, a shared calendar, meals and shopping. It works in any web browser, and you can install it on an iPhone from Safari with **Add to Home Screen**. You don't need an App Store listing or a paid Apple Developer account.

**What's inside:**
- **Families:** sign-in, families and invites, with admin and member roles.
- **Chores:** they repeat, and show ✅ when done, ❌ when missed, ✨ NEW, plus points and streaks.
- **A shared calendar** with day, week, month and year views.
- **Food & drink:** a recipe book, meal planner, live shopping list and ideas.
- **Notifications:** reminders, push on iPhone, and a notification centre.
- **Privacy:** optional end-to-end encryption for private notes.

All of it runs on free plans.

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
   | 4 | `20261114000400_food.sql` | Recipes, meal plans, shopping list, private photo storage |
   | 5 | `20261114000500_notifications.sql` | Notifications, reminders, push devices |
   | 6 | `20261114000600_encryption.sql` | Optional end-to-end encryption keys |

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

### Want to try it before inviting anyone?
An admin can go to **More** → **Family settings** → **Load demo data**. That adds example chores, events (a birthday, football practice, a dentist trip, a film night), recipes and drinks, a few planned dinners and a shopping list. It only fills empty sections, so it won't touch your own data. Delete the examples whenever you like.

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

## Using Food & Drink

The Food tab has five sections:

- **🗓️ Plan:** the weekly meal planner.
  - Tap a breakfast, lunch or dinner slot to choose a recipe, type something like "Takeaway", or tap **Surprise me**, which picks a recipe you haven't had for two weeks.
  - **Add this week's ingredients to shopping** puts everything you need from today onwards on the list. The same ingredient is added up across recipes (e.g. 400 g + 200 g spaghetti = 600 g).
  - Planned meals also show on the **Today** page ("What's for dinner?") and on the **calendar**. You can switch them off in Calendar options.
- **📖 Recipes** and **🥤 Drinks:** your family's recipe book.
  - **Each recipe has:** a photo, emoji, tags (dinner, dessert, kid-friendly, vegetarian, smoothie, mocktail, cocktail…), prep and cook time, servings, ingredients (one per line), steps and notes.
  - **Finding recipes:** search, filter by tag, or show **My favourites**.
  - **Favourites:** everyone stars their own, and the star shows how many people love it.
  - **New recipes** show a ✨ NEW badge until you've seen them.
  - **On a recipe's page:** tick ingredients off as you cook, send them to the **Shopping list**, or **Plan it** for a day.
  - **Trying it out:** an admin can tap **Add example recipes** on an empty recipe book.
- **🛒 Shopping:** one shared list, live for everyone, so two people in different aisles don't buy the same thing.
  - **Adding items:** type things like "2 milk". Items are sorted into supermarket aisles automatically.
  - **In the shop:** tap the circle to tick an item; it moves to "In the trolley" with the person who got it. **Clear ticked** tidies up afterwards.
- **💡 Ideas:** save links and recipes to try.
  - **Suggest something** gives you one of your own recipes you haven't had for a while, plus something new from a built-in list. Filter by dinner, breakfast, lunch, dessert, veggie, kid-friendly or drink. It's free, with no AI service involved.
  - **Saving a suggestion:** save it as an idea, or **Make it a recipe**. Once you've tried an idea, edit it and switch on **Move to the recipe book**.

**Photos** are shrunk on your phone before upload (about 250 KB each), so the free 1 GB of storage holds thousands. They're kept in a **private** storage area: only your family can see them, through links that expire after an hour.

**Who can do what:** by default kids (Members) can add recipes, plan meals and add shopping items. Admins can switch these off in **More** → **Family settings**. Anyone in the family can tick shopping items.

## Notifications and reminders

**These work straight away, with no setup:**
- **🔔 Notification centre:** the bell in the top corner on phones, or **Notifications** in the side menu on computers. It shows chores someone gave you, events you were added to, reminders and your daily summary. Tap one to open it.
- **Live pop-ups:** when someone gives you a chore or adds you to an event while the app is open, it pops up straight away.
- **Reminders inside the app:** when you set a reminder on a chore or event, it pops up in Family Hub at that time, as long as the app or tab is open.
- **Your own choices:** go to **More** → **Notifications** to choose a daily summary (and its time), new chores and events, chore reminders, event reminders and new recipes. These are just for you.

**Push notifications** pop up even when Family Hub is closed, including on iPhone. They need the one-off setup in Step 7.

## Step 7: Push notifications (one-off setup, about 15 minutes, free)

You'll create a pair of keys, add them to Vercel and Supabase, deploy a small Supabase function, and start a once-a-minute timer. All of it is free.

1. **Create your keys.** Open Family Hub as an admin and go to **More** → **Notifications** → **Set up push (admins)** → **Create my keys**. Keep that page open: it shows each value below with a **copy** button, and the keys never leave your device.
2. **Vercel:** go to your project → **Settings** → **Environment Variables** and add `VITE_VAPID_PUBLIC_KEY` with the public key. Then go to **Deployments** → **⋯** → **Redeploy**.
3. **Supabase:** go to **Edge Functions** → **Secrets** and add these four:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY` (keep this one secret)
   - `VAPID_SUBJECT` (your Family Hub web address)
   - `CRON_SECRET` (keep this one secret)
4. **Deploy the reminder function.** The easiest way is the included GitHub Action:
   1. On supabase.com, open your account menu → **Access Tokens** → **Generate new token**, and copy it.
   2. In GitHub, open your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add two:
      - `SUPABASE_ACCESS_TOKEN`: the token you just copied.
      - `SUPABASE_PROJECT_REF`: the `abcdefgh` part of `https://abcdefgh.supabase.co`.
   3. Go to the **Actions** tab → **Deploy reminder function** → **Run workflow**. Wait for the green tick.

   From now on, the function redeploys itself whenever it changes.
   *No GitHub Actions?* In Supabase go to **Edge Functions** → **Deploy a new function** → **Via Editor**. Name it `send-reminders`, create two files, `index.ts` and `webpush.ts`, and paste in the contents of the files with those names from `supabase/functions/send-reminders/`. Then open the function's settings and turn **Verify JWT** off. (The function checks its own secret instead.)
5. **Start the timer.** Copy the SQL from step 4 on the setup page. It's already filled in with your project address and secret. In Supabase go to **SQL Editor** → **New query**, paste it and click **Run**. (The same SQL is in `supabase/setup/schedule-reminders.sql` if you'd rather fill it in by hand.)
6. **Turn it on, on each device:**
   - **iPhone/iPad:** open Family Hub **from the Home Screen icon** (see Step 5), then go to **More** → **Notifications** → **Turn on notifications** → **Allow** → **Send a test**.
   - **Android, Windows or Mac (Chrome, Edge or Firefox):** do the same in the browser.

**iPhone limitations to know about:**
- Push needs **iOS 16.4 or newer** and the app **added to the Home Screen**. In a normal Safari tab, reminders only appear inside the app while it's open.
- Each device has to be turned on separately, and each person turns on their own devices.
- If you remove the app from the Home Screen, or turn notifications off in iPhone Settings, that device stops getting them. Turn them on again in the app.
- Focus modes, Do Not Disturb and Low Power Mode can delay or hide notifications.
- Reminders are checked once a minute, so they can arrive up to a minute late.
- Notifications show titles and times, but never private notes, and never locations when encryption is on (Phase 6).

To stop all reminders, run `select cron.unschedule('family-hub-reminders');` in the SQL Editor.

---

## Private notes: end-to-end encryption (optional)

Normally, your family's data is protected by your logins, the database rules and Supabase's disk encryption. If you also want **private notes that not even the server can read**, an admin can turn on end-to-end encryption:

1. Go to **More** → **Encryption** → **Turn on encryption**, tick the box and enter your password.
2. You'll see a **family recovery code** like `ABCD-EFGH-…`. **Save it somewhere safe** (a password manager, or print it), then tap **Done**. It's shown only once.
3. That's it. Other family members get the key automatically: their key is made when they sign in, and an admin's app shares the family key with them.

**What gets encrypted:** chore notes, event notes, event locations and recipe notes. They're encrypted on your phone before they're saved, and stored as `enc:v1:…` gibberish.
Titles, dates and times stay readable, so the calendar, reminders and push notifications keep working.

**Things to know:**
- **Your password is the key.** You type it when you sign in. On a new device, signing in unlocks everything automatically. If a device ever shows *"Private notes are locked on this device"*, tap **Unlock** and enter your password.
- **Forgot your password?** Reset it as usual. Your notes show 🔒 until an admin opens Family Hub, at which point their app re-shares the key with you automatically.
- **If every admin loses access** and the recovery code is lost too, encrypted notes can't be recovered by anyone. Not Supabase, and not the developer. With the code, an admin goes to **More** → **Encryption** → **Use recovery code**.
- **Changing your password** in **More** → **Profile** keeps your access. It asks for your current password too.
- **Push notifications** never include notes or locations.
- **Turning it off** (admins: **More** → **Encryption** → **Turn off encryption**) decrypts everything back to normal text.
- **Exports** (**More** → **Privacy & your data**) are decrypted on your device, so the file is readable.

The full technical details, including the threat model, are in [SECURITY.md](SECURITY.md).

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

Full details are in **[SECURITY.md](SECURITY.md)**.

- **HTTPS only.** Vercel serves the site over HTTPS, and `vercel.json` adds strict security headers (HSTS, a Content-Security-Policy and no framing). Push messages are encrypted to each device.
- **Encrypted at rest.** Supabase encrypts the database, photo storage and backups on disk with AES-256. That's a guarantee of the hosting provider, which SECURITY.md explains, including what it does and doesn't protect against.
- **Check it yourself.** Run [`supabase/setup/security-check.sql`](supabase/setup/security-check.sql) in the Supabase SQL Editor. Every line should say ✅. Also turn on **Project Settings** → **Database** → **Enforce SSL on incoming connections**.
- **Row Level Security** is on for every table. A person can only read or change data in a family they belong to. The automated tests in `tests/integration/` prove that one family can't see another family's data.
- **Optional end-to-end encryption** for private notes (see above).
- **Input checking.** Everything you type is checked in the app *and* cleaned in the database (length limits and control characters removed).
- **No secrets in the code.** The website only contains the public anon key. Secrets live in environment variables, and `.env.example` shows the names.
- **Wrong invite codes.** After 10 wrong codes in an hour, that account is blocked from trying again for an hour.
- **Export or delete.** You can export or delete all family data from **More** → **Privacy & your data**.

---

## Optional: real emails (password reset and confirmation)
Supabase's free built-in email only reaches members of your Supabase team. To email everyone for free:
1. Sign up at **https://resend.com** (the free plan sends 3,000 emails a month) and verify your domain, or use their test domain.
2. In Supabase, go to **Project Settings** → **Authentication** → **SMTP Settings**, enable custom SMTP and enter Resend's SMTP details.

Without this, if a family member forgets their password, the project owner can go to Supabase → **Authentication** → **Users**, find that person, and delete them. The person then signs up again and rejoins with the invite code. If encryption is on, an admin's app shares the key with their new account automatically.

## Free plan notes
- **Edge Functions:** the reminder timer uses about 43,000 function calls a month. The free plan allows 500,000.
- **Inactivity pause:** a free Supabase project pauses after about **7 days with no activity**. Everyday family use keeps it awake. If it does pause, open the Supabase dashboard and click **Restore**.
- **Free limits:** 500 MB of database and 1 GB of file storage, which is plenty for a family.

---

## Known limitations

- **iPhone push** needs iOS 16.4+ and the app on the Home Screen. In a Safari tab, reminders only show while the app is open. Focus modes and Low Power Mode can delay notifications.
- **Reminders** are checked once a minute, so they can arrive up to a minute late. Push only works after the one-off setup in Step 7.
- **Free Supabase** projects pause after about 7 days without use. Restore with one click.
- **Emails** (password reset, confirmation) need a free email service such as Resend, because Supabase's built-in sender only reaches your own team.
- **Sign in with Apple** isn't included, because it needs the paid Apple Developer account. Google sign-in is possible (free) but wasn't set up, at your request.
- **Everyone needs an email address.** There are no parent-managed child accounts yet.
- **Offline:** the app opens offline and shows what was last loaded, but changes need a connection. They aren't queued.
- **Encryption:**
  - Titles, dates, times, ingredients and shopping items aren't encrypted, so search, the calendar and reminders keep working.
  - Removing a member doesn't change (rotate) the family key.
  - If every admin and the recovery code are lost, encrypted notes are gone.
- **Editing repeating events** changes every date. You can skip a single date, but not edit just one occurrence.
- **Several families:** one account can belong to more than one family, but the app shows one at a time. Switch in **More**.
- **Deleting your account:** there's no "delete my account" button. Leave the family, then the project owner deletes the user in Supabase → Authentication.

## Possible future upgrades

- **App Store version:** wrap the same code with Capacitor for an App Store app (needs the paid Apple Developer account), adding native widgets, Siri and reliable background notifications.
- **Child accounts** with a username and PIN, created by a parent (needs a small Edge Function).
- **Sign in with Google**, or with Apple (paid account).
- **Offline editing:** queue changes made offline and sync them later.
- **Key rotation:** a new family key when someone leaves, plus encrypted titles as an option.
- **Edit one occurrence** of a repeating event or chore.
- **Rewards:** turn points into rewards (screen time, pocket money), with charts and weekly leaderboards.
- **Calendar sync:** two-way sync with Google Calendar or iCloud (ICS feeds).
- **Recipe import** from a web page link, and scaling recipes by servings.
- **Barcode scanning** for the shopping list, and grouping by your own shop's aisles.
- **Home Screen widgets** (needs the native app).
- **More languages**, and US date formats.

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
| `npm test` | Unit tests (Vitest): repeat rules, status/NEW/streaks, reminders, encryption, Web Push, ingredients, validation |
| `npm run test:integration` | RLS, permission, notification and encryption tests against the local Supabase |
| `npm run typecheck` / `npm run lint` | TypeScript and oxlint |
| `npm run db:reset` | Recreate the local database from `supabase/migrations` |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `npx supabase functions serve --env-file supabase/functions/.env.local` | Run the reminder function locally |

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
  features/food/        Food page (plan, recipes, drinks, shopping, ideas), recipe page
  pages/                one file per screen
  lib/                  Supabase client, validation, colours, dates, generated DB types
  lib/tasks/            recurrence + status rules (pure functions, unit-tested)
  lib/calendar/         event expansion, multi-day spans, month grids (unit-tested)
  lib/food/             ingredient parsing/merging, aisles, built-in suggestions (unit-tested)
  features/notifications/  notification centre, settings, push setup helper
  features/encryption/  encryption provider, unlock, settings page
  features/demo/        "Load demo data"
  lib/crypto/           end-to-end encryption (Web Crypto) + on-device key store (unit-tested)
  sw.ts                 service worker (offline support, push notifications)
supabase/migrations/    the database schema and RLS policies (run in order)
supabase/functions/send-reminders/  Edge Function: reminders + Web Push (no dependencies)
supabase/setup/         one-off SQL (the reminder timer, the security self-check)
.github/workflows/      CI (types, lint, tests, build) and Edge Function deploy
SECURITY.md             how data is protected, and how to verify it
tests/integration/      RLS, permission, notification and encryption tests against a real Supabase
vercel.json             hosting, security headers and SPA routing
```

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, vite-plugin-pwa (Workbox), TanStack Query (with an offline cache), Supabase (Auth, Postgres, Realtime) and Motion.

### How repeating chores work (technical)
A task stores a repeat rule. Each day the rule matches is an *occurrence*. Ticking writes a row to `task_completions` for that date (and person), so each day is independent. A past occurrence with no completion is *missed*. Because status is worked out from the rule and the ticks, history needs no background job and never gets lost. The rule exists in TypeScript (`src/lib/tasks/recurrence.ts`) and in SQL (`public.occurs_on`), and an integration test checks that they agree on every day across three years. The server also refuses ticks for days a task isn't due, for future days, and for other people's tasks.

### Tests
- **87 unit tests** (`npm test`).
- **91 integration tests** (`npm run test:integration`, with `npx supabase start` running). These include cross-family isolation for every table and for photo storage. Switching RLS off on a table makes them fail, which proves the tests work.
- **During development, each phase was also tested end to end in real browsers:**
  - Playwright scripts ran on iPhone and desktop sizes.
  - An axe-core accessibility audit of 36 page and theme combinations found no WCAG 2.1 AA problems.
  - Web Push was tested end to end against a fake push service.
