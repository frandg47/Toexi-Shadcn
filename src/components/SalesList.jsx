"use client";

import { useEffect, useState } from "react";
import { getAdminSales } from "../utils/getAdminSales";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";

export function SalesList() {
    const [sales, setSales] = useState([]);
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);

    const [filters, setFilters] = useState({
        start_date: "",
        end_date: "",
        seller_id: ""
    });

    const load = async () => {
        const { data, count } = await getAdminSales(page, filters);
        setSales(data || []);
        setCount(count || 0);
    };

    useEffect(() => {
        load();
    }, [page, filters]);

    const totalPages = Math.ceil(count / 10);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold mb-4">Ventas registradas</h1>

            {/* 🔎 Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted p-4 rounded-lg">
                <div>
                    <label className="text-sm font-medium">Desde:</label>
                    <Input type="date" onChange={e => setFilters({ ...filters, start_date: e.target.value })} />
                </div>
                <div>
                    <label className="text-sm font-medium">Hasta:</label>
                    <Input type="date" onChange={e => setFilters({ ...filters, end_date: e.target.value })} />
                </div>
                <div>
                    <label className="text-sm font-medium">Vendedor:</label>
                    <Input placeholder="ID vendedor (luego lo cambiamos por Select)"
                        onChange={e => setFilters({ ...filters, seller_id: e.target.value })} />
                </div>
            </div>

            {/* 🧾 LISTA DE TICKETS */}
            <div className="space-y-6">
                {sales.map((s) => (
                    <Card key={s.sale_id} className="p-5 shadow-md w-full">
                        <div className="flex justify-between">
                            <h2 className="font-bold text-lg">Venta #{s.sale_id}</h2>
                            <span className="text-sm text-muted-foreground">{new Date(s.sale_date).toLocaleString()}</span>
                        </div>

                        <hr className="my-3" />

                        {/* Cliente y vendedor */}
                        <div className="text-sm mb-3">
                            <p><strong>Cliente:</strong> {s.customer_name} {s.customer_last_name}</p>
                            <p><strong>Vendedor:</strong> {s.seller_name} {s.seller_last_name}</p>
                            <p><strong>Tel:</strong> {s.customer_phone ?? "-"}</p>
                        </div>

                        {/* Items */}
                        <div className="text-sm border rounded p-3 bg-muted/40">
                            <strong>Productos:</strong>
                            {s.items?.map((i, idx) => (
                                <div key={idx} className="flex justify-between border-b py-1">
                                    <span>{i.product_name} {i.variant_name} — {i.quantity}u</span>
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
                                        {p.installments > 1 ? ` · ${p.installments} cuotas` : ""}
                                    </span>
                                    <span>${Number(p.amount_ars).toLocaleString("es-AR")}</span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <p className="font-bold text-right text-xl mt-3 text-primary">
                            Total: ${Number(s.total_ars).toLocaleString("es-AR")}
                        </p>
                    </Card>
                ))}
            </div>

            {/* 📄 Paginación */}
            <div className="flex justify-center gap-3 mt-8">
                <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm">Página {page} de {totalPages}</span>
                <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>

        </div>
    );
}
