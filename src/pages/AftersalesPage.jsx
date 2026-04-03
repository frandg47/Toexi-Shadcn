import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconDotsVertical,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconTool,
} from "@tabler/icons-react";
import { toast } from "sonner";

const STATUS_LABELS = {
  defective_in_store: "Defectuoso en local",
  in_repair: "En reparacion",
  repaired: "Reparado",
};

const STATUS_BADGE = {
  defective_in_store:
    "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  in_repair:
    "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  repaired:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
};

const SOURCE_LABELS = {
  factory: "Fabrica",
  warranty: "Garantia",
};

const formatVariantLabel = (variant) => {
  if (!variant) return "-";
  return [variant.products?.name, variant.variant_name, variant.color && `(${variant.color})`]
    .filter(Boolean)
    .join(" ");
};

export default function AftersalesPage() {
  const { role } = useAuth();
  const isAllowed = ["owner", "superadmin"].includes(`${role || ""}`.toLowerCase());

  const [devices, setDevices] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    source: "all",
  });
  const [form, setForm] = useState({
    variant_id: "",
    quantity: "1",
    imei: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: devicesData, error: devicesError }, { data: variantsData, error: variantsError }] =
        await Promise.all([
          supabase
            .from("aftersales_devices")
            .select(
              "id, sale_id, warranty_exchange_id, source_type, imei, quantity, status, notes, created_at, updated_at, variant:product_variants!aftersales_devices_variant_id_fkey(id, variant_name, color, products(name)), warranty:warranty_exchanges!aftersales_devices_warranty_exchange_id_fkey(id, reason)",
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("product_variants")
            .select("id, variant_name, color, stock, products(name, active)")
            .gt("stock", 0)
            .order("id", { ascending: false }),
        ]);

      if (devicesError) throw devicesError;
      if (variantsError) throw variantsError;

      setDevices(devicesData || []);
      setVariants(
        (variantsData || []).filter((variant) => variant.products?.active !== false),
      );
    } catch (error) {
      toast.error("No se pudo cargar postventa", {
        description: error?.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) load();
  }, [isAllowed, load]);

  const filteredDevices = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return devices.filter((device) => {
      if (filters.status !== "all" && device.status !== filters.status) return false;
      if (filters.source !== "all" && device.source_type !== filters.source) return false;
      if (!search) return true;

      const haystack = [
        formatVariantLabel(device.variant),
        device.imei,
        device.notes,
        device.warranty?.reason,
        device.sale_id ? `venta ${device.sale_id}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [devices, filters]);

  const summary = useMemo(
    () =>
      devices.reduce(
        (acc, device) => {
          acc.total += Number(device.quantity || 0);
          acc[device.status] += Number(device.quantity || 0);
          return acc;
        },
        {
          total: 0,
          defective_in_store: 0,
          in_repair: 0,
          repaired: 0,
        },
      ),
    [devices],
  );

  const resetForm = () => {
    setForm({
      variant_id: "",
      quantity: "1",
      imei: "",
      notes: "",
    });
  };

  const handleRegister = async () => {
    if (!form.variant_id) {
      toast.error("Selecciona una variante");
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.rpc("register_aftersales_device", {
        p_variant_id: Number(form.variant_id),
        p_quantity: Number(form.quantity || 0),
        p_imei: form.imei.trim() || null,
        p_notes: form.notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Equipo enviado a postventa");
      setDialogOpen(false);
      resetForm();
      load();
    } catch (error) {
      toast.error("No se pudo registrar el equipo", {
        description: error?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (device, nextStatus) => {
    try {
      const { error } = await supabase.rpc("update_aftersales_device_status", {
        p_aftersales_device_id: device.id,
        p_status: nextStatus,
        p_notes: device.notes || null,
      });

      if (error) throw error;

      toast.success("Estado actualizado");
      load();
    } catch (error) {
      toast.error("No se pudo actualizar el estado", {
        description: error?.message,
      });
    }
  };

  if (!isAllowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total en postventa</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Defectuoso en local</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-rose-600 dark:text-rose-300">
            {summary.defective_in_store}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">En reparacion</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600 dark:text-amber-300">
            {summary.in_repair}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reparados</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {summary.repaired}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Postventa</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <IconRefresh className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <IconPlus className="h-4 w-4" />
              Registrar defecto de fabrica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <Input
                placeholder="Equipo, IMEI, venta..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="defective_in_store">Defectuoso en local</SelectItem>
                  <SelectItem value="in_repair">En reparacion</SelectItem>
                  <SelectItem value="repaired">Reparado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Origen</Label>
              <Select
                value={filters.source}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, source: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="factory">Fabrica</SelectItem>
                  <SelectItem value="warranty">Garantia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      {device.created_at
                        ? new Date(device.created_at).toLocaleDateString("es-AR")
                        : "-"}
                    </TableCell>
                    <TableCell>{formatVariantLabel(device.variant)}</TableCell>
                    <TableCell>{device.imei || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">{SOURCE_LABELS[device.source_type] || device.source_type}</Badge>
                        {device.sale_id ? (
                          <span className="text-xs text-muted-foreground">
                            Venta #{device.sale_id}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{device.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[device.status]}>
                        {STATUS_LABELS[device.status] || device.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {device.notes || device.warranty?.reason || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Estado</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {device.status !== "defective_in_store" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(device, "defective_in_store")
                              }
                            >
                              <IconShieldCheck className="h-4 w-4" />
                              Marcar defectuoso
                            </DropdownMenuItem>
                          )}
                          {device.status !== "in_repair" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(device, "in_repair")}
                            >
                              <IconTool className="h-4 w-4" />
                              Marcar en reparacion
                            </DropdownMenuItem>
                          )}
                          {device.status !== "repaired" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(device, "repaired")}
                            >
                              <IconRefresh className="h-4 w-4" />
                              Marcar reparado
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredDevices.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No hay equipos en postventa para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar equipo defectuoso</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1">
              <Label>Variante</Label>
              <Select
                value={form.variant_id}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, variant_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar variante" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={String(variant.id)}>
                      {formatVariantLabel(variant)} | Stock: {variant.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label>IMEI</Label>
                <Input
                  placeholder="IMEI del equipo"
                  value={form.imei}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, imei: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label>Notas</Label>
              <Textarea
                placeholder="Detalle del defecto o contexto"
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleRegister} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
