import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconCreditCard,
  IconEdit,
  IconHomeDollar,
  IconRefresh,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import DialogProduct from "../components/DialogProduct";
import { Icon } from "lucide-react";

const TABLE_COLUMNS = [
  { id: "image", label: "Imagen" },
  { id: "name", label: "Producto" },
  { id: "brand", label: "Marca" },
  { id: "stock", label: "Stock" },
  { id: "usd_price", label: "Precio USD" },
  { id: "cash_price", label: "Efectivo / Transfer" },
  { id: "payment_methods", label: "Metodos de pago" },
  { id: "commission", label: "Comision" },
  { id: "actions", label: "Acciones" },
];

const DEFAULT_FX_RATE = 1000;
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/80?text=Producto";



const SAMPLE_PAYMENT_METHODS = [
  { id: "cash", name: "Efectivo / Transfer", multiplier: 1 },
  { id: "visa", name: "Visa Credito", multiplier: 1.05 },
  { id: "mastercard", name: "Mastercard Credito", multiplier: 1.08 },
];

const currencyFormatterARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const currencyFormatterUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const percentageFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

const formatCurrencyARS = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return currencyFormatterARS.format(Number(value));
};

const formatCurrencyUSD = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return currencyFormatterUSD.format(Number(value));
};

const formatPercentage = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return percentageFormatter.format(Number(value)) + "%";
};

