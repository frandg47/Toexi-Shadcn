import React, { useEffect, useState, useCallback } from "react";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner"; 
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  // ✅ AGREGADO: Componentes de AlertDialog de shadcn/ui
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  IconCurrencyDollar,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
// ❌ ELIMINADO: import Swal from "sweetalert2";
import { supabase } from "@/lib/supabaseClient";
import { ConfigLoading } from "../../components/ui/loading/config-loading";

const ComissionConfig = () => {
  const [rules, setRules] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(false);
  // 🆕 ESTADO: Para manejar el AlertDialog de eliminación
  const [deleteRule, setDeleteRule] = useState({ open: false, id: null });
  const [formData, setFormData] = useState({
    brand_id: "",
    category_id: "",
    commission_pct: "",
    commission_fixed: "",
    priority: 100,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, brandsRes, categoriesRes] = await Promise.all([
        supabase
          .from("commission_rules")
          .select(
            `
            id,
            brand_id,
            category_id,
            commission_pct,
            commission_fixed,
            priority,
            brands(name),
            categories(name)
            `
          )
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
      // 🔄 REEMPLAZO 1: Usar toast para error de carga
      toast.error("No se pudieron cargar las reglas de comisión", {
        description: error.message || "Error desconocido al obtener datos.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🆕 FUNCIÓN: Abre el AlertDialog de eliminación
  const handleOpenDeleteDialog = (id) => {
    setDeleteRule({ open: true, id });
  };
  
  // 🆕 FUNCIÓN: Ejecuta la eliminación
  const handleConfirmDelete = async () => {
    const id = deleteRule.id;
    setDeleteRule({ open: false, id: null }); // Cerrar diálogo inmediatamente
    
    if (!id) return;
    
    const { error } = await supabase
      .from("commission_rules")
      .delete()
      .eq("id", id);
      
    if (error) {
      // 🔄 REEMPLAZO 2: Usar toast para error de eliminación
      toast.error("Error", {
        description: "No se pudo eliminar la regla.",
      });
    } else {
      // 🔄 REEMPLAZO 3: Usar toast para éxito de eliminación
      toast.success("Eliminado", {
        description: "La regla fue eliminada correctamente.",
      });
      fetchData();
    }
  };

  const handleSave = async () => {
    let validationError = null;

    // Validación de Prioridad
    if (
      !formData.priority ||
      isNaN(formData.priority) ||
      parseInt(formData.priority) < 1
    ) {
      validationError = "La prioridad debe ser un número entero positivo.";
    }

    // Validación de Marca o Categoría
    if (!validationError && !formData.brand_id && !formData.category_id) {
      validationError = "Debe seleccionar una marca o una categoría.";
    }

    // Validación de Comisión
    if (!validationError && !formData.commission_pct && !formData.commission_fixed) {
      validationError = "Debe definir un porcentaje o una comisión fija.";
    }

    // Validación de % Comisión
    if (
      !validationError &&
      formData.commission_pct &&
      (isNaN(formData.commission_pct) || parseFloat(formData.commission_pct) < 0)
    ) {
      validationError = "El porcentaje de comisión debe ser un número positivo.";
    }
    
    // Validación de Comisión Fija
    if (
      !validationError &&
      formData.commission_fixed &&
      (isNaN(formData.commission_fixed) || parseFloat(formData.commission_fixed) < 0)
    ) {
      validationError = "La comisión fija debe ser un número positivo.";
    }
    
    // Mostrar error si existe
    if (validationError) {
      setOpenDialog(false);
      // 🔄 REEMPLAZO 4: Usar toast para errores de validación
      toast.error("Error de validación", {
        description: validationError,
      });
      return;
    }

    const payload = {
      brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      commission_pct: formData.commission_pct
        ? parseFloat(formData.commission_pct)
        : null,
      commission_fixed: formData.commission_fixed
        ? parseFloat(formData.commission_fixed)
        : null,
      priority: parseInt(formData.priority),
    };

    const { error } = editingRule
      ? await supabase
          .from("commission_rules")
          .update(payload)
          .eq("id", editingRule.id)
      : await supabase.from("commission_rules").insert([payload]);

    if (error) {
      // 🔄 REEMPLAZO 5: Usar toast para error al guardar
      toast.error("Error", {
        description: "No se pudo guardar la regla.",
      });
      return;
    }

    // 🔄 REEMPLAZO 6: Usar toast para éxito al guardar
    toast.success("Éxito", {
      description: "La regla fue guardada correctamente.",
    });
    setOpenDialog(false);
    setEditingRule(null);
    setFormData({
      brand_id: "",
      category_id: "",
      commission_pct: "",
      commission_fixed: "",
      priority: 100,
    });
    fetchData();
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      brand_id: rule.brand_id || "",
      category_id: rule.category_id || "",
      // Asegurar que los valores numéricos se carguen como strings para el input
      commission_pct: rule.commission_pct?.toString() || "", 
      commission_fixed: rule.commission_fixed?.toString() || "",
      priority: rule.priority,
    });
    setOpenDialog(true);
  };

  return (
    <>
      {/* <SiteHeader titulo="Configuración de Comisiones" /> */}
      <div className="@container/main flex flex-1 flex-col gap-4 py-6">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={fetchData}>
            <IconRefresh className="h-4 w-4" /> Refrescar
          </Button>
          <Button
            onClick={() => {
              setEditingRule(null);
              setFormData({
                brand_id: "",
                category_id: "",
                commission_pct: "",
                commission_fixed: "",
                priority: 100,
              });
              setOpenDialog(true);
            }}
          >
            <IconPlus className="h-4 w-4" /> Nueva
          </Button>
        </div>

        {/* Cards de reglas */}
        {rules.length === 0 || loading ? (
          <ConfigLoading />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rules.map((rule) => (
              <Card key={rule.id} className="transition-all hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <IconCurrencyDollar className="text-blue-600 h-5 w-5" />
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(rule)}
                  >
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleOpenDeleteDialog(rule.id)}
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
        <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingRule
                ? "Editar Regla de Comisión"
                : "Nueva Regla de Comisión"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="brand_id">Marca</Label>
              <Select
                value={formData.brand_id || "all"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    brand_id: value === "all" ? "" : value,
                    // Si elijo marca, limpio categoría (y viceversa)
                    category_id: value === "all" ? formData.category_id : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category_id">Categoría</Label>
              <Select
                value={formData.category_id || "all"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    category_id: value === "all" ? "" : value,
                    // Si elijo categoría, limpio marca (y viceversa)
                    brand_id: value === "all" ? formData.brand_id : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="commission_pct">% Comisión</Label>
                <Input
                  id="commission_pct"
                  type="number"
                  value={formData.commission_pct}
                  onChange={(e) =>
                    setFormData({ 
                      ...formData, 
                      commission_pct: e.target.value, 
                      // Si lleno %, limpio fijo
                      commission_fixed: e.target.value ? "" : formData.commission_fixed 
                    })
                  }
                  placeholder="Ej: 5"
                  disabled={!!formData.commission_fixed}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="commission_fixed">Comisión fija ($)</Label>
                <Input
                  id="commission_fixed"
                  type="number"
                  value={formData.commission_fixed}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commission_fixed: e.target.value,
                      // Si lleno fijo, limpio %
                      commission_pct: e.target.value ? "" : formData.commission_pct,
                    })
                  }
                  placeholder="Ej: 100"
                  disabled={!!formData.commission_pct}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
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
      
      {/* 🆕 COMPONENTE: AlertDialog para confirmar la eliminación */}
      <AlertDialog
        open={deleteRule.open}
        onOpenChange={(open) => {
          if (!open) setDeleteRule({ open: false, id: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar regla de comisión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la regla de comisión seleccionada.
              **Esta acción no se puede deshacer.** ¿Confirmas que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* FIN AlertDialog */}
    </>
  );
};

export default ComissionConfig;