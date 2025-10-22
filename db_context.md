# 📘 Database Context — Financial & Product Management System

## 🗂️ Overview
Este esquema pertenece a un sistema de **gestión de productos, ventas, comisiones y tipos de cambio**.  
Las entidades principales incluyen productos, variantes, marcas, categorías, reglas de comisión, ventas y usuarios.

---

## 🧩 Tables & Relationships

### 1. `brands`
Registra las **marcas de productos**.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador único |
| `name` | text | UNIQUE, NOT NULL | Nombre de la marca |

---

### 2. `categories`
Agrupa los productos por **categoría o tipo**.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador único |
| `name` | text | UNIQUE, NOT NULL | Nombre de la categoría |

---

### 3. `commission_rules`
Define **reglas globales o por categoría/marca** para el cálculo de comisiones.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador único |
| `category_id` | integer | FK → `categories.id` | Regla aplicable a una categoría |
| `brand_id` | integer | FK → `brands.id` | Regla aplicable a una marca |
| `commission_pct` | numeric |  | Porcentaje de comisión |
| `commission_fixed` | numeric |  | Comisión fija en USD |
| `priority` | integer | DEFAULT 100 | Prioridad de la regla (menor número = mayor prioridad) |

> 💡 Si un producto tiene comisión propia, prevalece sobre las reglas globales.

---

### 4. `fx_rates`
Guarda los **tipos de cambio** utilizados en operaciones.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `source` | text |  | Fuente del tipo de cambio (ej. API, manual) |
| `rate` | numeric | NOT NULL | Valor de cotización |
| `is_active` | boolean | DEFAULT true | Estado activo/inactivo |
| `updated_at` | timestamp | DEFAULT now() | Fecha de última actualización |
| `created_at` | timestamp | DEFAULT now() | Fecha de creación |
| `created_by` | text |  | Usuario que registró |
| `notes` | text |  | Observaciones |

---

### 5. `payment_methods`
Contiene los **métodos de pago** disponibles.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `name` | text | UNIQUE, NOT NULL | Nombre (efectivo, transferencia, etc.) |
| `multiplier` | numeric | DEFAULT 1 | Factor de ajuste del monto (intereses, descuentos) |

---

### 6. `payment_installments`
Define los **planes en cuotas** asociados a un método de pago.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `payment_method_id` | integer | FK → `payment_methods.id` | Método de pago asociado |
| `installments` | integer | NOT NULL | Cantidad de cuotas |
| `multiplier` | numeric | NOT NULL | Multiplicador del total |
| `description` | text |  | Texto descriptivo del plan |

---

### 7. `products`
Tabla principal de **productos**.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `name` | text | NOT NULL | Nombre del producto |
| `brand_id` | integer | FK → `brands.id` | Marca del producto |
| `category_id` | integer | FK → `categories.id` | Categoría del producto |
| `usd_price` | numeric | NOT NULL | Precio base en USD |
| `commission_pct` | numeric |  | Comisión individual (si aplica) |
| `commission_fixed` | numeric |  | Comisión fija (si aplica) |
| `allow_backorder` | boolean | DEFAULT false | Permitir venta sin stock |
| `lead_time_label` | text |  | Tiempo de entrega estimado |
| `active` | boolean | DEFAULT true | Estado activo/inactivo |
| `cover_image_url` | text |  | Imagen principal |
| `created_at` | timestamp | DEFAULT now() | Fecha de creación |

---

### 8. `product_variants`
Gestiona las **variantes de productos** (color, almacenamiento, RAM, etc.).

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `product_id` | integer | FK → `products.id` | Producto al que pertenece |
| `storage` | text |  | Capacidad (GB, TB) |
| `ram` | text |  | Memoria RAM |
| `color` | text |  | Color de la variante |
| `sku` | text | UNIQUE | Código SKU único |
| `usd_price` | numeric |  | Precio en USD (puede diferir del principal) |
| `stock` | integer | DEFAULT 0 | Stock disponible |
| `image_url` | text |  | Imagen de la variante |
| `active` | boolean | DEFAULT true | Estado |
| `created_at` | timestamp | DEFAULT now() | Fecha de creación |
| `updated_at` | timestamp | DEFAULT now() | Última actualización |
| `variant_name` | text | DEFAULT '' | Nombre amigable (ej. “128GB Azul”) |

---

### 9. `profiles`
Guarda los **perfiles de usuario internos** vinculados a `auth.users`.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | uuid | PK, FK → `auth.users.id` | Identificador del usuario |
| `role` | text | CHECK ('admin', 'viewer') | Rol del usuario |
| `created_at` | timestamp | DEFAULT now() | Fecha de creación |
| `username` | text |  | Alias o nombre de usuario |

---

### 10. `sales`
Registra todas las **ventas realizadas**.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | integer | PK | Identificador |
| `product_id` | integer | FK → `products.id` | Producto vendido |
| `variant_id` | integer | FK → `product_variants.id` | Variante seleccionada |
| `user_id` | uuid | FK → `auth.users.id` y `profiles.id` | Vendedor o usuario responsable |
| `quantity` | integer | DEFAULT 1 | Cantidad vendida |
| `unit_price` | numeric | NOT NULL | Precio unitario |
| `total` | numeric | Computed: `quantity * unit_price` | Total de la venta |
| `payment_method_id` | integer | FK → `payment_methods.id` | Método de pago usado |
| `sale_date` | timestamp | DEFAULT now() | Fecha de la venta |

---

### 11. `users`
Registra **usuarios externos o clientes** vinculados a `auth.users`.

| Column | Type | Constraints | Description |
|--------|------|--------------|-------------|
| `id` | bigint | PK | Identificador interno |
| `created_at` | timestamptz | DEFAULT now() | Fecha de alta |
| `name` | text |  | Nombre del cliente |
| `last_name` | text |  | Apellido |
| `dni` | text |  | Documento |
| `phone` | text |  | Teléfono |
| `email` | text |  | Correo electrónico |
| `role` | text |  | Rol del usuario |
| `adress` | text |  | Dirección |
| `is_active` | boolean | DEFAULT false | Estado de habilitación |
| `id_auth` | uuid | UNIQUE, FK → `auth.users.id` | Identificador de autenticación |

---