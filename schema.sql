create table users (
  id text primary key,
  name text not null,
  role text not null check (role in ('admin', 'member')),
  completed_tasks_count integer not null default 0 check (completed_tasks_count >= 0),
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id text primary key,
  title text not null,
  reward integer not null check (reward > 0),
  details text,
  deadline_amount integer check (deadline_amount is null or deadline_amount > 0),
  deadline_unit text not null check (deadline_unit in ('day', 'week', 'month')),
  due_at timestamptz,
  requires_approval boolean not null default true,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'available' check (
    status in ('available', 'in_progress', 'done', 'approved', 'rejected')
  ),
  created_by_user_id text not null references users(id),
  target_user_id text references users(id),
  assigned_to_user_id text references users(id),
  completed_by_user_id text references users(id),
  approved_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table rewards (
  id text primary key,
  title text not null,
  description text,
  cost integer not null check (cost > 0),
  stock integer not null check (stock > 0),
  purchased_count integer not null default 0 check (purchased_count >= 0),
  available_amount integer not null check (available_amount > 0),
  available_unit text not null check (available_unit in ('day', 'week', 'month')),
  available_until timestamptz not null,
  per_user_limit integer not null check (per_user_limit > 0),
  created_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purchased_count <= stock)
);

create table reward_transactions (
  id text primary key,
  user_id text not null references users(id),
  task_id text references tasks(id),
  amount integer not null,
  type text not null check (type in ('task_reward', 'manual_adjustment')),
  created_by_user_id text not null references users(id),
  created_at timestamptz not null default now()
);

create table purchase_transactions (
  id text primary key,
  user_id text not null references users(id),
  reward_id text not null references rewards(id),
  amount integer not null check (amount > 0),
  type text not null default 'reward_purchase' check (type = 'reward_purchase'),
  created_at timestamptz not null default now()
);

create table app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into users (id, name, role)
values ('user_admin_1', 'Адмін', 'admin')
on conflict (id) do nothing;

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_admins
    where lower(email) = lower(auth.email())
  );
$$;

alter table users enable row level security;
alter table tasks enable row level security;
alter table rewards enable row level security;
alter table reward_transactions enable row level security;
alter table purchase_transactions enable row level security;
alter table app_admins enable row level security;

create policy "read users" on users for select using (auth.role() = 'authenticated');
create policy "create member users" on users
  for insert
  with check (auth.role() = 'authenticated' and (role = 'member' or is_app_admin()));
create policy "update users" on users
  for update
  using (auth.role() = 'authenticated' and (role = 'member' or is_app_admin()))
  with check (auth.role() = 'authenticated' and (role = 'member' or is_app_admin()));

create policy "read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "admin creates tasks" on tasks for insert with check (is_app_admin());
create policy "update tasks" on tasks
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "admin deletes tasks" on tasks for delete using (is_app_admin());

create policy "read rewards" on rewards for select using (auth.role() = 'authenticated');
create policy "admin creates rewards" on rewards for insert with check (is_app_admin());
create policy "update rewards" on rewards
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "read reward transactions" on reward_transactions for select using (auth.role() = 'authenticated');
create policy "create reward transactions" on reward_transactions
  for insert
  with check (auth.role() = 'authenticated' and (type = 'task_reward' or is_app_admin()));

create policy "read purchases" on purchase_transactions for select using (auth.role() = 'authenticated');
create policy "create purchases" on purchase_transactions
  for insert
  with check (auth.role() = 'authenticated');

create policy "admins read admin list" on app_admins for select using (is_app_admin());

create index tasks_status_idx on tasks(status);
create index tasks_due_at_idx on tasks(due_at);
create index tasks_target_user_id_idx on tasks(target_user_id);
create index tasks_assigned_to_user_id_idx on tasks(assigned_to_user_id);
create index tasks_created_by_user_id_idx on tasks(created_by_user_id);
create index reward_transactions_user_id_idx on reward_transactions(user_id);
create index purchase_transactions_user_id_idx on purchase_transactions(user_id);
create index purchase_transactions_reward_id_idx on purchase_transactions(reward_id);
create index rewards_available_until_idx on rewards(available_until);
