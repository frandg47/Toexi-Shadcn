import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_OPTIONS = [
  { value: "superadmin", label: "Super administrador" },
  { value: "seller", label: "Vendedor" },
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

const UsersTable = ({ refreshToken = 0 }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, last_name, email, role, state, phone, dni, adress, created_at")
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
          text: `La cuenta de ${user.email} ahora esta ${!user.state ? "activa" : "inactiva"}.`,
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

  const handleRoleChange = useCallback(
    async (user, newRole) => {
      if (user.role === newRole) return;
      try {
        setRefreshing(true);
        const { error } = await supabase
          .from("users")
          .update({ role: newRole })
          .eq("id", user.id);

        if (error) throw error;
        await fetchUsers();
        Swal.fire({
          icon: "success",
          title: "Rol actualizado",
          text: `${user.email} ahora es ${newRole}.`,
          timer: 1800,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "No se pudo actualizar el rol",
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

  const isEmpty = useMemo(() => !loading && users.length === 0, [loading, users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usuarios registrados</h2>
        <Button variant="outline" onClick={() => fetchUsers()} disabled={refreshing}>
          {refreshing ? "Actualizando..." : "Refrescar"}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="w-[160px] text-right">Acciones</TableHead>
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
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Todavia no se registraron usuarios.
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{buildFullName(user)}</div>
                    <div className="text-sm text-muted-foreground">DNI: {user.dni || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div>{user.email}</div>
                    <div className="text-sm text-muted-foreground">{user.adress || "Sin direccion"}</div>
                  </TableCell>
                  <TableCell>{user.phone || "-"}</TableCell>
                  <TableCell>
                    <Select value={user.role} onValueChange={(value) => handleRoleChange(user, value)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={Boolean(user.state)}
                      onCheckedChange={() => handleToggleActive(user)}
                      aria-label={"Cambiar estado de " + user.email}
                    />
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user)}
                      disabled={refreshing}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersTable;





