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
  const [loading, setLoading] = useState(true);
  const [inventoryAll, setInventoryAll] = useState([]);

  // 🔹 Ajuste de stock
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustment, setAdjustment] = useState({
    type: "ajuste",
    quantity: 0,
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

  // 🔹 Obtener inventario
  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("product_id, stock, updated_at, products(name, brands(name))");

    if (error) {
      console.error("error", error);
      Swal.fire("Error", "No se pudo cargar el inventario", "error");
    } else {
      const sorted = data.sort((a, b) =>
        a.products.name.localeCompare(b.products.name)
      );
      setInventory(sorted);
      setInventoryAll(sorted);
    }

    setLoading(false);
  };

  const handleSearch = (value) => {
  const query = value.toLowerCase();
  if (!query) {
    setInventory(inventoryAll); // 👈 si está vacío, restaurar todo
    return;
  }

  const filtered = inventoryAll.filter((item) => {
    const productName = item.products?.name?.toLowerCase() || "";
    const brandName = item.products?.brands?.name?.toLowerCase() || "";
    return (
      productName.includes(query) ||
      brandName.includes(query)
    );
  });

  setInventory(filtered);
};


  useEffect(() => {
    fetchInventory();
  }, []);

  // 🔹 Traer productos que aún no tienen inventario
  const fetchAvailableProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brands(name)");

    if (error) {
      Swal.fire("Error", "No se pudieron cargar los productos", "error");
      console.log("error", error);
      return;
    }

    // Filtrar los productos ya existentes en inventario
    const withoutInventory = data.filter(
      (p) => !inventory.some((i) => i.product_id === p.id)
    );
    setAvailableProducts(withoutInventory);
  };

  // 🔹 Guardar ajuste de stock
  const handleStockAdjust = async () => {
    const { type, quantity, reason } = adjustment;
    const value = parseInt(quantity);
    if (!value || value <= 0) {
      setIsDialogOpen(false);
      await Swal.fire("Error", "Cantidad inválida", "warning");
      return;
    }
    const movement = {
      product_id: selectedProduct.product_id,
      type,
      quantity: value,
      reason: reason || "Ajuste manual",
      created_by: currentUser,
    };

    const { error } = await supabase
      .from("inventory_movements")
      .insert([movement]);

    if (error) {
      setIsDialogOpen(false);
      await Swal.fire("Error", "No se pudo registrar el movimiento", "error");
    } else {
      Swal.fire("Éxito", "Stock actualizado correctamente", "success");
      setIsDialogOpen(false);
      fetchInventory();
    }
  };

  // 🔹 Agregar nuevo inventario
  const handleAddInventory = async () => {
    const { product_id, stock, notes } = newInventory;

    if (!product_id || !stock) {
      setIsNewDialogOpen(false);
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
      // Registrar movimiento inicial
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
      <div className="flex justify-between items-center mt-4">
        <div className="">
          <Input
            type="text"
            placeholder="Buscar por producto o marca..."
            className="w-72"
            onChange={(e) => handleSearch(e.target.value)}
          />
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
          <CardHeader className="flex items-center justify-between">
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
                        {item.products.brands?.name}
                      </p>
                      <Badge
                        variant={item.stock <= 2 ? "destructive" : "outline"}
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
                          quantity: 0,
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
                onChange={(e) =>
                  setAdjustment({ ...adjustment, type: e.target.value })
                }
                className="border rounded-md p-2"
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                placeholder="Ej: 10"
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
