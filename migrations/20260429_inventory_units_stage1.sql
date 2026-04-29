alter table public.products
add column if not exists inventory_tracking_mode text not null default 'quantity';

alter table public.products
drop constraint if exists products_inventory_tracking_mode_check;

alter table public.products
add constraint products_inventory_tracking_mode_check
check (inventory_tracking_mode in ('quantity', 'serial'));

create table if not exists public.inventory_units (
  id bigint generated always as identity primary key,
  variant_id integer not null references public.product_variants(id),
  purchase_id bigint references public.purchases(id),
  purchase_item_id bigint references public.purchase_items(id),
  sale_id bigint references public.sales(id),
  sale_item_id bigint references public.sale_items(id),
  warranty_exchange_id bigint references public.warranty_exchanges(id),
  identifier_value text not null,
  identifier_normalized text generated always as (
    nullif(
      lower(
        regexp_replace(
          btrim(coalesce(identifier_value, '')),
          '[^[:alnum:]]',
          '',
          'g'
        )
      ),
      ''
    )
  ) stored,
  status text not null default 'available',
  received_at timestamp with time zone not null default now(),
  sold_at timestamp with time zone,
  returned_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  constraint inventory_units_status_check
    check (
      status in (
        'available',
        'reserved',
        'sold',
        'defective',
        'in_repair',
        'returned_available',
        'returned_defective',
        'warranty_hold',
        'voided'
      )
    )
);

create unique index if not exists inventory_units_identifier_normalized_uidx
  on public.inventory_units (identifier_normalized)
  where identifier_normalized is not null;

create index if not exists inventory_units_variant_id_idx
  on public.inventory_units (variant_id);

create index if not exists inventory_units_purchase_item_id_idx
  on public.inventory_units (purchase_item_id);

create index if not exists inventory_units_sale_item_id_idx
  on public.inventory_units (sale_item_id);

create index if not exists inventory_units_status_idx
  on public.inventory_units (status);

create table if not exists public.inventory_unit_events (
  id bigint generated always as identity primary key,
  inventory_unit_id bigint not null references public.inventory_units(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  related_table text,
  related_id bigint,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists inventory_unit_events_unit_id_idx
  on public.inventory_unit_events (inventory_unit_id, created_at desc);

alter table public.sale_item_imeis
add column if not exists inventory_unit_id bigint references public.inventory_units(id);

create or replace function public.set_inventory_units_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_inventory_units_updated_at on public.inventory_units;

create trigger trg_inventory_units_updated_at
before update on public.inventory_units
for each row
execute function public.set_inventory_units_updated_at();
