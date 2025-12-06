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
import { IconX, IconUserPlus } from "@tabler/icons-react";
import DialogAddCustomer from "../components/DialogAddCustomer";

export default function SheetNewLead({ open, onOpenChange, sellerId }) {
  const [loading, setLoading] = useState(false);

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

  const [dialogCustomerOpen, setDialogCustomerOpen] = useState(false);

  const [form, setForm] = useState({
    appointmentDatetime: "",
    notes: "",
  });

  // 🔍 Buscar clientes
  useEffect(() => {
    if (!focusCustomer) return;
    const fetchCustomers = async () => {
      const q = searchCustomer.trim();
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, last_name, dni, phone, email")
        .or(
          `name.ilike.%${q}%,last_name.ilike.%${q}%,dni.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`
        )
        .limit(20);
      if (!error) setCustomers(data || []);
    };
    fetchCustomers();
  }, [focusCustomer, searchCustomer]);

  // 📦 Buscar productos
  useEffect(() => {
    if (!focusProduct) return;
    const q = searchProduct.trim();
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .limit(30);
      if (!error) setProducts(data || []);
    };
    fetchProducts();
  }, [focusProduct, searchProduct]);

  // 🎨 Buscar variantes según producto seleccionado
  useEffect(() => {
    if (!selectedProduct || !focusVariant) return;
    const fetchVariants = async () => {
      const q = searchVariant.trim();
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, variant_name, color, storage, ram, stock, products(name)")
        .eq("product_id", selectedProduct.id)
        .ilike("variant_name", `%${q}%`)
        .limit(40);
      if (!error) setVariants(data || []);
    };
    fetchVariants();
  }, [selectedProduct, focusVariant, searchVariant]);

  // ➕ Agregar variante
  const handleAddVariant = (variant) => {
    if (selectedVariants.some((v) => v.id === variant.id)) {
      toast("Ya está en la lista de productos interesados");
      return;
    }
    setSelectedVariants([...selectedVariants, variant]);
    setSearchVariant("");
  };

  // ❌ Quitar variante
  const handleRemoveVariant = (id) => {
    setSelectedVariants(selectedVariants.filter((v) => v.id !== id));
  };

  // 📦 Calcular estado del producto según stock
  const getProductStatus = () => {
    if (selectedVariants.length === 0) return null;
    const allHaveStock = selectedVariants.every((v) => v.stock > 0);
    return allHaveStock ? "disponible" : "en espera";
  };

  // 🧾 Enviar lead
  const handleSubmit = async () => {
    if (selectedVariants.length === 0) {
      toast.error("Debes agregar al menos una variante interesada");
      return;
    }

    if (!selectedCustomer) {
      toast.error("Debes seleccionar un cliente");
      return;
    }

    if (!form.appointmentDatetime) {
      toast.error("Debes seleccionar una fecha y hora para la cita");
      return;
    }

    const selectedDate = new Date(form.appointmentDatetime);
    const now = new Date();

    if (selectedDate <= now) {
      toast.error("La fecha y hora deben ser posteriores a la actual");
      return;
    }

    setLoading(true);

    const variantList = selectedVariants.map((v) => ({
      id: v.id,
      product_name: v.products?.name || "Producto",
      variant_name: v.variant_name,
      color: v.color,
      storage: v.storage,
      ram: v.ram,
      stock: v.stock,
    }));

    const productStatus = getProductStatus();

    const { error } = await supabase.from("leads").insert([
      {
        referred_by: sellerId,
        customer_id: selectedCustomer?.id || null,
        interested_variants: variantList, // ✅ jsonb en Supabase
        appointment_datetime: form.appointmentDatetime || null,
        notes: form.notes || null,
        status: "pendiente",
        product_status: productStatus, // ✅ "disponible" o "en espera"
      },
    ]);

    setLoading(false);

    if (error) {
      console.error(error);
      toast.error("Error al crear el pedido");
      return;
    }

    toast.success("Pedido creado correctamente");
    onOpenChange(false);
    // Reset
    setForm({ appointmentDatetime: "", notes: "" });
    setSelectedCustomer(null);
    setSelectedProduct(null);
    setSelectedVariants([]);
    setSearchCustomer("");
    setSearchProduct("");
    setSearchVariant("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-visible"
      >
        <SheetHeader>
          <SheetTitle>Nuevo pedido</SheetTitle>
          <SheetDescription>
            Selecciona un cliente, un producto y las variantes de su interés.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-4">
          {/* 🧍‍♂️ Cliente */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar cliente..."
                value={
                  selectedCustomer
                    ? `${selectedCustomer.name} ${
                        selectedCustomer.last_name || ""
                      }`
                    : searchCustomer
                }
                onFocus={() => setFocusCustomer(true)}
                onBlur={() => setTimeout(() => setFocusCustomer(false), 200)}
                onChange={(e) => {
                  setSelectedCustomer(null);
                  setSearchCustomer(e.target.value);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDialogCustomerOpen(true)}
                title="Nuevo cliente"
              >
                <IconUserPlus className="h-5 w-5" />
              </Button>
            </div>
            {focusCustomer && (
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

          {/* 🛍 Producto */}
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

          {/* 🎨 Variantes */}
          <div className="relative">
            <Input
              placeholder={
                selectedProduct
                  ? "Buscar variantes (color, capacidad, etc.)"
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
                          {v.products?.name || ""} - {v.variant_name || ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.color || ""}
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

            {/* 🏷 Variantes seleccionadas */}
            {selectedVariants.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedVariants.map((v) => (
                  <Badge
                    key={v.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {v.products?.name || ""} - {v.variant_name || ""} -{" "}
                    {v.color || ""}
                    <IconX
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveVariant(v.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 📅 Fecha y notas */}
          <Input
            type="datetime-local"
            value={form.appointmentDatetime}
            onChange={(e) =>
              setForm((f) => ({ ...f, appointmentDatetime: e.target.value }))
            }
          />
          <Textarea
            placeholder="Notas adicionales (preferencias, detalles del producto, etc.)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <SheetFooter className="mt-6">
          <Button className="w-full" disabled={loading} onClick={handleSubmit}>
            {loading ? "Guardando..." : "Guardar pedido"}
          </Button>
        </SheetFooter>
      </SheetContent>
      {/* 💬 Modal para crear cliente */}
      <DialogAddCustomer
        open={dialogCustomerOpen}
        onClose={() => setDialogCustomerOpen(false)}
        onSuccess={(newCustomer) => {
          setSelectedCustomer(newCustomer);
          setDialogCustomerOpen(false);
          toast.success(`Cliente ${newCustomer.name} agregado correctamente`);
        }}
      />
    </Sheet>
  );
}
