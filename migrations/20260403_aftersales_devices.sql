create table if not exists public.aftersales_devices (
  id bigint generated always as identity primary key,
  variant_id integer not null references public.product_variants(id),
  sale_id bigint references public.sales(id),
  warranty_exchange_id bigint references public.warranty_exchanges(id),
  source_type text not null
    check (source_type in ('factory', 'warranty')),
  imei text,
  quantity integer not null default 1,
  status text not null default 'defective_in_store'
    check (status in ('defective_in_store', 'in_repair', 'repaired')),
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists aftersales_devices_variant_id_idx
  on public.aftersales_devices (variant_id);

create index if not exists aftersales_devices_status_idx
  on public.aftersales_devices (status);

create index if not exists aftersales_devices_sale_id_idx
  on public.aftersales_devices (sale_id);

create or replace function public.register_aftersales_device(
  p_variant_id integer,
  p_quantity integer default 1,
  p_imei text default null,
  p_notes text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_stock integer;
  device_id bigint;
begin
  if not public.is_owner() then
    raise exception 'Solo owner puede registrar equipos en postventa';
  end if;

  if p_variant_id is null then
    raise exception 'p_variant_id es obligatorio';
  end if;

  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select coalesce(stock, 0)
    into current_stock
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'No se encontro la variante %', p_variant_id;
  end if;

  if current_stock < p_quantity then
    raise exception
      'No hay stock suficiente para mover a postventa. Stock actual %, requerido %',
      current_stock,
      p_quantity;
  end if;

  update public.product_variants
  set stock = coalesce(stock, 0) - p_quantity,
      stock_defective = coalesce(stock_defective, 0) + p_quantity,
      updated_at = now()
  where id = p_variant_id;

  insert into public.aftersales_devices (
    variant_id,
    source_type,
    imei,
    quantity,
    status,
    notes,
    created_by
  ) values (
    p_variant_id,
    'factory',
    nullif(trim(coalesce(p_imei, '')), ''),
    p_quantity,
    'defective_in_store',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into device_id;

  return device_id;
end;
$function$;

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
  if not public.is_owner() then
    raise exception 'Solo owner puede actualizar postventa';
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

create or replace function public.process_warranty_exchange(
  p_sale_id bigint,
  p_sale_item_id bigint,
  p_return_bucket text,
  p_replacement_variant_id integer,
  p_reason text,
  p_notes text default null,
  p_replacement_imei text default null
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
  warranty_id bigint;
  item_quantity integer;
  original_imei_value text;
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

  select p.active
    into replacement_product_active
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
    created_by
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
    auth.uid()
  )
  returning id into warranty_id;

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
