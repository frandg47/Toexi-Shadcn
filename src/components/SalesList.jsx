"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminSales } from "../utils/getAdminSales";

import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis,
} from "@/components/ui/pagination";


import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContextProvider";
import { supabase } from "@/lib/supabaseClient";
import { formatPersonName } from "@/utils/formatName";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";

import { IconCalendar, IconRefresh, IconDownload } from "@tabler/icons-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function SalesList() {
    const [sales, setSales] = useState([]);
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const { role } = useAuth();
    const isOwner = role?.toLowerCase() === "owner";
    const [sellerOptions, setSellerOptions] = useState([]);
    const [editOpen, setEditOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [editDate, setEditDate] = useState(null);
    const [editTime, setEditTime] = useState("09:00");
    const [editSellerId, setEditSellerId] = useState("");
    const [editChannelId, setEditChannelId] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [channels, setChannels] = useState([]);

    // �️ Estados para anulación
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelingSale, setCancelingS] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [bucketOpen, setBucketOpen] = useState(false);
    const [selectedBucket, setSelectedBucket] = useState("available");
    const [cancelingProcess, setCancelingProcess] = useState(false);

    // �📌 Filtros unificados
    const [filters, setFilters] = useState({
        start_date: "",
        end_date: "",
        seller_id: "",
    });

    // 📌 Fecha inicial (mes actual)
    const getDefaultMonthRange = () => {
        const start = new Date();
        start.setDate(1);
        const end = new Date();
        return { from: start, to: end };
    };

    const getDefaultWeekRange = () => {
        const start = new Date();
        start.setDate(start.getDate() - start.getDay() + 1);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { from: start, to: end };
    };

    const [dateRange, setDateRange] = useState(getDefaultMonthRange());
    const [refreshing, setRefreshing] = useState(false);

    // 📌 Actualiza filtros cuando cambia el calendario
    useEffect(() => {
        if (dateRange?.from) {
            // Sumar 1 día a la fecha final para incluir todo el último día
            const endDate = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
            endDate.setDate(endDate.getDate() + 1);

            setFilters((f) => ({
                ...f,
                start_date: dateRange.from.toISOString().split("T")[0],
                end_date: endDate.toISOString().split("T")[0],
            }));
        }
    }, [dateRange]);

    useEffect(() => {
        if (!isOwner) return;

        const fetchSellers = async () => {
            const { data, error } = await supabase
                .from("users")
                .select("id_auth, name, last_name, email")
                .eq("role", "seller")
                .eq("is_active", true)
                .order("name", { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setSellerOptions(data || []);
        };

        const fetchChannels = async () => {
            const { data, error } = await supabase
                .from("sales_channels")
                .select("id, name")
                .eq("is_active", true)
                .order("name", { ascending: true });

            if (error) {
                console.error(error);
                return;
            }

            setChannels(data || []);
        };

        fetchSellers();
        fetchChannels();
    }, [isOwner]);

    const load = useCallback(async () => {
        try {
            setRefreshing(true);
            const { data, count } = await getAdminSales(page, filters);
            setSales(data || []);
            setCount(count || 0);
        } catch (err) {
            toast.error("Error al cargar ventas");
        } finally {
            setRefreshing(false);
        }
    }, [page, filters]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.ceil(count / 10);
    const openEditSale = (sale) => {
        const saleDate = sale?.sale_date ? new Date(sale.sale_date) : new Date();
        const hh = String(saleDate.getHours()).padStart(2, "0");
        const mm = String(saleDate.getMinutes()).padStart(2, "0");

        setEditingSale(sale);
        setEditDate(saleDate);
        setEditTime(`${hh}:${mm}`);
        setEditSellerId(sale?.seller_id || "");
        setEditChannelId(sale?.sales_channel_id ? String(sale.sales_channel_id) : "");
        setEditOpen(true);
    };

    const closeEditSale = () => {
        setEditOpen(false);
        setEditingSale(null);
        setEditChannelId("");
    };

    const handleSaveEdit = async () => {
        if (!editingSale) return;

        // Validar que no sea una venta anulada
        if (editingSale.status === "anulado") {
            toast.error("No se puede editar una venta anulada");
            return;
        }

        if (!editDate || !editTime) {
            toast.error("Selecciona fecha y hora");
            return;
        }

        const [hh, mm] = editTime.split(":");
        const nextDate = new Date(editDate);
        nextDate.setHours(Number(hh), Number(mm), 0, 0);

        const payload = {
            sale_date: nextDate.toISOString(),
        };

        if (editSellerId) {
            payload.seller_id = editSellerId;
        }

        if (editChannelId) {
            payload.sales_channel_id = editChannelId;
        }

        try {
            setSavingEdit(true);
            const { error } = await supabase
                .from("sales")
                .update(payload)
                .eq("id", editingSale.sale_id);

            if (error) throw error;

            toast.success("Venta actualizada");
            closeEditSale();
            load();
        } catch (err) {
            toast.error("No se pudo actualizar la venta", {
                description: err?.message,
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const startCancelSale = (sale) => {
        if (!isOwner) {
            toast.error("Solo el owner puede anular ventas");
            return;
        }
        setCancelingS(sale);
        setCancelReason("");
        setCancelOpen(true);
    };

    const closeCancelDialog = () => {
        setCancelOpen(false);
        setCancelingS(null);
        setCancelReason("");
    };

    const proceedToBucketSelection = () => {
        if (!cancelReason.trim()) {
            toast.error("Debes ingresar un motivo de anulación");
            return;
        }
        setCancelOpen(false);
        setBucketOpen(true);
    };

    const closeBucketDialog = () => {
        setBucketOpen(false);
        setSelectedBucket("available");
    };

    const completeCancelSale = async () => {
        if (!cancelingSale) return;

        try {
            setCancelingProcess(true);
            const { error } = await supabase.rpc("void_sale", {
                p_sale_id: cancelingSale.sale_id,
                p_reason: cancelReason,
                p_bucket: selectedBucket,
            });

            if (error) throw error;

            toast.success("Venta anulada correctamente");
            closeBucketDialog();
            setCancelingS(null);
            setCancelReason("");
            load();
        } catch (err) {
            toast.error("No se pudo anular la venta", {
                description: err?.message,
            });
        } finally {
            setCancelingProcess(false);
        }
    };


    // 📄 Generar PDF de venta
    const handleDownloadSalePDF = (sale) => {
        try {
            const doc = new jsPDF();
            const margin = 14;
            const pageWidth = doc.internal.pageSize.getWidth();
            let y = margin;

            // Logo
            const logoWidth = 22;
            const logoHeight = 22;
            const logoX = pageWidth - logoWidth - margin;
            doc.addImage("/toexi.jpg", "JPEG", logoX - 2, margin - 8, logoWidth, logoHeight);

            // Encabezado
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("COMPROBANTE DE VENTA", margin, y);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`N°: VTA-${String(sale.sale_id).padStart(6, "0")}`, margin, y + 6);

            y += 26;

            // Cliente / Fechas
            const fecha = new Date(sale.sale_date).toLocaleDateString("es-AR");

            doc.setFontSize(11);
            doc.rect(margin, y, 180, 22);

            doc.text("Fecha:", margin + 4, y + 6);
            doc.text(fecha, margin + 40, y + 6);

            doc.text("Cliente:", margin + 4, y + 12);
            doc.text(
                `${sale.customer_name} ${sale.customer_last_name} (Tel: ${sale.customer_phone || "-"})`,
                margin + 40,
                y + 12
            );

            y += 30;

            // Vendedor
            const vendedorNombre = sale.seller_name && sale.seller_name.trim()
                ? `${sale.seller_name}${sale.seller_last_name ? ' ' + sale.seller_last_name : ''} (Tel: ${sale.seller_phone || "-"}) `
                : "Toexi Tech";

            doc.setFontSize(11);
            doc.rect(margin, y, 180, 16);

            doc.text("Vendedor:", margin + 4, y + 6);
            doc.text(vendedorNombre, margin + 40, y + 6);

            y += 24;
            autoTable(doc, {
                startY: y,
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontSize: 10,
                    fontStyle: "bold",
                    lineWidth: 0.3,
                    lineColor: [0, 0, 0],
                },
                bodyStyles: {
                    fontSize: 10,
                    lineWidth: 0.3,
                    lineColor: [0, 0, 0],
                },
                head: [["Producto", "Variante", "Color", "Cant", "IMEI/s", "Subtotal USD", "Subtotal ARS"]],
                body: sale.items?.map((i) => [
                    i.product_name,
                    i.variant_name || "Modelo Base",
                    i.color || "-",
                    i.quantity,
                    (i.imeis || []).join("\n"),
                    `USD ${(i.subtotal_usd || i.usd_price * i.quantity).toFixed(2)}`,
                    `$ ${Number(i.subtotal_ars).toLocaleString("es-AR")}`,
                ]) || [],
                columnStyles: {
                    0: { cellWidth: 32 },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 12 },
                    4: { cellWidth: 30 },
                    5: { halign: "right", cellWidth: 30 },
                    6: { halign: "right", cellWidth: 26 },
                },
                theme: "plain",
                margin: { top: 0, right: 0, bottom: 0, left: margin },
                didDrawCell: (data) => {
                    const { table, row, column } = data;
                    const totalRows = table.body.length;
                    const totalCols = table.columns.length;

                    if (row.index === 0 && column.index === 0) {
                        data.cell.styles.lineWidth = [0, 0.3, 0.3, 0];
                    } else if (row.index === 0 && column.index === totalCols - 1) {
                        data.cell.styles.lineWidth = [0, 0, 0.3, 0.3];
                    } else if (row.index === totalRows - 1 && column.index === 0) {
                        data.cell.styles.lineWidth = [0.3, 0.3, 0, 0];
                    } else if (row.index === totalRows - 1 && column.index === totalCols - 1) {
                        data.cell.styles.lineWidth = [0.3, 0, 0, 0.3];
                    } else if (row.index === 0) {
                        data.cell.styles.lineWidth = [0, 0.3, 0.3, 0.3];
                    } else if (row.index === totalRows - 1) {
                        data.cell.styles.lineWidth = [0.3, 0.3, 0, 0.3];
                    } else if (column.index === 0) {
                        data.cell.styles.lineWidth = [0.3, 0.3, 0.3, 0];
                    } else if (column.index === totalCols - 1) {
                        data.cell.styles.lineWidth = [0.3, 0, 0.3, 0.3];
                    } else {
                        data.cell.styles.lineWidth = [0.3, 0.3, 0.3, 0.3];
                    }
                }
            });

            y = doc.lastAutoTable.finalY + 10;

            // Resumen financiero
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");

            // doc.text(`Subtotal USD: USD ${sale.total_usd?.toFixed(2) || "0.00"}`, margin, y);
            // y += 6;

            const subtotalWithSurcharge =
                Number(sale.total_ars) + Number(sale.discount_amount || 0);

            doc.text(
                `Subtotal: $ ${subtotalWithSurcharge.toLocaleString("es-AR")}`,
                margin,
                y
            );
            y += 6;

            if (Number(sale.discount_amount) > 0) {
                doc.text(
                    `Descuento aplicado: -$ ${Number(sale.discount_amount).toLocaleString("es-AR")}`,
                    margin,
                    y
                );
                y += 6;
            }

            // doc.setFontSize(14);
            // doc.setFont("helvetica", "bold");
            // doc.setTextColor(0, 100, 200);
            // doc.text(
            //     `TOTAL: $ ${Number(sale.total_ars).toLocaleString("es-AR")}`,
            //     margin,
            //     y
            // );
            // y += 14;

            doc.text(`Cotización aplicada: $ ${sale.fx_rate_used}`, margin, y);
            y += 14;

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 100, 200);
            doc.text(`TOTAL: $ ${Number(sale.total_ars).toLocaleString("es-AR")}`, margin, y);

            y += 14;

            // Métodos de pago
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text("Formas de Pago:", margin, y);
            y += 6;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            sale.payments?.forEach((p) => {
                doc.text(
                    `• ${p.payment_method_name}${p.installments ? ` (${p.installments} cuotas)` : ""}: $ ${Number(p.amount_ars).toLocaleString("es-AR")}`,
                    margin,
                    y
                );
                y += 5;
            });

            doc.text(`Nota: ${sale.notes || "-"}`, margin, y += 8);
            y += 4;


            // =============================
            //  FOOTER LEGAL + DATOS EMPRESA
            // =============================
            const pageHeight = doc.internal.pageSize.getHeight();
            const footerCenter = pageWidth / 2;

            let fY = pageHeight - 24;

            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(60);
            doc.text("TOEXI TECH", footerCenter, fY, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);

            doc.text("Teléfono: 381 364 5246", footerCenter, fY + 5, { align: "center" });
            doc.text("Instagram: @toexi.tech", footerCenter, fY + 10, { align: "center" });

            // Legal
            doc.setFontSize(8);
            doc.setTextColor(120);
            doc.text("Gracias por su compra", footerCenter, fY + 17, { align: "center" });

            doc.save(`venta_${sale.sale_id}.pdf`);
            toast.success("PDF descargado correctamente");

        } catch (err) {
            console.error("Error generando PDF:", err);
            toast.error("Error al generar PDF");
        }
    };

    return (
        <div className="pb-6 space-y-6">

            {/* 🔎 FILTROS EXACTO AL ESTILO FxRatesConfig */}
            <div
                className="flex flex-col gap-3 sm:flex-row lg:items-center sm:justify-between"
            >
                {/* ------- FILA 1 (siempre) ------- */}
                <div className="flex gap-3">
                    {/* Rango (ocupa espacio restante en mobile) */}
                    <div className="flex-1">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="flex items-center gap-2 w-full sm:w-auto"
                                >
                                    <IconCalendar className="h-4 w-4" />
                                    {dateRange?.from
                                        ? `${dateRange.from.toLocaleDateString("es-AR")} → ${dateRange.to
                                            ? dateRange.to.toLocaleDateString("es-AR")
                                            : "..."
                                        }`
                                        : "Seleccionar rango"}
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="p-2" align="start">
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    className="rounded-lg border shadow-sm"
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Semana actual */}
                    <Button
                        variant="outline"
                        onClick={() => setDateRange(getDefaultWeekRange())}
                        className="whitespace-nowrap"
                    >
                        Semana actual
                    </Button>
                </div>

                {/* ------- FILA 2 SOLO EN MOBILE, MISMA FILA EN LG+ ------- */}
                <div
                    className="flex w-full justify-end gap-3 lg:w-auto lg:justify-end"
                >
                    <Button
                        variant="outline"
                        onClick={() => {
                            setDateRange(getDefaultMonthRange());
                            load();
                        }}
                        disabled={refreshing}
                    >
                        <IconRefresh
                            className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                        />
                        Refrescar
                    </Button>
                </div>
            </div>


            {/* Filtro por vendedor */}
            {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted p-4 rounded-lg">
        <div>
          <label className="text-sm font-medium">Vendedor:</label>
          <Input
            placeholder="ID vendedor (provisorio)"
            onChange={(e) =>
              setFilters((f) => ({ ...f, seller_id: e.target.value }))
            }
          />
        </div>
      </div> */}

            {/* 🧾 LISTA DE TICKETS */}
            <div className="space-y-6">
                {sales.length !== 0 ? sales.map((s) => (
                    <Card key={s.sale_id} className="p-5 shadow-md w-full">
                        <div className="flex justify-between">
                            <h2 className="font-bold text-lg">Venta #{s.sale_id}</h2>
                            <span className="text-sm text-muted-foreground">
                                {new Date(s.sale_date).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {s.status && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Estado:
                                    </span>
                                    <Badge
                                        variant={
                                            s.status === "anulado" ? "destructive" : "default"
                                        }
                                    >
                                        {s.status === "anulado" ? "ANULADA" : s.status}
                                    </Badge>
                                </div>
                            )}
                            {s.sales_channel_name && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Origen:
                                    </span>
                                    <Badge variant="outline">
                                        {s.sales_channel_name}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        <hr className="my-3" />

                        {/* Cliente y vendedor */}
                        <div className="text-sm mb-3">
                            <p>
                                <strong>Cliente:</strong>{" "}
                                {formatPersonName(s.customer_name, s.customer_last_name)}
                                <strong>{" | "}Tel:</strong> {" "} {s.customer_phone ?? "-"}
                            </p>
                            <p>
                                <strong>Vendedor:</strong>{" "}
                                {formatPersonName(s.seller_name, s.seller_last_name)}
                                <strong>{" | "}Tel:</strong> {" "} {s.seller_phone ?? "3816783617"}
                            </p>
                        </div>

                        {/* Items */}
                        <div className="text-sm border rounded p-3 bg-muted/40">
                            <strong>Productos:</strong>
                            {s.items?.map((i, idx) => (
                                <div key={idx} className="border-b py-1 last:border-0">
                                    <div className="flex justify-between">
                                        <span>
                                            {i.product_name} {i.variant_name} {i.color ? `(${i.color})` : ""} — {i.quantity}u
                                        </span>
                                        <span>
                                            ${Number(i.subtotal_ars ?? 0).toLocaleString("es-AR")}
                                        </span>

                                    </div>
                                    {i.imei && i.imei.toString().trim() !== "" && <div className="text-xs text-muted-foreground">IMEI: {i.imei}</div>}
                                </div>
                            ))}
                        </div>

                        {/* Pagos */}
                        <div className="text-sm border rounded p-3 mt-3 bg-muted/40">
                            <strong>Métodos de pago:</strong>
                            {s.payments?.map((p, idx) => (
                                <div key={idx} className="flex justify-between border-b last:border-0 py-1">
                                    <span>
                                        {p.payment_method_name}
                                        {p.installments > 1 ? ` · ${p.installments} cuotas` : ""}
                                    </span>
                                    <span>${Number(p.amount_ars).toLocaleString("es-AR")}</span>
                                </div>
                            ))}
                        </div>

                        {s.notes && (
                            <div className="text-sm border rounded p-3 mt-3 bg-muted/40">
                                <strong>Notas: </strong>
                                {s.notes}
                            </div>
                        )}

                        {s.status === "anulado" && (
                            <div className="text-xs border-l-2 border-red-500 rounded p-3 mt-3 bg-red-50 dark:bg-red-950/20">
                                <div className="font-semibold text-red-700 dark:text-red-300 mb-2">
                                    📋 Información de Anulación
                                </div>
                                <div className="space-y-1 text-red-700 dark:text-red-300">
                                    <p>
                                        <strong>Motivo:</strong> {s.void_reason || "-"}
                                    </p>
                                    <p>
                                        <strong>Anulado el:</strong>{" "}
                                        {s.voided_at
                                            ? new Date(s.voided_at).toLocaleString("es-AR")
                                            : "-"}
                                    </p>
                                    <p>
                                        <strong>Stock devuelto a:</strong>{" "}
                                        {s.void_stock_bucket === "available"
                                            ? "Disponible"
                                            : s.void_stock_bucket === "defective"
                                                ? "Defectuoso"
                                                : "-"}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="text-right mt-3 space-y-1">
                            <div className="text-sm text-muted-foreground">
                                Subtotal: $
                                {(Number(s.total_ars) + Number(s.discount_amount || 0)).toLocaleString("es-AR")}
                            </div>

                            {Number(s.discount_amount) > 0 && (
                                <div className="text-sm text-green-600">
                                    Descuento: −$
                                    {Number(s.discount_amount).toLocaleString("es-AR")}
                                </div>
                            )}

                            <div className="font-bold text-xl text-primary">
                                Total a pagar: $
                                {Number(s.total_ars).toLocaleString("es-AR")}
                            </div>
                        </div>


                        {/* Botón descargar PDF */}
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                            {isOwner && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditSale(s)}
                                        disabled={s.status === "anulado"}
                                    >
                                        Editar venta
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => startCancelSale(s)}
                                        disabled={s.status === "anulado"}
                                    >
                                        Anular venta
                                    </Button>
                                </>
                            )}
                            <Button
                                onClick={() => handleDownloadSalePDF(s)}
                                size="sm"
                                className="gap-2"
                            >
                                <IconDownload className="h-4 w-4" />
                                Descargar PDF
                            </Button>
                        </div>
                    </Card>
                )) :
                    (
                        <p className="text-center text-muted-foreground">No se encontraron ventas para los filtros seleccionados.</p>
                    )}
            </div>

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    if (!open) closeEditSale();
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar venta</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Fecha de venta</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left"
                                    >
                                        {editDate
                                            ? editDate.toLocaleDateString("es-AR")
                                            : "Seleccionar fecha"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="p-0">
                                    <Calendar
                                        mode="single"
                                        selected={editDate}
                                        onSelect={setEditDate}
                                        className="m-auto"
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Hora</Label>
                            <Input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Vendedor</Label>
                            <Select
                                value={editSellerId || ""}
                                onValueChange={setEditSellerId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar vendedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {editingSale?.seller_id &&
                                        !sellerOptions.some(
                                            (seller) =>
                                                seller.id_auth === editingSale.seller_id
                                        ) && (
                                            <SelectItem value={editingSale.seller_id}>
                                                {[editingSale.seller_name, editingSale.seller_last_name]
                                                    .filter(Boolean)
                                                    .join(" ") || "Vendedor actual"}
                                            </SelectItem>
                                        )}
                                    {sellerOptions.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            Sin vendedores activos
                                        </SelectItem>
                                    ) : (
                                        sellerOptions.map((seller) => (
                                            <SelectItem
                                                key={seller.id_auth}
                                                value={seller.id_auth}
                                            >
                                                {[seller.name, seller.last_name]
                                                    .filter(Boolean)
                                                    .join(" ") || seller.email}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Canal de venta</Label>
                            <Select
                                value={editChannelId || ""}
                                onValueChange={setEditChannelId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar canal" />
                                </SelectTrigger>
                                <SelectContent>
                                    {editingSale?.sales_channel_id &&
                                        !channels.some(
                                            (ch) =>
                                                ch.id === editingSale.sales_channel_id
                                        ) && (
                                            <SelectItem value={String(editingSale.sales_channel_id)}>
                                                {editingSale.sales_channel_name || "Canal actual"}
                                            </SelectItem>
                                        )}
                                    {channels.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            Sin canales activos
                                        </SelectItem>
                                    ) : (
                                        channels.map((channel) => (
                                            <SelectItem
                                                key={channel.id}
                                                value={channel.id.toString()}
                                            >
                                                {channel.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditSale}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 🗑️ Dialog para ingresar motivo de anulación */}
            <Dialog open={cancelOpen} onOpenChange={(open) => {
                if (!open) closeCancelDialog();
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Anular venta #{cancelingSale?.sale_id}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cancel-reason">Motivo de anulación</Label>
                            <Input
                                id="cancel-reason"
                                placeholder="Ej: Error de carga, cliente cambió de idea..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="min-h-20 resize-none"
                                as="textarea"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeCancelDialog}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={proceedToBucketSelection}
                        >
                            Siguiente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 🪣 Dialog para seleccionar bucket de stock */}
            <Dialog open={bucketOpen} onOpenChange={(open) => {
                if (!open) closeBucketDialog();
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Destino del stock devuelto</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            ¿Dónde debe devolverse el stock de esta venta anulada?
                        </p>

                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition"
                                onClick={() => setSelectedBucket("available")}
                            >
                                <input
                                    type="radio"
                                    name="bucket"
                                    value="available"
                                    checked={selectedBucket === "available"}
                                    onChange={() => setSelectedBucket("available")}
                                    className="h-4 w-4"
                                />
                                <div>
                                    <div className="font-semibold">Stock Disponible</div>
                                    <div className="text-sm text-muted-foreground">
                                        El producto puede venderse nuevamente
                                    </div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition"
                                onClick={() => setSelectedBucket("defective")}
                            >
                                <input
                                    type="radio"
                                    name="bucket"
                                    value="defective"
                                    checked={selectedBucket === "defective"}
                                    onChange={() => setSelectedBucket("defective")}
                                    className="h-4 w-4"
                                />
                                <div>
                                    <div className="font-semibold">Stock Defectuoso</div>
                                    <div className="text-sm text-muted-foreground">
                                        El producto necesita revisión/reparación
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeBucketDialog}>
                            Atrás
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={completeCancelSale}
                            disabled={cancelingProcess}
                        >
                            {cancelingProcess ? "Anulando..." : "Confirmar anulación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 📄 Paginación */}
            {/* 📄 Paginación Shadcn */}
            <Pagination className="mt-10 flex justify-center">
                <PaginationContent>

                    {/* Botón Anterior */}
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (page > 1) setPage((p) => p - 1);
                            }}
                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>

                    {/* Primera página */}
                    {page > 3 && (
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setPage(1);
                                }}
                            >
                                1
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    {/* ... */}
                    {page > 4 && (
                        <PaginationItem>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )}

                    {/* Páginas anteriores */}
                    {page > 1 && (
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setPage(page - 1);
                                }}
                            >
                                {page - 1}
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    {/* Página actual */}
                    <PaginationItem>
                        <PaginationLink
                            href="#"
                            isActive
                        >
                            {page}
                        </PaginationLink>
                    </PaginationItem>

                    {/* Página siguiente */}
                    {page < totalPages && (
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setPage(page + 1);
                                }}
                            >
                                {page + 1}
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    {/* ... */}
                    {page < totalPages - 3 && (
                        <PaginationItem>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )}

                    {/* Última página */}
                    {page < totalPages - 2 && (
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setPage(totalPages);
                                }}
                            >
                                {totalPages}
                            </PaginationLink>
                        </PaginationItem>
                    )}

                    {/* Botón Siguiente */}
                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (page < totalPages) setPage((p) => p + 1);
                            }}
                            className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>

                </PaginationContent>
            </Pagination>

        </div>
    );
}
