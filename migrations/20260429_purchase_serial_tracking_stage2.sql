create or replace function public.create_purchase_with_inventory_units(
  p_provider_id bigint,
  p_purchase_date date,
  p_currency text,
  p_total_amount numeric,
  p_total_amount_ars numeric,
  p_fx_rate_used numeric,
  p_notes text,
  p_items jsonb,
  p_payments jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_purchase_id bigint;
  v_purchase_item_id bigint;
  v_item jsonb;
  v_payment jsonb;
  v_variant_id integer;
  v_quantity integer;
  v_unit_cost numeric;
  v_subtotal numeric;
  v_tracking_mode text;
  v_identifier text;
  v_identifier_count integer;
  v_received_at timestamp with time zone;
begin
  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede registrar compras';
  end if;

  if p_provider_id is null then
    raise exception 'p_provider_id es obligatorio';
  end if;

  if p_purchase_date is null then
    raise exception 'p_purchase_date es obligatorio';
  end if;

  if p_currency not in ('ARS', 'USD', 'USDT') then
    raise exception 'Moneda invalida: %', p_currency;
  end if;

  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'Debes enviar al menos un item';
  end if;

  v_received_at := p_purchase_date::timestamp at time zone 'America/Argentina/Buenos_Aires';

  insert into public.purchases (
    provider_id,
    purchase_date,
    currency,
    total_amount,
    total_amount_ars,
    fx_rate_used,
    notes,
    status
  ) values (
    p_provider_id,
    p_purchase_date,
    p_currency,
    p_total_amount,
    p_total_amount_ars,
    p_fx_rate_used,
    nullif(trim(coalesce(p_notes, '')), ''),
    'active'
  )
  returning id into v_purchase_id;

  for v_item in
    select *
    from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::integer;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_cost := coalesce((v_item ->> 'unit_cost')::numeric, 0);

    if v_variant_id is null then
      raise exception 'Todos los items deben tener variant_id';
    end if;

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero para la variante %', v_variant_id;
    end if;

    if v_unit_cost < 0 then
      raise exception 'El costo unitario no puede ser negativo para la variante %', v_variant_id;
    end if;

    select p.inventory_tracking_mode
      into v_tracking_mode
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if not found then
      raise exception 'No se encontro la variante %', v_variant_id;
    end if;

    v_subtotal := v_quantity * v_unit_cost;

    insert into public.purchase_items (
      purchase_id,
      variant_id,
      quantity,
      unit_cost,
      subtotal
    ) values (
      v_purchase_id,
      v_variant_id,
      v_quantity,
      v_unit_cost,
      v_subtotal
    )
    returning id into v_purchase_item_id;

    update public.product_variants
    set stock = coalesce(stock, 0) + v_quantity,
        updated_at = now()
    where id = v_variant_id;

    if v_tracking_mode = 'serial' then
      v_identifier_count := coalesce(jsonb_array_length(v_item -> 'identifiers'), 0);

      if v_identifier_count <> v_quantity then
        raise exception
          'La variante % requiere % IMEI/SN y se recibieron %',
          v_variant_id,
          v_quantity,
          v_identifier_count;
      end if;

      for v_identifier in
        select nullif(trim(jsonb_array_elements_text(v_item -> 'identifiers')), '')
      loop
        if v_identifier is null then
          raise exception 'Todos los IMEI/SN deben estar completos para la variante %', v_variant_id;
        end if;

        insert into public.inventory_units (
          variant_id,
          purchase_id,
          purchase_item_id,
          identifier_value,
          status,
          received_at,
          notes,
          updated_by
        ) values (
          v_variant_id,
          v_purchase_id,
          v_purchase_item_id,
          v_identifier,
          'available',
          v_received_at,
          'Ingreso por compra',
          auth.uid()
        );

        insert into public.inventory_unit_events (
          inventory_unit_id,
          event_type,
          from_status,
          to_status,
          related_table,
          related_id,
          notes
        )
        select
          iu.id,
          'purchase_received',
          null,
          'available',
          'purchases',
          v_purchase_id,
          'Ingreso inicial por compra'
        from public.inventory_units iu
        where iu.purchase_item_id = v_purchase_item_id
          and iu.identifier_value = v_identifier
        order by iu.id desc
        limit 1;
      end loop;
    end if;
  end loop;

  for v_payment in
    select *
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    insert into public.purchase_payments (
      purchase_id,
      account_id,
      payment_method_id,
      amount,
      currency,
      amount_ars,
      fx_rate_used,
      notes
    ) values (
      v_purchase_id,
      (v_payment ->> 'account_id')::bigint,
      nullif(v_payment ->> 'payment_method_id', '')::integer,
      coalesce((v_payment ->> 'amount')::numeric, 0),
      v_payment ->> 'currency',
      coalesce((v_payment ->> 'amount_ars')::numeric, 0),
      nullif(v_payment ->> 'fx_rate_used', '')::numeric,
      nullif(trim(coalesce(p_notes, '')), '')
    );
  end loop;

  return json_build_object('purchase_id', v_purchase_id);
end;
$function$;

create or replace function public.void_purchase(
  p_purchase_id bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  purchase_row public.purchases%rowtype;
  payment_row record;
  item_row record;
  current_stock numeric;
  available_units integer;
begin
  if p_purchase_id is null then
    raise exception 'p_purchase_id es obligatorio';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  if not public.is_owner_or_superadmin() then
    raise exception 'Solo owner o superadmin puede anular compras';
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
      pi.id,
      pi.variant_id,
      pi.quantity,
      p.inventory_tracking_mode
    from public.purchase_items pi
    join public.product_variants pv on pv.id = pi.variant_id
    join public.products p on p.id = pv.product_id
    where pi.purchase_id = p_purchase_id
  loop
    if item_row.inventory_tracking_mode = 'serial' then
      select count(*)
        into available_units
      from public.inventory_units iu
      where iu.purchase_item_id = item_row.id
        and iu.status = 'available';

      if available_units <> item_row.quantity then
        raise exception
          'No se puede anular la compra. La variante % tiene unidades serializadas que ya cambiaron de estado',
          item_row.variant_id;
      end if;

      update public.inventory_units
      set status = 'voided',
          updated_by = auth.uid(),
          notes = trim(concat_ws(' | ', nullif(notes, ''), format('Compra anulada: %s', trim(p_reason))))
      where purchase_item_id = item_row.id;

      insert into public.inventory_unit_events (
        inventory_unit_id,
        event_type,
        from_status,
        to_status,
        related_table,
        related_id,
        notes
      )
      select
        iu.id,
        'purchase_voided',
        'available',
        'voided',
        'purchases',
        p_purchase_id,
        trim(p_reason)
      from public.inventory_units iu
      where iu.purchase_item_id = item_row.id;
    end if;
  end loop;

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
$function$;
