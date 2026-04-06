create or replace function public.is_owner_or_superadmin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.users u
    where u.id_auth = auth.uid()
      and u.is_active = true
      and lower(coalesce(u.role, '')) in ('owner', 'superadmin')
  );
$function$;

create table if not exists public.warranty_exchange_items (
  id bigint generated always as identity primary key,
  warranty_exchange_id bigint not null references public.warranty_exchanges(id) on delete cascade,
  variant_id integer not null references public.product_variants(id),
  imei text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_usd numeric not null default 0,
  subtotal_usd numeric not null default 0,
  created_at timestamp with time zone not null default now()
);

create index if not exists warranty_exchange_items_exchange_id_idx
  on public.warranty_exchange_items (warranty_exchange_id);

create index if not exists warranty_exchange_items_variant_id_idx
  on public.warranty_exchange_items (variant_id);

alter table public.warranty_exchanges
add column if not exists store_credit_usd numeric not null default 0,
add column if not exists store_credit_amount_ars numeric;

create or replace function public.process_warranty_exchange(
  p_sale_id bigint,
  p_sale_item_id bigint,
  p_return_bucket text,
  p_replacements jsonb,
  p_reason text,
  p_notes text default null,
  p_settlement_account_id bigint default null,
  p_settlement_payment_method_id integer default null,
  p_settlement_installments integer default null,
  p_settlement_multiplier numeric default null,
  p_settlement_currency text default null,
  p_settlement_amount numeric default null,
  p_settlement_amount_ars numeric default null,
  p_settlement_fx_rate_used numeric default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  sale_row public.sales%rowtype;
  sale_item_row public.sale_items%rowtype;
  replacement_row jsonb;
  replacement_variant_row record;
  replacement_total_usd numeric := 0;
  original_total_usd numeric;
  difference_usd numeric;
  warranty_id bigint;
  item_quantity integer;
  original_imei_value text;
  settlement_type_value text := 'none';
  settlement_account_currency text;
  replacement_items_count integer := 0;
  first_replacement_variant_id integer;
  first_replacement_imei text;
  store_credit_ars_value numeric := null;
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede procesar garantias';
  end if;

  if p_sale_id is null then
    raise exception 'p_sale_id es obligatorio';
  end if;

  if p_sale_item_id is null then
    raise exception 'p_sale_item_id es obligatorio';
  end if;

  if p_return_bucket not in ('available', 'defective') then
    raise exception 'Bucket invalido. Use available o defective';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'El motivo de garantia es obligatorio';
  end if;

  if p_replacements is null or jsonb_typeof(p_replacements) <> 'array' or jsonb_array_length(p_replacements) = 0 then
    raise exception 'Debes enviar al menos un producto de reemplazo';
  end if;

  select *
    into sale_row
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'No se encontro la venta %', p_sale_id;
  end if;

  if sale_row.status = 'anulado' then
    raise exception 'No se puede gestionar garantia sobre una venta anulada';
  end if;

  select *
    into sale_item_row
  from public.sale_items
  where id = p_sale_item_id
    and sale_id = p_sale_id
  for update;

  if not found then
    raise exception 'No se encontro el item % para la venta %', p_sale_item_id, p_sale_id;
  end if;

  if sale_item_row.variant_id is null then
    raise exception 'El item seleccionado no tiene variante asociada';
  end if;

  item_quantity := greatest(coalesce(sale_item_row.quantity, 0), 1);
  original_imei_value := nullif(trim(coalesce(sale_item_row.imei, '')), '');

  if original_imei_value is null then
    select nullif(trim(coalesce(sii.imei, '')), '')
      into original_imei_value
    from public.sale_item_imeis sii
    where sii.sale_item_id = p_sale_item_id
    order by sii.id asc
    limit 1;
  end if;

  original_total_usd := coalesce(sale_item_row.subtotal_usd, sale_item_row.usd_price * item_quantity, 0);

  for replacement_row in
    select value
    from jsonb_array_elements(p_replacements)
  loop
    replacement_items_count := replacement_items_count + 1;

    if coalesce((replacement_row ->> 'variant_id')::integer, 0) <= 0 then
      raise exception 'Cada reemplazo debe tener variant_id';
    end if;

    if coalesce((replacement_row ->> 'quantity')::integer, 0) <= 0 then
      raise exception 'Cada reemplazo debe tener quantity mayor a cero';
    end if;

    select
      pv.id,
      pv.usd_price,
      pv.stock,
      p.active
      into replacement_variant_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (replacement_row ->> 'variant_id')::integer
    for update of pv;

    if not found then
      raise exception 'No se encontro la variante de reemplazo %', replacement_row ->> 'variant_id';
    end if;

    if not replacement_variant_row.active then
      raise exception 'La variante de reemplazo % pertenece a un producto inactivo', replacement_variant_row.id;
    end if;

    if replacement_variant_row.stock
      + (
        case
          when p_return_bucket = 'available'
            and replacement_variant_row.id = sale_item_row.variant_id
            then item_quantity
          else 0
        end
      )
      < (replacement_row ->> 'quantity')::integer then
      raise exception
        'No hay stock suficiente para la variante % . Stock actual %, requerido %',
        replacement_variant_row.id,
        replacement_variant_row.stock,
        (replacement_row ->> 'quantity')::integer;
    end if;

    replacement_total_usd :=
      replacement_total_usd
      + (coalesce(replacement_variant_row.usd_price, 0) * (replacement_row ->> 'quantity')::integer);

    if replacement_items_count = 1 then
      first_replacement_variant_id := replacement_variant_row.id;
      first_replacement_imei := nullif(trim(coalesce(replacement_row ->> 'imei', '')), '');
    end if;
  end loop;

  difference_usd := round((replacement_total_usd - original_total_usd)::numeric, 2);

  if difference_usd > 0.009 then
    if p_settlement_account_id is null then
      raise exception 'Debes seleccionar la cuenta para liquidar la diferencia';
    end if;

    if p_settlement_payment_method_id is null then
      raise exception 'Debes seleccionar el metodo de pago para liquidar la diferencia';
    end if;

    if p_settlement_currency is null then
      raise exception 'Debes indicar la moneda de la diferencia';
    end if;

    if coalesce(p_settlement_amount, 0) <= 0 then
      raise exception 'El monto de la diferencia debe ser mayor a cero';
    end if;

    select currency
      into settlement_account_currency
    from public.accounts
    where id = p_settlement_account_id
    for update;

    if not found then
      raise exception 'No se encontro la cuenta seleccionada';
    end if;

    if settlement_account_currency <> p_settlement_currency then
      raise exception 'La moneda de la cuenta no coincide con la moneda de liquidacion';
    end if;

    settlement_type_value := 'customer_payment';
  elsif difference_usd < -0.009 then
    settlement_type_value := 'store_credit';
    if p_settlement_fx_rate_used is not null then
      store_credit_ars_value := round(abs(difference_usd) * p_settlement_fx_rate_used, 2);
    end if;
  end if;

  if p_return_bucket = 'available' then
    update public.product_variants
    set stock = coalesce(stock, 0) + item_quantity,
        updated_at = now()
    where id = sale_item_row.variant_id;
  else
    update public.product_variants
    set stock_defective = coalesce(stock_defective, 0) + item_quantity,
        updated_at = now()
    where id = sale_item_row.variant_id;
  end if;

  for replacement_row in
    select value
    from jsonb_array_elements(p_replacements)
  loop
    update public.product_variants
    set stock = coalesce(stock, 0) - (replacement_row ->> 'quantity')::integer,
        updated_at = now()
    where id = (replacement_row ->> 'variant_id')::integer;
  end loop;

  insert into public.warranty_exchanges (
    sale_id,
    sale_item_id,
    original_variant_id,
    original_imei,
    quantity,
    returned_stock_bucket,
    replacement_variant_id,
    replacement_imei,
    reason,
    notes,
    status,
    created_by,
    price_difference_usd,
    settlement_type,
    settlement_account_id,
    settlement_payment_method_id,
    settlement_installments,
    settlement_multiplier,
    settlement_currency,
    settlement_amount,
    settlement_amount_ars,
    settlement_fx_rate_used,
    store_credit_usd,
    store_credit_amount_ars
  ) values (
    p_sale_id,
    p_sale_item_id,
    sale_item_row.variant_id,
    original_imei_value,
    item_quantity,
    p_return_bucket,
    first_replacement_variant_id,
    first_replacement_imei,
    trim(p_reason),
    nullif(trim(coalesce(p_notes, '')), ''),
    'completed',
    auth.uid(),
    difference_usd,
    settlement_type_value,
    case when settlement_type_value = 'customer_payment' then p_settlement_account_id else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_payment_method_id else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_installments else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_multiplier else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_currency else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_amount else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_amount_ars else null end,
    case when settlement_type_value = 'customer_payment' then p_settlement_fx_rate_used else null end,
    case when settlement_type_value = 'store_credit' then abs(difference_usd) else 0 end,
    case when settlement_type_value = 'store_credit' then store_credit_ars_value else null end
  )
  returning id into warranty_id;

  for replacement_row in
    select value
    from jsonb_array_elements(p_replacements)
  loop
    insert into public.warranty_exchange_items (
      warranty_exchange_id,
      variant_id,
      imei,
      quantity,
      unit_price_usd,
      subtotal_usd
    )
    select
      warranty_id,
      pv.id,
      nullif(trim(coalesce(replacement_row ->> 'imei', '')), ''),
      (replacement_row ->> 'quantity')::integer,
      coalesce(pv.usd_price, 0),
      coalesce(pv.usd_price, 0) * (replacement_row ->> 'quantity')::integer
    from public.product_variants pv
    where pv.id = (replacement_row ->> 'variant_id')::integer;
  end loop;

  if settlement_type_value = 'customer_payment' then
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
      movement_date
    ) values (
      p_settlement_account_id,
      'income',
      p_settlement_amount,
      p_settlement_currency,
      p_settlement_amount_ars,
      p_settlement_fx_rate_used,
      'warranty_exchange_settlement',
      warranty_id,
      format('Cobro diferencia de garantia | Venta #%s', p_sale_id),
      current_date
    );
  end if;

  if p_return_bucket = 'defective' then
    insert into public.aftersales_devices (
      variant_id,
      sale_id,
      warranty_exchange_id,
      source_type,
      imei,
      quantity,
      status,
      notes,
      created_by
    ) values (
      sale_item_row.variant_id,
      p_sale_id,
      warranty_id,
      'warranty',
      original_imei_value,
      item_quantity,
      'defective_in_store',
      concat('Garantia: ', trim(p_reason), coalesce(case when nullif(trim(coalesce(p_notes, '')), '') is not null then ' | ' || trim(p_notes) else null end, '')),
      auth.uid()
    );
  end if;

  return warranty_id;
