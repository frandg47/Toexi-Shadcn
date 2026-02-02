import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const formatCurrency = (value, currency) => {
  const safe = Number(value || 0);
  const formatCurrency = currency === "USD" ? "USD" : "ARS";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency: formatCurrency,
    minimumFractionDigits: 2,
  }).format(safe);
};

export default function MovementsConfig() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    accountId: "all",
    type: "all",
  });

  const loadData = async () => {
    setLoading(true);
    const [{ data: accountsData, error: accountsError }, movementsRes] =
      await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, currency, initial_balance, include_in_balance")
          .order("name", { ascending: true }),
        supabase
          .from("account_movements")
          .select(
            "id, created_at, movement_date, account_id, type, amount, currency, amount_ars, related_table, related_id, notes, accounts(name, currency)"
          )
          .order("movement_date", { ascending: false })
          .limit(200),
      ]);

    if (accountsError) {
      setLoading(false);
      toast.error("No se pudieron cargar las cuentas", {
        description: accountsError.message,
      });
      return;
    }
    if (movementsRes.error) {
      setLoading(false);
      toast.error("No se pudieron cargar los movimientos", {
        description: movementsRes.error.message,
      });
      return;
    }

    setAccounts(accountsData || []);
    setMovements(movementsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const movementsFiltered = useMemo(() => {
    return movements.filter((m) => {
      if (filters.accountId !== "all" && String(m.account_id) !== filters.accountId) {
        return false;
      }
      if (filters.type !== "all" && m.type !== filters.type) {
        return false;
      }
      if (filters.dateFrom && new Date(m.movement_date) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && new Date(m.movement_date) > new Date(filters.dateTo)) {
        return false;
      }
      return true;
    });
  }, [movements, filters]);

  const accountBalances = useMemo(() => {
    const totals = new Map();
    movements.forEach((m) => {
      const entry = totals.get(m.account_id) || { income: 0, expense: 0 };
      if (m.type === "income") entry.income += Number(m.amount || 0);
      if (m.type === "expense") entry.expense += Number(m.amount || 0);
      totals.set(m.account_id, entry);
    });

    return accounts.map((acc) => {
      const totalsForAccount = totals.get(acc.id) || { income: 0, expense: 0 };
      const current = Number(acc.initial_balance || 0)
        + totalsForAccount.income
        - totalsForAccount.expense;
      return {
        ...acc,
        income: totalsForAccount.income,
        expense: totalsForAccount.expense,
        current_balance: current,
      };
    });
  }, [accounts, movements]);

  const totalBalances = useMemo(() => {
    return accountBalances.reduce(
      (acc, item) => {
        if (!item.include_in_balance) return acc;
        if (item.currency === "USD") acc.usd += item.current_balance;
        else acc.ars += item.current_balance;
        return acc;
      },
      { ars: 0, usd: 0 }
    );
  }, [accountBalances]);

  return (
    <div className=" mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance total ARS</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(totalBalances.ars, "ARS")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance total USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(totalBalances.usd, "USD")}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance por cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Saldo inicial</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Egresos</TableHead>
                  <TableHead>Balance actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountBalances.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell>{acc.currency}</TableCell>
                    <TableCell>{formatCurrency(acc.initial_balance, acc.currency)}</TableCell>
                    <TableCell>{formatCurrency(acc.income, acc.currency)}</TableCell>
                    <TableCell>{formatCurrency(acc.expense, acc.currency)}</TableCell>
                    <TableCell>{formatCurrency(acc.current_balance, acc.currency)}</TableCell>
                  </TableRow>
                ))}
                {accountBalances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay cuentas disponibles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Movimientos</CardTitle>
          <Button onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
            />
            <Select
              value={filters.accountId}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, accountId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters((f) => ({ ...f, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="expense">Egresos</SelectItem>
                <SelectItem value="transfer">Transferencias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsFiltered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.movement_date}</TableCell>
                    <TableCell>
                      {m.accounts?.name || `Cuenta ${m.account_id}`}
                    </TableCell>
                    <TableCell>
                      {m.type === "income"
                        ? "Ingreso"
                        : m.type === "expense"
                          ? "Egreso"
                          : "Transferencia"}
                    </TableCell>
                    <TableCell>{formatCurrency(m.amount, m.currency)}</TableCell>
                    <TableCell>
                      {m.related_table ? `${m.related_table} #${m.related_id}` : "-"}
                    </TableCell>
                    <TableCell>{m.notes || "-"}</TableCell>
                  </TableRow>
                ))}
                {movementsFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay movimientos para mostrar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
