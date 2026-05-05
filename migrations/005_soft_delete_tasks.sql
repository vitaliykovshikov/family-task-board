alter table tasks
  add column if not exists deleted_at timestamptz;
