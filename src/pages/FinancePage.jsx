import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { IconCalendar, IconRefresh } from "@tabler/icons-react";

const formatCurrency = (value, currency) => {
  const safe = Number(value || 0);
  if (currency === "USDT") {
    return `USDT ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe)}`;
  }
  const resolvedCurrency = currency === "USD" ? "USD" : "ARS";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency: resolvedCurrency,
    minimumFractionDigits: 2,
  }).format(safe);
};

const getCurrencyBadgeClass = (currency) => {
  if (currency === "USD") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (currency === "USDT") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
};

export default function FinancePage() {
  const { role } = useAuth();
  const isOwner = role?.toLowerCase() === "owner";
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [balanceMovementsAll, setBalanceMovementsAll] = useState([]);
  const [balanceMovementsFiltered, setBalanceMovementsFiltered] = useState([]);
  const [fxRate, setFxRate] = useState(null);
  const [usdtRate, setUsdtRate] = useState(null);
  const [stockCostUsd, setStockCostUsd] = useState(0);
  const [filters, setFilters] = useState({
    accountId: "all",
    type: "all",
  });
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const loadStaticData = useCallback(async () => {
    setLoading(true);
    const [
      { data: accountsData, error: accountsError },
      { data: blueRateData, error: blueRateError },
      { data: usdtRateData, error: usdtRateError },
      { data: variantsData, error: variantsError },
      { data: movementsData, error: movementsError },
    ] = await Promise.all([
      supabase
        .from("accounts")
        .select(
          "id, name, currency, initial_balance, include_in_balance, is_reference_capital"
        )
        .order("name", { ascending: true }),
      supabase
        .from("fx_rates")
        .select("rate")
        .eq("source", "blue")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("fx_rates")
        .select("rate")
        .eq("source", "USDT")
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("product_variants").select("stock, cost_price_usd"),
      supabase.from("account_movements").select("account_id, type, amount"),
    ]);

    if (accountsError) {
      toast.error("No se pudieron cargar las cuentas", {
        description: accountsError.message,
      });
    } else {
      setAccounts(accountsData || []);
    }

    if (blueRateError) {
      toast.error("No se pudo cargar la cotizacion USD", {
        description: blueRateError.message,
      });
    } else {
      setFxRate(Number(blueRateData?.rate || 0) || null);
    }

    if (usdtRateError) {
      toast.error("No se pudo cargar la cotizacion USDT", {
        description: usdtRateError.message,
      });
    } else {
      setUsdtRate(Number(usdtRateData?.rate || 0) || null);
    }

    if (variantsError) {
      toast.error("No se pudo cargar el costo del stock", {
        description: variantsError.message,
      });
    } else {
      setStockCostUsd(
        (variantsData || []).reduce((total, variant) => {
          const stock = Number(variant.stock || 0);
          const cost = Number(variant.cost_price_usd || 0);
          return total + stock * cost;
        }, 0)
      );
    }

    if (movementsError) {
      toast.error("No se pudo cargar el balance general", {
        description: movementsError.message,
      });
    } else {
      setBalanceMovementsAll(movementsData || []);
    }

    setLoading(false);
  }, []);

  const loadFilteredBalances = useCallback(async () => {
    let query = supabase
      .from("account_movements")
      .select("account_id, type, amount");

    if (filters.accountId !== "all") {
      query = query.eq("account_id", filters.accountId);
    }
    if (filters.type !== "all") {
      query = query.eq("type", filters.type);
    }
    if (dateRange?.from) {
      query = query.gte(
        "movement_date",
        dateRange.from.toISOString().slice(0, 10)
      );
    }
    if (dateRange?.to) {
      query = query.lte(
        "movement_date",
        dateRange.to.toISOString().slice(0, 10)
      );
    }

    const { data, error } = await query;

    if (error) {
      toast.error("No se pudo cargar el balance filtrado", {
        description: error.message,
      });
      return;
    }

    setBalanceMovementsFiltered(data || []);
  }, [filters, dateRange]);

  useEffect(() => {
    loadStaticData();
  }, [loadStaticData]);

  useEffect(() => {
    loadFilteredBalances();
  }, [loadFilteredBalances]);

  const handleWeekFilter = () => {
    setDateRange({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });
  };

  const buildAccountBalances = useCallback((movementsSource) => {
    const totals = new Map();

    movementsSource.forEach((movement) => {
      const entry = totals.get(movement.account_id) || { income: 0, expense: 0 };
      if (movement.type === "income") entry.income += Number(movement.amount || 0);
      if (movement.type === "expense") entry.expense += Number(movement.amount || 0);
      totals.set(movement.account_id, entry);
    });

    return accounts.map((account) => {
      const totalsForAccount = totals.get(account.id) || { income: 0, expense: 0 };
      const currentBalance =
        Number(account.initial_balance || 0) +
        totalsForAccount.income -
        totalsForAccount.expense;

      return {
        ...account,
        income: totalsForAccount.income,
        expense: totalsForAccount.expense,
        current_balance: currentBalance,
      };
    });
  }, [accounts]);

  const accountBalancesAll = useMemo(
    () => buildAccountBalances(balanceMovementsAll),
    [buildAccountBalances, balanceMovementsAll]
  );

  const accountBalancesFiltered = useMemo(
    () => buildAccountBalances(balanceMovementsFiltered),
    [buildAccountBalances, balanceMovementsFiltered]
  );

  const totalBalances = useMemo(() => {
    return accountBalancesAll.reduce(
      (acc, item) => {
        if (!item.include_in_balance) return acc;
        if (item.currency === "USD") acc.usd += item.current_balance;
        else if (item.currency === "USDT") acc.usdt += item.current_balance;
        else acc.ars += item.current_balance;
        return acc;
      },
      { ars: 0, usd: 0, usdt: 0 }
    );
  }, [accountBalancesAll]);

  const convertAmountToUsd = useCallback(
    (amount, currency) => {
      const safeAmount = Number(amount || 0);
      if (!safeAmount) return 0;
      if (currency === "USD") return safeAmount;
      if (currency === "USDT") {
        if (usdtRate && fxRate) return (safeAmount * usdtRate) / fxRate;
        return safeAmount;
      }
      if (currency === "ARS") {
        if (!fxRate) return 0;
        return safeAmount / fxRate;
      }
      return 0;
    },
    [fxRate, usdtRate]
  );

  const businessMetrics = useMemo(() => {
    const operatingCashUsd = accountBalancesAll.reduce((total, account) => {
      if (!account.include_in_balance) return total;
      return total + convertAmountToUsd(account.current_balance, account.currency);
    }, 0);

    const referenceCapitalUsd = accountBalancesAll.reduce((total, account) => {
      if (!account.is_reference_capital) return total;
      return total + convertAmountToUsd(account.current_balance, account.currency);
    }, 0);

    return {
      operatingCashUsd,
      referenceCapitalUsd,
      stockCostUsd,
      realResultUsd: operatingCashUsd + stockCostUsd - referenceCapitalUsd,
    };
  }, [accountBalancesAll, convertAmountToUsd, stockCostUsd]);

  if (!isOwner) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-500">
          <CardHeader>
            <CardTitle className="text-white">Balance total ARS</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(totalBalances.ars, "ARS")}
          </CardContent>
        </Card>
        <Card className="bg-green-700">
          <CardHeader>
            <CardTitle className="text-white">Balance total USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(totalBalances.usd, "USD")}
          </CardContent>
        </Card>
        <Card className="bg-purple-700">
          <CardHeader>
            <CardTitle className="text-white">Balance total USDT</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(totalBalances.usdt, "USDT")}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Caja operativa USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(businessMetrics.operatingCashUsd, "USD")}
          </CardContent>
        </Card>
        <Card className="bg-amber-600">
          <CardHeader>
            <CardTitle className="text-white">Capital referencia USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(businessMetrics.referenceCapitalUsd, "USD")}
          </CardContent>
        </Card>
        <Card className="bg-cyan-700">
          <CardHeader>
            <CardTitle className="text-white">Stock al costo USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(businessMetrics.stockCostUsd, "USD")}
          </CardContent>
        </Card>
        <Card
          className={
            businessMetrics.realResultUsd >= 0 ? "bg-emerald-700" : "bg-rose-700"
          }
        >
          <CardHeader>
            <CardTitle className="text-white">Resultado real USD</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">
            {formatCurrency(businessMetrics.realResultUsd, "USD")}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Balance por cuenta</CardTitle>
          <Button onClick={loadStaticData} disabled={loading}>
            <IconRefresh className="h-4 w-4" />
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Fecha</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 min-w-[220px]"
                    >
                      <IconCalendar className="h-4 w-4" />
                      {dateRange?.from && dateRange?.to
                        ? `${dateRange.from.toLocaleDateString("es-AR")} - ${dateRange.to.toLocaleDateString("es-AR")}`
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
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Semana</span>
                <Button variant="outline" onClick={handleWeekFilter}>
                  Semana actual
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 md:justify-end">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Cuenta</span>
                <Select
                  value={filters.accountId}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, accountId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name} ({account.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Tipo</span>
                <Select
                  value={filters.type}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, type: value }))
                  }
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
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="bg-sky-50/70 text-sky-800">Saldo inicial</TableHead>
                  <TableHead className="bg-emerald-50/70 text-emerald-800">Ingresos</TableHead>
                  <TableHead className="bg-rose-50/70 text-rose-800">Egresos</TableHead>
                  <TableHead>Balance actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountBalancesFiltered.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getCurrencyBadgeClass(account.currency)}
                      >
                        {account.currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="bg-sky-50/50 font-medium text-sky-900">
                      {formatCurrency(account.initial_balance, account.currency)}
                    </TableCell>
                    <TableCell className="bg-emerald-50/50 font-medium text-emerald-900">
                      {formatCurrency(account.income, account.currency)}
                    </TableCell>
                    <TableCell className="bg-rose-50/50 font-medium text-rose-900">
                      {formatCurrency(account.expense, account.currency)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(account.current_balance, account.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                {accountBalancesFiltered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No hay cuentas disponibles.
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
