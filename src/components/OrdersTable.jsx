import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { IconRefresh, IconPhone } from "@tabler/icons-react"; // ✅ agregado IconPhone

const STATUS_STYLES = {
  pendiente: "text-yellow-700",
  confirmado: "text-blue-700",
  completado: "text-green-700",
  cancelado: "text-red-700",
};

const STATUS_COLORS = {
  pendiente: "bg-yellow-400",
  confirmado: "bg-blue-400",
  completado: "bg-green-400",
  cancelado: "bg-red-400",
};

const OrdersTable = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nameFilter, setNameFilter] = useState("");

  const fetchOrders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(
          `
          id,
          created_at,
          status,
          appointment_datetime,
          notes,
          interested_variants,
          customers (id, name, last_name, phone),
          seller:user_roles!leads_referred_by_fkey (id_auth, role)
        `
        )
        .order("created_at", { ascending: false });

      if (leadsError) throw leadsError;

      const sellerIds = [
        ...new Set(leadsData.map((l) => l.seller?.id_auth).filter(Boolean)),
      ];

      let usersMap = {};
      if (sellerIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id_auth, name, last_name, email")
          .in("id_auth", sellerIds);

        if (usersError) throw usersError;

        usersMap = Object.fromEntries(usersData.map((u) => [u.id_auth, u]));
      }

      const enriched = leadsData.map((lead) => ({
        ...lead,
        seller: {
          ...lead.seller,
          user: usersMap[lead.seller?.id_auth] || null,
        },
      }));

      setOrders(enriched);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar pedidos", { description: error.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleString("es-AR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "-";

  const filteredOrders = orders.filter((o) => {
    const customerName =
      o.customers?.name?.toLowerCase() +
      " " +
      (o.customers?.last_name?.toLowerCase() || "");
    return customerName.includes(nameFilter.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* 🔹 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          placeholder="Buscar por cliente..."
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-full sm:w-80 max-w-sm"
        />

        <Button
          variant="outline"
          onClick={() => fetchOrders(false)}
          disabled={refreshing}
          className="flex items-center gap-1"
        >
          <IconRefresh
            className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          Refrescar
        </Button>
      </div>

      {/* 🔹 Tabla */}
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Fecha cita</TableHead>
              <TableHead>Interesado en</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="grid gap-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No hay pedidos registrados.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => (
                <TableRow
                  key={o.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {/* 👤 Cliente con teléfono debajo */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>
                        {o.customers
                          ? `${o.customers.name} ${
                              o.customers.last_name || ""
                            }`
                          : "Sin cliente"}
                      </span>

                      {o.customers?.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <IconPhone size={12} className="text-zinc-500" />
                          <span>{o.customers.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* 🧑‍💼 Vendedor */}
                  <TableCell>
                    {o.seller?.user
                      ? `${o.seller.user.name ?? ""} ${
                          o.seller.user.last_name ?? ""
                        }`.trim() || "—"
                      : "—"}
                  </TableCell>

                  <TableCell>{formatDate(o.appointment_datetime)}</TableCell>

                  {/* 💡 Productos interesados */}
                  <TableCell className="max-w-xs">
                    {Array.isArray(o.interested_variants) &&
                    o.interested_variants.length > 0 ? (
                      <div className="text-xs space-y-0.5">
                        {o.interested_variants.map((v, i) => (
                          <div key={i} className="block truncate">
                            {v.name || v.product_name || "Producto"}{" "}
                            {v.variant_name ? ` - ${v.variant_name}` : ""}{" "}
                            {v.color && (
                              <span className="text-zinc-500">
                                ({v.color})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 🟢 Estado con pin animado */}
                  <TableCell>
                    <div className="relative flex items-center gap-2">
                      <span
                        className={`absolute inline-flex h-2 w-2 rounded-full ${
                          STATUS_COLORS[o.status] || "bg-gray-400"
                        } opacity-75 animate-ping`}
                      ></span>
                      <span
                        className={`relative inline-flex h-2 w-2 rounded-full ${
                          STATUS_COLORS[o.status] || "bg-gray-400"
                        }`}
                      ></span>
                      <span
                        className={`capitalize text-sm font-medium ${
                          STATUS_STYLES[o.status] || "text-gray-700"
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>{formatDate(o.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrdersTable;
