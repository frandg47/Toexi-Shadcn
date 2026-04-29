-- Stage 3: consume inventory_units in serialized sales and sale voids.

create or replace function public.create_sale_with_imeis(
  p_customer_id integer,
  p_seller_id uuid,
  p_lead_id integer,
  p_total_usd numeric,
  p_total_ars numeric,
  p_fx_rate numeric,
  p_notes text,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount numeric,
  p_items jsonb,
  p_payments jsonb,
  p_sales_channel_id integer
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale_id bigint;
  item jsonb;
  payment jsonb;
  v_sale_item_id bigint;
  product_stock integer;
  v_quantity integer;

  v_product_name text;
  v_variant_name text;
  v_color text;
  v_storage text;
  v_ram text;
  v_usd_price numeric;
  v_subtotal_usd numeric;
  v_subtotal_ars numeric;
  v_inventory_tracking_mode text;

  v_commission_pct numeric;
  v_commission_fixed numeric;

  v_payment_method_name text;
  v_amount numeric;
  v_amount_ars numeric;
  v_amount_usd numeric;
  v_installments integer;
  v_reference text;
  v_account_id bigint;

  imei_value text;
  v_inventory_unit_id bigint;
  v_inventory_unit public.inventory_units%rowtype;
  v_requested_units_count integer;
  v_distinct_units_count integer;
begin
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

  insert into public.sales (
    customer_id,
    seller_id,
    lead_id,
    total_usd,
    total_ars,
    fx_rate_used,
    notes,
    discount_type,
    discount_value,
    discount_amount,
    payments,
    sales_channel_id,
    sale_date
  )
  values (
    p_customer_id,
    p_seller_id,
    p_lead_id,
    p_total_usd,
    p_total_ars,
    p_fx_rate,
    p_notes,
    p_discount_type,
    p_discount_value,
    p_discount_amount,
    p_payments,
    p_sales_channel_id,
    now() at time zone 'America/Argentina/Buenos_Aires'
  )
  returning id into v_sale_id;

  for item in
    select *
    from jsonb_array_elements(p_items)
  loop
    select
      p.name,
      v.variant_name,
      v.color,
      v.storage,
      v.ram,
      v.usd_price,
      p.inventory_tracking_mode,
      p.commission_pct,
      p.commission_fixed
      into
        v_product_name,
        v_variant_name,
        v_color,
        v_storage,
        v_ram,
        v_usd_price,
        v_inventory_tracking_mode,
        v_commission_pct,
        v_commission_fixed
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = (item ->> 'variant_id')::integer;

    if v_usd_price is null then
      raise exception 'La variante % no tiene usd_price', (item ->> 'variant_id');
    end if;

    v_quantity := greatest(coalesce((item ->> 'quantity')::integer, 0), 0);
    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero para la variante %', (item ->> 'variant_id');
    end if;

    v_subtotal_usd := v_quantity * v_usd_price;
    v_subtotal_ars := v_subtotal_usd * p_fx_rate;

    select stock
      into product_stock
    from public.product_variants
    where id = (item ->> 'variant_id')::integer
    for update;

    if product_stock < v_quantity then
      raise exception 'Sin stock para variante %', (item ->> 'variant_id');
    end if;

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
      commission_pct,
      commission_fixed
    )
    values (
      v_sale_id,
      (item ->> 'variant_id')::integer,
      v_product_name,
      v_variant_name,
      v_color,
      v_storage,
      v_ram,
      v_usd_price,
      v_quantity,
      v_subtotal_usd,
      v_subtotal_ars,
      v_commission_pct,
      v_commission_fixed
    )
    returning id into v_sale_item_id;

    if coalesce(v_inventory_tracking_mode, 'quantity') = 'serial' then
      if not (item ? 'inventory_unit_ids') then
        raise exception 'Debes seleccionar unidades serializadas para la variante %', (item ->> 'variant_id');
      end if;

      if jsonb_typeof(item -> 'inventory_unit_ids') <> 'array' then
        raise exception 'inventory_unit_ids debe ser un arreglo para la variante %', (item ->> 'variant_id');
      end if;

      select jsonb_array_length(item -> 'inventory_unit_ids')
        into v_requested_units_count;

      select count(distinct value::bigint)
        into v_distinct_units_count
      from jsonb_array_elements_text(item -> 'inventory_unit_ids');

      if v_requested_units_count <> v_quantity or v_distinct_units_count <> v_quantity then
        raise exception 'La cantidad de unidades serializadas no coincide con la cantidad vendida para la variante %', (item ->> 'variant_id');
      end if;

      for v_inventory_unit_id in
        select value::bigint
        from jsonb_array_elements_text(item -> 'inventory_unit_ids')
      loop
        select *
          into v_inventory_unit
        from public.inventory_units
        where id = v_inventory_unit_id
        for update;

        if not found then
          raise exception 'No se encontro la unidad %', v_inventory_unit_id;
        end if;

        if v_inventory_unit.variant_id <> (item ->> 'variant_id')::integer then
          raise exception 'La unidad % no pertenece a la variante %', v_inventory_unit_id, (item ->> 'variant_id');
        end if;

        if v_inventory_unit.status <> 'available' then
          raise exception 'La unidad % ya no esta disponible', v_inventory_unit.identifier_value;
        end if;

        insert into public.sale_item_imeis (sale_item_id, imei, inventory_unit_id)
        values (v_sale_item_id, v_inventory_unit.identifier_value, v_inventory_unit.id);

        update public.inventory_units
        set status = 'sold',
            sale_id = v_sale_id,
            sale_item_id = v_sale_item_id,
            sold_at = now(),
            returned_at = null,
            updated_by = auth.uid()
        where id = v_inventory_unit.id;

        insert into public.inventory_unit_events (
          inventory_unit_id,
          event_type,
          from_status,
          to_status,
          related_table,
          related_id,
          notes,
          payload
        ) values (
          v_inventory_unit.id,
          'sale_created',
          'available',
          'sold',
          'sales',
          v_sale_id,
          null,
          jsonb_build_object(
            'sale_item_id', v_sale_item_id,
            'customer_id', p_customer_id
          )
        );
      end loop;
    elsif item ? 'imeis' then
      for imei_value in
        select nullif(trim(jsonb_array_elements_text(item -> 'imeis')), '')
      loop
        if imei_value is null then
          raise exception 'Todos los IMEIs deben estar completos';
        end if;

        if exists (
          select 1
          from public.sale_item_imeis sii
          join public.sale_items si on si.id = sii.sale_item_id
          join public.sales s on s.id = si.sale_id
          where sii.imei = imei_value
            and s.status <> 'anulado'
            and not exists (
              select 1
              from public.warranty_exchanges we
              left join public.aftersales_devices ad
                on ad.warranty_exchange_id = we.id
               and ad.imei = sii.imei
              where we.sale_item_id = si.id
                and we.original_imei = sii.imei
                and we.status = 'completed'
                and (
                  we.returned_stock_bucket = 'available'
                  or ad.status = 'repaired'
                )
            )
        ) then
          raise exception 'El IMEI % ya fue utilizado en otra venta activa', imei_value;
        end if;

        insert into public.sale_item_imeis (sale_item_id, imei)
        values (v_sale_item_id, imei_value);
      end loop;
    end if;

    update public.product_variants
    set stock = stock - v_quantity,
        updated_at = now()
    where id = (item ->> 'variant_id')::integer;
  end loop;

  for payment in
    select *
    from jsonb_array_elements(p_payments)
  loop
    v_amount := coalesce(nullif(payment ->> 'amount', '')::numeric, 0);
    v_installments := nullif(payment ->> 'installments', '')::integer;
    v_reference := payment ->> 'reference';
    v_account_id := nullif(payment ->> 'account_id', '')::bigint;

    select name
      into v_payment_method_name
    from public.payment_methods
    where id = (payment ->> 'payment_method_id')::integer;

    if upper(coalesce(v_payment_method_name, '')) = 'USD' then
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
      (payment ->> 'payment_method_id')::integer,
      v_amount_ars,
      v_amount_usd,
      v_installments,
      v_reference,
      v_account_id
    );
  end loop;

  return json_build_object('sale_id', v_sale_id);
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
  v_items_count integer;
  item_row record;
  v_serial_units_count integer;
  v_target_status text;
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
    and coalesce(quantity, 0) > 0;

  if v_items_count = 0 then
    raise exception 'Venta %: no hay sale_items con variant_id/quantity para reintegrar', p_sale_id;
  end if;

  v_target_status := case when p_bucket = 'available' then 'available' else 'defective' end;

  for item_row in
    select
      si.id,
      si.variant_id,
      coalesce(si.quantity, 0)::integer as quantity,
      coalesce(p.inventory_tracking_mode, 'quantity') as inventory_tracking_mode
    from public.sale_items si
    join public.product_variants pv on pv.id = si.variant_id
    join public.products p on p.id = pv.product_id
    where si.sale_id = p_sale_id
      and si.variant_id is not null
      and coalesce(si.quantity, 0) > 0
    for update of si
  loop
    if p_bucket = 'available' then
      update public.product_variants
      set stock = stock + item_row.quantity,
          updated_at = now()
      where id = item_row.variant_id;
    else
      update public.product_variants
      set stock_defective = stock_defective + item_row.quantity,
          updated_at = now()
      where id = item_row.variant_id;
    end if;

    if item_row.inventory_tracking_mode = 'serial' then
      select count(*)
        into v_serial_units_count
      from public.inventory_units
      where sale_item_id = item_row.id;

      if v_serial_units_count > 0 and v_serial_units_count <> item_row.quantity then
        raise exception 'Venta %: cantidad inconsistente de unidades serializadas para sale_item %', p_sale_id, item_row.id;
      end if;

      with moved_units as (
        update public.inventory_units
        set status = v_target_status,
            sale_id = null,
            sale_item_id = null,
            sold_at = null,
            returned_at = now(),
            updated_by = auth.uid()
        where sale_item_id = item_row.id
        returning id, identifier_value
      )
      insert into public.inventory_unit_events (
        inventory_unit_id,
        event_type,
        from_status,
        to_status,
        related_table,
        related_id,
        notes,
        payload
      )
      select
        id,
        'sale_voided',
        'sold',
        v_target_status,
        'sales',
        p_sale_id,
        p_reason,
        jsonb_build_object(
          'sale_item_id', item_row.id,
          'bucket', p_bucket
        )
      from moved_units;
    end if;
  end loop;

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
