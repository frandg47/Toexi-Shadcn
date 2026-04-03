alter table public.warranty_exchanges
add column if not exists price_difference_usd numeric not null default 0,
add column if not exists settlement_type text not null default 'none'
  check (settlement_type in ('none', 'customer_payment', 'customer_refund')),
add column if not exists settlement_account_id bigint references public.accounts(id),
add column if not exists settlement_payment_method_id integer references public.payment_methods(id),
add column if not exists settlement_installments integer,
add column if not exists settlement_multiplier numeric,
add column if not exists settlement_currency text
  check (settlement_currency is null or settlement_currency = any (array['ARS'::text, 'USD'::text, 'USDT'::text])),
add column if not exists settlement_amount numeric,
add column if not exists settlement_amount_ars numeric,
add column if not exists settlement_fx_rate_used numeric;

create or replace function public.process_warranty_exchange(
  p_sale_id bigint,
  p_sale_item_id bigint,
  p_return_bucket text,
  p_replacement_variant_id integer,
  p_reason text,
  p_notes text default null,
  p_replacement_imei text default null,
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
  replacement_product_active boolean;
  replacement_stock numeric;
  replacement_unit_usd numeric;
  warranty_id bigint;
  item_quantity integer;
  original_imei_value text;
  original_total_usd numeric;
  replacement_total_usd numeric;
  difference_usd numeric;
  settlement_type_value text := 'none';
  settlement_account_currency text;
begin
  if not public.is_owner() then
    raise exception 'Solo owner puede procesar garantias';
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

  if p_replacement_variant_id is null then
    raise exception 'p_replacement_variant_id es obligatorio';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'El motivo de garantia es obligatorio';
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

  select p.active, coalesce(pv.usd_price, 0)
    into replacement_product_active, replacement_unit_usd
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = p_replacement_variant_id
  for update of pv;

  if not found then
    raise exception 'No se encontro la variante de reemplazo %', p_replacement_variant_id;
  end if;

  if not replacement_product_active then
    raise exception 'La variante de reemplazo pertenece a un producto inactivo';
  end if;

  select coalesce(stock, 0)
    into replacement_stock
  from public.product_variants
  where id = p_replacement_variant_id
  for update;

  if p_replacement_variant_id = sale_item_row.variant_id and p_return_bucket = 'available' then
    replacement_stock := replacement_stock + item_quantity;
  end if;

  if replacement_stock < item_quantity then
    raise exception
      'No hay stock suficiente para el reemplazo. Stock actual %, requerido %',
      replacement_stock,
      item_quantity;
  end if;

  replacement_total_usd := coalesce(replacement_unit_usd, 0) * item_quantity;
  difference_usd := round((replacement_total_usd - original_total_usd)::numeric, 2);

  if abs(coalesce(difference_usd, 0)) > 0.009 then
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

    settlement_type_value :=
      case
        when difference_usd > 0 then 'customer_payment'
        else 'customer_refund'
      end;
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

  update public.product_variants
  set stock = coalesce(stock, 0) - item_quantity,
      updated_at = now()
  where id = p_replacement_variant_id;

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
    settlement_fx_rate_used
  ) values (
    p_sale_id,
    p_sale_item_id,
    sale_item_row.variant_id,
    original_imei_value,
    item_quantity,
    p_return_bucket,
    p_replacement_variant_id,
    nullif(trim(coalesce(p_replacement_imei, '')), ''),
    trim(p_reason),
    nullif(trim(coalesce(p_notes, '')), ''),
    'completed',
    auth.uid(),
    difference_usd,
    settlement_type_value,
    p_settlement_account_id,
    p_settlement_payment_method_id,
    p_settlement_installments,
    p_settlement_multiplier,
    p_settlement_currency,
    p_settlement_amount,
    p_settlement_amount_ars,
    p_settlement_fx_rate_used
  )
  returning id into warranty_id;

  if settlement_type_value <> 'none' then
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
      case
        when settlement_type_value = 'customer_payment' then 'income'
        else 'expense'
      end,
      p_settlement_amount,
      p_settlement_currency,
      p_settlement_amount_ars,
      p_settlement_fx_rate_used,
      'warranty_exchange_settlement',
      warranty_id,
      case
        when settlement_type_value = 'customer_payment'
          then format('Cobro diferencia de garantia | Venta #%s', p_sale_id)
        else format('Reintegro diferencia de garantia | Venta #%s', p_sale_id)
      end,
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
