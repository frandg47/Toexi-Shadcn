import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import DialogSaleInvoice from "./DialogSaleInvoice";
import DialogAddCustomer from "./DialogAddCustomer";
import {
  IconX,
  IconCash,
  IconCreditCard,
  IconBuildingBank,
  IconReceipt2,
  IconChevronRight,
  IconChevronLeft,
  IconTrash,
  IconCirclePlus,
  IconUserPlus,
} from "@tabler/icons-react";
// import { useNavigate } from "react-router-dom";
// import { useSaleStore } from "../store/useSaleStore";

export default function SheetNewSale({ open, onOpenChange, lead }) {
  // --- Wizard ---
  const [step, setStep] = useState(1);

  // --- Loading flags ---
  const [loading, setLoading] = useState(false);

  // --- Exchange rate ---
  const [exchangeRate, setExchangeRate] = useState(null);

  // --- Lookups ---
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  // --- Search fields / focus controllers ---
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [searchVariant, setSearchVariant] = useState("");
  const [focusCustomer, setFocusCustomer] = useState(false);
  const [focusProduct, setFocusProduct] = useState(false);
  const [focusVariant, setFocusVariant] = useState(false);

  // --- Selected entities / cart ---
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState([]); // each: {...variant, quantity}

  // --- Notes ---
  const [form, setForm] = useState({ notes: "" });

  // --- Payments (mixto) ---
  const [payments, setPayments] = useState([
    { method: "", amount: "", reference: "", installments: "" },
  ]);

  // --- Invoice dialog ---
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // --- Add Customer dialog ---
  const [dialogCustomerOpen, setDialogCustomerOpen] = useState(false);

  // Métodos de pago desde la BD
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentInstallments, setPaymentInstallments] = useState([]);

  // const navigate = useNavigate();
  // const setCustomer = useSaleStore((s) => s.setCustomer);
  // const setItems = useSaleStore((s) => s.setItems);
  // const setFxRate = useSaleStore((s) => s.setFxRate);
  // const setNotes = useSaleStore((s) => s.setNotes);

  // ========== HELPERS ==========
  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(n || 0);

  // Total base en ARS (sin recargos)
  const baseTotal = useMemo(() => {
    if (!exchangeRate) return 0;
    return selectedVariants.reduce(
      (acc, v) => acc + v.usd_price * v.quantity * exchangeRate,
      0
    );
  }, [selectedVariants, exchangeRate]);

  // pagos sin interés (efectivo/transfer/macro)
  const paidNoInterest = useMemo(() => {
    return payments
      .filter((p) => {
        const info = paymentInstallments.find(
          (i) =>
            i.payment_method_id === Number(p.payment_method_id) &&
            i.installments === Number(p.installments)
        );
        const multiplier = info?.multiplier || p.multiplier || 1;
        return Number(multiplier) === 1;
      })
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [payments, paymentInstallments]);

  // saldo después de pagos sin interés
  const saldo = useMemo(() => {
    return Math.max(baseTotal - paidNoInterest, 0);
  }, [baseTotal, paidNoInterest]);

  // buscar método con interés (si existe)
  const interestMethod = useMemo(() => {
    return payments.find((p) => {
      const info = paymentInstallments.find(
        (i) =>
          i.payment_method_id === Number(p.payment_method_id) &&
          i.installments === Number(p.installments)
      );
      const multiplier = info?.multiplier || p.multiplier || 1;
      return Number(multiplier) > 1;
    });
  }, [payments, paymentInstallments]);

  // multiplicador de interés
  const multiplier = interestMethod
    ? paymentInstallments.find(
      (i) =>
        i.payment_method_id === Number(interestMethod.payment_method_id) &&
        i.installments === Number(interestMethod.installments)
    )?.multiplier || 1
    : 1;

  // total final con recargo
  const totalWithSurcharge = useMemo(() => {
    if (!interestMethod) return baseTotal;

    const interestPart = saldo * (multiplier - 1);
    return baseTotal + interestPart;
  }, [baseTotal, saldo, multiplier, interestMethod]);

  // cuánto lleva pagado el cliente
  const paidARS = useMemo(() => {
    return payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [payments]);

  // saldo restante
  const remaining = useMemo(() => {
    return Math.max(totalWithSurcharge - paidARS, 0);
  }, [totalWithSurcharge, paidARS]);

  // Total USD original
  const subtotalUSD = useMemo(() => {
    return selectedVariants.reduce(
      (acc, v) => acc + v.usd_price * v.quantity,
      0
    );
  }, [selectedVariants]);

  const methodIcon = (m) => {
    if (m === "efectivo") return <IconCash className="h-4 w-4" />;
    if (m === "transferencia") return <IconBuildingBank className="h-4 w-4" />;
    if (m === "tarjeta") return <IconCreditCard className="h-4 w-4" />;
    return null;
  };

  // ========== EFFECTS ==========

  // Cotización activa
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("rate")
        .eq("is_active", true)
        .maybeSingle();

      if (error) console.error("Error obteniendo cotización:", error);
      if (data) setExchangeRate(Number(data.rate));
    };
    fetchExchangeRate();
  }, []);

  // Obtener métodos de pago y cuotas
  useEffect(() => {
    const fetchPayments = async () => {
      const { data: methods } = await supabase
        .from("payment_methods")
        .select("id, name, multiplier");

      const { data: installments } = await supabase
        .from("payment_installments")
        .select("id, payment_method_id, installments, multiplier");

      setPaymentMethods(methods || []);
      setPaymentInstallments(installments || []);
    };

    fetchPayments();
  }, []);

  // Si viene de un lead, auto-completar
  useEffect(() => {
    if (lead) {
      setSelectedCustomer(lead.customers || null);
      setSelectedVariants(lead.interested_variants || []);
      setStep(1); // arrancamos en 1 y permitimos avanzar
    } else {
      setStep(1);
    }
  }, [lead]);

  const resetFormData = () => {
    // Paso del wizard
    setStep(1);

    // Cliente
    setSelectedCustomer(null);
    setSearchCustomer("");
    setFocusCustomer(false);

    // Producto y variantes
    setSelectedProduct(null);
    setSearchProduct("");
    setVariants([]);
    setSelectedVariants([]);

    // Variantes búsqueda
    setSearchVariant("");
    setFocusVariant(false);

    // Notas
    setForm({ notes: "" });

    // Pagos
    setPayments([
      { method: "", amount: "", reference: "", installments: "" }
    ]);

    // Datos del preview
    setInvoiceData(null);

    // Lead (no tocar)
  };



  // Enriquecer variantes del lead
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
        setSelectedVariants(data.map((v) => ({ ...v, quantity: 1 })));
      }
    };
    enrichVariants();
  }, [lead]);

  // Buscar clientes
  useEffect(() => {
    if (!focusCustomer || lead) return;
    const q = searchCustomer.trim();
    const fetchCustomers = async () => {
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

  // Buscar productos
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

  // Buscar variantes por producto (solo stock)
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

  const getInstallmentsForMethod = (methodId) => {
    if (!methodId) return [];
    return paymentInstallments.filter(
      (inst) => inst.payment_method_id === Number(methodId)
    );
  };

  // ========== CART HANDLERS ==========
  const handleAddVariant = (variant) => {
    if (selectedVariants.some((v) => v.id === variant.id)) {
      toast("Ya está en el carrito");
      return;
    }
    setSelectedVariants([...selectedVariants, { ...variant, quantity: 1 }]);
    setSearchVariant("");
  };

  const handleRemoveVariant = (variantId) => {
    setSelectedVariants((prev) =>
      prev.filter((v) => v.id !== variantId && v.variant_id !== variantId)
    );
  };

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

  const handleIMEIChange = (id, imei) => {
    setSelectedVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, imei: imei } : v))
    );
  };

  // ========== PAYMENTS HANDLERS ==========
  const addPaymentRow = () =>
    setPayments((p) => [
      ...p,
      { method: "", amount: "", reference: "", installments: "" },
    ]);
  const removePaymentRow = (idx) =>
    setPayments((p) => p.filter((_, i) => i !== idx));
  const updatePaymentField = (idx, field, value) =>
    setPayments((p) =>
      p.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );

  // ========== SAVE ==========
  const handleSubmit = async () => {
    if (!selectedCustomer) return toast.error("Selecciona un cliente");
    if (!selectedVariants.length) return toast.error("Agrega productos");
    if (!exchangeRate) return toast.error("Error con la cotización");

    const normalized = payments
      .map((p) => ({
        payment_method_id: p.payment_method_id,
        method_name: p.method_name,
        installments: p.installments || null,
        multiplier: p.multiplier || 1,
        amount: Number(p.amount || 0),
      }))
      .filter((p) => p.payment_method_id && p.amount > 0);

    if (!normalized.length)
      return toast.error("Agrega al menos un método de pago");

    if (Math.round(paidARS) !== Math.round(totalWithSurcharge)) {
      return toast.error(
        "El total pagado no coincide con el total de la venta"
      );
    }

    // Chequeo de stock
    const recheckIds = selectedVariants.map((v) => v.id);
    const { data: fresh, error: freshErr } = await supabase
      .from("product_variants")
      .select("id, stock")
      .in("id", recheckIds);

    if (freshErr) return toast.error("Error validando stock");

    const stockMap = Object.fromEntries(fresh.map((f) => [f.id, f.stock]));
    const insufficient = selectedVariants.find(
      (v) => (v.quantity || 1) > (stockMap[v.id] ?? 0)
    );
    if (insufficient) {
      return toast.error(`Sin stock para ${insufficient.variant_name}`);
    }

    // ✅ Armamos los datos que irá al modal
    const items = selectedVariants.map((v) => ({
      variant_id: v.id,
      product_name: v.products?.name,
      variant_name: v.variant_name,
      color: v.color,
      storage: v.storage,
      ram: v.ram,
      usd_price: v.usd_price,
      quantity: v.quantity,
      imei: v.imei || null,
      subtotal_usd: v.usd_price * v.quantity,
      subtotal_ars: v.usd_price * v.quantity * exchangeRate,
    }));

    const salePreview = {
      customer_id: selectedCustomer.id,
      seller_id: lead?.seller?.id_auth ?? null,
      lead_id: lead?.id ?? null,
      total_usd: items.reduce((acc, it) => acc + it.subtotal_usd, 0),
      total_ars: items.reduce((acc, it) => acc + it.subtotal_ars, 0),
      fx_rate_used: exchangeRate,
      notes: form.notes || null,
      payments: normalized,
      variants: items,
      customer_name: `${selectedCustomer.name} ${selectedCustomer.last_name ?? ""
        }`,
      customer_phone: selectedCustomer.phone ?? "",
      seller_name: `${lead?.seller?.user?.name ?? ""} ${lead?.seller?.user?.last_name ?? ""
        }`,
      seller_email: lead?.seller?.user?.email ?? "",
      total_final_ars: totalWithSurcharge,
    };

    setInvoiceData(salePreview);
    setInvoiceOpen(true);
    onOpenChange(false);
  };

  // ========== RENDER ==========
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Nueva venta</SheetTitle>
              <SheetDescription>
                Completá los 3 pasos para registrar la venta.
              </SheetDescription>
            </div>
            <IconReceipt2 className="absolute right-12 top-6 h-6 w-6 text-primary" />
          </div>

          {/* Wizard header */}
          <div className="flex items-center justify-center mt-3 border-b pb-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={step >= 1 ? "font-semibold text-primary" : ""}>
                1. Cliente
              </span>
              <IconChevronRight className="h-4 w-4" />
              <span className={step >= 2 ? "font-semibold text-primary" : ""}>
                2. Productos
              </span>
              <IconChevronRight className="h-4 w-4" />
              <span className={step === 3 ? "font-semibold text-primary" : ""}>
                3. Pago
              </span>
            </div>
            {/* <div className="flex gap-2">
              {step > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <IconChevronLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>
              )}
              {/* {step < 3 && (
                <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                  Siguiente
                  <IconChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )} 
            </div> */}
          </div>
        </SheetHeader>

        <div className=" px-4 sm:px-4">
          {/* ========== PASO 1: CLIENTE ========== */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium ">Seleccionar cliente</h3>

              <div className="relative">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar cliente..."
                    readOnly={!!lead}
                    value={
                      selectedCustomer
                        ? `${selectedCustomer.name} ${selectedCustomer.last_name || ""
                        }`
                        : searchCustomer
                    }
                    onFocus={() => !lead && setFocusCustomer(true)}
                    onBlur={() =>
                      !lead && setTimeout(() => setFocusCustomer(false), 160)
                    }
                    onChange={(e) => {
                      if (!lead) {
                        setSelectedCustomer(null);
                        setSearchCustomer(e.target.value);
                      }
                    }}
                  />
                  {!lead && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDialogCustomerOpen(true)}
                      title="Nuevo cliente"
                    >
                      <IconUserPlus className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {focusCustomer && !lead && (
                  <div className="absolute z-[50] mt-1 w-full rounded-md border bg-background shadow">
                    <ScrollArea className="max-h-[250px] overflow-y-auto">
                      {(customers || []).length > 0 ? (
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
                              DNI: {c.dni || "N/D"} •{" "}
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

              <div className="flex justify-end">
                <Button disabled={!selectedCustomer} onClick={() => setStep(2)}>
                  Siguiente
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========== PASO 2: PRODUCTOS / CARRITO ========== */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium ">Seleccionar productos</h3>

              {/* Producto */}
              <div className="relative">
                <Input
                  placeholder="Buscar producto..."
                  value={selectedProduct ? selectedProduct.name : searchProduct}
                  onFocus={() => setFocusProduct(true)}
                  onBlur={() => setTimeout(() => setFocusProduct(false), 160)}
                  onChange={(e) => {
                    setSelectedProduct(null);
                    setSearchProduct(e.target.value);
                  }}
                />
                {focusProduct && (
                  <div className="absolute z-[50] mt-1 w-full rounded-md border bg-background shadow">
                    <ScrollArea className="max-h-[250px] overflow-y-auto">
                      {(products || []).length > 0 ? (
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

              {/* Variantes */}
              <div className="relative">
                <Input
                  placeholder={
                    selectedProduct
                      ? "Buscar variantes disponibles..."
                      : "Selecciona un producto primero"
                  }
                  value={searchVariant}
                  onFocus={() => setFocusVariant(true)}
                  onBlur={() => setTimeout(() => setFocusVariant(false), 160)}
                  onChange={(e) => setSearchVariant(e.target.value)}
                  disabled={!selectedProduct}
                />
                {focusVariant && selectedProduct && (
                  <div className="absolute z-[50] mt-1 w-full rounded-md border bg-background shadow">
                    <ScrollArea className="max-h-[250px] overflow-y-auto">
                      {(variants || []).length > 0 ? (
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
                              {v.color || ""} • Stock: {v.stock} • USD{" "}
                              {v.usd_price}
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

              {/* Carrito */}
              {selectedVariants.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="text-sm font-semibold">Carrito de venta</h4>
                  {selectedVariants.map((v) => (
                    <div
                      key={v.id}
                      className="border rounded-lg p-3 space-y-2 bg-muted/20"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {v.products?.name} - {v.variant_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {v.color} • Stock: {v.stock}
                            {v.storage ? ` • ${v.storage}GB` : ""}
                            {v.ram ? ` • ${v.ram} RAM` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(v.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                          title="Quitar"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-muted-foreground">Cantidad</label>
                          <Input
                            type="number"
                            value={v.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                v.id,
                                parseInt(e.target.value || "0", 10),
                                v.stock
                              )
                            }
                            className="w-full text-center"
                            min={1}
                            max={v.stock}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">IMEI/Código</label>
                          <Input
                            type="text"
                            placeholder="IMEI o código único"
                            value={v.imei || ""}
                            onChange={(e) => handleIMEIChange(v.id, e.target.value)}
                            className="w-full text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between pt-2 border-t">
                        <div className="text-xs text-muted-foreground">Subtotal</div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {formatARS(
                              v.usd_price * (exchangeRate || 0) * v.quantity
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            USD {v.usd_price} × {v.quantity}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between border-t pt-3 text-sm font-medium">
                    <span>Total:</span>
                    <span>{formatARS(baseTotal)}</span>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      className=""
                      disabled={selectedVariants.length === 0}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      <IconChevronLeft className="h-4 w-4" />
                      Volver
                    </Button>

                    <Button
                      className=""
                      disabled={selectedVariants.length === 0}
                      onClick={() => {
                        // Validar IMEI obligatorio
                        const missingIMEI = selectedVariants.find(
                          (v) => !v.imei || v.imei.trim() === ""
                        );

                        if (missingIMEI) {
                          toast.error(
                            `Los productos requieren IMEI/Código.`
                          );
                          return;
                        }

                        setStep((s) => (s < 3 ? s + 1 : s));
                      }}
                    >
                      Siguiente
                      <IconChevronRight className="h-4 w-4" />
                    </Button>

                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== PASO 3: PAGO ========== */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium">Métodos de Pago</h3>

              {payments.map((p, i) => (
                <div
                  key={i}
                  className="border p-3 rounded-md space-y-3 bg-muted/40"
                >
                  {/* Selects arriba */}
                  <div className="flex items-center gap-2">
                    {methodIcon(p.method)}

                    <Select
                      value={
                        p.payment_method_id ? String(p.payment_method_id) : ""
                      }
                      onValueChange={(val) => {
                        const chosen = paymentMethods.find(
                          (m) => String(m.id) === val
                        );

                        updatePaymentField(i, "payment_method_id", val);
                        updatePaymentField(i, "method_name", chosen?.name);
                        updatePaymentField(
                          i,
                          "method",
                          chosen?.name.toLowerCase()
                        );
                        updatePaymentField(i, "installments", "");
                        updatePaymentField(
                          i,
                          "multiplier",
                          chosen?.multiplier || 1
                        );
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Método de pago..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {getInstallmentsForMethod(p.payment_method_id).length >
                      0 && (
                        <Select
                          value={p.installments || ""}
                          onValueChange={(val) => {
                            const inst = getInstallmentsForMethod(
                              p.payment_method_id
                            ).find((x) => x.installments === Number(val));
                            updatePaymentField(i, "installments", val);
                            updatePaymentField(
                              i,
                              "multiplier",
                              inst?.multiplier || 1
                            );
                          }}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="Cuotas" />
                          </SelectTrigger>
                          <SelectContent>
                            {getInstallmentsForMethod(p.payment_method_id).map(
                              (inst) => (
                                <SelectItem
                                  key={inst.id}
                                  value={inst.installments.toString()}
                                >
                                  {inst.installments} cuotas
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      )}

                    {payments.length > 1 && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removePaymentRow(i)}
                        title="Eliminar"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Inputs debajo */}
                  <div className="grid gap-2">
                    <div className="flex gap-2 items-end">
                      <Input
                        className="flex-1"
                        placeholder="Monto (ARS)"
                        type="number"
                        value={p.amount}
                        onChange={(e) =>
                          updatePaymentField(i, "amount", e.target.value)
                        }
                      />
                      {i === payments.length - 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updatePaymentField(i, "amount", String(remaining));
                          }}
                        >
                          Restante
                        </Button>
                      )}
                    </div>

                    {p.method === "transferencia" && (
                      <Input
                        placeholder="Referencia de transferencia"
                        value={p.reference || ""}
                        onChange={(e) =>
                          updatePaymentField(i, "reference", e.target.value)
                        }
                      />
                    )}
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addPaymentRow}
                className="w-full"
              >
                <IconCirclePlus className="h-4 w-4 mr-1" />
                Agregar otro pago
              </Button>

              {/* Totales */}
              <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
                <div className="text-muted-foreground">Subtotal USD:</div>
                <div className="text-right font-semibold">
                  {subtotalUSD.toFixed(2)} USD
                </div>

                <div className="text-muted-foreground">Cotización:</div>
                <div className="text-right">${exchangeRate}</div>

                <div className="text-muted-foreground">Total base ARS:</div>
                <div className="text-right font-semibold">
                  {formatARS(baseTotal)}
                </div>

                {payments.map((p, i) => {
                  if (!p.payment_method_id) return null;
                  const amount = Number(p.amount || 0);
                  return (
                    <div key={i} className="col-span-2 flex justify-between">
                      <div className="text-muted-foreground">
                        {p.method_name || "Método"}:
                      </div>
                      <div className="text-right">{formatARS(amount)}</div>
                    </div>
                  );
                })}

                <div className="text-muted-foreground font-medium border-t mt-2 pt-2">
                  Total Final ARS:
                </div>
                <div className="text-right font-bold text-primary border-t mt-2 pt-2">
                  {formatARS(totalWithSurcharge)}
                </div>

                <div className="text-muted-foreground">Pagado:</div>
                <div
                  className={`text-right font-semibold ${Math.round(paidARS) === Math.round(totalWithSurcharge)
                    ? "text-green-600"
                    : "text-red-600"
                    }`}
                >
                  {formatARS(paidARS)}
                </div>

                <div className="text-muted-foreground">Restante:</div>
                <div
                  className={`text-right font-bold ${remaining === 0 ? "text-green-600" : "text-blue-600"
                    }`}
                >
                  {formatARS(remaining)}
                </div>
              </div>

              <Textarea
                placeholder="Notas de la operación (opcional)"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />

              {/* ✅ Botón Volver + Finalizar */}
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  className=""
                  onClick={() => setStep(2)}
                >
                  <IconChevronLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>

                <Button className="" disabled={loading} onClick={handleSubmit}>
                  {loading ? "Guardando..." : "Finalizar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <SheetFooter />
      </SheetContent>

      {/* Comprobante / Factura */}
      {invoiceData && (
        <DialogSaleInvoice
          open={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
          sale={{ ...invoiceData, reset: resetFormData }}
        />
      )}

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
