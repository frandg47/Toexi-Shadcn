import React, { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import Swal from "sweetalert2";
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
      Swal.fire("Error", "No se pudo cargar el inventario", "error");
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
      Swal.fire("Error", "No se pudieron cargar los productos", "error");
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
      await Swal.fire("Error", "Cantidad inválida", "warning");
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
    console.log("actualizo", productId, current, amount, newStock);

    // 1) Actualizar inventario
    const { error: updateError } = await supabase
      .from("inventory")
      .update({ stock: newStock, updated_at: new Date() })
      .eq("product_id", productId);

    if (updateError) {
      await Swal.fire("Error", "No se pudo actualizar el stock", "error");
      return;
    }

    // 2) Registrar movimiento (guardamos la cantidad ingresada)
    const { error: movementError } = await supabase
      .from("inventory_movements")
      .insert([
        {
          product_id: productId,
          type,
          quantity: amount, // delta para entrada/salida, valor final en ajuste si preferís podés guardar newStock
          reason: reason || "Ajuste manual",
          created_by: currentUser,
        },
      ]);

    if (movementError) {
      await Swal.fire("Error", "No se pudo registrar el movimiento", "error");
      return;
    }

    setIsDialogOpen(false);
    await Swal.fire("Éxito", "Stock actualizado correctamente", "success");
    fetchInventory();
  };

  // 🔹 Agregar nuevo inventario
  const handleAddInventory = async () => {
    const { product_id, stock, notes } = newInventory;

    if (!product_id || !stock) {
      await Swal.fire(
        "Campos requeridos",
        "Seleccioná producto y cantidad",
        "warning"
      );
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
      Swal.fire("Error", "No se pudo agregar el inventario", "error");
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

      Swal.fire("Éxito", "Inventario agregado correctamente", "success");
      setIsNewDialogOpen(false);
      setNewInventory({ product_id: "", stock: "", notes: "" });
      fetchInventory();
    }
  };

  return (
    <>
      <SiteHeader titulo="Configuración de Inventario" />
      <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            type="text"
            placeholder="Buscar por producto o marca..."
            className="w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="border rounded-md p-2 text-sm"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            className="border rounded-md p-2 text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
                      size="icon"
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
              <select
                value={adjustment.type}
                onChange={(e) => {
                  const newType = e.target.value;
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
                className="border rounded-md p-2"
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            <p className="text-sm text-muted-foreground">
              Stock actual: {selectedProduct?.stock ?? "-"}
            </p>

            <div className="grid gap-2">
              <Label>Nuevo stock</Label>
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
                placeholder="Ej: ingreso de stock, venta manual..."
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
              <select
                value={newInventory.product_id}
                onChange={(e) =>
                  setNewInventory({
                    ...newInventory,
                    product_id: e.target.value,
                  })
                }
                className="border rounded-md p-2"
              >
                <option value="">Seleccionar producto...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.brands?.name})
                  </option>
                ))}
              </select>
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
