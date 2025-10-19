import { useEffect, useState, useMemo } from "react";
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
  const [product, setProduct] = useState(null);

  // Configuración de campos visibles según categoría
  const VARIANT_FIELDS_BY_CATEGORY = {
    Celulares: ["storage", "ram", "color", "usd_price", "stock"],
    Tablets: ["storage", "ram", "color", "usd_price", "stock"],
    Auriculares: ["color", "usd_price", "stock"],
    Accesorios: ["color", "usd_price", "stock"],
    Notebooks: ["storage", "ram", "usd_price", "stock"],
    default: ["color", "usd_price", "stock"],
  };

  // Determinar qué campos mostrar
  const visibleFields = useMemo(() => {
    if (!product?.categories?.name) return VARIANT_FIELDS_BY_CATEGORY.default;
    return (
      VARIANT_FIELDS_BY_CATEGORY[product.categories.name] ||
      VARIANT_FIELDS_BY_CATEGORY.default
    );
  }, [product]);

  // Cargar producto y variantes
  useEffect(() => {
    const fetchData = async () => {
      if (!productId) return;
      setLoading(true);

      const { data: productData } = await supabase
        .from("products")
        .select("*, brands(name), categories(name)")
        .eq("id", productId)
        .single();

      setProduct(productData || null);

      const { data: variantsData } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("id", { ascending: true });

      setVariants(variantsData || []);
      setLoading(false);
    };

    if (open) fetchData();
  }, [open, productId]);

  const handleChange = (index, field, value) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        product_id: productId,
        variant_name: "",
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
          <DialogTitle className="text-2xl font-bold">
            Gestionar variantes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <>
            {product && (
              <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Marca:</span>{" "}
                      {product.brands?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Categoría:</span>{" "}
                      {product.categories?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Campos mostrados:{" "}
                      {visibleFields.join(", ") || "por defecto"}
                    </p>
                  </div>
                  <div className="flex justify-center items-center">
                    <img
                      src={product.cover_image_url}
                      alt={product.name}
                      className="h-24 w-24 object-contain rounded-md border bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {variants.length} variante
                  {variants.length !== 1 ? "s" : ""} configurada
                  {variants.length !== 1 ? "s" : ""}
                </h4>
                <Button variant="outline" onClick={addVariant} size="sm">
                  <IconPlus className="h-4 w-4 mr-2" /> Nueva variante
                </Button>
              </div>

              <div className="space-y-3">
                {variants.map((v, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 bg-card hover:border-primary/50 transition-colors space-y-4"
                  >
                    {/* Nombre de variante (manual o generado) */}
                    <div className="grid gap-2">
                      <Label htmlFor={`variant-name-${index}`}>
                        Nombre de variante
                      </Label>
                      <Input
                        id={`variant-name-${index}`}
                        placeholder="ej: 256GB / 8GB / Negro"
                        value={v.variant_name || ""}
                        onChange={(e) =>
                          handleChange(index, "variant_name", e.target.value)
                        }
                      />
                    </div>

                    {/* Campos dinámicos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {visibleFields.includes("storage") && (
                        <div className="grid gap-2">
                          <Label>Almacenamiento</Label>
                          <Input
                            placeholder="256GB"
                            value={v.storage || ""}
                            onChange={(e) =>
                              handleChange(index, "storage", e.target.value)
                            }
                          />
                        </div>
                      )}

                      {visibleFields.includes("ram") && (
                        <div className="grid gap-2">
                          <Label>RAM</Label>
                          <Input
                            placeholder="8GB"
                            value={v.ram || ""}
                            onChange={(e) =>
                              handleChange(index, "ram", e.target.value)
                            }
                          />
                        </div>
                      )}

                      {visibleFields.includes("color") && (
                        <div className="grid gap-2">
                          <Label>Color</Label>
                          <Input
                            placeholder="Negro"
                            value={v.color || ""}
                            onChange={(e) =>
                              handleChange(index, "color", e.target.value)
                            }
                          />
                        </div>
                      )}

                      {visibleFields.includes("usd_price") && (
                        <div className="grid gap-2">
                          <Label>Precio USD</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={v.usd_price || ""}
                            onChange={(e) =>
                              handleChange(
                                index,
                                "usd_price",
                                parseFloat(e.target.value)
                              )
                            }
                          />
                        </div>
                      )}

                      {visibleFields.includes("stock") && (
                        <div className="grid gap-2">
                          <Label>Stock</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={v.stock || 0}
                            onChange={(e) =>
                              handleChange(
                                index,
                                "stock",
                                parseInt(e.target.value)
                              )
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Estado y eliminar */}
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={v.active}
                          onCheckedChange={(checked) =>
                            handleChange(index, "active", checked)
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {v.active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeVariant(index, v)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {variants.length === 0 && (
                  <div className="text-center py-8 border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground">
                      No hay variantes configuradas
                    </p>
                    <Button variant="link" onClick={addVariant} className="mt-2">
                      Agregar la primera variante
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={saveVariants} disabled={variants.length === 0}>
            <IconDeviceFloppy className="h-4 w-4 mr-2" />
            Guardar {variants.length} variante{variants.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
