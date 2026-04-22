-- Store gross card payments in sale_payments, but credit only the net amount
-- in account_movements by removing the configured payment-method surcharge.

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

