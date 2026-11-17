-- Early access: a drop's subscribers ("Prévenez-moi" before the early window, or newsletter
-- subscribers) can order its pieces some hours before everyone else (setting
-- drop_early_access_hours, 24 by default). They get an email when it starts.
alter table public.drop_reminders
  add column if not exists early_notified_at timestamptz;
alter table public.drops
  add column if not exists early_reminded_at timestamptz;
