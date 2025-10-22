import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
// ✅ AGREGADO: Sonner para notificaciones
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConcentricLoader from "@/components/ui/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconCreditCard,
  IconPlus,
  IconTrash,
  IconEdit,
  IconRefresh,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
// ❌ ELIMINADO: import Swal from "sweetalert2";

export default function PaymentMethodsConfig() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [methodModal, setMethodModal] = useState({
    open: false,
    editId: null,
    name: "",
    percent: 0,
  });
  const [installmentModal, setInstallmentModal] = useState({
    open: false,
    methodId: null,
    editId: null,
    installments: "",
    percent: "",
    description: "",
  });

  // 🔹 Obtener métodos con sus cuotas
  const fetchMethods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_methods")
      .select(
        "id, name, multiplier, payment_installments(id, installments, multiplier, description)"
      )
      .order("id");

    if (error) {
      // 🔄 REEMPLAZO 1: Usar toast para error de carga
      toast.error("Error de carga", {
        description: "No se pudieron cargar los métodos de pago.",
      });
    } else {
      setMethods(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  // 🔹 Guardar o actualizar método
  const handleSaveMethod = async () => {
    const { name, percent, editId } = methodModal;
    if (!name) {
      // 🔄 REEMPLAZO 2: Usar toast para campos requeridos
      toast.warning("Campos requeridos", {
        description: "Completá el nombre del método.",
      });
      return;
    }

    const multiplier = 1 + parseFloat(percent || 0) / 100;
    const payload = { name, multiplier: parseFloat(multiplier.toFixed(4)) };

    let error;
    if (editId) {
      const { error: updateError } = await supabase
        .from("payment_methods")
        .update(payload)
        .eq("id", editId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("payment_methods")
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      // 🔄 REEMPLAZO 3: Usar toast para error al guardar
      toast.error("Error al guardar", {
        description: "No se pudo guardar el método de pago.",
      });
    } else {
      // 🔄 REEMPLAZO 4: Usar toast para éxito
      toast.success("Éxito", {
        description: `Método "${name}" ${editId ? "actualizado" : "creado"} correctamente.`,
      });
      setMethodModal({ open: false, editId: null, name: "", percent: 0 });
      fetchMethods();
    }
  };

  // 🔹 Eliminar método
  const handleDeleteMethod = async (id, name) => {
    // 🔄 REEMPLAZO 5: Usar un toast.custom para confirmación o simplificar a una advertencia con un diálogo
    // Por simplicidad, se usará un diálogo interno o la confirmación de la librería de UI preferida.
    // Aquí, para mantener la lógica de confirmación, se usará una promesa simple con `window.confirm` para un ejemplo de reemplazo rápido, aunque en un entorno Shadcn/ui se preferiría un Dialog o un componente de confirmación customizado de Sonner.

    if (!window.confirm(`¿Estás seguro de que quieres eliminar el método "${name}"? Se eliminarán también sus cuotas asociadas.`)) {
      return;
    }

    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", id);
      
    if (error) {
      // 🔄 REEMPLAZO 6: Usar toast para error al eliminar
      toast.error("Error al eliminar", {
        description: "No se pudo eliminar el método de pago.",
      });
    } else {
      // 🔄 REEMPLAZO 7: Usar toast para éxito
      toast.success("Eliminado", {
        description: `Método "${name}" y sus cuotas asociadas eliminados.`,
      });
      fetchMethods();
    }
  };

  // 🔹 Guardar o actualizar cuota
  const handleSaveInstallment = async () => {
    const { methodId, installments, percent, description, editId } =
      installmentModal;
    if (!installments) {
      // 🔄 REEMPLAZO 8: Usar toast para campos requeridos
      toast.warning("Campos requeridos", {
        description: "Completá la cantidad de cuotas.",
      });
      return;
    }

    const multiplier = 1 + parseFloat(percent || 0) / 100;
    const payload = {
      payment_method_id: methodId,
      installments: parseInt(installments),
      multiplier: parseFloat(multiplier.toFixed(4)),
      description: description || null,
    };

    let error;
    if (editId) {
      const { error: updateError } = await supabase
        .from("payment_installments")
        .update(payload)
        .eq("id", editId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("payment_installments")
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      // 🔄 REEMPLAZO 9: Usar toast para error al guardar cuota
      toast.error("Error al guardar", {
        description: "No se pudo guardar la configuración de la cuota.",
      });
    } else {
      // 🔄 REEMPLAZO 10: Usar toast para éxito
      toast.success("Éxito", {
        description: `Cuota de ${installments} ${editId ? "actualizada" : "creada"} correctamente.`,
      });
      setInstallmentModal({
        open: false,
        methodId: null,
        editId: null,
        installments: "",
        percent: "",
        description: "",
      });
      fetchMethods();
    }
  };

  // 🔹 Eliminar cuota
  const handleDeleteInstallment = async (id, installments) => {
    // 🔄 REEMPLAZO 11: Usar un toast.custom para confirmación o simplificar a una advertencia con un diálogo
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la cuota de ${installments}? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    const { error } = await supabase
      .from("payment_installments")
      .delete()
      .eq("id", id);
      
    if (error) {
      // 🔄 REEMPLAZO 12: Usar toast para error al eliminar cuota
      toast.error("Error al eliminar", {
        description: "No se pudo eliminar la cuota.",
      });
    } else {
      // 🔄 REEMPLAZO 13: Usar toast para éxito
      toast.success("Eliminada", {
        description: "Cuota eliminada correctamente.",
      });
      fetchMethods();
    }
  };

  return (
    <>
      <SiteHeader titulo="Configuración de Métodos de Pago" />
      <div className="mt-6 flex justify-end items-center gap-3">
        <Button variant="outline" onClick={fetchMethods}>
          <IconRefresh className="h-4 w-4" /> Refrescar
        </Button>
        <Button
          onClick={() =>
            setMethodModal({ open: true, editId: null, name: "", percent: 0 })
          }
        >
          <IconPlus className="h-4 w-4" /> Agregar
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {methods.map((method) => (
          <Card
            key={method.id}
            className="shadow-sm hover:shadow-md transition"
          >
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-lg">
                <IconCreditCard className="text-purple-600" />
                {method.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setMethodModal({
                      open: true,
                      editId: method.id,
                      name: method.name,
                      percent: ((method.multiplier - 1) * 100).toFixed(2),
                    })
                  }
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteMethod(method.id, method.name)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Aumento:{" "}
                {method.multiplier >= 1 ? (
                  <b className="text-red-700">
                    +{((method.multiplier - 1) * 100).toFixed(2)}%
                  </b>
                ) : (
                  <b className="text-green-700">
                    {/* Multiplier < 1 means a discount */}
                    -{((1 - method.multiplier) * 100).toFixed(2)}%
                  </b>
                )}
              </p>
              <div className="space-y-2">
                <p className="font-medium">Cuotas:</p>
                {method.payment_installments?.length > 0 ? (
                  method.payment_installments.map((i) => (
                    <div
                      key={i.id}
                      className="flex justify-between items-center text-sm border rounded p-2"
                    >
                      {i.multiplier >= 1 ? (
                        <span>
                          {i.installments} cuotas —
                          <b className="text-red-700 ml-1">
                            +{((i.multiplier - 1) * 100).toFixed(2)}%
                          </b>
                          {i.description && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({i.description})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>
                          {i.installments} cuotas —
                          <b className="text-green-700 ml-1">
                            -{((1 - i.multiplier) * 100).toFixed(2)}%
                          </b>
                        </span>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setInstallmentModal({
                              open: true,
                              methodId: method.id,
                              editId: i.id,
                              installments: i.installments,
                              percent: ((i.multiplier - 1) * 100).toFixed(2),
                              description: i.description || "",
                            })
                          }
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteInstallment(i.id, i.installments)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No hay cuotas registradas.
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setInstallmentModal({
                    open: true,
                    methodId: method.id,
                    editId: null,
                    installments: "",
                    percent: "",
                    description: "",
                  })
                }
              >
                <IconPlus className="h-4 w-4 mr-1" /> Agregar cuota
              </Button>
            </CardContent>
          </Card>
        ))}

        {loading && (
            // Mostrar esqueletos si está cargando
            <>
                <Skeleton className="h-[250px] w-full" />
                <Skeleton className="h-[250px] w-full" />
                <Skeleton className="h-[250px] w-full" />
            </>
        )}

        {!methods.length && !loading && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-10">
            No hay métodos de pago registrados.
          </p>
        )}
      </div>

      {/* 💳 Modal Método */}
      <Dialog
        open={methodModal.open}
        onOpenChange={() =>
          setMethodModal({ open: false, editId: null, name: "", percent: 0 })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {methodModal.editId ? "Editar método" : "Nuevo método"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={methodModal.name}
                onChange={(e) =>
                  setMethodModal((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Porcentaje de aumento (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={methodModal.percent}
                onChange={(e) =>
                  setMethodModal((p) => ({ ...p, percent: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setMethodModal({
                  open: false,
                  editId: null,
                  name: "",
                  percent: 0,
                })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveMethod}>
              {methodModal.editId ? "Guardar cambios" : "Crear método"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 💰 Modal Cuotas */}
      <Dialog
        open={installmentModal.open}
        onOpenChange={() =>
          setInstallmentModal({
            open: false,
            methodId: null,
            editId: null,
            installments: "",
            percent: "",
            description: "",
          })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {installmentModal.editId ? "Editar cuota" : "Nueva cuota"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Cantidad de cuotas</Label>
              <Input
                type="number"
                value={installmentModal.installments}
                onChange={(e) =>
                  setInstallmentModal((p) => ({
                    ...p,
                    installments: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Porcentaje de aumento (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={installmentModal.percent}
                onChange={(e) =>
                  setInstallmentModal((p) => ({
                    ...p,
                    percent: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={installmentModal.description}
                onChange={(e) =>
                  setInstallmentModal((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setInstallmentModal({
                  open: false,
                  methodId: null,
                  editId: null,
                  installments: "",
                  percent: "",
                  description: "",
                })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveInstallment}>
              {installmentModal.editId ? "Guardar cambios" : "Crear cuota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}