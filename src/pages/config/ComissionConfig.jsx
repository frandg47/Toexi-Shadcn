import React, { useEffect, useState, useCallback } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { IconCurrencyDollar, IconEdit, IconTrash, IconPlus } from "@tabler/icons-react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabaseClient";

const ComissionConfig = () => {
  const [rules, setRules] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    brand_id: "",
    category_id: "",
    commission_pct: "",
    commission_fixed: "",
    priority: 100,
  });

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, brandsRes, categoriesRes] = await Promise.all([
        supabase
          .from("commission_rules")
          .select(`
            id,
            brand_id,
            category_id,
            commission_pct,
            commission_fixed,
            priority,
            brands(name),
            categories(name)
          `)
          .order("priority", { ascending: true }),
        supabase.from("brands").select("id, name").order("name"),
        supabase.from("categories").select("id, name").order("name"),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      setRules(rulesRes.data);
      setBrands(brandsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar las reglas de comisión", "error");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar regla?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from("commission_rules").delete().eq("id", id);
    if (error) {
      Swal.fire("Error", "No se pudo eliminar la regla", "error");
    } else {
      Swal.fire("Eliminado", "La regla fue eliminada correctamente", "success");
      fetchData();
    }
  };

  const handleSave = async () => {
    const payload = {
      brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      commission_pct: formData.commission_pct ? parseFloat(formData.commission_pct) : null,
      commission_fixed: formData.commission_fixed ? parseFloat(formData.commission_fixed) : null,
      priority: parseInt(formData.priority),
    };

    const { error } = editingRule
      ? await supabase.from("commission_rules").update(payload).eq("id", editingRule.id)
      : await supabase.from("commission_rules").insert([payload]);

    if (error) {
      Swal.fire("Error", "No se pudo guardar la regla", "error");
      return;
    }

    Swal.fire("Éxito", "La regla fue guardada correctamente", "success");
    setOpenDialog(false);
    setEditingRule(null);
    setFormData({ brand_id: "", category_id: "", commission_pct: "", commission_fixed: "", priority: 100 });
    fetchData();
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      brand_id: rule.brand_id || "",
      category_id: rule.category_id || "",
      commission_pct: rule.commission_pct || "",
      commission_fixed: rule.commission_fixed || "",
      priority: rule.priority,
    });
    setOpenDialog(true);
  };

  return (
    <>
      <SiteHeader titulo="Configuración de Comisiones" />
      <div className="mt-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setOpenDialog(true)}>
            <IconPlus className="h-4 w-4 mr-2" /> Nueva Regla
          </Button>
        </div>

        {/* Cards de reglas */}
        {rules.length === 0 ? (
          <p className="text-center text-muted-foreground mt-10">
            No hay reglas de comisión configuradas.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rules.map((rule) => (
              <Card key={rule.id} className="transition-all hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <IconCurrencyDollar className="text-blue-600" />
                      {rule.brands?.name || "Todas las marcas"} /{" "}
                      {rule.categories?.name || "Todas las categorías"}
                    </span>
                    <Badge variant="outline">Prioridad {rule.priority}</Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm">
                    <strong>Comisión:</strong>{" "}
                    {rule.commission_pct
                      ? `${rule.commission_pct}%`
                      : rule.commission_fixed
                      ? `$${rule.commission_fixed}`
                      : "No definida"}
                  </p>
                </CardContent>

                <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal para crear/editar */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regla de Comisión" : "Nueva Regla de Comisión"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Marca</Label>
              <select
                value={formData.brand_id}
                onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Categoría</Label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>% Comisión</Label>
                <Input
                  type="number"
                  value={formData.commission_pct}
                  onChange={(e) => setFormData({ ...formData, commission_pct: e.target.value })}
                  placeholder="Ej: 5"
                />
              </div>

              <div>
                <Label>Comisión fija ($)</Label>
                <Input
                  type="number"
                  value={formData.commission_fixed}
                  onChange={(e) => setFormData({ ...formData, commission_fixed: e.target.value })}
                  placeholder="Ej: 100"
                />
              </div>
            </div>

            <div>
              <Label>Prioridad</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ComissionConfig;
