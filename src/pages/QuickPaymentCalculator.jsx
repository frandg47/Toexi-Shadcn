"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { IconCirclePlus, IconTrash } from "@tabler/icons-react";
import { calculateTotals } from "@/utils/paymentCalculator";
import { supabase } from "@/lib/supabaseClient";

// Utils
const formatARS = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(value || 0));

const QuickPaymentCalculator = () => {
  // ======================
  // Estado base
  // ======================
  const [baseAmountARS, setBaseAmountARS] = useState("");
  const [exchangeRate, setExchangeRate] = useState(null);

  // ======================
  // Métodos / cuotas desde Supabase
  // ======================
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentInstallments, setPaymentInstallments] = useState([]);

  // ======================
  // Pagos elegidos
  // ======================
  const [payments, setPayments] = useState([
    {
      payment_method_id: "",
      method_name: "",
      installments: "",
      amount: "",
    },
  ]);

  // ======================
  // Cargar cotización
  // ======================
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const { data } = await supabase
        .from("fx_rates")
        .select("rate")
        .eq("is_active", true)
        .maybeSingle();

      if (data) setExchangeRate(Number(data.rate));
    };

    fetchExchangeRate();
  }, []);

  // ======================
  // Cargar métodos y cuotas
  // ======================
  useEffect(() => {
    const fetchPayments = async () => {
      const { data: methods } = await supabase
        .from("payment_methods")
        .select("id, name, multiplier");
      const { data: installments } = await supabase
        .from("payment_installments")
        .select("id, payment_method_id, installments, multiplier");

      setPaymentMethods(methods || []);
      setPaymentInstallments(installments || []);
    };

    fetchPayments();
  }, []);

  const getInstallmentsForMethod = (id) =>
    paymentInstallments.filter((i) => i.payment_method_id === Number(id));

  // ======================
  // Monto base ARS (manual)
  // ======================
  const parsedBaseAmountARS = useMemo(
    () => Number(baseAmountARS || 0),
    [baseAmountARS]
  );

  // ======================
  // Totales
  // ======================
  const totals = useMemo(() => {
    return calculateTotals({
      baseAmountARS: parsedBaseAmountARS,
      payments,
      paymentInstallments,
    });
  }, [parsedBaseAmountARS, payments, paymentInstallments]);

  // ======================
  // UI
  // ======================
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-6 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold">Calculadora rápida</h2>

      {/* Monto base */}
      <Input
        type="number"
        placeholder="Monto base (ARS)"
        value={baseAmountARS}
        onChange={(e) => setBaseAmountARS(e.target.value)}
      />

      {exchangeRate && (
        <p className="text-sm text-muted-foreground">
          Cotización de referencia: ${exchangeRate}
        </p>
      )}

      {/* Métodos / cuotas */}
      <div className="space-y-3">
        {payments.map((p, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border p-3 rounded-md bg-muted/40"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={p.payment_method_id || ""}
                onValueChange={(val) => {
                  const chosen = paymentMethods.find((m) => m.id == val);
                  setPayments((prev) =>
                    prev.map((row, idx) =>
                      idx === i
                        ? {
                            ...row,
                            payment_method_id: val,
                            method_name: chosen?.name || "",
                            installments: "",
                          }
                        : row
                    )
                  );
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {getInstallmentsForMethod(p.payment_method_id).length > 0 && (
                <Select
                  value={p.installments || ""}
                  onValueChange={(val) =>
                    setPayments((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, installments: val } : row
                      )
                    )
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Cuotas" />
                  </SelectTrigger>
                  <SelectContent>
                    {getInstallmentsForMethod(p.payment_method_id).map((x) => (
                      <SelectItem key={x.id} value={String(x.installments)}>
                        {x.installments}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {payments.length > 1 && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() =>
                    setPayments((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <Input
                type="number"
                placeholder="Monto a pagar (ARS)"
                value={p.amount}
                className="flex-1"
                onChange={(e) =>
                  setPayments((prev) =>
                    prev.map((row, idx) =>
                      idx === i ? { ...row, amount: e.target.value } : row
                    )
                  )
                }
              />

              {i === payments.length - 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPayments((prev) =>
                      prev.map((row, idx) =>
                        idx === i
                          ? { ...row, amount: String(totals.remainingARS) }
                          : row
                      )
                    )
                  }
                >
                  Restante
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            setPayments((prev) => [
              ...prev,
              {
                payment_method_id: "",
                method_name: "",
                installments: "",
                amount: "",
              },
            ])
          }
        >
          <IconCirclePlus className="h-4 w-4" />
          Agregar pago
        </Button>
      </div>

      {/* Resultados */}
      <div className="space-y-1 text-sm border-t pt-3">
        <div className="flex justify-between">
          <span>Total base:</span>
          <span>{formatARS(totals.baseAmountARS)}</span>
        </div>

        {totals.interestMethod && (
          <>
            <div className="flex justify-between">
              <span>
                Recargo ({totals.interestMethod.installments} cuotas):
              </span>
              <span>
                {formatARS(
                  totals.totalWithSurcharge - totals.baseAmountARS
                )}
              </span>
            </div>
            {/* <div className="flex justify-between font-semibold text-blue-600">
              <span>Total con recargo:</span>
              <span>{formatARS(totals.totalWithSurcharge)}</span>
            </div> */}
          </>
        )}

        <div className="flex justify-between text-green-600">
          <span>Pagado:</span>
          <span>{formatARS(totals.paidARS)}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Restante:</span>
          <span>{formatARS(totals.remainingARS)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg">
          <span>Total:</span>
          <span>{formatARS(totals.totalWithSurcharge)}</span>
        </div>
      </div>
    </div>
  );
};

export default QuickPaymentCalculator;
