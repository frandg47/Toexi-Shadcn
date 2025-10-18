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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconCreditCard,
  IconEdit,
  IconHomeDollar,
  IconRefresh,
  IconTrash,
  IconPlus,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import DialogProduct from "../components/DialogProduct";

const TABLE_COLUMNS = [
  { id: "image", label: "Imagen" },
  { id: "name", label: "Producto" },
  { id: "brand", label: "Marca" },
  { id: "stock", label: "Stock" },
  { id: "usd_price", label: "Precio USD" },
  { id: "cash_price", label: "Efec/Transf" },
  { id: "payment_methods", label: "Métodos de pago" },
  { id: "commission", label: "Comisión" },
  { id: "actions", label: "Acciones" },
];

const DEFAULT_FX_RATE = "cargando...";
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/80?text=Producto";

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

const formatCurrencyARS = (v) =>
  v == null || Number.isNaN(Number(v)) ? "-" : currencyFormatterARS.format(v);
const formatCurrencyUSD = (v) =>
  v == null || Number.isNaN(Number(v)) ? "-" : currencyFormatterUSD.format(v);
const formatPercentage = (v) =>
  v == null || Number.isNaN(Number(v))
    ? "-"
    : percentageFormatter.format(v) + "%";

const getProductInitials = (name) => {
  if (!name) return "PR";
  const parts = name.split(" ").filter(Boolean);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
};

