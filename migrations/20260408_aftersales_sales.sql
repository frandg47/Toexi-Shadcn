alter table public.aftersales_devices
add column if not exists sold_sale_id bigint references public.sales(id),
add column if not exists sold_at timestamp with time zone;

create or replace function public.update_aftersales_device_status(
  p_aftersales_device_id bigint,
  p_status text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  device_row public.aftersales_devices%rowtype;
  current_stock integer;
  current_stock_defective integer;
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede actualizar postventa';
  end if;

  if p_aftersales_device_id is null then
    raise exception 'p_aftersales_device_id es obligatorio';
  end if;

  if p_status not in ('defective_in_store', 'in_repair', 'repaired') then
    raise exception 'Estado invalido';
  end if;

  select *
    into device_row
  from public.aftersales_devices
  where id = p_aftersales_device_id
  for update;

  if not found then
    raise exception 'No se encontro el registro de postventa %', p_aftersales_device_id;
  end if;

  if device_row.sold_sale_id is not null then
    raise exception 'El equipo ya fue vendido desde postventa';
  end if;

  if device_row.status = p_status then
    update public.aftersales_devices
    set notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
        updated_at = now()
    where id = p_aftersales_device_id;
    return;
  end if;

  select coalesce(stock, 0), coalesce(stock_defective, 0)
    into current_stock, current_stock_defective
  from public.product_variants
  where id = device_row.variant_id
  for update;

  if device_row.status <> 'repaired' and p_status = 'repaired' then
    if current_stock_defective < device_row.quantity then
      raise exception
        'No hay stock defectuoso suficiente para reparar. Defectuoso actual %, requerido %',
        current_stock_defective,
        device_row.quantity;
    end if;

    update public.product_variants
    set stock = coalesce(stock, 0) + device_row.quantity,
        stock_defective = coalesce(stock_defective, 0) - device_row.quantity,
        updated_at = now()
    where id = device_row.variant_id;
  elsif device_row.status = 'repaired' and p_status <> 'repaired' then
    if current_stock < device_row.quantity then
      raise exception
        'No hay stock disponible suficiente para volver a marcar como defectuoso. Stock actual %, requerido %',
        current_stock,
        device_row.quantity;
    end if;

    update public.product_variants
    set stock = coalesce(stock, 0) - device_row.quantity,
        stock_defective = coalesce(stock_defective, 0) + device_row.quantity,
        updated_at = now()
    where id = device_row.variant_id;
  end if;

  update public.aftersales_devices
  set status = p_status,
      notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
      updated_at = now()
  where id = p_aftersales_device_id;
end;
$function$;

create or replace function public.set_aftersales_stock_cost_balance(
  p_aftersales_device_id bigint,
  p_include boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede actualizar postventa';
  end if;

  if p_aftersales_device_id is null then
    raise exception 'p_aftersales_device_id es obligatorio';
  end if;

  update public.aftersales_devices
  set include_in_stock_cost_balance = coalesce(p_include, false),
      updated_at = now()
  where id = p_aftersales_device_id
    and sold_sale_id is null;

  if not found then
    raise exception 'No se encontro un equipo disponible en postventa con id %', p_aftersales_device_id;
  end if;
end;
$function$;

create or replace function public.create_aftersales_sale(
  p_aftersales_device_id bigint,
  p_customer_id integer,
  p_seller_id uuid,
  p_sales_channel_id integer,
  p_unit_price_usd numeric,
  p_total_usd numeric,
  p_total_ars numeric,
  p_fx_rate numeric,
  p_notes text default null,
  p_payments jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_device public.aftersales_devices%rowtype;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_sale_id bigint;
  v_sale_item_id bigint;
  v_payment jsonb;
  v_payment_method_name text;
  v_amount numeric;
  v_amount_ars numeric;
  v_amount_usd numeric;
  v_installments integer;
  v_reference text;
  v_account_id bigint;
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede vender desde postventa';
  end if;

  if p_aftersales_device_id is null then
    raise exception 'p_aftersales_device_id es obligatorio';
  end if;

  if p_customer_id is null then
    raise exception 'p_customer_id es obligatorio';
  end if;

  if coalesce(p_unit_price_usd, 0) < 0 then
    raise exception 'El precio por unidad no puede ser negativo';
  end if;

  if coalesce(p_total_ars, 0) < 0 then
    raise exception 'El total no puede ser negativo';
  end if;

  if coalesce(p_fx_rate, 0) <= 0 then
    raise exception 'No hay cotizacion valida';
  end if;

  select *
    into v_device
  from public.aftersales_devices
  where id = p_aftersales_device_id
  for update;

  if not found then
    raise exception 'No se encontro el equipo de postventa %', p_aftersales_device_id;
  end if;

  if v_device.sold_sale_id is not null then
    raise exception 'El equipo de postventa ya fue vendido';
  end if;

  if v_device.status <> 'defective_in_store' then
    raise exception 'Solo se puede vender desde postventa un equipo defectuoso en local';
  end if;

  if p_sales_channel_id is not null then
    if not exists (
      select 1
      from public.sales_channels sc
      where sc.id = p_sales_channel_id
        and sc.is_active = true
    ) then
      raise exception 'Canal invalido o inactivo: %', p_sales_channel_id;
    end if;
  end if;

  select *
    into v_variant
  from public.product_variants
  where id = v_device.variant_id
  for update;

  if not found then
    raise exception 'No se encontro la variante asociada al equipo de postventa';
  end if;

  if coalesce(v_variant.stock_defective, 0) < coalesce(v_device.quantity, 0) then
    raise exception
      'No hay stock defectuoso suficiente. Defectuoso actual %, requerido %',
      coalesce(v_variant.stock_defective, 0),
      coalesce(v_device.quantity, 0);
  end if;

  select *
    into v_product
  from public.products
  where id = v_variant.product_id;

  insert into public.sales (
    customer_id,
    seller_id,
    total_usd,
    total_ars,
    fx_rate_used,
    notes,
    payments,
    sales_channel_id,
    sale_date
  )
  values (
    p_customer_id,
    p_seller_id,
    p_total_usd,
    p_total_ars,
    p_fx_rate,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_payments,
    p_sales_channel_id,
    now() at time zone 'America/Argentina/Buenos_Aires'
  )
  returning id into v_sale_id;

  insert into public.sale_items (
    sale_id,
    variant_id,
    product_name,
    variant_name,
    color,
    storage,
    ram,
    usd_price,
    quantity,
    subtotal_usd,
    subtotal_ars,
    imei,
    commission_pct,
    commission_fixed
  )
  values (
    v_sale_id,
    v_variant.id,
    v_product.name,
    v_variant.variant_name,
    v_variant.color,
    v_variant.storage,
    v_variant.ram,
    p_unit_price_usd,
    v_device.quantity,
    p_unit_price_usd * v_device.quantity,
    p_total_ars,
    nullif(trim(coalesce(v_device.imei, '')), ''),
    v_product.commission_pct,
    v_product.commission_fixed
  )
  returning id into v_sale_item_id;

  if nullif(trim(coalesce(v_device.imei, '')), '') is not null then
    insert into public.sale_item_imeis (sale_item_id, imei)
    values (v_sale_item_id, trim(v_device.imei));
  end if;

  update public.product_variants
  set stock_defective = stock_defective - v_device.quantity,
      updated_at = now()
  where id = v_variant.id;

  for v_payment in
    select *
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    v_amount := coalesce(nullif(v_payment ->> 'amount', '')::numeric, 0);
    v_installments := nullif(v_payment ->> 'installments', '')::integer;
    v_reference := v_payment ->> 'reference';
    v_account_id := nullif(v_payment ->> 'account_id', '')::bigint;

    select name
      into v_payment_method_name
    from public.payment_methods
    where id = (v_payment ->> 'payment_method_id')::integer;

    if upper(coalesce(v_payment_method_name, '')) in ('USD', 'USDT') then
      v_amount_usd := v_amount;
      v_amount_ars := v_amount * p_fx_rate;
    else
      v_amount_ars := v_amount;
      v_amount_usd := null;
    end if;

    insert into public.sale_payments (
      sale_id,
      payment_method_id,
      amount_ars,
      amount_usd,
      installments,
      reference,
      account_id
    )
    values (
      v_sale_id,
      (v_payment ->> 'payment_method_id')::integer,
      v_amount_ars,
      v_amount_usd,
      v_installments,
      v_reference,
      v_account_id
    );
  end loop;

  update public.aftersales_devices
  set sold_sale_id = v_sale_id,
      sold_at = now(),
      include_in_stock_cost_balance = false,
      updated_at = now(),
      notes = concat(
        coalesce(notes, ''),
        case when nullif(trim(coalesce(notes, '')), '') is not null then ' | ' else '' end,
        'Vendido desde postventa en venta #',
        v_sale_id
      )
  where id = p_aftersales_device_id;

  return json_build_object('sale_id', v_sale_id);
end;
$function$;
