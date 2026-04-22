-- Payment accreditation tracking for delayed card settlements.

alter table public.payment_methods
  add column if not exists accreditation_delay_business_days integer not null default 0;

alter table public.payment_methods
  drop constraint if exists payment_methods_accreditation_delay_check;

alter table public.payment_methods
  add constraint payment_methods_accreditation_delay_check
  check (accreditation_delay_business_days >= 0);

alter table public.account_movements
  add column if not exists accreditation_status text not null default 'credited';

alter table public.account_movements
  drop constraint if exists account_movements_accreditation_status_check;

alter table public.account_movements
  add constraint account_movements_accreditation_status_check
  check (accreditation_status in ('credited', 'pending'));

alter table public.account_movements
  add column if not exists available_on date;

update public.account_movements
set available_on = movement_date
where available_on is null;

create or replace function public.add_business_days(
  p_start_date date,
  p_days integer
)
returns date
language plpgsql
stable
as $function$
declare
  v_date date := coalesce(p_start_date, current_date);
  v_remaining integer := greatest(coalesce(p_days, 0), 0);
begin
  while v_remaining > 0 loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6 then
      v_remaining := v_remaining - 1;
    end if;
  end loop;

  return v_date;
end;
$function$;

create or replace function public.sync_movement_from_sale_payment()
returns trigger
language plpgsql
as $$
declare
  v_movement_date date;
  v_accreditation_delay integer := 0;
  v_available_on date;
  v_accreditation_status text;
  v_multiplier numeric := 1;
  v_net_amount numeric;
  v_net_amount_ars numeric;
begin
  if tg_op = 'DELETE' then
    delete from public.account_movements
      where related_table = 'sale_payments'
        and related_id = old.id;
    return old;
  end if;

  delete from public.account_movements
    where related_table = 'sale_payments'
      and related_id = new.id;

  if new.account_id is null then
    return new;
  end if;

  v_movement_date := coalesce(new.created_at::date, current_date);

  select coalesce(pm.accreditation_delay_business_days, 0)
    into v_accreditation_delay
  from public.payment_methods pm
  where pm.id = new.payment_method_id;

  select greatest(coalesce(pi.multiplier, pm.multiplier, 1), 1)
    into v_multiplier
  from public.payment_methods pm
  left join public.payment_installments pi
    on pi.payment_method_id = pm.id
   and pi.installments = new.installments
  where pm.id = new.payment_method_id;

  v_multiplier := greatest(coalesce(v_multiplier, 1), 1);
  v_available_on := public.add_business_days(v_movement_date, v_accreditation_delay);
  v_accreditation_status :=
    case when v_available_on > current_date then 'pending' else 'credited' end;

  if new.amount_usd is not null and new.amount_usd <> 0 then
    v_net_amount := new.amount_usd / v_multiplier;

    insert into public.account_movements (
      account_id,
      type,
      amount,
      currency,
      amount_ars,
      fx_rate_used,
      related_table,
      related_id,
      notes,
      movement_date,
      accreditation_status,
      available_on
    ) values (
      new.account_id,
      'income',
      v_net_amount,
      'USD',
      null,
      null,
      'sale_payments',
      new.id,
      case
        when v_multiplier > 1 then
          'Ingreso neto sin recargo de tarjeta/posnet. Cobrado: ' || new.amount_usd || ' USD'
        else null
      end,
      v_movement_date,
      v_accreditation_status,
      v_available_on
    );
  else
    v_net_amount := new.amount_ars / v_multiplier;
    v_net_amount_ars := new.amount_ars / v_multiplier;

    insert into public.account_movements (
      account_id,
      type,
      amount,
      currency,
      amount_ars,
      fx_rate_used,
      related_table,
      related_id,
      notes,
      movement_date,
      accreditation_status,
      available_on
    ) values (
      new.account_id,
      'income',
      v_net_amount,
      'ARS',
      v_net_amount_ars,
      null,
      'sale_payments',
      new.id,
      case
        when v_multiplier > 1 then
          'Ingreso neto sin recargo de tarjeta/posnet. Cobrado: ' || new.amount_ars || ' ARS'
        else null
      end,
      v_movement_date,
      v_accreditation_status,
      v_available_on
    );
  end if;

  return new;
end;
$$;

update public.sale_payments
set id = id
where account_id is not null;
