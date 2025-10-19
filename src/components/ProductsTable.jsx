import { useCallback, useEffect, useMemo, useState } from "react";
// ❌ ELIMINADO: import Swal from "sweetalert2";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";

import { supabase } from "../lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DialogVariants from "../components/DialogVariants";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProductDetailDialog from "../components/ProductDetailDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  IconVersions,
} from "@tabler/icons-react";
import DialogProduct from "../components/DialogProduct";

// ✅ AGREGADO: Componente de diálogo de confirmación (asumiendo su existencia)
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TABLE_COLUMNS = [
  { id: "image", label: "Imagen" },
  { id: "name", label: "Producto" },
  { id: "brand", label: "Marca" },
  { id: "stock", label: "Stock" },
  { id: "usd_price", label: "Precio USD" },
  { id: "cash_price", label: "Efec/Transf" },
  // { id: "payment_methods", label: "Métodos de pago" },
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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [openVariants, setOpenVariants] = useState(false);
  const [selectedVariantProduct, setSelectedVariantProduct] = useState(null);

  const [paymentInstallments, setPaymentInstallments] = useState([]);
  const [productDialog, setProductDialog] = useState({
    open: false,
    product: null,
  });

  // 🔄 REEMPLAZO 2: Estado para el AlertDialog de eliminación
  const [deleteDialog, setDeleteDialog] = useState({
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
             product_variants (
               id,
               storage,
               ram,
               color,
               usd_price,
               stock,
               image_url
             )
           `
          )
          .order("name"),
        supabase
          .from("payment_methods")
          .select(
            "id, name, multiplier, payment_installments(id, installments, multiplier, description, payment_method_id)"
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

      const rules = commissionRulesRes?.data || [];
      const methodsRaw = paymentMethodsRes?.data || [];

      // 🔹 Separar métodos e installments
      const flatInstallments = methodsRaw.flatMap(
        (m) => m.payment_installments || []
      );
      const methods = methodsRaw.map(
        ({ payment_installments, ...rest }) => rest
      );

      const filteredMethods = methods.filter(
        (m) =>
          !m.name.toLowerCase().includes("efectivo") &&
          !m.name.toLowerCase().includes("transfer")
      );

      const getCommissionForProduct = (p) => {
        if (p.commission_pct !== null || p.commission_fixed !== null) {
          return {
            pct: p.commission_pct,
            fixed: p.commission_fixed,
            ruleName: "Propia",
            priority: 0,
          };
        }

        const applicable = rules.filter(
          (r) =>
            (r.brand_id && r.brand_id === p.brand_id) ||
            (r.category_id && r.category_id === p.category_id)
        );

        if (applicable.length === 0)
          return { pct: null, fixed: null, ruleName: "No tiene", priority: null };

        const bestRule = applicable.reduce((a, b) =>
          a.priority < b.priority ? a : b
        );

        return {
          pct: bestRule.commission_pct,
          fixed: bestRule.commission_fixed,
          ruleName: bestRule.brand_id
            ? `Por Marca`
            : `Por Categoría`,
          priority: bestRule.priority,
        };
      };

      const processed = (productsRes?.data || []).map((p) => {
        const commission = getCommissionForProduct(p);
        const variants = p.product_variants || [];
        const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        const minVariantPrice = Math.min(
          ...variants.map((v) => Number(v.usd_price || p.usd_price))
        );

        return {
          id: p.id,
          name: p.name,
          brand_id: p.brand_id,
          category_id: p.category_id,
          brandName: p.brands?.name ?? "Sin marca",
          categoryName: p.categories?.name ?? "Sin categoría",
          stock: totalStock,
          usdPrice: minVariantPrice,
          commissionPct: commission.pct ?? null,
          commissionFixed: commission.fixed ?? null,
          commissionRuleName: commission.ruleName,
          priority: commission.priority,
          coverImageUrl:
            p.cover_image_url || variants[0]?.image_url || PLACEHOLDER_IMAGE,
          allowBackorder: p.allow_backorder,
          leadTimeLabel: p.lead_time_label,
          active: p.active,
          variants,
        };
      });

      setFxRate(currentFxRate);
      setProducts(processed);
      setBrands(brandsRes?.data || []);
      setCategories(categoriesRes?.data || []);
      setPaymentMethods(filteredMethods);
      setPaymentInstallments(flatInstallments);
      console.log("Processed products:", processed);
    } catch (err) {
      console.error(err);
      // 🔄 REEMPLAZO 3: Reemplazar Swal por toast
      toast.error("Error al cargar los productos", {
        description: err.message || "Ocurrió un error desconocido al cargar datos.",
      });
      // ❌ ELIMINADO: Swal.fire("Error", "No se pudieron cargar los productos", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(refreshToken === 0);
  }, [fetchProducts, refreshToken]);

  const handleRefresh = () => fetchProducts(false);

  // 🔄 REEMPLAZO 4: Función para manejar la apertura del diálogo de eliminación
  const handleOpenDeleteDialog = (product) => {
    setDeleteDialog({ open: true, product });
  };

  // 🔄 REEMPLAZO 5: Función que se ejecuta al confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (!deleteDialog.product) return;
    
    // Aquí iría la lógica real de eliminación (e.g., await supabase.from('products').delete().eq('id', deleteDialog.product.id))

    // Simulando el comportamiento original de solo mostrar una alerta
    toast.info("Funcionalidad aún en desarrollo", {
        description: `El producto ${deleteDialog.product.name} no fue eliminado.`,
    });
    
    // ❌ ELIMINADO: Swal.fire("Info", "Funcionalidad aún en desarrollo", "info");
    
    // Cerrar el diálogo
    setDeleteDialog({ open: false, product: null });
  };
  // FIN REEMPLAZO 5

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
        {/* Cotización */}
        <div className="flex items-center gap-3 rounded-md border border-green-500 bg-gray-200/20 p-3 text-xl">
          <IconHomeDollar className="h-6 w-6 text-green-500" />
          Cotización actual del USD: {formatCurrencyARS(fxRate)}
        </div>

        {/* Filtros */}
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

        {/* Tabla */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_COLUMNS.map((c) => (
                  <TableHead key={c.id}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COLUMNS.length}>
                    <div className="grid gap-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
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
                filteredProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50 transition"
                    onClick={() => setSelectedProduct(p)}
                  >
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
                      {" "}
                      {p.stock === 0 && p.allowBackorder ? (
                        <div className="flex flex-col leading-tight">
                          {" "}
                          <span className="font-medium text-amber-600">
                            {" "}
                            Pedido{" "}
                          </span>{" "}
                          <span className="text-sm text-muted-foreground">
                            {" "}
                            {p.leadTimeLabel || "Sin plazo"}{" "}
                          </span>{" "}
                        </div>
                      ) : (
                        p.stock
                      )}{" "}
                    </TableCell>

                    <TableCell>{formatCurrencyUSD(p.usdPrice)}</TableCell>
                    <TableCell>
                      {formatCurrencyARS(p.usdPrice * fxRate)}
                    </TableCell>

                    {/* <TableCell>
                      <span className="text-muted-foreground text-sm">
                        Ver en detalle
                      </span>
                    </TableCell> */}

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
                          <span>Prioridad: {p.priority}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {!isSellerView && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductDialog({
                                    open: true,
                                    product: p,
                                  });
                                }}
                              >
                                <IconEdit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVariantProduct(p); // ← guardamos el producto actual
                                  setOpenVariants(true);
                                }}
                              >
                                <IconVersions className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Variantes</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 🔄 REEMPLAZO 6: Usar la nueva función de diálogo
                                  handleOpenDeleteDialog(p); 
                                }}
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!isSellerView && (
        <>
          <DialogProduct
            open={productDialog.open}
            onClose={() => setProductDialog({ open: false, product: null })}
            product={productDialog.product}
            onSave={handleRefresh}
          />
          <DialogVariants
            open={openVariants}
            onClose={() => {
              setOpenVariants(false);
              setSelectedVariantProduct(null);
            }}
            productId={selectedVariantProduct?.id}
            onSave={handleRefresh}
          />

          {/* 🔄 REEMPLAZO 7: AlertDialog para la confirmación de eliminación */}
          <AlertDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, product: null })}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Eliminar {deleteDialog.product?.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. ¿Estás seguro de que quieres
                  eliminar este producto?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* FIN REEMPLAZO 7 */}
        </>
      )}

      {selectedProduct && (
        <ProductDetailDialog
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          fxRate={fxRate}
          paymentMethods={paymentMethods}
          paymentInstallments={paymentInstallments}
        />
      )}
    </TooltipProvider>
  );
};

export default ProductsTable;