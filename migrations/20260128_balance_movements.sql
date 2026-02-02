-- Balance stage: account movements + payment-account links

create table if not exists public.account_movements (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  movement_date date not null default current_date,
  account_id bigint not null references public.accounts(id),
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric not null,
  currency text not null check (currency in ('ARS', 'USD')),
  amount_ars numeric,
  fx_rate_used numeric,
  related_table text,
  related_id bigint,
  notes text
);

create index if not exists account_movements_account_date_idx
  on public.account_movements (account_id, movement_date);
create index if not exists account_movements_related_idx
  on public.account_movements (related_table, related_id);

alter table public.sale_payments
  add column if not exists account_id bigint;
alter table public.sale_payments
  add constraint sale_payments_account_id_fkey
  foreign key (account_id) references public.accounts(id);

create table if not exists public.purchase_payments (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases(id) on delete cascade,
  account_id bigint not null references public.accounts(id),
  payment_method_id integer references public.payment_methods(id),
  amount numeric not null,
  currency text not null check (currency in ('ARS', 'USD')),
  amount_ars numeric,
  fx_rate_used numeric,
  created_at timestamp with time zone not null default now(),
  notes text
);

create index if not exists purchase_payments_purchase_idx
  on public.purchase_payments (purchase_id);
create index if not exists purchase_payments_account_idx
  on public.purchase_payments (account_id);

create or replace function public.sync_movement_from_sale_payment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.account_movements
      where related_table = 'sale_payments'
        and related_id = old.id;
    return old;
  end if;

  delete from public.account_movements
    where related_table = 'sale_payments'
      and related_id = new.id;

  if new.account_id is null then
    return new;
  end if;

  if new.amount_usd is not null and new.amount_usd <> 0 then
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
      new.account_id,
      'income',
      new.amount_usd,
      'USD',
      null,
      null,
      'sale_payments',
      new.id,
      null,
      coalesce(new.created_at::date, current_date)
    );
  else
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
      new.account_id,
      'income',
      new.amount_ars,
      'ARS',
      new.amount_ars,
      null,
      'sale_payments',
      new.id,
      null,
      coalesce(new.created_at::date, current_date)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sale_payments_movement on public.sale_payments;
create trigger trg_sale_payments_movement
after insert or update or delete on public.sale_payments
for each row execute function public.sync_movement_from_sale_payment();

create or replace function public.sync_movement_from_expense()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.account_movements
      where related_table = 'expenses'
        and related_id = old.id;
    return old;
  end if;

  delete from public.account_movements
    where related_table = 'expenses'
      and related_id = new.id;

  if new.account_id is null then
    return new;
  end if;

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
    new.account_id,
    'expense',
    new.amount,
    new.currency,
    new.amount_ars,
    new.fx_rate_used,
    'expenses',
    new.id,
    new.notes,
    new.expense_date
  );

  return new;
end;
$$;

drop trigger if exists trg_expenses_movement on public.expenses;
create trigger trg_expenses_movement
after insert or update or delete on public.expenses
for each row execute function public.sync_movement_from_expense();

create or replace function public.sync_movement_from_purchase_payment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.account_movements
      where related_table = 'purchase_payments'
        and related_id = old.id;
    return old;
  end if;

  delete from public.account_movements
    where related_table = 'purchase_payments'
      and related_id = new.id;

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
    new.account_id,
    'expense',
    new.amount,
    new.currency,
    new.amount_ars,
    new.fx_rate_used,
    'purchase_payments',
    new.id,
    new.notes,
    coalesce(new.created_at::date, current_date)
  );

  return new;
end;
$$;

drop trigger if exists trg_purchase_payments_movement on public.purchase_payments;
create trigger trg_purchase_payments_movement
after insert or update or delete on public.purchase_payments
for each row execute function public.sync_movement_from_purchase_payment();
