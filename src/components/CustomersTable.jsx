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

const CustomersTable = ({ refreshToken = 0, isSellerView }) => {
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

      {/* 🔹 Cards View en lugar de tabla */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && (
          <>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 shadow-sm bg-card space-y-2"
              >
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </>
        )}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-10">
            No hay clientes registrados.
          </div>
        )}

        {!loading &&
          filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border p-4 shadow-sm bg-card flex flex-col justify-between hover:shadow-md transition"
            >
              {/* 🧍 Nombre */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{buildFullName(c)}</h3>
                {c.is_active ? (
                  <Badge variant="success" className="bg-green-500 text-white">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </div>

              {/* 🧾 Datos */}
              <div className="space-y-1 text-sm text-muted-foreground mb-3">
                {c.dni && (
                  <p>
                    <span className="font-medium text-foreground">DNI:</span>{" "}
                    {c.dni}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-1">
                    <IconUser size={14} /> {c.phone}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-1">
                    <IconUser size={14} /> {c.email}
                  </p>
                )}
                {c.address && (
                  <p className="flex items-center gap-1">
                    <IconHome size={14} /> {c.address}
                  </p>
                )}
                {c.city && (
                  <p className="flex items-center gap-1">
                    <IconMapPin size={14} /> {c.city}
                  </p>
                )}
                <p className="text-xs mt-1">
                  Creado:{" "}
                  <span className="text-foreground">
                    {formatDate(c.created_at)}
                  </span>
                </p>
              </div>

              {/* ✏️ Acciones */}
              <div className="flex justify-between items-center mt-auto pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCustomerId(c.id)}
                  >
                    <IconEdit className="h-4 w-4" />
                  </Button>

                  {!isSellerView && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setDeleteDialog({ open: true, customer: c })
                      }
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>

      <DialogEditCustomer
        open={!!editingCustomerId}
        onClose={() => setEditingCustomerId(null)}
        customerId={editingCustomerId}
        onSuccess={() => fetchCustomers(false)}
        isSellerView={isSellerView}
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
