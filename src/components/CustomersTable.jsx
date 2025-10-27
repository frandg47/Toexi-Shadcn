import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DialogAddCustomer from "./DialogAddCustomer";
import { IconPlus } from "@tabler/icons-react";
import DialogEditCustomer from "./DialogEditCustomer";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconRefresh,
  IconTrash,
  IconEdit,
  IconUser,
  IconHome,
  IconMapPin,
} from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// 📋 Columnas visibles configurables
const TABLE_COLUMNS = [
  { id: "name", label: "Nombre" },
  { id: "dni", label: "DNI" },
  { id: "phone", label: "Teléfono" },
  { id: "email", label: "Email" },
  { id: "address", label: "Dirección" },
  { id: "city", label: "Ciudad" },
  { id: "is_active", label: "Activo" },
  { id: "created_at", label: "Registro" },
  { id: "actions", label: "Acciones" },
];

// 🕒 Formato de fecha local Argentina
const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(value));
  } catch (error) {
    console.error(error);
    return value;
  }
};

// 🧩 Construir nombre completo
const buildFullName = (c) =>
  [c?.name, c?.last_name].filter(Boolean).join(" ") || "Sin nombre";

const CustomersTable = ({ refreshToken = 0 }) => {
  const [visibleColumns, setVisibleColumns] = useState(
    TABLE_COLUMNS.map((col) => col.id)
  );
  const [filter, setFilter] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    customer: null,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  // 🔹 Obtener clientes desde Supabase
  const fetchCustomers = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, name, last_name, dni, phone, email, address, city, notes, is_active, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar clientes", {
        description: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers(refreshToken === 0);
  }, [fetchCustomers, refreshToken]);

  // ✅ Cambiar estado activo/inactivo
  const handleToggleActive = useCallback(
    async (customer) => {
      try {
        setRefreshing(true);
        const { error } = await supabase
          .from("customers")
          .update({ is_active: !customer.is_active })
          .eq("id", customer.id);
        if (error) throw error;
        toast.success("Estado actualizado", {
          description: `${buildFullName(customer)} ahora está ${
            !customer.is_active ? "activo" : "inactivo"
          }.`,
        });
        await fetchCustomers();
      } catch (error) {
        console.error(error);
        toast.error("No se pudo cambiar el estado", {
          description: error.message,
        });
      } finally {
        setRefreshing(false);
      }
    },
    [fetchCustomers]
  );

  // 🗑️ Eliminar cliente
  const handleConfirmDelete = useCallback(async () => {
    const c = deleteDialog.customer;
    if (!c) return;
    try {
      setRefreshing(true);
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Cliente eliminado", {
        description: `${buildFullName(c)} fue eliminado correctamente.`,
      });
      await fetchCustomers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el cliente", {
        description: error.message,
      });
    } finally {
      setRefreshing(false);
      setDeleteDialog({ open: false, customer: null });
    }
  }, [fetchCustomers, deleteDialog.customer]);

  // 🔍 Filtrado
  const filtered = useMemo(() => {
    if (!filter.trim()) return customers;
    return customers.filter((c) =>
      buildFullName(c).toLowerCase().includes(filter.toLowerCase())
    );
  }, [customers, filter]);

  const isEmpty = !loading && filtered.length === 0;
  const toggleColumn = useCallback((col) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* 🔹 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Buscar cliente..."
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-80 max-w-sm"
        />
        <div className="flex justify-center sm:justify-end flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Columnas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              {TABLE_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={visibleColumns.includes(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={() => fetchCustomers(false)}
            disabled={refreshing}
          >
            <IconRefresh
              className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refrescar
          </Button>

          <Button onClick={() => setDialogOpen(true)}>
            <IconPlus className="h-4 w-4" />
            Agregar
          </Button>

          <DialogAddCustomer
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSuccess={() => fetchCustomers(false)}
          />
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
              {visibleColumns.includes("name") && <TableHead>Nombre</TableHead>}
              {visibleColumns.includes("dni") && <TableHead>DNI</TableHead>}
              {visibleColumns.includes("phone") && (
                <TableHead>Teléfono</TableHead>
              )}
              {visibleColumns.includes("email") && <TableHead>Email</TableHead>}
              {visibleColumns.includes("address") && (
                <TableHead>Dirección</TableHead>
              )}
              {visibleColumns.includes("city") && <TableHead>Ciudad</TableHead>}
              {visibleColumns.includes("is_active") && (
                <TableHead>Activo</TableHead>
              )}
              {visibleColumns.includes("created_at") && (
                <TableHead>Registro</TableHead>
              )}
              {visibleColumns.includes("actions") && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length}>
                  <div className="grid gap-2">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isEmpty && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  No hay clientes registrados.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              filtered.map((c) => (
                <TableRow key={c.id}>
                  {visibleColumns.includes("name") && (
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{buildFullName(c)}</span>
                        {c.notes && (
                          <span className="text-xs text-muted-foreground">
                            {c.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("dni") && (
                    <TableCell>{c.dni || "-"}</TableCell>
                  )}
                  {visibleColumns.includes("phone") && (
                    <TableCell>{c.phone || "-"}</TableCell>
                  )}
                  {visibleColumns.includes("email") && (
                    <TableCell>{c.email || "-"}</TableCell>
                  )}
                  {visibleColumns.includes("address") && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <IconHome size={14} /> {c.address || "-"}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("city") && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <IconMapPin size={14} /> {c.city || "-"}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("is_active") && (
                    <TableCell>
                      <Switch
                        checked={Boolean(c.is_active)}
                        onCheckedChange={() => handleToggleActive(c)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.includes("created_at") && (
                    <TableCell>{formatDate(c.created_at)}</TableCell>
                  )}
                  {visibleColumns.includes("actions") && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCustomerId(c.id)}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({ open: true, customer: c })
                          }
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <DialogEditCustomer
        open={!!editingCustomerId}
        onClose={() => setEditingCustomerId(null)}
        customerId={editingCustomerId}
        onSuccess={() => fetchCustomers(false)}
      />

      {/* 🗑️ Modal de confirmación */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ open: false, customer: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por eliminar a{" "}
              <strong>{buildFullName(deleteDialog.customer)}</strong>.
              ¿Confirmás que deseas continuar? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomersTable;
