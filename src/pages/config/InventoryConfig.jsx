import React, { useEffect, useState } from "react";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConcentricLoader from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { IconBox, IconPlus, IconEdit, IconRefresh } from "@tabler/icons-react";
// ❌ ELIMINADO: import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContextProvider";

const InventoryConfig = () => {
  const { user } = useAuth();
  const currentUser =
    user?.user_metadata?.full_name || user?.email || "Usuario desconocido";

  const [inventory, setInventory] = useState([]);
  const [inventoryAll, setInventoryAll] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Filtros
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Ajuste de stock
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustment, setAdjustment] = useState({
    type: "ajuste",
    quantity: "",
    reason: "",
  });

  // 🔹 Nuevo inventario
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newInventory, setNewInventory] = useState({
    product_id: "",
    stock: "",
    notes: "",
  });
  const [availableProducts, setAvailableProducts] = useState([]);

  // 🔹 Obtener inventario + marcas + categorías
  const fetchInventory = async () => {
    setLoading(true);

    const [
      { data: inv, error: invError },
      { data: brandData },
      { data: catData },
    ] = await Promise.all([
      supabase
        .from("inventory")
        .select(
          "product_id, stock, updated_at, products(id, name, brand_id, category_id, brands(name), categories(name))"
        ),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("categories").select("id, name").order("name"),
    ]);

    if (invError) {
      console.error(invError);
      // 🔄 REEMPLAZO 1: Usar toast para error de carga
      toast.error("Error", {
        description: "No se pudo cargar el inventario.",
      });
    } else {
      const sorted = inv.sort((a, b) =>
        a.products.name.localeCompare(b.products.name)
      );
      setInventory(sorted);
      setInventoryAll(sorted);
      setBrands(brandData || []);
      setCategories(catData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // 🔹 Aplicar filtros y búsqueda
  const applyFilters = () => {
    let filtered = [...inventoryAll];
    const query = searchTerm.toLowerCase();

    if (query) {
      filtered = filtered.filter((item) => {
        const productName = item.products?.name?.toLowerCase() || "";
        const brandName = item.products?.brands?.name?.toLowerCase() || "";
        return productName.includes(query) || brandName.includes(query);
      });
    }

    if (selectedBrand) {
      filtered = filtered.filter(
        (item) => item.products.brand_id === parseInt(selectedBrand)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(
        (item) => item.products.category_id === parseInt(selectedCategory)
      );
    }

    setInventory(filtered);
  };

  // 👇 Ejecuta el filtro automáticamente cada vez que cambian los valores
  useEffect(() => {
    applyFilters();
  }, [searchTerm, selectedBrand, selectedCategory, inventoryAll]);

  // 🔹 Traer productos sin inventario
  const fetchAvailableProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brands(name)");

    if (error) {
      // 🔄 REEMPLAZO 2: Usar toast para error de carga de productos
      toast.error("Error", {
        description: "No se pudieron cargar los productos.",
      });
      return;
    }

    const withoutInventory = data.filter(
      (p) => !inventory.some((i) => i.product_id === p.id)
    );
    setAvailableProducts(withoutInventory);
  };

  // 🔹 Guardar ajuste de stock y actualizar en Supabase
  const handleStockAdjust = async () => {
    const { type, quantity, reason } = adjustment;

    // permitir 0, validar solo que sea número y no negativo
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount < 0) {
      // 🔄 REEMPLAZO 3: Usar toast para cantidad inválida
      toast.warning("Error", {
        description: "Cantidad inválida. Debe ser un número no negativo.",
      });
      return;
    }

    const productId = selectedProduct.product_id;
    const current = Number(selectedProduct?.stock ?? 0);

    let newStock = current;
    if (type === "entrada") {
      newStock = current + amount;
    } else if (type === "salida") {
      newStock = Math.max(0, current - amount);
    } else {
      // ajuste
      newStock = amount;
    }

    // 1) Actualizar inventario
    const { error: updateError } = await supabase
      .from("inventory")
      .update({ stock: newStock, updated_at: new Date() })
      .eq("product_id", productId);

    if (updateError) {
      // 🔄 REEMPLAZO 4: Usar toast para error de actualización de stock
      toast.error("Error", {
        description: "No se pudo actualizar el stock en el inventario.",
      });
      return;
    }

    // 2) Registrar movimiento (guardamos la cantidad ingresada)
    const { error: movementError } = await supabase
      .from("inventory_movements")
      .insert([
        {
          product_id: productId,
          type,
          quantity: amount,
          reason: reason || "Ajuste manual",
          created_by: currentUser,
        },
      ]);

    if (movementError) {
      // 🔄 REEMPLAZO 5: Usar toast para error de registro de movimiento
      toast.error("Error", {
        description: "Se actualizó el stock, pero no se pudo registrar el movimiento.",
      });
      return;
    }

    setIsDialogOpen(false);
    // 🔄 REEMPLAZO 6: Usar toast para éxito
    toast.success("Éxito", {
      description: `Stock de ${selectedProduct.products.name} actualizado a ${newStock}.`,
    });
    fetchInventory();
  };

  // 🔹 Agregar nuevo inventario
  const handleAddInventory = async () => {
    const { product_id, stock, notes } = newInventory;

    if (!product_id || !stock) {
      // 🔄 REEMPLAZO 7: Usar toast para campos requeridos
      toast.warning("Campos requeridos", {
        description: "Seleccioná producto y cantidad inicial.",
      });
      return;
    }

    const { error } = await supabase.from("inventory").insert([
      {
        product_id: parseInt(product_id),
        stock: parseInt(stock),
        updated_at: new Date(),
      },
    ]);

    if (error) {
      // 🔄 REEMPLAZO 8: Usar toast para error al agregar inventario
      toast.error("Error", {
        description: "No se pudo agregar el producto al inventario.",
      });
    } else {
      await supabase.from("inventory_movements").insert([
        {
          product_id: parseInt(product_id),
          type: "entrada",
          quantity: parseInt(stock),
          reason: notes || "Carga inicial",
          created_by: currentUser,
        },
      ]);

      // 🔄 REEMPLAZO 9: Usar toast para éxito
      toast.success("Éxito", {
        description: "Inventario agregado correctamente.",
      });
      setIsNewDialogOpen(false);
      setNewInventory({ product_id: "", stock: "", notes: "" });
      fetchInventory();
    }
  };

  return (
    <>
      {/* <SiteHeader titulo="Configuración de Inventario" /> */}
      <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            type="text"
            placeholder="Buscar por producto o marca..."
            className="w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Select
            value={selectedBrand}
            onValueChange={setSelectedBrand}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInventory}>
            <IconRefresh className="h-4 w-4" /> Refrescar
          </Button>

          <Button
            onClick={() => {
              fetchAvailableProducts();
              setIsNewDialogOpen(true);
            }}
          >
            <IconPlus className="h-4 w-4" /> Agregar
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <IconBox className="text-amber-600" />
              Inventario de Productos
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : inventory.length > 0 ? (
              <div className="space-y-3">
                {inventory.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between border-b py-2"
                  >
                    <div>
                      <p className="font-medium">{item.products.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.products.brands?.name} •{" "}
                        {item.products.categories?.name}
                      </p>
                      <Badge
                        variant={item.stock <= 2 ? "destructive" : "outline"}
                        className={item.stock > 2 && "bg-blue-500 text-white"}
                      >
                        Stock actual: {item.stock}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(item);
                        setAdjustment({
                          type: "ajuste",
                          quantity: String(item.stock ?? 0),
                          reason: "",
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay productos registrados en inventario.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 🔹 Modal Ajuste de Stock */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ajustar stock – {selectedProduct?.products.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Tipo de movimiento</Label>
              <Select
                value={adjustment.type}
                onValueChange={(newType) => {
                  setAdjustment((prev) => ({
                    ...prev,
                    type: newType,
                    // si paso a entrada/salida, dejo vacío; si es ajuste, prefijo stock actual
                    quantity:
                      newType === "ajuste"
                        ? String(selectedProduct?.stock ?? 0)
                        : "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (Sumar)</SelectItem>
                  <SelectItem value="salida">Salida (Restar)</SelectItem>
                  <SelectItem value="ajuste">Ajuste (Stock final)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              Stock actual: {selectedProduct?.stock ?? "-"}
            </p>

            <div className="grid gap-2">
              <Label>
                {adjustment.type === "ajuste" ? "Stock final" : "Cantidad"}
              </Label>
              <Input
                type="number"
                placeholder={
                  adjustment.type === "ajuste" ? "Stock final" : "Cantidad"
                }
                value={adjustment.quantity}
                onChange={(e) =>
                  setAdjustment({ ...adjustment, quantity: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Textarea
                placeholder="Ej: ingreso de stock, venta manual, error de conteo..."
                value={adjustment.reason}
                onChange={(e) =>
                  setAdjustment({ ...adjustment, reason: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleStockAdjust}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔹 Modal Agregar nuevo inventario */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar nuevo inventario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Producto</Label>
              <Select
                value={newInventory.product_id}
                onValueChange={(value) =>
                  setNewInventory({
                    ...newInventory,
                    product_id: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Seleccionar producto...</SelectItem>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} ({p.brands?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Stock inicial</Label>
              <Input
                type="number"
                placeholder="Ej: 10"
                value={newInventory.stock}
                onChange={(e) =>
                  setNewInventory({ ...newInventory, stock: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Comentario</Label>
              <Textarea
                placeholder="Ej: carga inicial, stock de apertura..."
                value={newInventory.notes}
                onChange={(e) =>
                  setNewInventory({ ...newInventory, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleAddInventory}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InventoryConfig;