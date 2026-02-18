import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const formatUSD = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n || 0);

export default function AccountsConfig() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    initial_balance: "",
    currency: "ARS",
  });
  const [form, setForm] = useState({
    name: "",
    initial_balance: "",
    currency: "ARS",
    notes: "",
    include_in_balance: true,
  });

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, currency, initial_balance, notes, include_in_balance")
      .order("name", { ascending: true });

    if (error) {
      toast.error("No se pudieron cargar las cuentas", {
        description: error.message,
      });
      return;
    }

    setAccounts(data || []);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const startEdit = (account) => {
    setEditId(account.id);
    setEditForm({
      name: account.name || "",
      initial_balance: String(account.initial_balance ?? ""),
      currency: account.currency || "ARS",
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({
      name: "",
      initial_balance: "",
      currency: "ARS",
    });
  };

  const handleUpdateAccount = async () => {
    const name = editForm.name.trim();
    const initialBalance = Number(editForm.initial_balance || 0);

    if (!name) return toast.error("Ingresa un nombre de cuenta");
    if (Number.isNaN(initialBalance))
      return toast.error("Monto inicial invalido");

    setLoading(true);
    const { error } = await supabase
      .from("accounts")
      .update({
        name,
        initial_balance: initialBalance,
        currency: editForm.currency,
      })
      .eq("id", editId);

    if (error) {
      setLoading(false);
      toast.error("No se pudo actualizar la cuenta", {
        description: error.message,
      });
      return;
    }

    toast.success("Cuenta actualizada");
    await loadAccounts();
    setLoading(false);
    cancelEdit();
  };

  const handleCreateAccount = async () => {
    const name = form.name.trim();
    const initialBalance = Number(form.initial_balance || 0);

    if (!name) return toast.error("Ingresa un nombre de cuenta");
    if (Number.isNaN(initialBalance))
      return toast.error("Monto inicial invalido");

    setLoading(true);
    const { error } = await supabase.from("accounts").insert([
      {
        name,
        initial_balance: initialBalance,
        currency: form.currency,
        notes: form.notes || null,
        include_in_balance: form.include_in_balance,
      },
    ]);

    if (error) {
      setLoading(false);
      toast.error("No se pudo crear la cuenta", { description: error.message });
      return;
    }

    toast.success("Cuenta creada");
    setForm({
      name: "",
      initial_balance: "",
      currency: "ARS",
      notes: "",
      include_in_balance: true,
    });
    await loadAccounts();
    setLoading(false);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Cuentas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Monto inicial"
            value={form.initial_balance}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                initial_balance: e.target.value,
              }))
            }
          />
          <Select
            value={form.currency}
            onValueChange={(value) => setForm((f) => ({ ...f, currency: value }))}
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
              checked={form.include_in_balance}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, include_in_balance: checked }))
              }
            />
            <span className="text-sm">Incluir en balance</span>
          </div>
        </div>
        <Textarea
          placeholder="Notas"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                <TableHead>Incluir</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    {editId === acc.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                      />
                    ) : (
                      acc.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === acc.id ? (
                      <Select
                        value={editForm.currency}
                        onValueChange={(value) =>
                          setEditForm((f) => ({ ...f, currency: value }))
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
                    ) : (
                      acc.currency
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === acc.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.initial_balance}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            initial_balance: e.target.value,
                          }))
                        }
                      />
                    ) : acc.currency === "USD" ? (
                      formatUSD(acc.initial_balance)
                    ) : (
                      formatARS(acc.initial_balance)
                    )}
                  </TableCell>
                  <TableCell>{acc.include_in_balance ? "Si" : "No"}</TableCell>
                  <TableCell className="text-right">
                    {editId === acc.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateAccount}
                          disabled={loading}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={loading}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(acc)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
  );
}
