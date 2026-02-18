-- Ensure one active FX rate per source (remove global single-active trigger)

do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on t.tgfoid = p.oid
    join pg_class c on t.tgrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where p.proname = 'ensure_single_active_fx_rate_global'
      and n.nspname = 'public'
      and c.relname = 'fx_rates'
      and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on public.fx_rates', r.tgname);
  end loop;
end;
$$;

drop function if exists public.ensure_single_active_fx_rate_global();

do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on t.tgfoid = p.oid
    join pg_class c on t.tgrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where p.proname = 'ensure_single_active_fx_rate'
      and n.nspname = 'public'
      and c.relname = 'fx_rates'
      and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on public.fx_rates', r.tgname);
  end loop;
end;
$$;

create or replace function public.ensure_single_active_fx_rate()
returns trigger
language plpgsql
as $$
begin
  if new.is_active then
    update public.fx_rates
    set is_active = false
    where source = new.source
      and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger ensure_single_active_fx_rate_trg
before insert or update on public.fx_rates
for each row execute function public.ensure_single_active_fx_rate();
