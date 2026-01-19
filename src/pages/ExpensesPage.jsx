import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n || 0);

export default function ExpensesPage() {
  const { role } = useAuth();
  const isOwner = role?.toLowerCase() === "owner";

  const [section, setSection] = useState("expenses");
  const [loading, setLoading] = useState(false);
  const [fxRate, setFxRate] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [accountForm, setAccountForm] = useState({
    name: "",
    initial_balance: "",
    currency: "ARS",
    notes: "",
    include_in_balance: true,
  });

  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    amount: "",
    account_id: "",
    category: "",
    type: "variable",
    notes: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: rate }, { data: accs }, fixedRes, variableRes] =
        await Promise.all([
          supabase
            .from("fx_rates")
            .select("rate")
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("accounts")
            .select(
              "id, name, currency, initial_balance, notes, include_in_balance"
            )
            .order("name", { ascending: true }),
          supabase
            .from("expenses")
            .select(
              "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, accounts(name, currency)"
            )
            .eq("type", "fixed")
            .order("expense_date", { ascending: false }),
          supabase
            .from("expenses")
            .select(
              "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, accounts(name, currency)"
            )
            .eq("type", "variable")
            .order("expense_date", { ascending: false })
            .limit(50),
        ]);

      setFxRate(rate?.rate ? Number(rate.rate) : null);
      setAccounts(accs || []);
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

  const handleCreateAccount = async () => {
    const name = accountForm.name.trim();
    const initialBalance = Number(accountForm.initial_balance || 0);

    if (!name) return toast.error("Ingresa un nombre de cuenta");
    if (Number.isNaN(initialBalance))
      return toast.error("Monto inicial invalido");

    const { error } = await supabase.from("accounts").insert([
      {
        name,
        initial_balance: initialBalance,
        currency: accountForm.currency,
        notes: accountForm.notes || null,
        include_in_balance: accountForm.include_in_balance,
      },
    ]);

    if (error) {
      toast.error("No se pudo crear la cuenta", { description: error.message });
      return;
    }

    toast.success("Cuenta creada");
    setAccountForm({
      name: "",
      initial_balance: "",
      currency: "ARS",
      notes: "",
      include_in_balance: true,
    });

    const { data } = await supabase
      .from("accounts")
      .select("id, name, currency, initial_balance, notes, include_in_balance")
      .order("name", { ascending: true });
    setAccounts(data || []);
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
    setExpenseForm((f) => ({ ...f, amount: "", category: "", notes: "" }));
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, amount, currency, amount_ars, category, type, notes, created_at, accounts(name, currency)"
      )
      .order("expense_date", { ascending: false })
      .limit(50);
    setExpenses(data || []);
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
            section === "accounts" ? "border-primary/60" : ""
          }`}
          onClick={() => setSection("accounts")}
        >
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
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
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name} ({acc.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="Categoria"
                  value={expenseForm.category}
                  onChange={(e) =>
                    setExpenseForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
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
              <CardTitle>Gastos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>ARS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>{exp.expense_date}</TableCell>
                        <TableCell>{exp.accounts?.name || "Cuenta"}</TableCell>
                        <TableCell>{exp.category || "-"}</TableCell>
                        <TableCell>{exp.type === "fixed" ? "Fijo" : "Variable"}</TableCell>
                        <TableCell>
                          {exp.currency === "USD"
                            ? `USD ${Number(exp.amount).toFixed(2)}`
                            : formatARS(exp.amount)}
                        </TableCell>
                        <TableCell>{formatARS(exp.amount_ars)}</TableCell>
                      </TableRow>
                    ))}
                    {expenses.length === 0 && (
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

      {section === "accounts" && (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Nombre"
                value={accountForm.name}
                onChange={(e) =>
                  setAccountForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Monto inicial"
                value={accountForm.initial_balance}
                onChange={(e) =>
                  setAccountForm((f) => ({
                    ...f,
                    initial_balance: e.target.value,
                  }))
                }
              />
              <Select
                value={accountForm.currency}
                onValueChange={(value) =>
                  setAccountForm((f) => ({ ...f, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={accountForm.include_in_balance}
                  onCheckedChange={(checked) =>
                    setAccountForm((f) => ({
                      ...f,
                      include_in_balance: checked,
                    }))
                  }
                />
                <span className="text-sm">Incluir en balance</span>
              </div>
            </div>
            <Textarea
              placeholder="Notas"
              value={accountForm.notes}
              onChange={(e) =>
                setAccountForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
            <Button onClick={handleCreateAccount} disabled={loading}>
              Crear cuenta
            </Button>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Saldo inicial</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>{acc.name}</TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell>
                        {acc.currency === "USD"
                          ? `USD ${Number(acc.initial_balance || 0).toFixed(2)}`
                          : formatARS(acc.initial_balance)}
                      </TableCell>
                      <TableCell>
                        {acc.include_in_balance ? "Si" : "No"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {accounts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No hay cuentas creadas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
