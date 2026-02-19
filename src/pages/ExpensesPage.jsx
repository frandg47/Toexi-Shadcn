import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { IconEdit, IconPlus, IconCalendar } from "@tabler/icons-react";

const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n || 0);

const addInterval = (dateValue, amount, unit) => {
  if (!dateValue || !amount) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const value = Number(amount);
  if (!value) return null;

  if (unit === "weeks") {
    date.setDate(date.getDate() + value * 7);
    return date;
  }
  if (unit === "months") {
    date.setMonth(date.getMonth() + value);
    return date;
  }
  date.setDate(date.getDate() + value);
  return date;
};

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
};

const getDueDate = (expense) => {
  if (expense?.type !== "fixed") return null;
  if (!expense?.frequency_value || !expense?.frequency_unit) {
    return new Date(expense?.expense_date);
  }
  if (!expense?.last_paid_at) {
    return new Date(expense?.expense_date);
  }
  return addInterval(
    expense.last_paid_at,
    expense.frequency_value,
    expense.frequency_unit
  );
};

export default function ExpensesPage() {
  const { role } = useAuth();
  const isOwner = role?.toLowerCase() === "owner";

  const [section, setSection] = useState("expenses");
  const [loading, setLoading] = useState(false);
  const [fxRate, setFxRate] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: "all",
    account: "all",
    status: "all",
  });
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editForm, setEditForm] = useState({
    expense_date: "",
    amount: "",
    account_id: "",
    category: "",
    notes: "",
    frequency_value: "",
    frequency_unit: "months",
    last_paid_at: null,
  });

  const [incomeForm, setIncomeForm] = useState({
    movement_date: new Date().toISOString().slice(0, 10),
    amount: "",
    account_id: "",
    category: "",
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    amount: "",
    account_id: "",
    category: "",
    type: "variable",
    frequency_value: 1,
    frequency_unit: "months",
    notes: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "expense",
    is_active: true,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        { data: rate },
        { data: accs },
        fixedRes,
        variableRes,
        categoriesRes,
      ] = await Promise.all([
        supabase
          .from("fx_rates")
          .select("rate")
          .eq("is_active", true)
          .eq("source", "blue")
          .maybeSingle(),
        supabase
          .from("accounts")
          .select("id, name, currency, initial_balance, notes, include_in_balance")
          .order("name", { ascending: true }),
          supabase
            .from("expenses")
            .select(
              "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, last_paid_at, frequency_value, frequency_unit, account_id, accounts(name, currency)"
            )
            .eq("type", "fixed")
            .order("expense_date", { ascending: false }),
          supabase
            .from("expenses")
            .select(
              "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, last_paid_at, frequency_value, frequency_unit, account_id, accounts(name, currency)"
            )
            .eq("type", "variable")
            .order("expense_date", { ascending: false })
            .limit(50),
        supabase
          .from("finance_categories")
          .select("id, name, type, is_active, created_at")
          .order("name", { ascending: true }),
      ]);

      setFxRate(rate?.rate ? Number(rate.rate) : null);
      setAccounts(accs || []);
      setCategories(categoriesRes?.data || []);
      const fixedExpenses = fixedRes?.data || [];
      const variableExpenses = variableRes?.data || [];
      const combined = [...fixedExpenses, ...variableExpenses];
      combined.sort((a, b) => {
        if (a.type !== b.type) return a.type === "fixed" ? -1 : 1;
        return new Date(b.expense_date) - new Date(a.expense_date);
      });
      setExpenses(combined);
      setLoading(false);
    };

    load();
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((a) => String(a.id) === String(expenseForm.account_id)),
    [accounts, expenseForm.account_id]
  );
  const selectedIncomeAccount = useMemo(
    () => accounts.find((a) => String(a.id) === String(incomeForm.account_id)),
    [accounts, incomeForm.account_id]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense" && c.is_active),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income" && c.is_active),
    [categories]
  );

  const fixedExpenses = useMemo(
    () => expenses.filter((exp) => exp.type === "fixed"),
    [expenses]
  );

  const variableExpenses = useMemo(
    () => expenses.filter((exp) => exp.type === "variable"),
    [expenses]
  );

  const applyFilters = useCallback(
    (list, includeStatus) => {
      return list.filter((exp) => {
        if (dateRange?.from) {
          if (new Date(exp.expense_date) < dateRange.from) return false;
        }
        if (dateRange?.to) {
          if (new Date(exp.expense_date) > dateRange.to) return false;
        }
        if (filters.category !== "all" && exp.category !== filters.category) {
          return false;
        }
        if (
          filters.account !== "all" &&
          String(exp.account_id) !== String(filters.account)
        ) {
          return false;
        }
        if (includeStatus && filters.status !== "all") {
          const dueDate = getDueDate(exp);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPaidCurrent =
            exp.last_paid_at && dueDate && new Date(dueDate) > today;
          const isOverdue = dueDate && new Date(dueDate) <= today;
          if (filters.status === "paid" && !isPaidCurrent) return false;
          if (filters.status === "overdue" && !isOverdue) return false;
        }
        return true;
      });
    },
    [dateRange, filters]
  );

  const filteredFixedExpenses = useMemo(
    () => applyFilters(fixedExpenses, true),
    [applyFilters, fixedExpenses]
  );

  const filteredVariableExpenses = useMemo(
    () => applyFilters(variableExpenses, false),
    [applyFilters, variableExpenses]
  );

  const handleWeekFilter = () => {
    setDateRange({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });
  };

  const handleCreateExpense = async () => {
    if (!expenseForm.expense_date) return toast.error("Selecciona una fecha");
    if (!selectedAccount) return toast.error("Selecciona una cuenta");

    const amount = Number(expenseForm.amount || 0);
    if (!amount || Number.isNaN(amount)) return toast.error("Monto invalido");

    const currency = selectedAccount.currency || "ARS";
    if (currency === "USD" && !fxRate) {
      return toast.error("No hay cotizacion activa para USD");
    }
    const amountARS = currency === "USD" ? amount * fxRate : amount;

    const { error } = await supabase.from("expenses").insert([
      {
        expense_date: expenseForm.expense_date,
        amount,
        currency,
        amount_ars: amountARS,
        account_id: selectedAccount.id,
        category: expenseForm.category || null,
        type: expenseForm.type,
        notes: expenseForm.notes || null,
        frequency_value:
          expenseForm.type === "fixed"
            ? Number(expenseForm.frequency_value || 1)
            : null,
        frequency_unit:
          expenseForm.type === "fixed" ? expenseForm.frequency_unit : null,
        fx_rate_used: currency === "USD" ? fxRate : null,
      },
    ]);

    if (error) {
      toast.error("No se pudo registrar el gasto", {
        description: error.message,
      });
      return;
    }

    toast.success("Gasto registrado");
    setExpenseForm((f) => ({
      ...f,
      amount: "",
      category: "",
      notes: "",
      frequency_value: 1,
      frequency_unit: "months",
    }));
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, last_paid_at, frequency_value, frequency_unit, account_id, accounts(name, currency)"
      )
      .order("expense_date", { ascending: false })
      .limit(50);
    setExpenses(data || []);
  };

  const handleCreateIncome = async () => {
    if (!incomeForm.movement_date) return toast.error("Selecciona una fecha");
    if (!selectedIncomeAccount) return toast.error("Selecciona una cuenta");

    const amount = Number(incomeForm.amount || 0);
    if (!amount || Number.isNaN(amount)) return toast.error("Monto invalido");

    const currency = selectedIncomeAccount.currency || "ARS";
    if (currency === "USD" && !fxRate) {
      return toast.error("No hay cotizacion activa para USD");
    }

    const amountARS = currency === "USD" ? amount * fxRate : amount;
    const notes = [
      incomeForm.category ? `Categoria: ${incomeForm.category}` : "",
      incomeForm.notes,
    ]
      .filter(Boolean)
      .join(" | ");

    const { error } = await supabase.from("account_movements").insert([
      {
        movement_date: incomeForm.movement_date,
        account_id: selectedIncomeAccount.id,
        type: "income",
        amount,
        currency,
        amount_ars: amountARS,
        fx_rate_used: currency === "USD" ? fxRate : null,
        related_table: "manual_income",
        notes: notes || null,
      },
    ]);

    if (error) {
      toast.error("No se pudo registrar el ingreso", {
        description: error.message,
      });
      return;
    }

    toast.success("Ingreso registrado");
    setIncomeForm((f) => ({
      ...f,
      amount: "",
      category: "",
      notes: "",
    }));
  };

  const handleOpenEdit = (expense) => {
    if (!expense) return;
    setEditingExpense(expense);
    setEditForm({
      expense_date: expense.expense_date || "",
      amount: expense.amount ?? "",
      account_id: String(expense.account_id || ""),
      category: expense.category || "",
      notes: expense.notes || "",
      frequency_value: expense.frequency_value ?? 1,
      frequency_unit: expense.frequency_unit || "months",
      last_paid_at: expense.last_paid_at || null,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    if (!editForm.expense_date) return toast.error("Selecciona una fecha");

    const amount = Number(editForm.amount || 0);
    if (!amount || Number.isNaN(amount)) return toast.error("Monto invalido");

    const selectedEditAccount = accounts.find(
      (acc) => String(acc.id) === String(editForm.account_id)
    );
    if (!selectedEditAccount) {
      return toast.error("Selecciona una cuenta");
    }

    const currency = selectedEditAccount.currency || "ARS";
    if (currency === "USD" && !fxRate) {
      return toast.error("No hay cotizacion activa para USD");
    }
    const amountARS = currency === "USD" ? amount * fxRate : amount;

    const payload = {
      expense_date: editForm.expense_date,
      amount,
      currency,
      amount_ars: amountARS,
      account_id: selectedEditAccount.id,
      category: editForm.category || null,
      notes: editForm.notes || null,
      frequency_value:
        editingExpense.type === "fixed"
          ? Number(editForm.frequency_value || 1)
          : null,
      frequency_unit:
        editingExpense.type === "fixed" ? editForm.frequency_unit : null,
      last_paid_at: editForm.last_paid_at,
    };

    const { error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", editingExpense.id);

    if (error) {
      toast.error("No se pudo actualizar el gasto", {
        description: error.message,
      });
      return;
    }

    toast.success("Gasto actualizado");
    setEditDialogOpen(false);
    setEditingExpense(null);
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, last_paid_at, frequency_value, frequency_unit, account_id, accounts(name, currency)"
      )
      .order("expense_date", { ascending: false })
      .limit(50);
    setExpenses(data || []);
  };

  const handleMarkPaid = async (expenseId) => {
    if (!expenseId) return;
    const { error } = await supabase
      .from("expenses")
      .update({ last_paid_at: new Date().toISOString() })
      .eq("id", expenseId);

    if (error) {
      toast.error("No se pudo marcar como pagado", {
        description: error.message,
      });
      return;
    }

    toast.success("Gasto marcado como pagado");
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, last_paid_at, frequency_value, frequency_unit, account_id, accounts(name, currency)"
      )
      .order("expense_date", { ascending: false })
      .limit(50);
    setExpenses(data || []);
  };

  const handleCreateCategory = async () => {
    const name = categoryForm.name.trim();
    if (!name) return toast.error("Ingresa un nombre de categoria");

    const { error } = await supabase.from("finance_categories").insert([
      {
        name,
        type: categoryForm.type,
        is_active: categoryForm.is_active,
      },
    ]);

    if (error) {
      toast.error("No se pudo crear la categoria", {
        description: error.message,
      });
      return;
    }

    toast.success("Categoria creada");
    setCategoryForm({ name: "", type: "expense", is_active: true });
    setCategoryDialogOpen(false);
    const { data } = await supabase
      .from("finance_categories")
      .select("id, name, type, is_active, created_at")
      .order("name", { ascending: true });
    setCategories(data || []);
  };

  if (!isOwner) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="space-y-6 py-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            section === "expenses" ? "border-primary/60" : ""
          }`}
          onClick={() => setSection("expenses")}
        >
          <CardHeader>
            <CardTitle>Gastos</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            section === "income" ? "border-primary/60" : ""
          }`}
          onClick={() => setSection("income")}
        >
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {section === "expenses" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Registrar gasto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) =>
                    setExpenseForm((f) => ({
                      ...f,
                      expense_date: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <Select
                  value={expenseForm.account_id}
                  onValueChange={(value) =>
                    setExpenseForm((f) => ({ ...f, account_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cuenta" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={expenseForm.category}
                    onValueChange={(value) =>
                      setExpenseForm((f) => ({ ...f, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCategoryDialogOpen(true)}
                    aria-label="Agregar categoria"
                  >
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={expenseForm.type === "fixed"}
                    onCheckedChange={(checked) =>
                      setExpenseForm((f) => ({
                        ...f,
                        type: checked ? "fixed" : "variable",
                      }))
                    }
                  />
                  <span className="text-sm">Es fijo</span>
                </div>
                <Input
                  placeholder="Moneda"
                  value={selectedAccount?.currency || "--"}
                  readOnly
                />
              </div>
              {expenseForm.type === "fixed" && (
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Cada cuanto"
                    value={expenseForm.frequency_value}
                    onChange={(e) =>
                      setExpenseForm((f) => ({
                        ...f,
                        frequency_value: e.target.value,
                      }))
                    }
                  />
                  <Select
                    value={expenseForm.frequency_unit}
                    onValueChange={(value) =>
                      setExpenseForm((f) => ({
                        ...f,
                        frequency_unit: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="days">Dias</SelectItem>
                      <SelectItem value="weeks">Semanas</SelectItem>
                      <SelectItem value="months">Meses</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Proximo vencimiento"
                    value={formatDateOnly(
                      addInterval(
                        expenseForm.expense_date,
                        expenseForm.frequency_value || 1,
                        expenseForm.frequency_unit
                      ) || expenseForm.expense_date
                    )}
                    readOnly
                  />
                </div>
              )}

              <Textarea
                placeholder="Notas"
                value={expenseForm.notes}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
              <Button onClick={handleCreateExpense} disabled={loading}>
                Guardar gasto
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Semana</span>
                  <Button variant="outline" onClick={handleWeekFilter}>
                    Semana actual
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 md:justify-end">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    Categoria
                  </span>
                  <Select
                    value={filters.category}
                    onValueChange={(value) =>
                      setFilters((f) => ({ ...f, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="all">Todas</SelectItem>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Cuenta</span>
                  <Select
                    value={filters.account}
                    onValueChange={(value) =>
                      setFilters((f) => ({ ...f, account: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cuenta" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="all">Todas</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters((f) => ({ ...f, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="overdue">En deuda</SelectItem>
                      <SelectItem value="paid">Pagados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Gastos fijos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>ARS</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFixedExpenses.map((exp) => {
                      const dueDate = getDueDate(exp);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPaidCurrent =
                        exp.last_paid_at && dueDate && new Date(dueDate) > today;
                      const isOverdue = dueDate && new Date(dueDate) <= today;

                      return (
                        <TableRow
                          key={exp.id}
                          className={isOverdue ? "bg-red-50" : ""}
                        >
                          <TableCell>{exp.expense_date}</TableCell>
                          <TableCell>{exp.accounts?.name || "Cuenta"}</TableCell>
                          <TableCell>{exp.category || "-"}</TableCell>
                          <TableCell>
                            {exp.frequency_value
                              ? `${exp.frequency_value} ${
                                  exp.frequency_unit === "weeks"
                                    ? "semanas"
                                    : exp.frequency_unit === "months"
                                    ? "meses"
                                    : "dias"
                                }`
                              : "-"}
                          </TableCell>
                          <TableCell>{formatDateOnly(getDueDate(exp))}</TableCell>
                          <TableCell>
                            {exp.currency === "USD"
                              ? `USD ${Number(exp.amount).toFixed(2)}`
                              : formatARS(exp.amount)}
                          </TableCell>
                          <TableCell>{formatARS(exp.amount_ars)}</TableCell>
                          <TableCell className="text-right">
                            {isPaidCurrent
                              ? "Pagado"
                              : isOverdue
                              ? "En deuda"
                              : "Pendiente"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(exp)}
                              >
                                <IconEdit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkPaid(exp.id)}
                                disabled={isPaidCurrent}
                              >
                                Marcar pagado
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredFixedExpenses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-muted-foreground"
                        >
                          No hay gastos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Gastos variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>ARS</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVariableExpenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>{exp.expense_date}</TableCell>
                        <TableCell>{exp.accounts?.name || "Cuenta"}</TableCell>
                        <TableCell>{exp.category || "-"}</TableCell>
                        <TableCell>
                          {exp.currency === "USD"
                            ? `USD ${Number(exp.amount).toFixed(2)}`
                            : formatARS(exp.amount)}
                        </TableCell>
                        <TableCell>{formatARS(exp.amount_ars)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(exp)}
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredVariableExpenses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No hay gastos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {section === "income" && (
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                type="date"
                value={incomeForm.movement_date}
                onChange={(e) =>
                  setIncomeForm((f) => ({
                    ...f,
                    movement_date: e.target.value,
                  }))
                }
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Monto"
                value={incomeForm.amount}
                onChange={(e) =>
                  setIncomeForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
              <Select
                value={incomeForm.account_id}
                onValueChange={(value) =>
                  setIncomeForm((f) => ({ ...f, account_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name} ({acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <Select
                  value={incomeForm.category}
                  onValueChange={(value) =>
                    setIncomeForm((f) => ({ ...f, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {incomeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCategoryDialogOpen(true)}
                  aria-label="Agregar categoria"
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Moneda"
                value={selectedIncomeAccount?.currency || "--"}
                readOnly
              />
            </div>
            <Textarea
              placeholder="Notas"
              value={incomeForm.notes}
              onChange={(e) =>
                setIncomeForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
            <Button onClick={handleCreateIncome} disabled={loading}>
              Guardar ingreso
            </Button>
          </CardContent>
        </Card>
      )}

      {/* <Card>
        <CardHeader>
          <CardTitle>Categorias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Activa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>{cat.type === "income" ? "Ingreso" : "Gasto"}</TableCell>
                    <TableCell>{cat.is_active ? "Si" : "No"}</TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No hay categorias creadas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card> */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="date"
              value={editForm.expense_date}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, expense_date: e.target.value }))
              }
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Monto"
              value={editForm.amount}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
            <Select
              value={editForm.account_id}
              onValueChange={(value) =>
                setEditForm((f) => ({ ...f, account_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={editForm.category}
              onValueChange={(value) =>
                setEditForm((f) => ({ ...f, category: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingExpense?.type === "fixed" && (
              <>
                <Input
                  type="number"
                  min="1"
                  placeholder="Cada cuanto"
                  value={editForm.frequency_value}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      frequency_value: e.target.value,
                    }))
                  }
                />
                <Select
                  value={editForm.frequency_unit}
                  onValueChange={(value) =>
                    setEditForm((f) => ({
                      ...f,
                      frequency_unit: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="days">Dias</SelectItem>
                    <SelectItem value="weeks">Semanas</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <Textarea
            placeholder="Notas"
            value={editForm.notes}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
          <DialogFooter>
            {editingExpense?.last_paid_at && (
              <Button
                variant="outline"
                onClick={() =>
                  setEditForm((f) => ({ ...f, last_paid_at: null }))
                }
              >
                Anular pago
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateExpense}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Nueva categoria</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nombre"
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <Select
              value={categoryForm.type}
              onValueChange={(value) =>
                setCategoryForm((f) => ({ ...f, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="income">Ingreso</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(checked) =>
                  setCategoryForm((f) => ({ ...f, is_active: checked }))
                }
              />
              <span className="text-sm">Activa</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateCategory} disabled={loading}>
              Crear categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
