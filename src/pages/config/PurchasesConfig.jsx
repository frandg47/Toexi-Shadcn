import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContextProvider";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n || 0);

const formatUSD = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0);

const PurchasesConfig = () => {
  const { role } = useAuth();
  const isOwner = role?.toLowerCase() === "owner";
  const [providers, setProviders] = useState([]);
  const [variants, setVariants] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [fxRate, setFxRate] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [form, setForm] = useState({
    provider_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    currency: "ARS",
    account_id: "",
    notes: "",
  });
  const [items, setItems] = useState([]);
  const [searchVariant, setSearchVariant] = useState("");
  const [focusVariant, setFocusVariant] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [
        { data: prov },
        { data: vars },
        { data: rate },
        { data: list },
        { data: accountsData },
      ] =
        await Promise.all([
          supabase.from("providers").select("id, name").order("name"),
          supabase
            .from("product_variants")
            .select("id, variant_name, color, storage, ram, products(name)")
            .eq("active", true)
            .order("id", { ascending: true }),
          supabase
            .from("fx_rates")
            .select("rate")
            .eq("is_active", true)
            .eq("source", "blue")
            .maybeSingle(),
          supabase
            .from("purchases")
            .select(
              "id, purchase_date, total_amount, currency, providers(name), notes"
            )
            .order("purchase_date", { ascending: false })
            .limit(20),
          supabase
            .from("accounts")
            .select("id, name, currency")
            .order("name", { ascending: true }),
        ]);

      setProviders(prov || []);
      setVariants(vars || []);
      setFxRate(rate?.rate ? Number(rate.rate) : null);
      setPurchases(list || []);
      setAccounts(accountsData || []);
    };

    load();
  }, []);

  const accountsForCurrency = useMemo(
    () => accounts.filter((acc) => acc.currency === form.currency),
    [accounts, form.currency]
  );

  useEffect(() => {
    if (!accountsForCurrency.length) {
      if (form.account_id) {
        setForm((f) => ({ ...f, account_id: "" }));
      }
      return;
    }
    if (
      form.account_id &&
      !accountsForCurrency.some((acc) => String(acc.id) === form.account_id)
    ) {
      setForm((f) => ({ ...f, account_id: "" }));
      return;
    }
    if (accountsForCurrency.length === 1 && !form.account_id) {
      setForm((f) => ({ ...f, account_id: String(accountsForCurrency[0].id) }));
    }
  }, [accountsForCurrency, form.account_id]);

  const totalAmount = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + Number(item.quantity || 0) * Number(item.unit_cost || 0),
      0
    );
  }, [items]);

  const handleAddItem = (variant) => {
    if (items.some((i) => i.variant_id === variant.id)) return;
    setItems((prev) => [
      ...prev,
      { variant_id: variant.id, variant, quantity: 1, unit_cost: "" },
    ]);
    setSearchVariant("");
  };

  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((i) =>
        i.variant_id === id ? { ...i, [field]: value } : i
      )
    );
  };

  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== id));
  };

  const handleSave = async () => {
    if (!form.provider_id) return toast.error("Selecciona un proveedor");
    if (!form.account_id) return toast.error("Selecciona una cuenta");
    if (!items.length) return toast.error("Agrega al menos un producto");

    const currency = form.currency;
    if (currency === "USD" && !fxRate) {
      return toast.error("No hay cotizacion activa para USD");
    }
    const totalAmountArs = currency === "USD" ? totalAmount * fxRate : totalAmount;

    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert([
        {
          provider_id: Number(form.provider_id),
          purchase_date: form.purchase_date,
          currency,
          total_amount: totalAmount,
          total_amount_ars: totalAmountArs,
          fx_rate_used: currency === "USD" ? fxRate : null,
          notes: form.notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      toast.error("No se pudo registrar la compra", { description: error.message });
      return;
    }

    const { error: paymentError } = await supabase
      .from("purchase_payments")
      .insert([
        {
          purchase_id: purchase.id,
          account_id: Number(form.account_id),
          amount: totalAmount,
          currency,
          amount_ars: totalAmountArs,
          fx_rate_used: currency === "USD" ? fxRate : null,
          notes: form.notes || null,
        },
      ]);

    if (paymentError) {
      toast.error("Compra creada, pero falló el pago", {
        description: paymentError.message,
      });
      return;
    }

    const payloadItems = items.map((i) => ({
      purchase_id: purchase.id,
      variant_id: i.variant_id,
      quantity: Number(i.quantity || 0),
      unit_cost: Number(i.unit_cost || 0),
      subtotal: Number(i.quantity || 0) * Number(i.unit_cost || 0),
    }));

    const { error: itemsError } = await supabase
      .from("purchase_items")
      .insert(payloadItems);

    if (itemsError) {
      toast.error("Compra creada, pero fallaron los items", {
        description: itemsError.message,
      });
      return;
    }

    toast.success("Compra registrada");
    setForm((f) => ({ ...f, notes: "" }));
    setItems([]);

    const { data: list } = await supabase
      .from("purchases")
      .select("id, purchase_date, total_amount, currency, providers(name), notes")
      .order("purchase_date", { ascending: false })
      .limit(20);
    setPurchases(list || []);
  };

  const openPurchaseDetail = async (purchase) => {
    if (!purchase?.id) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailPurchase(purchase);
    setDetailItems([]);

    const { data, error } = await supabase
      .from("purchase_items")
      .select(
        "id, quantity, unit_cost, subtotal, product_variants(variant_name, color, storage, ram, products(name))"
      )
      .eq("purchase_id", purchase.id)
      .order("id", { ascending: true });

    if (error) {
      toast.error("No se pudieron cargar los items", {
        description: error.message,
      });
      setDetailLoading(false);
      return;
    }

    setDetailItems(data || []);
    setDetailLoading(false);
  };

  if (!isOwner) {
    return <Navigate to="/unauthorized" replace />;
  }

  const filteredVariants = variants.filter((v) => {
    const name = `${v.products?.name || ""} ${v.variant_name || ""} ${v.color || ""}`
      .toLowerCase()
      .trim();
    return name.includes(searchVariant.toLowerCase());
  });

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registrar compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, purchase_date: e.target.value }))
              }
            />
            <Select
              value={form.provider_id}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, provider_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.currency}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, currency: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={form.account_id}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, account_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accountsForCurrency.length === 0 && (
                  <SelectItem value="none" disabled>
                    Sin cuentas para {form.currency}
                  </SelectItem>
                )}
                {accountsForCurrency.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Total"
              value={
                form.currency === "USD"
                  ? `USD ${totalAmount.toFixed(2)}`
                  : formatARS(totalAmount)
              }
              readOnly
            />
          </div>

          <div className="relative">
            <Input
              placeholder="Buscar producto/variante..."
              value={searchVariant}
              onFocus={() => setFocusVariant(true)}
              onBlur={() => setTimeout(() => setFocusVariant(false), 200)}
              onChange={(e) => setSearchVariant(e.target.value)}
            />
            {focusVariant && searchVariant && (
              <div className="absolute z-[50] mt-1 w-full rounded-md border bg-background shadow">
                <div className="max-h-64 overflow-y-auto">
                  {filteredVariants.length > 0 ? (
                    filteredVariants.slice(0, 40).map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => handleAddItem(v)}
                        className="w-full text-left px-3 py-2 hover:bg-muted"
                      >
                        {v.products?.name} {v.variant_name} {v.color}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Sin coincidencias
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo unit.</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.variant_id}>
                    <TableCell>
                      {item.variant?.products?.name} {item.variant?.variant_name}{" "}
                      {item.variant?.color}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(item.variant_id, "quantity", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) =>
                          handleUpdateItem(item.variant_id, "unit_cost", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {form.currency === "USD"
                        ? `USD ${(Number(item.quantity || 0) * Number(item.unit_cost || 0)).toFixed(2)}`
                        : formatARS(Number(item.quantity || 0) * Number(item.unit_cost || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveItem(item.variant_id)}
                      >
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Agrega productos a la compra.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Textarea
            placeholder="Notas"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <Button onClick={handleSave}>Guardar compra</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimas compras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => openPurchaseDetail(p)}
                  >
                    <TableCell>{p.purchase_date}</TableCell>
                    <TableCell>{p.providers?.name || "-"}</TableCell>
                    <TableCell>
                      {p.currency === "USD"
                        ? `USD ${Number(p.total_amount || 0).toFixed(2)}`
                        : formatARS(p.total_amount)}
                    </TableCell>
                    <TableCell>{p.notes || "-"}</TableCell>
                  </TableRow>
                ))}
                {purchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay compras registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Detalle de compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><strong>Proveedor:</strong> {detailPurchase?.providers?.name || "-"}</div>
            <div><strong>Fecha:</strong> {detailPurchase?.purchase_date || "-"}</div>
            <div>
              <strong>Total:</strong>{" "}
              {detailPurchase?.currency === "USD"
                ? formatUSD(detailPurchase?.total_amount)
                : formatARS(detailPurchase?.total_amount)}
            </div>
          </div>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo unit.</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Cargando items...
                    </TableCell>
                  </TableRow>
                )}
                {!detailLoading &&
                  detailItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_variants?.products?.name || "-"}</TableCell>
                      <TableCell>
                        {[item.product_variants?.variant_name, item.product_variants?.color]
                          .filter(Boolean)
                          .join(" ")}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {detailPurchase?.currency === "USD"
                          ? formatUSD(item.unit_cost)
                          : formatARS(item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        {detailPurchase?.currency === "USD"
                          ? formatUSD(item.subtotal)
                          : formatARS(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                {!detailLoading && detailItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No hay items registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesConfig;