const getProductInitials = (name) => {
  if (!name) return "PR";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// const buildSampleProduct = (product, rate) => {
//   const usdPrice = Number(product.usd_price) || 0;
//   const commissionPct = product.commission_pct ?? null;
//   const commissionAmountUSD =
//     commissionPct === null ? null : (usdPrice * commissionPct) / 100;

//   return {
//     id: product.id,
//     name: product.name,
//     coverImageUrl: product.cover_image_url,
//     brandName: product?.brands?.name ?? "Marca demo",
//     stock: product?.inventory?.stock ?? 0,
//     usdPrice,
//     commissionPct,
//     commissionAmountUSD,
//     paymentOptions: SAMPLE_PAYMENT_METHODS.map((method) => ({
//       id: method.id,
//       name: method.name,
//       multiplier: method.multiplier,
//       priceARS: usdPrice * rate * method.multiplier,
//     })),
//   };
// };

const ProductsTable = ({ refreshToken = 0 }) => {
  const [visibleColumns, setVisibleColumns] = useState(
    TABLE_COLUMNS.map((column) => column.id)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [productDialog, setProductDialog] = useState({
    open: false,
    product: null,
  });

  const fetchProducts = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);

    try {
      // Consultas paralelas
      const [fxRatesRes, paymentMethodsRes, productsRes, commissionRulesRes] =
        await Promise.all([
          supabase
            .from("fx_rates")
            .select("id, rate, is_active")
            .order("is_active", { ascending: false }),
          supabase
            .from("payment_methods")
            .select("id, name, multiplier")
            .order("name"),
          supabase
            .from("products")
            .select(
              `
            id,
            name,
            brand_id,
            category_id,
            usd_price,
            commission_pct,
            commission_fixed,
            cover_image_url,
            brands(name),
            inventory(stock),
            allow_backorder,
            lead_time_label,
            active
          `
            )
            .order("name"),
          supabase
            .from("commission_rules")
            .select(
              `id, brand_id, category_id, commission_pct, commission_fixed, priority`
            )
            .order("priority", { ascending: true }),
        ]);

      // Cotización activa
      let currentFxRate = DEFAULT_FX_RATE;
      if (fxRatesRes?.data?.length) {
        const activeRate =
          fxRatesRes.data.find((r) => r.is_active) ?? fxRatesRes.data[0];
        currentFxRate = Number(activeRate.rate) || DEFAULT_FX_RATE;
      }

      const paymentMethods = paymentMethodsRes?.data?.length
        ? paymentMethodsRes.data
        : SAMPLE_PAYMENT_METHODS;

      const rules = commissionRulesRes?.data ?? [];

      const rawProducts = productsRes?.data?.length
        && productsRes.data;

      // --- 💡 Función que devuelve la mejor comisión para un producto
      // --- 💡 Función que devuelve la mejor comisión para un producto
      const findCommissionForProduct = (product) => {
        // 1️⃣ Si el producto tiene comisión propia
        if (
          product.commission_pct != null ||
          product.commission_fixed != null
        ) {
          return {
            pct: product.commission_pct ?? null,
            fixed: product.commission_fixed ?? null,
            source: "Producto",
            priority: 0,
          };
        }

        // 2️⃣ Filtrar todas las reglas que aplican por marca o categoría
        const applicableRules = rules.filter((rule) => {
          const matchesBrand =
            rule.brand_id && rule.brand_id === product.brand_id;
          const matchesCategory =
            rule.category_id && rule.category_id === product.category_id;
          const globalRule = !rule.brand_id && !rule.category_id; // regla general (sin marca ni categoría)
          return matchesBrand || matchesCategory || globalRule;
        });

        if (applicableRules.length === 0) return null;

        // 3️⃣ Ordenar las reglas por prioridad (menor número = más prioridad)
        applicableRules.sort((a, b) => a.priority - b.priority);

        // 4️⃣ Tomar la regla más prioritaria
        const best = applicableRules[0];

        return {
          pct: best.commission_pct ?? null,
          fixed: best.commission_fixed ?? null,
          source: "Regla",
          priority: best.priority,
        };
      };

      // --- Construcción de productos
      const preparedProducts = rawProducts.map((product) => {
        const usdPrice = Number(product.usd_price) || 0;
        const commission = findCommissionForProduct(product);
        const pct = commission?.pct ?? null;
        const fixed = commission?.fixed ?? null;

        return {
          id: product.id,
          name: product.name,
          coverImageUrl: product.cover_image_url || PLACEHOLDER_IMAGE,
          brand_id: product.brand_id, // 👈 agregado
          category_id: product.category_id, // 👈 agregado
          brandName: product?.brands?.name ?? "Sin marca",
          stock: product?.inventory?.stock ?? 0,
          usdPrice,
          commissionPct: pct,
          commissionFixed: fixed,
          commissionAmountUSD:
            fixed !== null
              ? fixed
              : pct !== null
              ? (usdPrice * pct) / 100
              : null,
          allowBackorder: product.allow_backorder ?? false,
          leadTimeLabel: product.lead_time_label ?? "",
          active: product.active ?? true,
          paymentOptions: paymentMethods.map((method) => ({
            id: method.id,
            name: method.name,
            multiplier: method.multiplier,
            priceARS: usdPrice * currentFxRate * method.multiplier,
          })),
        };
      });

      setFxRate(currentFxRate);
      setProducts(preparedProducts);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los productos", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(refreshToken === 0);
  }, [fetchProducts, refreshToken]);

  const handleRefresh = () => fetchProducts(false);

  const handleColumnToggle = (columnId) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== columnId);
      }
      return [...prev, columnId];
    });
  };

  const handleDelete = useCallback(async (product) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Eliminar ${product.name}?`,
      text: "Esta accion estara disponible proximamente.",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#ef4444",
    });

    if (result.isConfirmed) {
      Swal.fire({
        icon: "info",
        title: "Eliminar producto",
        text: "La eliminacion de productos aun esta en desarrollo.",
      });
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) => {
      const nameMatch = product.name?.toLowerCase().includes(term);
      const brandMatch = product.brandName?.toLowerCase().includes(term);
      return nameMatch || brandMatch;
    });
  }, [products, searchTerm]);

  const columnCount = Math.max(visibleColumns.length, 1);
  const isEmpty = !loading && filteredProducts.length === 0;

  return (
    <>
      <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-md border border-green-500 bg-gray-200/20 p-3 text-xl">
          <IconHomeDollar className="h-6 w-6 text-green-500" />
          Cotizacion actual del USD: {formatCurrencyARS(fxRate)}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar por producto o marca..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="sm:w-72"
          />

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Columnas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {TABLE_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visibleColumns.includes(column.id)}
                    onCheckedChange={() => handleColumnToggle(column.id)}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <IconRefresh
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refrescar
            </Button>
            <Button
              onClick={() => setProductDialog({ open: true, product: null })}
            >
              <IconPlus className="h-4 w-4" />
              Agregar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_COLUMNS.filter((column) =>
                  visibleColumns.includes(column.id)
                ).map((column) => (
                  <TableHead key={column.id}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <div className="grid gap-2">
                      {[...Array(3)].map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {isEmpty && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No hay productos disponibles.
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                filteredProducts.map((product) => {
                  const cashPriceARS = product.usdPrice * fxRate;
                  const paymentColumnVisible =
                    visibleColumns.includes("payment_methods");

                  return (
                    <TableRow key={product.id}>
                      {visibleColumns.includes("image") && (
                        <TableCell className="w-[70px]">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={product?.coverImageUrl}
                              alt={product.name}
                            />
                            <AvatarFallback>
                              {getProductInitials(product.name)}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                      )}

                      {visibleColumns.includes("name") && (
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("brand") && (
                        <TableCell>
                          <Badge variant="outline">{product.brandName}</Badge>
                        </TableCell>
                      )}

                      {visibleColumns.includes("stock") && (
                        <TableCell>
                          {product.stock === 0 && product.allowBackorder ? (
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium text-amber-600">
                                Pedido
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {product.leadTimeLabel || "Sin plazo"}
                              </span>
                            </div>
                          ) : (
                            product.stock
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.includes("usd_price") && (
                        <TableCell>
                          {formatCurrencyUSD(product.usdPrice)}
                        </TableCell>
                      )}

                      {visibleColumns.includes("cash_price") && (
                        <TableCell>{formatCurrencyARS(cashPriceARS)}</TableCell>
                      )}

                      {paymentColumnVisible && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                              >
                                <IconCreditCard className="h-4 w-4" />
                                Metodos ({product.paymentOptions.length})
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              <DropdownMenuLabel>
                                Montos estimados
                              </DropdownMenuLabel>
                              {product.paymentOptions.map((method) => (
                                <DropdownMenuItem
                                  key={method.id}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span>{method.name}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {formatCurrencyARS(method.priceARS)}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}

                      {visibleColumns.includes("commission") && (
                        <TableCell>
                          {product.commissionPct === null &&
                          product.commissionFixed === null ? (
                            "-"
                          ) : (
                            <div className="space-y-1">
                              {product.commissionPct && (
                                <div>
                                  {formatPercentage(product.commissionPct)}
                                </div>
                              )}
                              {product.commissionFixed && (
                                <div>
                                  {formatCurrencyUSD(product.commissionFixed)}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                {product.commissionSource === "Regla"
                                  ? `Regla (prioridad ${product.commissionPriority})`
                                  : "Definido en producto"}
                              </div>
                            </div>
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.includes("actions") && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setProductDialog({ open: true, product })
                              }
                              disabled={refreshing}
                            >
                              <IconEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(product)}
                              disabled={refreshing}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
      <DialogProduct
        open={productDialog.open}
        onClose={() => setProductDialog({ open: false, product: null })}
        product={productDialog.product}
        onSave={handleRefresh}
      />
    </>
  );
};

export default ProductsTable;
