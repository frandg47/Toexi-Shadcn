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
import { Switch } from "@/components/ui/switch";
import { IconPlus, IconTrash, IconDeviceFloppy } from "@tabler/icons-react";
import Swal from "sweetalert2";

export default function DialogVariants({ open, onClose, productId }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Cargar variantes al abrir
  useEffect(() => {
    const fetchVariants = async () => {
      if (!productId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("id", { ascending: true });
      if (!error) setVariants(data || []);
      setLoading(false);
    };
    if (open) fetchVariants();
  }, [open, productId]);

  // 🔹 Manejar cambios en los campos
  const handleChange = (index, field, value) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  // 🔹 Agregar nueva variante local
  const addVariant = () => {
    setVariants([
      ...variants,
      {
        product_id: productId,
        storage: "",
        ram: "",
        color: "",
        usd_price: "",
        stock: 0,
        image_url: "",
        active: true,
      },
    ]);
  };

  // 🔹 Eliminar variante local o remota
  const removeVariant = async (index, variant) => {
    if (variant.id) {
      const confirm = await Swal.fire({
        title: "Eliminar variante",
        text: "¿Deseas eliminar esta variante?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });
      if (!confirm.isConfirmed) return;

      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variant.id);

      if (error) {
        Swal.fire("Error", "No se pudo eliminar la variante", "error");
        return;
      }
    }

    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // 🔹 Guardar cambios (update / insert)
  const saveVariants = async () => {
    const inserts = variants.filter((v) => !v.id);
    const updates = variants.filter((v) => v.id);

    const { error: insertError } =
      inserts.length > 0
        ? await supabase.from("product_variants").insert(inserts)
        : { error: null };

    const { error: updateError } =
      updates.length > 0
        ? await Promise.all(
            updates.map((v) =>
              supabase.from("product_variants").update(v).eq("id", v.id)
            )
          )
        : { error: null };

    if (insertError || updateError) {
      Swal.fire("Error", "No se pudieron guardar los cambios", "error");
      return;
    }

    Swal.fire("Éxito", "Variantes guardadas correctamente", "success");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Gestionar variantes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground py-4">
            Cargando variantes...
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {variants.map((v, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-7 gap-2 border rounded-md p-2 bg-card shadow-sm"
              >
                <Input
                  placeholder="Storage"
                  value={v.storage || ""}
                  onChange={(e) => handleChange(index, "storage", e.target.value)}
                />
                <Input
                  placeholder="RAM"
                  value={v.ram || ""}
                  onChange={(e) => handleChange(index, "ram", e.target.value)}
                />
                <Input
                  placeholder="Color"
                  value={v.color || ""}
                  onChange={(e) => handleChange(index, "color", e.target.value)}
                />
                <Input
                  placeholder="USD"
                  type="number"
                  value={v.usd_price || ""}
                  onChange={(e) =>
                    handleChange(index, "usd_price", parseFloat(e.target.value))
                  }
                />
                <Input
                  placeholder="Stock"
                  type="number"
                  value={v.stock || 0}
                  onChange={(e) =>
                    handleChange(index, "stock", parseInt(e.target.value))
                  }
                />
                <Input
                  placeholder="Imagen (URL)"
                  value={v.image_url || ""}
                  onChange={(e) =>
                    handleChange(index, "image_url", e.target.value)
                  }
                />
                <div className="flex items-center justify-between px-2">
                  <Switch
                    checked={v.active}
                    onCheckedChange={(checked) =>
                      handleChange(index, "active", checked)
                    }
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => removeVariant(index, v)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addVariant} className="w-full">
              <IconPlus className="h-4 w-4 mr-2" /> Agregar variante
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={saveVariants}>
            <IconDeviceFloppy className="h-4 w-4 mr-2" /> Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
