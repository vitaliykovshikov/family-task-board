alter table tasks
  add column if not exists target_user_id text references users(id),
  add column if not exists difficulty text not null default 'medium';

alter table tasks
  drop constraint if exists tasks_difficulty_check;

alter table tasks
  add constraint tasks_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard'));

create index if not exists tasks_target_user_id_idx on tasks(target_user_id);
