alter table public.purchases
add column if not exists status text not null default 'active',
add column if not exists void_reason text,
add column if not exists voided_at timestamp with time zone;

alter table public.purchases
drop constraint if exists purchases_status_check;

alter table public.purchases
add constraint purchases_status_check
check (status in ('active', 'cancelled'));

create or replace function public.void_purchase(
  p_purchase_id bigint,
  p_reason text
)
returns void
language plpgsql
as $$
declare
  purchase_row public.purchases%rowtype;
  payment_row record;
  item_row record;
  current_stock numeric;
begin
  if p_purchase_id is null then
    raise exception 'p_purchase_id es obligatorio';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  select *
    into purchase_row
  from public.purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'No se encontro la compra %', p_purchase_id;
  end if;

  if purchase_row.status = 'cancelled' then
    raise exception 'La compra % ya fue anulada', p_purchase_id;
  end if;

  for item_row in
    select
      pi.variant_id,
      sum(pi.quantity)::numeric as total_quantity
    from public.purchase_items pi
    where pi.purchase_id = p_purchase_id
    group by pi.variant_id
  loop
    select coalesce(pv.stock, 0)
      into current_stock
    from public.product_variants pv
    where pv.id = item_row.variant_id
    for update;

    if current_stock < item_row.total_quantity then
      raise exception
        'No hay stock suficiente para anular la compra. Variante %, stock actual %, a revertir %',
        item_row.variant_id,
        current_stock,
        item_row.total_quantity;
    end if;

    update public.product_variants
    set stock = coalesce(stock, 0) - item_row.total_quantity
    where id = item_row.variant_id;
  end loop;

  for payment_row in
    select
      pp.id,
      pp.account_id,
      pp.amount,
      pp.currency,
      pp.amount_ars,
      pp.fx_rate_used
    from public.purchase_payments pp
    where pp.purchase_id = p_purchase_id
      and pp.account_id is not null
  loop
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
      payment_row.account_id,
      'income',
      payment_row.amount,
      payment_row.currency,
      payment_row.amount_ars,
      payment_row.fx_rate_used,
      'purchase_reversal',
      payment_row.id,
      format('Anulacion de compra #%s | Motivo: %s', p_purchase_id, trim(p_reason)),
      purchase_row.purchase_date
    );
  end loop;

  update public.purchases
  set
    status = 'cancelled',
    void_reason = trim(p_reason),
    voided_at = now()
  where id = p_purchase_id;
end;
$$;
