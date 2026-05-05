drop policy if exists "read users" on users;
drop policy if exists "create member users" on users;
drop policy if exists "update users" on users;
drop policy if exists "read tasks" on tasks;
drop policy if exists "admin creates tasks" on tasks;
drop policy if exists "update tasks" on tasks;
drop policy if exists "read rewards" on rewards;
drop policy if exists "admin creates rewards" on rewards;
drop policy if exists "update rewards" on rewards;
drop policy if exists "read reward transactions" on reward_transactions;
drop policy if exists "create reward transactions" on reward_transactions;
drop policy if exists "read purchases" on purchase_transactions;
drop policy if exists "create purchases" on purchase_transactions;

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
