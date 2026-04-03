create table if not exists public.warranty_exchanges (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.sales(id),
  sale_item_id bigint not null references public.sale_items(id),
  original_variant_id integer references public.product_variants(id),
  original_imei text,
  quantity integer not null default 1,
  returned_stock_bucket text not null
    check (returned_stock_bucket in ('available', 'defective')),
  replacement_variant_id integer not null references public.product_variants(id),
  replacement_imei text,
  reason text not null,
  notes text,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists warranty_exchanges_sale_id_idx
  on public.warranty_exchanges (sale_id);

create index if not exists warranty_exchanges_sale_item_id_idx
  on public.warranty_exchanges (sale_item_id);

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
    nullif(trim(coalesce(sale_item_row.imei, '')), ''),
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

  return warranty_id;
end;
$function$;
