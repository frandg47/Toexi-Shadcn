-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.brands (
  id integer NOT NULL DEFAULT nextval('brands_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT brands_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.commission_payments (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  seller_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric NOT NULL,
  paid_at timestamp with time zone,
  notes text,
  CONSTRAINT commission_payments_pkey PRIMARY KEY (id),
  CONSTRAINT commission_payments_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.user_roles(id_auth)
);
CREATE TABLE public.commission_rules (
  id integer NOT NULL DEFAULT nextval('commission_rules_id_seq'::regclass),
  category_id integer,
  brand_id integer,
  commission_pct numeric,
  commission_fixed numeric,
  priority integer NOT NULL DEFAULT 100,
  CONSTRAINT commission_rules_pkey PRIMARY KEY (id),
  CONSTRAINT commission_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT commission_rules_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id)
);
CREATE TABLE public.customers (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  last_name text,
  dni text UNIQUE,
  phone text,
  email text,
  address text,
  city text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fx_rates (
  id integer NOT NULL DEFAULT nextval('fx_rates_id_seq'::regclass),
  source text,
  rate numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  created_at timestamp with time zone DEFAULT now(),
  created_by text,
  notes text,
  CONSTRAINT fx_rates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leads (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  referred_by uuid NOT NULL,
  customer_id integer,
  appointment_datetime timestamp with time zone,
  qr_code text UNIQUE,
  status text DEFAULT 'pendiente'::text,
  notes text,
  sale_id integer UNIQUE,
  interested_variants jsonb,
  product_status character varying DEFAULT 'en espera'::character varying,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.user_roles(id_auth),
  CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.payment_installments (
  id integer NOT NULL DEFAULT nextval('payment_installments_id_seq'::regclass),
  payment_method_id integer NOT NULL,
  installments integer NOT NULL,
  multiplier numeric NOT NULL,
  description text,
  CONSTRAINT payment_installments_pkey PRIMARY KEY (id),
  CONSTRAINT payment_installments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id)
);
CREATE TABLE public.payment_methods (
  id integer NOT NULL DEFAULT nextval('payment_methods_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  multiplier numeric NOT NULL DEFAULT 1,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_variants (
  id integer NOT NULL DEFAULT nextval('product_variants_id_seq'::regclass),
  product_id integer NOT NULL,
  storage text,
  ram text,
  color text,
  sku text UNIQUE,
  usd_price numeric,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  variant_name text DEFAULT ''::text,
  processor text,
  graphics_card text,
  screen_size text,
  resolution text,
  storage_type text,
  storage_capacity text,
  ram_type text,
  ram_frequency text,
  battery text,
  weight text,
  operating_system text,
  camera_main text,
  camera_front text,
  wholesale_price numeric,
  stock_defective integer NOT NULL DEFAULT 0,
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id integer NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  name text NOT NULL,
  brand_id integer,
  category_id integer NOT NULL,
  usd_price numeric,
  commission_pct numeric,
  commission_fixed numeric,
  allow_backorder boolean NOT NULL DEFAULT false,
  lead_time_label text,
  active boolean NOT NULL DEFAULT true,
  cover_image_url text,
  created_at timestamp without time zone DEFAULT now(),
  deposit_amount real,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.sale_item_imeis (
  id integer NOT NULL DEFAULT nextval('sale_item_imeis_id_seq'::regclass),
  sale_item_id integer NOT NULL,
  imei text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sale_item_imeis_pkey PRIMARY KEY (id),
  CONSTRAINT sale_item_imeis_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id)
);
CREATE TABLE public.sale_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sale_id bigint,
  variant_id integer,
  product_name text,
  variant_name text,
  color text,
  storage text,
  ram text,
  usd_price numeric,
  quantity integer,
  subtotal_usd numeric,
  subtotal_ars numeric,
  imei character varying DEFAULT NULL::character varying,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);
CREATE TABLE public.sale_payments (
  id bigint NOT NULL DEFAULT nextval('sale_payments_id_seq'::regclass),
  sale_id integer NOT NULL,
  method text CHECK (method = ANY (ARRAY['efectivo'::text, 'transferencia'::text, 'tarjeta'::text])),
  amount_ars numeric NOT NULL,
  amount_usd numeric,
  reference text,
  card_brand text,
  installments integer,
  created_at timestamp without time zone DEFAULT now(),
  payment_method_id integer,
  CONSTRAINT sale_payments_pkey PRIMARY KEY (id),
  CONSTRAINT sale_payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_payments_payment_method_fk FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id)
);
CREATE TABLE public.sales (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  customer_id integer,
  seller_id uuid,
  lead_id integer,
  total_usd numeric,
  total_ars numeric,
  fx_rate_used numeric,
  notes text,
  sale_date timestamp without time zone DEFAULT now(),
  status text DEFAULT '''vendido''::text'::text,
  payments jsonb,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  void_stock_bucket text CHECK (void_stock_bucket IS NULL OR (void_stock_bucket = ANY (ARRAY['available'::text, 'defective'::text]))),
  sales_channel_id integer,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT sales_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.user_roles(id_auth),
  CONSTRAINT sales_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id),
  CONSTRAINT sales_sales_channel_id_fkey FOREIGN KEY (sales_channel_id) REFERENCES public.sales_channels(id)
);
CREATE TABLE public.sales_channels (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_channels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  id_auth uuid NOT NULL,
  role text CHECK (role = ANY (ARRAY['superadmin'::text, 'owner'::text, 'seller'::text])),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id_auth)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  dni text,
  phone text,
  email text,
  role text CHECK (role = ANY (ARRAY['superadmin'::text, 'owner'::text, 'seller'::text])),
  last_name text,
  adress text,
  is_active boolean DEFAULT false,
  id_auth uuid DEFAULT gen_random_uuid() UNIQUE,
  avatar_url text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_auth_fkey FOREIGN KEY (id_auth) REFERENCES auth.users(id)
);