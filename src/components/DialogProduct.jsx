import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
// ❌ ELIMINADO: import Swal from "sweetalert2";

// ✅ AGREGADO: Import de Sonner para notificaciones
import { toast } from "sonner";

export default function DialogProduct({ open, onClose, product, onSave }) {
  const isEditing = !!product;
  console.log("producto a editar:", product);
  console.log("rule", product?.commissionRuleName);
  const [form, setForm] = useState({
    name: "",
    brand_id: "",
    category_id: "",
    usd_price: "",
    commission_pct: "",
    commission_fixed: "",
    cover_image_url: "",
    allow_backorder: false,
    lead_time_label: "",
    active: true,
  });

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        brand_id: product.brand_id || "",
        category_id: product.category_id || "",
        usd_price: product.usd_price || product.usdPrice || "",
        commission_pct:
          product.commissionRuleName === "Propia"
            ? product.commission_pct || product.commissionPct || ""
            : "",
        commission_fixed:
          product.commissionRuleName === "Propia"
            ? product.commission_fixed || product.commissionFixed || ""
            : "",
        cover_image_url: product.cover_image_url || product.coverImageUrl || "",
        allow_backorder:
          product.allow_backorder ?? product.allowBackorder ?? false,
        lead_time_label: product.lead_time_label || product.leadTimeLabel || "",
        active: product.active ?? true,
      });
    } else {
      // si es nuevo producto
      setForm({
        name: "",
        brand_id: "",
        category_id: "",
        usd_price: "",
        commission_pct: "",
        commission_fixed: "",
        cover_image_url: "",
        allow_backorder: false,
        lead_time_label: "",
        active: true,
      });
    }
  }, [product]);

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: br }, { data: cat }] = await Promise.all([
        supabase.from("brands").select("id, name"),
        supabase.from("categories").select("id, name"),
      ]);
      setBrands(br || []);
      setCategories(cat || []);
    };
    fetchOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSwitch = (name, checked) => {
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const saveProduct = async (payload) => {
    if (isEditing) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id);
      if (error) throw new Error("Error al actualizar el producto.");
    } else {
      const { error } = await supabase
        .from("products")
        .insert([payload]);
      if (error) throw new Error("Error al crear el producto.");
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.usd_price) {
      // ⚠️ Reemplazo 1: SweetAlert Warning por toast.warning
      toast.warning(
        "Campos requeridos: Completa al menos nombre y precio"
      );
      return;
    }

    const payload = {
      name: form.name,
      brand_id: form.brand_id ? parseInt(form.brand_id) : null,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      usd_price: parseFloat(form.usd_price),
      commission_pct: form.commission_pct
        ? parseFloat(form.commission_pct)
        : null,
      commission_fixed: form.commission_fixed
        ? parseFloat(form.commission_fixed)
        : null,
      cover_image_url: form.cover_image_url || null,
      allow_backorder: form.allow_backorder,
      lead_time_label: form.allow_backorder
        ? form.lead_time_label || null
        : null,
      active: form.active,
    };

    const successMessage = isEditing
      ? "Producto actualizado correctamente"
      : "Producto creado correctamente";
    
    // 🔁 Reemplazo 2: Flujo con loading, éxito y error usando toast.promise
    try {
      await toast.promise(saveProduct(payload), {
        loading: "Guardando producto...",
        success: successMessage,
        error: (err) => {
          // Si saveProduct lanza un error, se maneja aquí.
          // Se usa el mensaje del error lanzado, o un default.
          return err.message || "No se pudo guardar el producto";
        },
      });

      // Si el promise fue exitoso, cerramos el diálogo y actualizamos la lista
      onClose();
      onSave();

    } catch (e) {
      // La promesa falló, el toast ya mostró el error. No hacemos nada más aquí.
      // Si el error es manejado dentro del toast.promise, este catch
      // es opcional, pero lo dejamos por si hay otros errores no capturados.
      console.error("Error en el guardado (capturado por promise):", e);
    }

    // ❌ ELIMINADO: La lógica de error y éxito de Swal se encapsuló en toast.promise
    /*
    let error;
    // ... lógica de guardado con error
    if (error) {
      Swal.fire("Error", "No se pudo guardar el producto", "error");
      return;
    }
    Swal.fire(
      "Éxito",
      isEditing
        ? "Producto actualizado correctamente"
        : "Producto creado correctamente",
      "success"
    );
    onClose();
    onSave();
    */
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* 🧾 Nombre */}
          <div className="flex flex-col gap-2">
            <Label>Nombre</Label>
            <Input name="name" value={form.name} onChange={handleChange} />
          </div>

          {/* 🏷️ Marca y categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Marca</Label>
              <select
                name="brand_id"
                value={form.brand_id || ""}
                onChange={handleChange}
                className="w-full rounded-md border p-2"
              >
                <option value="">Seleccionar...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Categoría</Label>
              <select
                name="category_id"
                value={form.category_id || ""}
                onChange={handleChange}
                className="w-full rounded-md border p-2"
              >
                <option value="">Seleccionar...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 💵 Precios y comisiones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Precio (USD)</Label>
              <Input
                name="usd_price"
                type="number"
                step="0.01"
                value={form.usd_price}
                onChange={handleChange}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Comisión (%)</Label>
              <Input
                name="commission_pct"
                type="number"
                step="0.01"
                disabled={!!form.commission_fixed}
                value={form.commission_pct || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Comisión fija (USD)</Label>
            <Input
              name="commission_fixed"
              type="number"
              step="0.01"
              disabled={!!form.commission_pct}
              value={form.commission_fixed || ""}
              onChange={handleChange}
            />
          </div>

          {/* 🖼️ Imagen */}
          <div className="flex flex-col gap-2">
            <Label>Imagen (URL)</Label>
            <Textarea
              name="cover_image_url"
              placeholder="https://..."
              value={form.cover_image_url || ""}
              onChange={handleChange}
            />
          </div>

          {/* 🔁 Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label className="text-sm">Permitir backorder</Label>
              <Switch
                checked={form.allow_backorder}
                onCheckedChange={(checked) =>
                  handleSwitch("allow_backorder", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <Label className="text-sm">Activo</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => handleSwitch("active", checked)}
              />
            </div>
          </div>

          {/* ⏱️ Tiempo de entrega (solo si backorder activo) */}
          {form.allow_backorder && (
            <div className="flex flex-col gap-2 mt-2">
              <Label>Tiempo de entrega</Label>
              <Input
                name="lead_time_label"
                placeholder='Ej: "Pedido en 3-4 días"'
                value={form.lead_time_label || ""}
                onChange={handleChange}
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}