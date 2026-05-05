alter table tasks
  alter column deadline_amount drop not null,
  alter column due_at drop not null;

alter table tasks
  drop constraint if exists tasks_deadline_amount_check;

alter table tasks
  add constraint tasks_deadline_amount_check
  check (deadline_amount is null or deadline_amount > 0);
