import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import SheetNewSale from "./SheetNewSale";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconDotsVertical,
  IconCheck,
  IconX,
  IconCalendarEvent,
  IconReceipt2,
  IconRotateClockwise,
  IconPhone,
  IconRefresh,
  IconShoppingBag,
  IconCash,
  IconBan,
  IconCalendar,
  IconCircleX,
  IconCircleCheck,
  IconCircleDashed,
} from "@tabler/icons-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import DialogReschedule from "./DialogReschedule";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "../context/AuthContextProvider";

const STATUS_STYLES = {
  pendiente: "text-yellow-700",
  sin_exito: "text-blue-700",
  vendido: "text-green-700",
  cancelado: "text-red-700",
};

const STATUS_COLORS = {
  pendiente: "bg-yellow-400",
  sin_exito: "bg-blue-400",
  vendido: "bg-green-400",
  cancelado: "bg-red-400",
};

const OrdersTable = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const handleWeekFilter = () => {
    setDateRange({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });
  };

  const fetchOrders = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);

    try {
      const query = supabase
        .from("leads")
        .select(`
                  id,
                  created_at,
                  status,
                  appointment_datetime,
                  notes,
                  interested_variants,
                  customers (id, name, last_name, phone),
                  seller:user_roles!leads_referred_by_fkey (id_auth, role)
            `)
        .order("created_at", { ascending: false });

      // Si el usuario NO es superadmin (es vendedor), filtrar solo sus pedidos
      if (role !== "superadmin") {
        query.eq("referred_by", id_auth);
      }

      const { data: leadsData, error: leadsError } = await query;



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
      await autoCancelExpired(enriched);
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

  const handleUpdateStatus = async (id, status) => {
    const { error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date() })
      .eq("id", id);

    if (error) {
      toast.error("Error actualizando estado");
    } else {
      toast.success("Estado actualizado");
      fetchOrders(false);
    }
  };

  const autoCancelExpired = async (leads) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalizar a medianoche

    const toCancel = leads.filter((l) => {
      if (l.status !== "pendiente" || !l.appointment_datetime) return false;

      const appt = new Date(l.appointment_datetime);
      appt.setHours(0, 0, 0, 0); // ignorar la hora

      return appt < today;
    });

    if (toCancel.length === 0) return;

    const ids = toCancel.map((l) => l.id);

    const { error } = await supabase
      .from("leads")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (!error) {
      toast("Citas vencidas canceladas", {
        description: `${ids.length} pedido(s) actualizados`,
      });
      fetchOrders(false);
    }
  };

  const kpis = {
    total: orders.length,
    pendiente: orders.filter((o) => o.status === "pendiente").length,
    sin_exito: orders.filter((o) => o.status === "sin_exito").length,
    vendido: orders.filter((o) => o.status === "vendido").length,
    cancelado: orders.filter((o) => o.status === "cancelado").length,
  };

  const [rescheduleLead, setRescheduleLead] = useState(null);
  const openReschedule = (lead) => setRescheduleLead(lead);
  const closeReschedule = () => setRescheduleLead(null);
  const [saleLead, setSaleLead] = useState(null);
  const [saleOpen, setSaleOpen] = useState(false);

  const handleCreateSale = (lead) => {
    setSaleLead(lead);
    setSaleOpen(true);
  };

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      })
      : "-";

  const filteredOrders = orders
    .filter((o) => {
      const customerName =
        (o.customers?.name?.toLowerCase() || "") +
        " " +
        (o.customers?.last_name?.toLowerCase() || "");
      return customerName.includes(nameFilter.toLowerCase());
    })
    .filter((o) =>
      statusFilter === "todos" ? true : o.status === statusFilter
    )
    .filter((o) => {
      const date = new Date(o.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });

  const { role, id_auth } = useAuth();

  return (
    <div className="space-y-4">
      {/* 🔹 Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <Input
              placeholder="Buscar por cliente..."
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full sm:w-80"
            />

            {/* 🔹 Filtro por fecha */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="whitespace-nowrap">
                  <IconCalendar className="h-4 w-4 mr-2" />
                  {dateRange?.from && dateRange?.to
                    ? `${dateRange.from.toLocaleDateString(
                      "es-AR"
                    )} - ${dateRange.to.toLocaleDateString("es-AR")}`
                    : "Filtrar por fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-3" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={handleWeekFilter}>
              Semana actual
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="sin_exito">Sin éxito</SelectItem>
                <SelectItem value="vendido">Vendido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

        {/* KPIs
        <div className="grid grid-cols-5 gap-2 w-full">
          {Object.entries(kpis).map(([key, value]) => (
            <Badge
              key={key}
              variant="outline"
              className={`hidden capitalize text-center md:block ${
                STATUS_STYLES[key] || "text-gray-700"
              } border ${
                STATUS_COLORS[key] || "bg-gray-300"
              } bg-opacity-20 p-2`}
            >
              {key}: {value}
            </Badge>
          ))}
        </div> */}
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
              <TableHead className="w-10 text-center"></TableHead>
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
                  {/* Cliente */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>
                        {o.customers
                          ? `${o.customers.name} ${o.customers.last_name || ""}`
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

                  <TableCell>
                    {o.seller?.user
                      ? `${o.seller.user.name ?? ""} ${o.seller.user.last_name ?? ""
                        }`.trim() || "—"
                      : "—"}
                  </TableCell>

                  <TableCell>{formatDate(o.appointment_datetime)}</TableCell>

                  <TableCell className="max-w-xs">
                    {Array.isArray(o.interested_variants) &&
                      o.interested_variants.length > 0 ? (
                      <div className="text-xs space-y-0.5">
                        {o.interested_variants.map((v, i) => (
                          <div key={i} className="block truncate">
                            {v.name || v.product_name || "Producto"}{" "}
                            {v.variant_name ? ` - ${v.variant_name}` : ""}{" "}
                            {v.color && (
                              <span className="text-zinc-500">({v.color})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="relative flex items-center gap-2">
                      <span
                        className={`absolute inline-flex h-2 w-2 rounded-full ${STATUS_COLORS[o.status] || "bg-gray-400"
                          } opacity-75 animate-ping`}
                      ></span>
                      <span
                        className={`relative inline-flex h-2 w-2 rounded-full ${STATUS_COLORS[o.status] || "bg-gray-400"
                          }`}
                      ></span>
                      <span
                        className={`capitalize text-sm font-medium ${STATUS_STYLES[o.status] || "text-gray-700"
                          }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>{formatDate(o.created_at)}</TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <IconDotsVertical size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {(() => {
                          switch (o.status) {
                            case "vendido":
                              return (
                                <DropdownMenuItem
                                  disabled
                                  className="text-muted-foreground"
                                >
                                  <IconCircleCheck className="mr-2 h-4 w-4" />
                                  Venta completada
                                </DropdownMenuItem>
                              );

                            case "pendiente":
                              return (
                                <>
                                  {
                                    role === "superadmin" && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => handleCreateSale(o)}
                                        >
                                          <IconReceipt2 className="mr-2 h-4 w-4" />
                                          Registrar venta
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUpdateStatus(o.id, "sin_exito")
                                          }
                                        >
                                          <IconBan className="mr-2 h-4 w-4" />
                                          Sin éxito (no concretó)
                                        </DropdownMenuItem>
                                      </>
                                    )
                                  }
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() =>
                                      handleUpdateStatus(o.id, "cancelado")
                                    }
                                  >
                                    <IconCircleX className="mr-2 h-4 w-4" />
                                    Cancelar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openReschedule(o)}
                                  >
                                    <IconCalendarEvent className="mr-2 h-4 w-4" />
                                    Reprogramar cita
                                  </DropdownMenuItem>

                                </>
                              );

                            case "sin_exito":
                              return (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => openReschedule(o)}
                                  >
                                    <IconCalendarEvent className="mr-2 h-4 w-4" />
                                    Reprogramar cita
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() =>
                                      handleUpdateStatus(o.id, "cancelado")
                                    }
                                  >
                                    <IconCircleX className="mr-2 h-4 w-4" />
                                    Cancelar
                                  </DropdownMenuItem>
                                </>
                              );

                            case "cancelado":
                              return (
                                <DropdownMenuItem
                                  onClick={() => openReschedule(o)}
                                >
                                  <IconCalendarEvent className="mr-2 h-4 w-4" />
                                  Reprogramar cita
                                </DropdownMenuItem>
                              );

                            default:
                              return null;
                          }
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DialogReschedule
        open={!!rescheduleLead}
        onClose={closeReschedule}
        lead={rescheduleLead}
        onSaved={() => fetchOrders(false)}
      />

      <SheetNewSale
        open={saleOpen}
        onOpenChange={setSaleOpen}
        lead={saleLead}
      />
    </div>
  );
};

export default OrdersTable;
