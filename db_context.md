# 🧩 Base de Datos – Sistema Financiero / Gestión Comercial

> ⚠️ **Aviso:** Este esquema es solo para contexto y documentación.  
> No debe ejecutarse directamente, ya que el orden de tablas y constraints puede no ser válido para ejecución.

---

## 🏷️ Tabla: `brands`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador único. |
| name | text (UNIQUE) | Nombre de la marca. |

🔗 **Relaciones:**
- Referenciada por `products.brand_id`
- Referenciada por `commission_rules.brand_id`

---

## 📂 Tabla: `categories`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador único. |
| name | text (UNIQUE) | Nombre de la categoría. |

🔗 **Relaciones:**
- Referenciada por `products.category_id`
- Referenciada por `commission_rules.category_id`

---

## 💰 Tabla: `commission_rules`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador de la regla. |
| category_id | integer (FK → categories.id) | Categoría asociada. |
| brand_id | integer (FK → brands.id) | Marca asociada. |
| commission_pct | numeric | Porcentaje de comisión. |
| commission_fixed | numeric | Comisión fija. |
| priority | integer | Prioridad de aplicación (por defecto: 100). |

🧠 **Notas:**
- Permite definir reglas de comisión variables según marca o categoría.
- Se puede establecer prioridad entre reglas.

---

## 💱 Tabla: `fx_rates`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador. |
| source | text | Fuente del tipo de cambio (ej: “oficial”, “blue”, “manual”). |
| rate | numeric | Valor del tipo de cambio. |
| is_active | boolean (default true) | Indica si el tipo de cambio está activo. |
| updated_at | timestamp | Última actualización. |

---

## 📦 Tabla: `inventory`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| product_id | integer (PK, FK → products.id) | Producto asociado. |
| stock | integer | Cantidad disponible. |
| updated_at | timestamp | Fecha de última actualización. |

---

## 💳 Tabla: `payment_methods`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador. |
| name | text (UNIQUE) | Nombre del método (efectivo, transferencia, etc.). |
| multiplier | numeric (default 1) | Factor multiplicador para cálculos financieros. |

---

## 🛒 Tabla: `products`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador del producto. |
| name | text | Nombre del producto. |
| brand_id | integer (FK → brands.id) | Marca asociada. |
| category_id | integer (FK → categories.id) | Categoría del producto. |
| usd_price | numeric | Precio en USD. |
| commission_pct | numeric | Porcentaje de comisión específico. |
| commission_fixed | numeric | Comisión fija específica. |
| allow_backorder | boolean (default false) | Permite venta sin stock. |
| lead_time_label | text | Texto de tiempo de entrega o disponibilidad. |
| active | boolean (default true) | Indica si está activo. |
| cover_image_url | text | Imagen principal del producto. |
| created_at | timestamp | Fecha de creación. |

🔗 **Relaciones:**
- Referenciado por `inventory.product_id`
- Referenciado por `sales.product_id`

---

## 👤 Tabla: `profiles`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | uuid (PK, FK → auth.users.id) | ID del usuario autenticado. |
| role | text (admin / viewer) | Rol del usuario dentro del sistema. |
| created_at | timestamp | Fecha de creación. |
| username | text | Nombre visible o alias. |

---

## 🧾 Tabla: `sales`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | integer (PK) | Identificador de la venta. |
| product_id | integer (FK → products.id) | Producto vendido. |
| user_id | uuid (FK → auth.users.id / profiles.id) | Usuario que realizó la venta. |
| quantity | integer | Cantidad vendida. |
| unit_price | numeric | Precio unitario. |
| total | numeric | Total (quantity * unit_price). |
| payment_method_id | integer (FK → payment_methods.id) | Método de pago utilizado. |
| sale_date | timestamp | Fecha de la venta. |

🔗 **Relaciones:**
- `sales.product_id` → `products.id`
- `sales.payment_method_id` → `payment_methods.id`
- `sales.user_id` → `profiles.id`

---

## 🧍 Tabla: `users`
| Columna | Tipo | Descripción |
|----------|------|--------------|
| id | bigint (PK, identity) | Identificador interno. |
| created_at | timestamp | Fecha de creación. |
| name | text | Nombre del usuario. |
| last_name | text | Apellido. |
| dni | text | Documento. |
| phone | text | Teléfono. |
| email | text | Correo electrónico. |
| role | text | Rol (ej. empleado, cliente). |
| adress | text | Dirección. |
| state | boolean | Estado (activo/inactivo). |
| id_auth | uuid (FK → auth.users.id) | ID del usuario autenticado. |

---

## 🔗 Relaciones principales (resumen)
- **brands** ↔ **products** (1:N)  
- **categories** ↔ **products** (1:N)  
- **commission_rules** ↔ **brands / categories** (opcional N:1)  
- **products** ↔ **inventory / sales** (1:N)  
- **payment_methods** ↔ **sales** (1:N)  
- **auth.users / profiles / sales** relacionados mediante claves UUID  
- **fx_rates** independiente (configuración global)

---

## 🧠 Ejemplos de consultas útiles

**Obtener stock y nombre de producto:**
```sql
SELECT p.name, i.stock
FROM products p
JOIN inventory i ON i.product_id = p.id;
