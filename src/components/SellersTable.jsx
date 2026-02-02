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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getPeriodRange = (monthFilter) => {
    if (!monthFilter) return null;
    const [year, month] = monthFilter.split("-").map(Number);
    if (!year || !month) return null;
    const start = new Date(year, month - 1, 1);
    const endExclusive = new Date(year, month, 1);
    return { startKey: toDateKey(start), endExclusiveKey: toDateKey(endExclusive) };
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
    const [salesDialogOpen, setSalesDialogOpen] = useState(false);
    const [salesDialogTitle, setSalesDialogTitle] = useState("");
    const [salesDialogItems, setSalesDialogItems] = useState([]);

    const loadSalesForSeller = useCallback(
        async (sellerId, sellerName, periodStart, periodEnd) => {
            if (!sellerId || !periodStart || !periodEnd) {
                setSalesDialogItems([]);
                setSalesDialogTitle(sellerName || "Ventas");
                setSalesDialogOpen(true);
                return;
            }

            const periodEndExclusive = addDaysToDateKey(periodEnd, 1);
            const { data: sales, error } = await supabase
                .from("sales")
                .select(
                    "id, sale_date, total_ars, customers(name, last_name), sales_channels(name)"
                )
                .eq("seller_id", sellerId)
                .gte("sale_date", periodStart)
                .lt("sale_date", periodEndExclusive || periodEnd)
                .neq("status", "anulado")
                .order("sale_date", { ascending: false });

            if (error) {
                console.error(error);
                setSalesDialogItems([]);
                setSalesDialogTitle(sellerName || "Ventas");
                setSalesDialogOpen(true);
                return;
            }

            const saleIds = (sales || []).map((sale) => sale.id).filter(Boolean);

            if (saleIds.length === 0) {
                setSalesDialogItems(sales || []);
                setSalesDialogTitle(sellerName || "Ventas");
                setSalesDialogOpen(true);
                return;
            }

            const { data: items, error: itemsError } = await supabase
                .from("sale_items")
                .select(
                    "sale_id, quantity, usd_price, product_name, variant_name, commission_pct, commission_fixed"
                )
                .in("sale_id", saleIds);

            if (itemsError) {
                console.error(itemsError);
            }

            const saleItemsMap = {};
            const saleCommissionMap = {};

            (items || []).forEach((item) => {
                const qty = Number(item.quantity || 0);
                const usdPrice = Number(item.usd_price || 0);
                const pct = item.commission_pct;
                const fixed = item.commission_fixed;
                let itemCommission = 0;

                if (pct != null) {
                    itemCommission = usdPrice * qty * (Number(pct) / 100);
                } else if (fixed != null) {
                    itemCommission = Number(fixed) * qty;
                }

                if (!saleItemsMap[item.sale_id]) {
                    saleItemsMap[item.sale_id] = [];
                }
                saleItemsMap[item.sale_id].push({
                    name: item.product_name || "Producto",
                    variant: item.variant_name || "",
                    quantity: qty,
                });

                saleCommissionMap[item.sale_id] =
                    (saleCommissionMap[item.sale_id] || 0) + itemCommission;
            });

            const salesWithDetails = (sales || []).map((sale) => ({
                ...sale,
                items: saleItemsMap[sale.id] || [],
                commission_usd: saleCommissionMap[sale.id] || 0,
            }));

            setSalesDialogItems(salesWithDetails);
            setSalesDialogTitle(sellerName || "Ventas");
            setSalesDialogOpen(true);
        },
        []
    );

    const fetchSellers = useCallback(async (showSkeleton = false) => {
        if (showSkeleton) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const period = getPeriodRange(monthFilter);
            const periodStart = period?.startKey;
            const periodEndExclusive = period?.endExclusiveKey;
            if (!periodStart || !periodEndExclusive) {
                setSellers([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const periodEnd = addDaysToDateKey(periodEndExclusive, -1);

            // Obtener tipo de cambio activo
            const { data: fxData, error: fxError } = await supabase
                .from("fx_rates")
                .select("rate")
                .eq("is_active", true)
                .maybeSingle();

            if (fxError) throw fxError;
            if (fxData) setFxRate(Number(fxData.rate));

            // Obtener vendedores (usuarios con rol 'seller')
            const { data: users, error: usersError } = await supabase
                .from("users")
                .select("id, id_auth, name, avatar_url, last_name, email, role")
                .eq("role", "seller")
                .order("name", { ascending: true });

            if (usersError) throw usersError;

            const { data: salesInPeriod, error: salesError } = await supabase
                .from("sales")
                .select("id, seller_id")
                .eq("status", "vendido")
                .gte("sale_date", periodStart)
                .lt("sale_date", periodEndExclusive);

            if (salesError) throw salesError;

            const usersMap = {};
            (users || []).forEach(user => {
                usersMap[user.id_auth] = user;
            });

            const saleIdsAll = (salesInPeriod || []).map((sale) => sale.id).filter(Boolean);
            const { data: items, error: itemsError } = await supabase
                .from("sale_items")
                .select("sale_id, quantity, usd_price, commission_pct, commission_fixed")
                .in("sale_id", saleIdsAll.length ? saleIdsAll : [0]);

            if (itemsError) console.error(itemsError);

            const saleSellerMap = {};
            salesInPeriod?.forEach((sale) => {
                if (sale?.id) saleSellerMap[sale.id] = sale.seller_id;
            });

            const commissionsBySeller = {};
            const salesCountBySeller = {};

            salesInPeriod?.forEach((sale) => {
                if (!sale?.seller_id) return;
                salesCountBySeller[sale.seller_id] =
                    (salesCountBySeller[sale.seller_id] || 0) + 1;
            });

            (items || []).forEach((item) => {
                const sellerId = saleSellerMap[item.sale_id];
                if (!sellerId) return;
                const qty = Number(item.quantity || 0);
                const usdPrice = Number(item.usd_price || 0);
                const pct = item.commission_pct;
                const fixed = item.commission_fixed;
                let itemCommission = 0;

                if (pct != null) {
                    itemCommission = usdPrice * qty * (Number(pct) / 100);
                } else if (fixed != null) {
                    itemCommission = Number(fixed) * qty;
                }

                commissionsBySeller[sellerId] =
                    (commissionsBySeller[sellerId] || 0) + itemCommission;
            });

            const { data: paymentsForPeriod, error: paymentsError } = await supabase
                .from("commission_payments")
                .select("id, seller_id, period_start, period_end, total_amount, paid_at")
                .eq("period_end", periodEnd);

            if (paymentsError) throw paymentsError;

            const paymentsMap = {};
            (paymentsForPeriod || []).forEach((p) => {
                paymentsMap[p.seller_id] = p;
            });

            const sellerIdsWithSales = Object.keys(salesCountBySeller);
            const enrichedPayments = sellerIdsWithSales.map((sellerId) => {
                const seller = usersMap[sellerId];
                if (!seller) return null;
                const payment = paymentsMap[sellerId];
                const totalCommissionsUSD = Number(commissionsBySeller[sellerId] || 0);
                const isPaid = !!payment?.paid_at;

                return {
                    id: payment?.id || null,
                    seller_id: sellerId,
                    period_start: payment?.period_start || periodStart,
                    period_end: payment?.period_end || periodEnd,
                    total_amount: payment?.total_amount || totalCommissionsUSD,
                    paid_at: payment?.paid_at || null,
                    seller,
                    sales_count: salesCountBySeller[sellerId] || 0,
                    commissions_total_usd: totalCommissionsUSD,
                    commissions_total_ars: totalCommissionsUSD * (fxData?.rate || fxRate || 1),
                    isPaid,
                };
            });

            const validPayments = enrichedPayments.filter(p => p !== null);

            const { data: allSales, error: allSalesError } = await supabase
                .from("sales")
                .select("sale_date")
                .neq("status", "anulado")
                .order("sale_date", { ascending: false })
                .limit(500);

            if (!allSalesError && allSales) {
                const uniqueMonths = new Set();
                allSales.forEach((sale) => {
                    if (!sale?.sale_date) return;
                    const date = new Date(sale.sale_date);
                    if (Number.isNaN(date.getTime())) return;
                    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                    uniqueMonths.add(toDateKey(monthEnd));
                });
                const monthList = Array.from(uniqueMonths).sort(
                    (a, b) => new Date(b) - new Date(a)
                );

                setAvailableMonths(monthList);
                if (!monthList.includes(monthFilter) && monthList.length > 0) {
                    setMonthFilter(monthList[0]);
                }
            }

            setSellers(validPayments);
            return;
            /*
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
                    const periodEndExclusive = addDaysToDateKey(payment.period_end, 1);
                    const { data: salesInPeriod } = await supabase
                        .from("sales")
                        .select("id")
                        .eq("seller_id", payment.seller_id)
                        .eq("status", "vendido")
                        .gte("sale_date", payment.period_start)
                        .lt("sale_date", periodEndExclusive || payment.period_end);

                    const saleIds = (salesInPeriod || []).map((sale) => sale.id).filter(Boolean);
                    let computedCommissionUSD = 0;

                    if (saleIds.length > 0) {
                        const { data: items, error: itemsError } = await supabase
                            .from("sale_items")
                            .select("sale_id, quantity, usd_price, commission_pct, commission_fixed")
                            .in("sale_id", saleIds);

                        if (itemsError) {
                            console.error(itemsError);
                        } else {
                            (items || []).forEach((item) => {
                                const qty = Number(item.quantity || 0);
                                const usdPrice = Number(item.usd_price || 0);
                                const pct = item.commission_pct;
                                const fixed = item.commission_fixed;
                                let itemCommission = 0;

                                if (pct != null) {
                                    itemCommission = usdPrice * qty * (Number(pct) / 100);
                                } else if (fixed != null) {
                                    itemCommission = Number(fixed) * qty;
                                }

                                computedCommissionUSD += itemCommission;
                            });
                        }
                    }

                    const totalCommissionsUSD =
                        saleIds.length > 0
                            ? computedCommissionUSD
                            : Number(payment.total_amount || 0);
                    const isPaid = !!payment.paid_at;

                    return {
                        ...payment,
                        seller,
                        sales_count: saleIds.length,
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
            */
        } catch (error) {
            console.error(error);
            toast.error("No se pudieron cargar los vendedores", {
                description: error.message,
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fxRate, monthFilter]);

    useEffect(() => {
        fetchSellers(refreshToken === 0);
    }, [fetchSellers, refreshToken]);

    const handlePayment = useCallback(async (paymentRecord) => {
        try {
            setRefreshing(true);

            const paidAt = new Date().toISOString();
            let error;

            if (paymentRecord.id) {
                ({ error } = await supabase
                    .from("commission_payments")
                    .update({ paid_at: paidAt })
                    .eq("id", paymentRecord.id));
            } else {
                ({ error } = await supabase
                    .from("commission_payments")
                    .insert([
                        {
                            seller_id: paymentRecord.seller_id,
                            period_start: paymentRecord.period_start,
                            period_end: paymentRecord.period_end,
                            total_amount: paymentRecord.commissions_total_usd || 0,
                            paid_at: paidAt,
                        },
                    ]));
            }

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
                                <TableRow
                                    key={payment.id}
                                    className="cursor-pointer"
                                    onClick={() =>
                                        loadSalesForSeller(
                                            payment.seller.id_auth,
                                            buildFullName(payment.seller),
                                            payment.period_start,
                                            payment.period_end
                                        )
                                    }
                                >
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
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!payment.isPaid) {
                                                        setPaymentDialog({
                                                            open: true,
                                                            paymentRecord: payment,
                                                        });
                                                    }
                                                }}
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

            <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
                <DialogContent className="w-[90vw] sm:max-w-3xl max-h-[85svh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{salesDialogTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Productos</TableHead>
                                    <TableHead>Canal</TableHead>
                                    <TableHead className="text-right">Comisión</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesDialogItems.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell>
                                            {new Date(sale.sale_date).toLocaleDateString("es-AR")}
                                        </TableCell>
                                        <TableCell>
                                            {sale.customers
                                                ? formatPersonName(
                                                    sale.customers.name,
                                                    sale.customers.last_name
                                                )
                                                : "Sin cliente"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                {sale.items?.length
                                                    ? sale.items.map((item, index) => (
                                                        <div key={`${sale.id}-item-${index}`}>
                                                            {item.name}
                                                            {item.variant ? ` (${item.variant})` : ""} x{item.quantity}
                                                        </div>
                                                    ))
                                                    : "Sin productos"}
                                            </div>
                                        </TableCell>
                                        <TableCell>{sale.sales_channels?.name || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrencyUSD(sale.commission_usd || 0)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {Number(sale.total_ars || 0).toLocaleString("es-AR")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {salesDialogItems.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center text-muted-foreground"
                                        >
                                            No hay ventas en el periodo seleccionado.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const addDaysToDateKey = (dateKey, days) => {
    if (!dateKey) return null;
    const [year, month, day] = dateKey.split("-").map(Number);
    if (!year || !month || !day) return null;
    const base = new Date(year, month - 1, day);
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

export default SellersTable;
