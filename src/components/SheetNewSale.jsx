import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { IconX } from "@tabler/icons-react";
import DialogSaleInvoice from "./DialogSaleInvoice";

export default function SheetNewSale({ open, onOpenChange, lead }) {
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [searchVariant, setSearchVariant] = useState("");

  const [focusCustomer, setFocusCustomer] = useState(false);
  const [focusProduct, setFocusProduct] = useState(false);
  const [focusVariant, setFocusVariant] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState([]);

  const [form, setForm] = useState({ notes: "" });

  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // 🪙 Obtener cotización activa
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("rate")
        .eq("is_active", true)
        .maybeSingle();

      if (error) console.error("Error obteniendo cotización:", error);
      if (data) setExchangeRate(data.rate);
    };
    fetchExchangeRate();
  }, []);

  // 🧠 Si viene de un lead, completar automáticamente
  useEffect(() => {
    if (lead) {
      setSelectedCustomer(lead.customers || null);
      setSelectedVariants(lead.interested_variants || []);
    }
  }, [lead]);

  // 🔄 Enriquecer variantes del lead con nombres y precios
  useEffect(() => {
    const enrichVariants = async () => {
      if (!lead || !lead.interested_variants) return;
      const ids = lead.interested_variants.map((v) => v.id).filter(Boolean);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, variant_name, color, storage, ram, usd_price, stock, products(name)"
        )
        .in("id", ids);

      if (!error && data) {
        const enriched = data.map((v) => ({ ...v, quantity: 1 }));
        setSelectedVariants(enriched);
      }
    };
    enrichVariants();
  }, [lead]);

  // 🔍 Buscar clientes (solo si no viene de un lead)
  useEffect(() => {
    if (!focusCustomer || lead) return;
    const fetchCustomers = async () => {
      const q = searchCustomer.trim();
      const { data } = await supabase
        .from("customers")
        .select("id, name, last_name, dni, phone, email")
        .or(
          `name.ilike.%${q}%,last_name.ilike.%${q}%,dni.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
        )
        .limit(20);
      setCustomers(data || []);
    };
    fetchCustomers();
  }, [focusCustomer, searchCustomer, lead]);

  // 📦 Buscar productos
  useEffect(() => {
    if (!focusProduct) return;
    const q = searchProduct.trim();
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .limit(30);
      setProducts(data || []);
    };
    fetchProducts();
  }, [focusProduct, searchProduct]);

  // 🎨 Buscar variantes (solo en stock)
  useEffect(() => {
    if (!selectedProduct || !focusVariant) return;
    const q = searchVariant.trim();
    const fetchVariants = async () => {
      const { data } = await supabase
        .from("product_variants")
        .select(
          "id, variant_name, color, storage, ram, usd_price, stock, products(name)"
        )
        .eq("product_id", selectedProduct.id)
        .gt("stock", 0)
        .ilike("variant_name", `%${q}%`)
        .limit(40);
      setVariants(data || []);
    };
    fetchVariants();
  }, [selectedProduct, focusVariant, searchVariant]);

  // ➕ Agregar variante
  const handleAddVariant = (variant) => {
    if (selectedVariants.some((v) => v.id === variant.id)) {
      toast("Ya está en el carrito");
      return;
    }
    setSelectedVariants([
      ...selectedVariants,
      { ...variant, quantity: 1 }, // cantidad inicial
    ]);
    setSearchVariant("");
  };

  // ❌ Quitar variante
  const handleRemoveVariant = (variantId) => {
    setSelectedVariants((prev) =>
      prev.filter((v) => v.id !== variantId && v.variant_id !== variantId)
    );
  };

  // 🔢 Cambiar cantidad
  const handleQuantityChange = (id, newQty, stock) => {
    if (newQty < 1) return;
    if (newQty > stock) {
      toast.warning(`Solo hay ${stock} unidades disponibles.`);
      return;
    }

    setSelectedVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, quantity: newQty } : v))
    );
  };

  // 💾 Guardar venta
  const handleSubmit = async () => {
    if (!selectedCustomer) return toast.error("Selecciona un cliente");
    if (!selectedVariants.length) return toast.error("Agrega productos");
    if (!exchangeRate) return toast.error("Error con la cotización");

    setLoading(true);

    const variantsToSave = selectedVariants.map((v) => ({
      id: v.id,
      product_name: v.products?.name,
      variant_name: v.variant_name,
      color: v.color,
      storage: v.storage,
      ram: v.ram,
      usd_price: v.usd_price,
      quantity: v.quantity,
      subtotal_usd: v.usd_price * v.quantity,
      subtotal_ars: v.usd_price * v.quantity * exchangeRate,
    }));

    const totalUSD = variantsToSave.reduce((acc, v) => acc + v.subtotal_usd, 0);
    const totalARS = variantsToSave.reduce((a, v) => a + v.subtotal_ars, 0);

    const { data, error } = await supabase
      .from("sales")
      .insert([
        {
          customer_id: selectedCustomer.id,
          variants: variantsToSave,
          total_usd: totalUSD,
          total_ars: totalARS,
          fx_rate_used: exchangeRate,
          notes: form.notes || null,
          created_from_lead: lead?.id ?? null,
          status: "completada",
        },
      ])
      .select()
      .single();

    setLoading(false);

    // ✅ Cargar en factura
    setInvoiceData({
      ...data,
      customer_name: `${selectedCustomer.name} ${selectedCustomer.last_name}`,
      customer_phone: selectedCustomer.phone,
      seller_name: lead?.seller_name ?? "Vendedor",
      seller_email: lead?.seller_email ?? "",
    });

    setInvoiceOpen(true); // ✅ Abrir comprobante
    onOpenChange(false); // ✅ Cerrar formulario
    toast.success("Venta registrada");


    if (error) {
      console.error(error);
      return toast.error("Error guardando venta");
    }
  };

  // 💰 Formateador de moneda
  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(n || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva venta</SheetTitle>
          <SheetDescription>
            Selecciona los productos vendidos y registra la operación.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-4">
          {/* 🧍‍♂️ Cliente */}
          <div className="relative">
            <Input
              placeholder="Buscar cliente..."
              readOnly={!!lead}
              value={
                selectedCustomer
                  ? `${selectedCustomer.name} ${
                      selectedCustomer.last_name || ""
                    }`
                  : searchCustomer
              }
              onFocus={() => !lead && setFocusCustomer(true)}
              onBlur={() =>
                !lead && setTimeout(() => setFocusCustomer(false), 200)
              }
              onChange={(e) => {
                if (!lead) {
                  setSelectedCustomer(null);
                  setSearchCustomer(e.target.value);
                }
              }}
            />
            {focusCustomer && !lead && (
              <div className="absolute z-[9999] mt-1 w-full rounded-md border bg-background shadow">
                <ScrollArea className="max-h-[250px] overflow-y-auto">
                  {customers.length > 0 ? (
                    customers.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setFocusCustomer(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted"
                      >
                        <div className="font-medium">
                          {c.name} {c.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          DNI: {c.dni || "N/D"} |{" "}
                          {c.phone || c.email || "Sin contacto"}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Sin coincidencias
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* 🛍 Producto y variantes */}
          <div className="relative">
            <Input
              placeholder="Buscar producto..."
              value={selectedProduct ? selectedProduct.name : searchProduct}
              onFocus={() => setFocusProduct(true)}
              onBlur={() => setTimeout(() => setFocusProduct(false), 200)}
              onChange={(e) => {
                setSelectedProduct(null);
                setSearchProduct(e.target.value);
              }}
            />
            {focusProduct && (
              <div className="absolute z-[9999] mt-1 w-full rounded-md border bg-background shadow">
                <ScrollArea className="max-h-[250px] overflow-y-auto">
                  {products.length > 0 ? (
                    products.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted"
                        onClick={() => {
                          setSelectedProduct(p);
                          setFocusProduct(false);
                          setSearchProduct("");
                          setVariants([]);
                        }}
                      >
                        {p.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Sin coincidencias
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          <div className="relative">
            <Input
              placeholder={
                selectedProduct
                  ? "Buscar variantes disponibles..."
                  : "Selecciona un producto primero"
              }
              value={searchVariant}
              onFocus={() => setFocusVariant(true)}
              onBlur={() => setTimeout(() => setFocusVariant(false), 200)}
              onChange={(e) => setSearchVariant(e.target.value)}
              disabled={!selectedProduct}
            />

            {focusVariant && selectedProduct && (
              <div className="absolute z-[9999] mt-1 w-full rounded-md border bg-background shadow">
                <ScrollArea className="max-h-[250px] overflow-y-auto">
                  {variants.length > 0 ? (
                    variants.map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => handleAddVariant(v)}
                        className="w-full text-left px-3 py-2 hover:bg-muted"
                      >
                        <div className="font-medium">
                          {v.products?.name} - {v.variant_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.color || ""} ({v.stock} unid.)
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Sin coincidencias
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* 🛒 Carrito */}
          {selectedVariants.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <h3 className="text-sm font-semibold">Carrito de venta</h3>
              {selectedVariants.map((v) => (
                <div
                  key={v.id}
                  className="flex justify-between items-center border rounded-lg p-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {v.products?.name} - {v.variant_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.color} | Stock: {v.stock}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={v.quantity}
                      onChange={(e) =>
                        handleQuantityChange(
                          v.id,
                          parseInt(e.target.value),
                          v.stock
                        )
                      }
                      className="w-14 text-center"
                      min={1}
                      max={v.stock}
                    />
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatARS(v.usd_price * exchangeRate * v.quantity)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        USD {v.usd_price} x {v.quantity}
                      </div>
                    </div>
                    <IconX
                      className="h-4 w-4 cursor-pointer text-red-500"
                      onClick={() => handleRemoveVariant(v.id)}
                    />
                  </div>
                </div>
              ))}

              {/* 💰 Totales */}
              <div className="flex justify-between border-t pt-3 text-sm font-medium">
                <span>Total:</span>
                <span>
                  {formatARS(
                    selectedVariants.reduce(
                      (acc, v) =>
                        acc + v.usd_price * v.quantity * (exchangeRate || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          )}

          {/* 📝 Notas */}
          <Textarea
            placeholder="Notas adicionales (detalle de la operación, pago, etc.)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <SheetFooter className="mt-6">
          <Button className="w-full" disabled={loading} onClick={handleSubmit}>
            {loading ? "Guardando..." : "Registrar venta"}
          </Button>
        </SheetFooter>
      </SheetContent>

      <DialogSaleInvoice
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        sale={invoiceData}
      />
    </Sheet>
  );
}
