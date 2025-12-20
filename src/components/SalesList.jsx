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
import { toast } from "sonner";

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

    // 📌 Filtros unificados
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
            setFilters((f) => ({
                ...f,
                start_date: dateRange.from.toISOString().split("T")[0],
                end_date: dateRange.to
                    ? dateRange.to.toISOString().split("T")[0]
                    : dateRange.from.toISOString().split("T")[0],
            }));
        }
    }, [dateRange]);

    const load = useCallback(async () => {
        try {
            setRefreshing(true);
            const { data, count } = await getAdminSales(page, filters);
            setSales(data || []);
            console.log("Sales loaded:", data);
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

                        <hr className="my-3" />

                        {/* Cliente y vendedor */}
                        <div className="text-sm mb-3">
                            <p>
                                <strong>Cliente:</strong> {s.customer_name}{" "}
                                {s.customer_last_name}
                                <strong>{" | "}Tel:</strong> {" "} {s.customer_phone ?? "-"}
                            </p>
                            <p>
                                <strong>Vendedor:</strong> {s.seller_name}{" "}
                                {s.seller_last_name}
                                <strong>{" | "}Tel:</strong> {" "} {s.seller_phone ?? "3816783617"}
                            </p>
                            {/* <p>
                                <strong>Tel:</strong> {s.customer_phone ?? "-"}
                            </p> */}
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
                        <div className="mt-4 flex justify-end">
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
