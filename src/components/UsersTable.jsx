import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { supabase } from "../lib/supabaseClient";
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
  IconBriefcase,
  IconUserShield,
} from "@tabler/icons-react";
import DialogEditUser from "./DialogEditUser";

// const ROLE_OPTIONS = [
//   { value: "superadmin", label: "Administrador" },
//   { value: "seller", label: "Vendedor" },
// ];

// Actualiza la lista de columnas disponibles
const TABLE_COLUMNS = [
  { id: "name", label: "Nombre" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Teléfono" },
  { id: "role", label: "Rol" },
  { id: "state", label: "Estado" },
  { id: "created_at", label: "Creación" },
  { id: "actions", label: "Acciones" },
];

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    console.error(error);
    return value;
  }
};

const buildFullName = (user) => {
  if (!user?.name && !user?.last_name) return "Sin nombre";
  return [user?.name, user?.last_name].filter(Boolean).join(" ");
};

const UsersTable = ({ refreshToken = 0, onAdd }) => {
  // Actualiza el estado inicial de columnas visibles
  const [visibleColumns, setVisibleColumns] = useState(
    TABLE_COLUMNS.map((col) => col.id)
  );
  // Agregamos estados para filtros y columnas
  const [nameFilter, setNameFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const fetchUsers = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select(
          "id, name, last_name, email, role, state, phone, dni, adress, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data ?? []);
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "No se pudieron cargar los usuarios",
        text: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(refreshToken === 0);
  }, [fetchUsers, refreshToken]);

  const handleToggleActive = useCallback(
    async (user) => {
      try {
        setRefreshing(true);
        const { error } = await supabase
          .from("users")
          .update({ state: !user.state })
          .eq("id", user.id);

        if (error) throw error;
        await fetchUsers();
        Swal.fire({
          icon: "success",
          title: "Estado actualizado",
          text: `La cuenta de ${user.email} ahora esta ${
            !user.state ? "activa" : "inactiva"
          }.`,
          timer: 1800,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "No se pudo actualizar el estado",
          text: error.message,
        });
      } finally {
        setRefreshing(false);
      }
    },
    [fetchUsers]
  );

  const handleDelete = useCallback(
    async (user) => {
      const result = await Swal.fire({
        icon: "warning",
        title: "Eliminar usuario",
        text: `Esta accion quitara a ${user.email} del listado. Confirma que deseas continuar?`,
        showCancelButton: true,
        confirmButtonText: "Eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
      });

      if (!result.isConfirmed) return;

      try {
        setRefreshing(true);
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("id", user.id);

        if (error) throw error;
        await fetchUsers();
        Swal.fire({
          icon: "success",
          title: "Usuario eliminado",
          text: `${user.email} fue eliminado del sistema`,
          timer: 1800,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "No se pudo eliminar",
          text: error.message,
        });
      } finally {
        setRefreshing(false);
      }
    },
    [fetchUsers]
  );

  // Función para alternar columnas visibles
  const toggleColumn = useCallback((columnName) => {
    setVisibleColumns((current) =>
      current.includes(columnName)
        ? current.filter((col) => col !== columnName)
        : [...current, columnName]
    );
  }, []);

  // Filtrar usuarios por nombre
  const filteredUsers = useMemo(() => {
    if (!nameFilter.trim()) return users;

    return users.filter((user) =>
      buildFullName(user).toLowerCase().includes(nameFilter.toLowerCase())
    );
  }, [users, nameFilter]);

  // Modificar el isEmpty para usar filteredUsers
  const isEmpty = useMemo(
    () => !loading && filteredUsers.length === 0,
    [loading, filteredUsers]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Buscar por nombre..."
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-80 max-w-sm"
        />
        <div className="flex gap-2 flex-wrap items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columnas
              </Button>
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
          {onAdd}
          <Button
            variant="outline"
            onClick={() => fetchUsers()}
            disabled={refreshing}
          >
            <IconRefresh />
            {refreshing ? "Actualizando..." : "Refrescar"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.includes("name") && <TableHead>Nombre</TableHead>}
              {visibleColumns.includes("email") && <TableHead>Email</TableHead>}
              {visibleColumns.includes("phone") && (
                <TableHead>Teléfono</TableHead>
              )}
              {visibleColumns.includes("role") && <TableHead>Rol</TableHead>}
              {visibleColumns.includes("state") && (
                <TableHead>Activa</TableHead>
              )}
              {visibleColumns.includes("created_at") && (
                <TableHead>Creada</TableHead>
              )}
              {visibleColumns.includes("actions") && (
                <TableHead className="w-[160px] text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="grid gap-2">
                    {[...Array(3)].map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {isEmpty && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  Todavia no se registraron usuarios.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  {visibleColumns.includes("name") && (
                    <TableCell>
                      <div className="font-medium">{buildFullName(user)}</div>
                      <div className="text-sm text-muted-foreground">
                        DNI: {user.dni || "-"}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("email") && (
                    <TableCell>
                      <div>{user.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.adress || "Sin dirección"}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("phone") && (
                    <TableCell>{user.phone || "-"}</TableCell>
                  )}
                  {visibleColumns.includes("role") && (
                    <TableCell>
                      {user.role === "superadmin" ? (
                        <Badge
                          variant="secondary"
                          className="bg-blue-500 text-white dark:bg-blue-600"
                        >
                          <IconUserShield className="h-4 w-4" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                        >
                          <IconBriefcase className="h-4 w-4" />
                          Vendedor
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.includes("state") && (
                    <TableCell>
                      <Switch
                        checked={Boolean(user.state)}
                        onCheckedChange={() => handleToggleActive(user)}
                        aria-label={"Cambiar estado de " + user.email}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.includes("created_at") && (
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                  )}
                  {visibleColumns.includes("actions") && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUserId(user.id)}
                          disabled={refreshing}
                        >
                          <IconEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          disabled={refreshing}
                          className="bg-red-400 hover:bg-red-500"
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

        <DialogEditUser
          open={!!editingUserId}
          onClose={() => setEditingUserId(null)}
          userId={editingUserId}
        />
      </div>
    </div>
  );
};

export default UsersTable;