end;
$function$;

create or replace function public.void_sale(
  p_sale_id bigint,
  p_reason text,
  p_bucket text default 'available'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_items_count int;
  v_updated_count int;
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede anular ventas';
  end if;

  if p_bucket not in ('available', 'defective') then
    raise exception 'Bucket invalido. Use available o defective';
  end if;

  perform 1 from public.sales where id = p_sale_id for update;

  if exists (select 1 from public.sales where id = p_sale_id and status = 'anulado') then
    raise exception 'La venta % ya esta anulada', p_sale_id;
  end if;

  select count(*) into v_items_count
  from public.sale_items
  where sale_id = p_sale_id
    and variant_id is not null
    and coalesce(quantity,0) > 0;

  if v_items_count = 0 then
    raise exception 'Venta %: no hay sale_items con variant_id/quantity para reintegrar', p_sale_id;
  end if;

  if p_bucket = 'available' then
    update public.product_variants pv
    set stock = pv.stock + t.qty,
        updated_at = now()
    from (
      select variant_id, sum(coalesce(quantity,0))::int as qty
      from public.sale_items
      where sale_id = p_sale_id
        and variant_id is not null
        and coalesce(quantity,0) > 0
      group by variant_id
    ) t
    where pv.id = t.variant_id;
  else
    update public.product_variants pv
    set stock_defective = pv.stock_defective + t.qty,
        updated_at = now()
    from (
      select variant_id, sum(coalesce(quantity,0))::int as qty
      from public.sale_items
      where sale_id = p_sale_id
        and variant_id is not null
        and coalesce(quantity,0) > 0
      group by variant_id
    ) t
    where pv.id = t.variant_id;
  end if;

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    raise exception 'Venta %: no se reintegro stock (0 variantes actualizadas). Revisa RLS/match de IDs.', p_sale_id;
  end if;

  perform public.revert_commission_for_sale(p_sale_id);

  update public.sales
  set status = 'anulado',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = p_reason,
      void_stock_bucket = p_bucket
  where id = p_sale_id;
end;
$function$;
