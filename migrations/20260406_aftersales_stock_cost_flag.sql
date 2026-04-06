alter table public.aftersales_devices
add column if not exists include_in_stock_cost_balance boolean not null default false;

create or replace function public.register_aftersales_device(
  p_variant_id integer,
  p_quantity integer default 1,
  p_imei text default null,
  p_notes text default null,
  p_include_in_stock_cost_balance boolean default false
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
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede registrar equipos en postventa';
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
    include_in_stock_cost_balance,
    created_by
  ) values (
    p_variant_id,
    'factory',
    nullif(trim(coalesce(p_imei, '')), ''),
    p_quantity,
    'defective_in_store',
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_include_in_stock_cost_balance, false),
    auth.uid()
  )
  returning id into device_id;

  return device_id;
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
  where id = p_aftersales_device_id;

  if not found then
    raise exception 'No se encontro el registro de postventa %', p_aftersales_device_id;
  end if;
end;
$function$;
