-- =============================================================================
-- Family Hub — schedule reminders (run ONCE, after deploying send-reminders)
--
-- Replace the two values below, then run this in Supabase → SQL Editor.
--   1. YOUR-PROJECT-REF  → from your project URL https://YOUR-PROJECT-REF.supabase.co
--   2. YOUR-CRON-SECRET  → the same long random text you saved as the
--                          CRON_SECRET Edge Function secret
--
-- Both values are stored encrypted in Supabase Vault, not in plain text.
-- To stop reminders later:  select cron.unschedule('family-hub-reminders');
-- =============================================================================

select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'family_hub_project_url');
select vault.create_secret('YOUR-CRON-SECRET', 'family_hub_cron_secret');

select cron.schedule(
  'family-hub-reminders',
  '* * * * *',  -- every minute
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'family_hub_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'family_hub_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
