drop index if exists public.idx_unique_imei_global;

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
  sale_id bigint;
  item jsonb;
  payment jsonb;
  sale_item_id bigint;
  product_stock integer;

  v_product_name text;
  v_variant_name text;
  v_color text;
  v_storage text;
  v_ram text;
  v_usd_price numeric;
  v_subtotal_usd numeric;
  v_subtotal_ars numeric;

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
  returning id into sale_id;

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
      p.commission_pct,
      p.commission_fixed
      into
        v_product_name,
        v_variant_name,
        v_color,
        v_storage,
        v_ram,
        v_usd_price,
        v_commission_pct,
        v_commission_fixed
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = (item ->> 'variant_id')::integer;

    if v_usd_price is null then
      raise exception 'La variante % no tiene usd_price', (item ->> 'variant_id');
    end if;

    v_subtotal_usd := (item ->> 'quantity')::integer * v_usd_price;
    v_subtotal_ars := v_subtotal_usd * p_fx_rate;

    select stock
      into product_stock
    from public.product_variants
    where id = (item ->> 'variant_id')::integer
    for update;

    if product_stock < (item ->> 'quantity')::integer then
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
      sale_id,
      (item ->> 'variant_id')::integer,
      v_product_name,
      v_variant_name,
      v_color,
      v_storage,
      v_ram,
      v_usd_price,
      (item ->> 'quantity')::integer,
      v_subtotal_usd,
      v_subtotal_ars,
      v_commission_pct,
      v_commission_fixed
    )
    returning id into sale_item_id;

    if item ? 'imeis' then
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
        values (sale_item_id, imei_value);
      end loop;
    end if;

    update public.product_variants
    set stock = stock - (item ->> 'quantity')::integer,
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
      sale_id,
      (payment ->> 'payment_method_id')::integer,
      v_amount_ars,
      v_amount_usd,
      v_installments,
      v_reference,
      v_account_id
    );
  end loop;

  return json_build_object('sale_id', sale_id);
end;
$function$;
