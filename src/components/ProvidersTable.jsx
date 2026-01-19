import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { IconRefresh, IconTrash, IconUser, IconPhone, IconMapPin } from "@tabler/icons-react";

const ProvidersTable = ({ onAdd }) => {
  const [filter, setFilter] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    provider: null,
  });

  const fetchProviders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("providers")
        .select(
          "id, name, contact_name, phone, email, address, city, notes, is_active, created_at"
        )
        .order("name", { ascending: true });

      if (error) throw error;
      setProviders(data ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar proveedores", {
        description: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders(true);
  }, [fetchProviders]);

  const handleConfirmDelete = useCallback(async () => {
    const p = deleteDialog.provider;
    if (!p) return;
    try {
      setRefreshing(true);
      const { error } = await supabase.from("providers").delete().eq("id", p.id);
      if (error) throw error;
      toast.success("Proveedor eliminado", {
        description: `${p.name} fue eliminado correctamente.`,
      });
      await fetchProviders();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el proveedor", {
        description: error.message,
      });
    } finally {
      setRefreshing(false);
      setDeleteDialog({ open: false, provider: null });
    }
  }, [fetchProviders, deleteDialog.provider]);

  const filtered = providers.filter((p) =>
    `${p.name || ""} ${p.contact_name || ""}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar proveedor..."
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-80"
        />

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => fetchProviders(false)}
            disabled={refreshing}
          >
            <IconRefresh className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refrescar
          </Button>
          {onAdd}
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ubicacion</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando proveedores...
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay proveedores registrados.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name || "Sin nombre"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        {p.contact_name || "Sin contacto"}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconPhone className="h-4 w-4 text-muted-foreground" />
                        {p.phone || p.email || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <IconMapPin className="h-4 w-4 text-muted-foreground" />
                      {p.city || p.address || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                    {p.notes || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.is_active ? (
                      <Badge variant="success" className="bg-green-500 text-white">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, provider: p })}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !open && setDeleteDialog({ open: false, provider: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              Estas por eliminar a{" "}
              <strong>{deleteDialog.provider?.name}</strong>. Esta accion no se puede deshacer.
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

export default ProvidersTable;
