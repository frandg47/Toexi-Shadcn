import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "../lib/supabaseClient";
import { formatPersonName } from "@/utils/formatName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { IconColumns } from "@tabler/icons-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    IconRefresh,
    IconShoppingCart,
    IconCoin,
    IconCreditCard,
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

const TABLE_COLUMNS = [
    { id: "avatar", label: "Avatar" },
    { id: "name", label: "Nombre Completo" },
    { id: "email", label: "Email" },
    { id: "sales_count", label: "Cantidad de Ventas" },
    { id: "commissions_usd", label: "Comisiones USD" },
    { id: "commissions_ars", label: "Comisiones ARS" },
    { id: "payment_date", label: "Fecha de Pago" },
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
    return formatPersonName(user?.name, user?.last_name);
};

const getInitials = (user) => {
    const name = buildFullName(user);
    if (!name || name === "Sin nombre") return "?";
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
};

const formatCurrency = (value) => {
    if (!value) return "0";
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatCurrencyUSD = (value) => {
    if (!value) return "0";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const getMonthName = (dateString) => {
    if (!dateString) return "-";
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat("es-ES", {
            month: "long",
            year: "numeric",
        }).format(date);
    } catch {
        return "-";
    }
};

const SellersTable = ({ refreshToken = 0 }) => {
    const [visibleColumns, setVisibleColumns] = useState(
        TABLE_COLUMNS.map((col) => col.id)
    );
    const [nameFilter, setNameFilter] = useState("");
    const [monthFilter, setMonthFilter] = useState(() => {
        const now = new Date();
        // Defecto: último día del mes actual
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            .toISOString()
            .split("T")[0];
        return periodEnd;
    });

    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [fxRate, setFxRate] = useState(null);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [paymentDialog, setPaymentDialog] = useState({
        open: false,
        paymentRecord: null,
    });

    const fetchSellers = useCallback(async (showSkeleton = false) => {
        if (showSkeleton) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            // Obtener tipo de cambio activo
            const { data: fxData } = await supabase
                .from("fx_rates")
                .select("rate")
                .eq("is_active", true)
                .maybeSingle();

            if (fxData) setFxRate(Number(fxData.rate));

            // Obtener vendedores (usuarios con rol 'seller')
            const { data: users, error: usersError } = await supabase
                .from("users")
                .select("id, id_auth, name, avatar_url, last_name, email, role")
                .eq("role", "seller")
                .order("name", { ascending: true });

            if (usersError) throw usersError;

            // Obtener todos los pagos de comisión
            const { data: allPayments, error: paymentsError } = await supabase
                .from("commission_payments")
                .select("id, seller_id, period_start, period_end, total_amount, paid_at")
                .order("period_end", { ascending: false });

            if (paymentsError) throw paymentsError;

            // Crear un mapa de usuarios por id_auth
            const usersMap = {};
            (users || []).forEach(user => {
                usersMap[user.id_auth] = user;
            });

            // Enriquecer cada pago de comisión con datos del vendedor y ventas
            const enrichedPayments = await Promise.all(
                (allPayments || []).map(async (payment) => {
                    const seller = usersMap[payment.seller_id];
                    if (!seller) return null;

                    // Contar ventas del vendedor en el período
                    const { count: salesCount } = await supabase
                        .from("sales")
                        .select("id", { count: "exact", head: true })
                        .eq("seller_id", payment.seller_id)
                        .eq("status", "vendido")
                        .gte("sale_date", payment.period_start)
                        .lte("sale_date", payment.period_end);

                    const totalCommissionsUSD = Number(payment.total_amount || 0);
                    const isPaid = !!payment.paid_at;

                    return {
                        ...payment,
                        seller,
                        sales_count: salesCount || 0,
                        commissions_total_usd: totalCommissionsUSD,
                        commissions_total_ars: totalCommissionsUSD * (fxRate || 1),
                        isPaid,
                    };
                })
            );

            // Filtrar nulos
            const validPayments = enrichedPayments.filter(p => p !== null);

            // Extraer todos los meses únicos disponibles
            const allMonths = new Set();
            validPayments.forEach(payment => {
                allMonths.add(payment.period_end);
            });

            const monthList = Array.from(allMonths)
                .filter(m => m)
                .sort((a, b) => new Date(b) - new Date(a));

            setAvailableMonths(monthList);

            // Si el monthFilter inicial NO coincide con ningún mes disponible,
            // seteamos automáticamente al mes más reciente.
            if (!monthList.includes(monthFilter) && monthList.length > 0) {
                setMonthFilter(monthList[0]);
            }

            setSellers(validPayments);
        } catch (error) {
            console.error(error);
            toast.error("No se pudieron cargar los vendedores", {
                description: error.message,
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fxRate]);

    useEffect(() => {
        fetchSellers(refreshToken === 0);
    }, [fetchSellers, refreshToken]);

    const handlePayment = useCallback(async (paymentRecord) => {
        try {
            setRefreshing(true);

            // Actualizar el pago a liquidado
            const { error } = await supabase
                .from("commission_payments")
                .update({ paid_at: new Date().toISOString() })
                .eq("id", paymentRecord.id);

            if (error) throw error;

            toast.success("Pago registrado", {
                description: `Se registró el pago de comisión para ${buildFullName(paymentRecord.seller)}.`,
            });

            setPaymentDialog({ open: false, paymentRecord: null });
            fetchSellers(false);
        } catch (error) {
            console.error(error);
            toast.error("Error al registrar pago", {
                description: error.message,
            });
        } finally {
            setRefreshing(false);
        }
    }, [fetchSellers]);

    const toggleColumn = useCallback((columnName) => {
        setVisibleColumns((current) =>
            current.includes(columnName)
                ? current.filter((col) => col !== columnName)
                : [...current, columnName]
        );
    }, []);

    const filteredSellers = useMemo(() => {
        return sellers
            .filter(p => p.period_end === monthFilter) // Filtrar por mes exacto
            .filter(p => p.sales_count > 0) // Filtrar solo vendedores con ventas
            .filter(p =>
                buildFullName(p.seller).toLowerCase().includes(nameFilter.toLowerCase())
            );
    }, [sellers, monthFilter, nameFilter]);



    const isEmpty = useMemo(
        () => !loading && filteredSellers.length === 0,
        [loading, filteredSellers]
    );

    const columnCount = visibleColumns.length;

    return (
        <div className="space-y-4">
            {/* Header de filtros y acciones */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Buscador */}
                <Input
                    placeholder="Buscar por nombre..."
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="w-full lg:w-80 max-w-full"
                />

                {/* Filtros y botones */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end w-full lg:w-auto">
                    {/* Filtro de mes */}
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="w-full lg:w-56">
                            <SelectValue placeholder="Filtrar por mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableMonths
                                .filter(month => month && month.trim() !== "")
                                .map((month) => (
                                    <SelectItem key={month} value={month}>
                                        {getMonthName(month)}
                                    </SelectItem>
                                ))}
                        </SelectContent>

                    </Select>

                    {/* Columnas y Refrescar */}
                    <div className="flex gap-3 items-center justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="flex items-center gap-2">
                                    <IconColumns className="h-4 w-4" />
                                    <span>Columnas</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent className="w-56">
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

                        {/* Refrescar */}
                        <Button
                            variant="outline"
                            onClick={() => fetchSellers(false)}
                            disabled={refreshing}
                            className="flex items-center gap-2"
                        >
                            <IconRefresh
                                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                            />
                            Refrescar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {visibleColumns.includes("avatar") && (
                                <TableHead>Avatar</TableHead>
                            )}
                            {visibleColumns.includes("name") && (
                                <TableHead>Nombre Completo</TableHead>
                            )}
                            {visibleColumns.includes("sales_count") && (
                                <TableHead className="text-center">Cantidad de Ventas</TableHead>
                            )}
                            {visibleColumns.includes("commissions_usd") && (
                                <TableHead className="text-center">Comisiones USD</TableHead>
                            )}
                            {visibleColumns.includes("commissions_ars") && (
                                <TableHead className="text-center">Comisiones ARS</TableHead>
                            )}
                            {visibleColumns.includes("payment_date") && (
                                <TableHead className="text-center">Fecha de Pago</TableHead>
                            )}
                            {visibleColumns.includes("actions") && (
                                <TableHead className="text-center">Acciones</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={columnCount}>
                                    <div className="grid gap-2">
                                        {[...Array(10)].map((_, index) => (
                                            <Skeleton key={index} className="h-10 w-full" />
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {isEmpty && (
                            <TableRow>
                                <TableCell
                                    colSpan={columnCount}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    No hay vendedores registrados.
                                </TableCell>
                            </TableRow>
                        )}

                        {!loading &&
                            filteredSellers.map((payment) => (
                                <TableRow key={payment.id}>
                                    {visibleColumns.includes("avatar") && (
                                        <TableCell className="w-auto">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage src={payment.seller.avatar_url} />
                                                <AvatarFallback>{getInitials(payment.seller)}</AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                    )}
                                    {visibleColumns.includes("name") && (
                                        <TableCell>
                                            <div className="font-medium">{buildFullName(payment.seller)}</div>
                                        </TableCell>
                                    )}
                                    {visibleColumns.includes("sales_count") && (
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="flex items-center gap-2 justify-center w-fit mx-auto">
                                                <IconShoppingCart className="h-4 w-4" />
                                                {payment.sales_count}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {visibleColumns.includes("commissions_usd") && (
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="flex items-center gap-2 justify-center w-fit mx-auto">
                                                <IconCoin className="h-4 w-4" />
                                                {formatCurrencyUSD(payment.commissions_total_usd)}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {visibleColumns.includes("commissions_ars") && (
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="flex items-center gap-2 justify-center w-fit mx-auto">
                                                <IconCoin className="h-4 w-4" />
                                                {formatCurrency(payment.commissions_total_ars)}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {visibleColumns.includes("payment_date") && (
                                        <TableCell className="text-center">
                                            {payment.paid_at
                                                ? formatDate(payment.paid_at)
                                                : "Pendiente"}
                                        </TableCell>
                                    )}

                                    {visibleColumns.includes("actions") && (
                                        <TableCell className="text-center">
                                            <Button
                                                size="sm"
                                                variant={payment.isPaid ? "secondary" : "default"}
                                                className="flex items-center gap-2"
                                                onClick={() => !payment.isPaid && setPaymentDialog({ open: true, paymentRecord: payment })}
                                                disabled={refreshing || payment.isPaid}
                                            >
                                                <IconCreditCard className="h-4 w-4" />
                                                {payment.isPaid ? "Pagado" : "Pagar"}
                                            </Button>

                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>

            {/* AlertDialog para confirmar pago */}
            <AlertDialog
                open={paymentDialog.open}
                onOpenChange={(open) => {
                    if (!open) setPaymentDialog({ open: false, paymentRecord: null });
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar pago de comisión</AlertDialogTitle>
                        <AlertDialogDescription>
                            {paymentDialog.paymentRecord && (
                                <div className="space-y-2 mt-4">
                                    <p>
                                        <strong>Vendedor:</strong> {buildFullName(paymentDialog.paymentRecord.seller)}
                                    </p>
                                    <p>
                                        <strong>Mes:</strong> {getMonthName(paymentDialog.paymentRecord.period_end)}
                                    </p>
                                    <p>
                                        <strong>Comisión USD:</strong> {formatCurrencyUSD(paymentDialog.paymentRecord.commissions_total_usd)}
                                    </p>
                                    <p>
                                        <strong>Comisión ARS:</strong> {formatCurrency(paymentDialog.paymentRecord.commissions_total_ars)}
                                    </p>
                                    <p className="text-sm text-amber-600 mt-4">
                                        ¿Confirmas que deseas registrar este pago?
                                    </p>
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handlePayment(paymentDialog.paymentRecord)}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Confirmar pago
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default SellersTable;
