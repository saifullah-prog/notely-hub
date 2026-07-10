-- Rocky music app — auto-delete rejected submissions
-- Run this in Supabase after 0010:  Dashboard → SQL Editor → paste → Run.
--
-- The moment a submission's status becomes 'rejected' — whether from an admin
-- reject, the rule-based auto-review (0008), or the AI reviewer (0009) — the row
-- is removed automatically. One trigger covers every rejection path.

create or replace function public.delete_rejected_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.submissions where id = new.id;
  return null; -- AFTER trigger: return value is ignored
end;
$$;

drop trigger if exists trg_delete_rejected on public.submissions;
create trigger trg_delete_rejected
  after update on public.submissions
  for each row
  when (new.status = 'rejected')
  execute function public.delete_rejected_submission();

-- Clean up any submissions that are already rejected.
delete from public.submissions where status = 'rejected';
