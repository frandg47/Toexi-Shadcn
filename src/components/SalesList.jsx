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

import { IconCalendar, IconRefresh } from "@tabler/icons-react";

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

    return (
        <div className="pb-6 space-y-6">

            {/* 🔎 FILTROS EXACTO AL ESTILO FxRatesConfig */}
            <div className="flex flex-wrap items-center justify-between gap-4">

                {/* Rango de fechas */}
                <div className="flex gap-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="flex items-center gap-2">
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

                    {/* Semana */}
                    <Button
                        variant="outline"
                        onClick={() => setDateRange(getDefaultWeekRange())}
                    >
                        Semana actual
                    </Button>
                </div>

                {/* Acciones */}
                <div className="flex gap-3">
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
                {sales.map((s) => (
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
                            </p>
                            <p>
                                <strong>Vendedor:</strong> {s.seller_name}{" "}
                                {s.seller_last_name}
                            </p>
                            <p>
                                <strong>Tel:</strong> {s.customer_phone ?? "-"}
                            </p>
                        </div>

                        {/* Items */}
                        <div className="text-sm border rounded p-3 bg-muted/40">
                            <strong>Productos:</strong>
                            {s.items?.map((i, idx) => (
                                <div key={idx} className="flex justify-between border-b py-1">
                                    <span>
                                        {i.product_name} {i.variant_name} — {i.quantity}u
                                    </span>
                                    <span>${i.subtotal_ars.toLocaleString("es-AR")}</span>
                                </div>
                            ))}
                        </div>

                        {/* Pagos */}
                        <div className="text-sm border rounded p-3 mt-3 bg-muted/40">
                            <strong>Métodos de pago:</strong>
                            {s.payments?.map((p, idx) => (
                                <div key={idx} className="flex justify-between border-b py-1">
                                    <span>
                                        {p.method}
                                        {p.card_brand ? ` (${p.card_brand})` : ""}
                                        {p.installments > 1
                                            ? ` · ${p.installments} cuotas`
                                            : ""}
                                    </span>
                                    <span>${Number(p.amount_ars).toLocaleString("es-AR")}</span>
                                </div>
                            ))}
                        </div>

                        <p className="font-bold text-right text-xl mt-3 text-primary">
                            Total: ${Number(s.total_ars).toLocaleString("es-AR")}
                        </p>
                    </Card>
                ))}
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
