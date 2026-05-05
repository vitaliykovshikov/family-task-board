drop policy if exists "admin deletes tasks" on tasks;

create policy "admin deletes tasks" on tasks for delete using (is_app_admin());
