-- pg_cron によるスケジューリング
-- schedule は config.toml の [functions.*] では設定できないため、ここで定義する

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- poll-sites: JST 08:00 / 12:00 / 16:00 = UTC 23:00 / 03:00 / 07:00
select cron.schedule(
  'poll-sites',
  '0 23,3,7 * * *',
  $$
  select supabase_functions.http_request(
    'poll-sites',
    'POST',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb,
    30000
  )
  $$
);

-- ping-keep-alive: 3日に1回 UTC 00:00（Supabase Free tier auto-pause 対策）
select cron.schedule(
  'ping-keep-alive',
  '0 0 */3 * *',
  $$
  select supabase_functions.http_request(
    'ping-keep-alive',
    'POST',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb,
    10000
  )
  $$
);