const ProductsTable = ({ refreshToken = 0, isSellerView = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
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
      const [
        fxRatesRes,
        productsRes,
        paymentMethodsRes,
        brandsRes,
        categoriesRes,
        commissionRulesRes,
      ] = await Promise.all([
        supabase.from("fx_rates").select("rate, is_active"),
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
              allow_backorder,
              lead_time_label,
              active,
              brands (id, name),
              categories (id, name),
              inventory (stock)
            `
          )
          .order("name"),
        supabase
          .from("payment_methods")
          .select(
            "id, name, multiplier, payment_installments(id, installments, multiplier, description)"
          )
          .order("id"),
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("commission_rules")
          .select(
            "id, category_id, brand_id, commission_pct, commission_fixed, priority"
          )
          .order("priority"),
      ]);

      const currentFxRate =
        fxRatesRes?.data?.find((r) => r.is_active)?.rate ?? DEFAULT_FX_RATE;
      const methods = paymentMethodsRes?.data || [];
      const rules = commissionRulesRes?.data || [];

      // 🔹 Función para determinar la comisión aplicable
      // 🔹 Función para determinar la comisión aplicable
      const getCommissionForProduct = (p) => {
        // Si tiene comisión propia → prioridad máxima
        if (p.commission_pct != null || p.commission_fixed != null) {
          return {
            pct: p.commission_pct,
            fixed: p.commission_fixed,
            ruleName: "Propia",
            priority: 0,
          };
        }

        // Buscar reglas aplicables por marca o categoría
        const applicable = rules.filter(
          (r) =>
            (r.brand_id && r.brand_id === p.brand_id) ||
            (r.category_id && r.category_id === p.category_id)
        );

        // Si no hay reglas globales → mostrar "Propia"
        if (applicable.length === 0)
          return { pct: null, fixed: null, ruleName: "Propia", priority: null };

        // Seleccionar la regla con menor prioridad numérica (mayor prioridad real)
        const bestRule = applicable.reduce((a, b) =>
          a.priority < b.priority ? a : b
        );

        return {
          pct: bestRule.commission_pct,
          fixed: bestRule.commission_fixed,
          ruleName: bestRule.brand_id
            ? `Marca (prioridad ${bestRule.priority})`
            : `Categoría (prioridad ${bestRule.priority})`,
          priority: bestRule.priority,
        };
      };

      const processed = (productsRes?.data || []).map((p) => {
        const commission = getCommissionForProduct(p);
        return {
          id: p.id,
          name: p.name,
          brand_id: p.brand_id,
          category_id: p.category_id,
          brandName: p.brands?.name ?? "Sin marca",
          categoryName: p.categories?.name ?? "Sin categoría",
          stock: p.inventory?.stock ?? 0,
          usdPrice: Number(p.usd_price) || 0,
          commissionPct: commission.pct ?? null,
          commissionFixed: commission.fixed ?? null,
          commissionRuleName: commission.ruleName, // ✅ agregado
          coverImageUrl: p.cover_image_url || PLACEHOLDER_IMAGE,
          allowBackorder: p.allow_backorder,
          leadTimeLabel: p.lead_time_label,
          active: p.active,
          paymentOptions: methods.map((m) => ({
            ...m,
            priceARS: p.usd_price * currentFxRate * m.multiplier,
          })),
        };
      });

      setFxRate(currentFxRate);
      setProducts(processed);
      setBrands(brandsRes?.data || []);
      setCategories(categoriesRes?.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudieron cargar los productos", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(refreshToken === 0);
  }, [fetchProducts, refreshToken]);

  const columnsToRender = useMemo(
    () =>
      isSellerView
        ? TABLE_COLUMNS.filter((c) => c.id !== "actions")
        : TABLE_COLUMNS,
    [isSellerView]
  );

  const handleRefresh = () => fetchProducts(false);

  const handleDelete = async (product) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: `¿Eliminar ${product.name}?`,
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      confirmButtonColor: "#ef4444",
    });
    if (confirm.isConfirmed) {
      Swal.fire("Info", "Funcionalidad aún en desarrollo", "info");
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.brandName.toLowerCase().includes(term);
      const matchesBrand =
        !selectedBrand || p.brand_id === parseInt(selectedBrand);
      const matchesCategory =
        !selectedCategory || p.category_id === parseInt(selectedCategory);
      return matchesSearch && matchesBrand && matchesCategory;
    });
  }, [products, searchTerm, selectedBrand, selectedCategory]);

  return (
    <TooltipProvider>
      <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-md border border-green-500 bg-gray-200/20 p-3 text-xl">
          <IconHomeDollar className="h-6 w-6 text-green-500" />
          Cotización actual del USD: {formatCurrencyARS(fxRate)}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Buscar por producto o marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:w-64"
            />

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="border rounded-md p-2 text-sm"
            >
              <option value="">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded-md p-2 text-sm"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
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

            {!isSellerView && (
              <Button
                onClick={() => setProductDialog({ open: true, product: null })}
              >
                <IconPlus className="h-4 w-4" /> Agregar
              </Button>
            )}
          </div>
        </div>

        {/* 🧾 Tabla de productos */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columnsToRender.map((c) => (
                  <TableHead key={c.id}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columnsToRender.length}>
                    <div className="grid gap-2">
                      {[...Array(3)].map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_COLUMNS.length}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No hay productos que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => {
                  const cashPrice = p.usdPrice * fxRate;
                  const methods = p.paymentOptions.filter(
                    (m) =>
                      !m.name.toLowerCase().includes("efectivo") &&
                      !m.name.toLowerCase().includes("transfer")
                  );
                  const allPrices = methods.flatMap((m) =>
                    m.payment_installments?.length
                      ? m.payment_installments.map(
                          (i) => p.usdPrice * fxRate * i.multiplier
                        )
                      : p.usdPrice * fxRate * m.multiplier
                  );
                  const minPrice = Math.min(...allPrices);
                  const maxPrice = Math.max(...allPrices);

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={p.coverImageUrl} alt={p.name} />
                          <AvatarFallback>
                            {getProductInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <p className="text-xs text-muted-foreground">
                          {p.categoryName}
                        </p>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{p.brandName}</Badge>
                      </TableCell>

                      <TableCell>
                        {p.stock === 0 && p.allowBackorder ? (
                          <div className="flex flex-col leading-tight">
                            <span className="font-medium text-amber-600">
                              Pedido
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {p.leadTimeLabel || "Sin plazo"}
                            </span>
                          </div>
                        ) : (
                          p.stock
                        )}
                      </TableCell>

                      <TableCell>{formatCurrencyUSD(p.usdPrice)}</TableCell>

                      <TableCell>{formatCurrencyARS(cashPrice)}</TableCell>

                      <TableCell>
                        {methods.length ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="cursor-pointer border rounded-md p-2 hover:bg-muted transition">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    Desde
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    {formatCurrencyARS(minPrice)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    Hasta
                                  </span>
                                  <span className="font-semibold text-red-600">
                                    {formatCurrencyARS(maxPrice)}
                                  </span>
                                </div>
                              </div>
                            </PopoverTrigger>

                            <PopoverContent align="end" className="w-80">
                              <h4 className="font-medium mb-2 flex items-center gap-2">
                                <IconCreditCard className="h-4 w-4 text-purple-600" />
                                Métodos de pago
                              </h4>
                              {methods.map((m) => (
                                <div
                                  key={m.id}
                                  className="border-b pb-1 mb-2 last:border-0"
                                >
                                  <p className="font-semibold text-sm">
                                    {m.name}
                                  </p>
                                  {m.payment_installments?.length ? (
                                    m.payment_installments.map((i) => (
                                      <div
                                        key={i.id}
                                        className="flex justify-between text-xs text-muted-foreground"
                                      >
                                        <span>
                                          {i.installments} cuotas{" "}
                                          <span className="text-amber-600">
                                            (+
                                            {((i.multiplier - 1) * 100).toFixed(
                                              1
                                            )}
                                            %)
                                          </span>
                                        </span>
                                        <span>
                                          {formatCurrencyARS(
                                            p.usdPrice * fxRate * i.multiplier
                                          )}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>
                                        1 pago (+
                                        {((m.multiplier - 1) * 100).toFixed(1)}
                                        %)
                                      </span>
                                      <span>
                                        {formatCurrencyARS(
                                          p.usdPrice * fxRate * m.multiplier
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Sin métodos adicionales
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <span>
                                {p.commissionPct
                                  ? formatPercentage(p.commissionPct)
                                  : p.commissionFixed
                                  ? formatCurrencyUSD(p.commissionFixed)
                                  : "-"}
                              </span>
                              <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{p.commissionRuleName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {!isSellerView && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setProductDialog({ open: true, product: p })
                              }
                            >
                              <IconEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(p)}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!isSellerView && (
        <DialogProduct
          open={productDialog.open}
          onClose={() => setProductDialog({ open: false, product: null })}
          product={productDialog.product}
          onSave={handleRefresh}
        />
      )}
    </TooltipProvider>
  );
};

export default ProductsTable;
