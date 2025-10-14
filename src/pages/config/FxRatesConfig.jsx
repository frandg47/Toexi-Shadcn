import React, { useEffect, useState, useCallback } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar"; // 🗓️ Importamos el calendario
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { supabase } from "@/lib/supabaseClient";
import {
  IconSettingsDollar,
  IconRefresh,
  IconPlus,
  IconUser,
  IconMessage,
  IconEdit,
  IconCalendar,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContextProvider";
import Swal from "sweetalert2";
import { Switch } from "@/components/ui/switch";

const FxRatesConfig = () => {
  const { user } = useAuth();
  const currentUser =
    user?.user_metadata?.full_name || user?.email || "Usuario desconocido";

  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [selectedSource, setSelectedSource] = useState("");

  const [newRate, setNewRate] = useState({
    source: "",
    rate: "",
    is_active: true,
    notes: "",
  });

  // --- Fecha por defecto: semana actual ---
  const getDefaultWeekRange = () => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: start, to: end };
  };

  const [dateRange, setDateRange] = useState(getDefaultWeekRange());

  const fetchFxRates = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRates(data || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las cotizaciones", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFxRates();
  }, [fetchFxRates]);

  const formatDate = (dateString) =>
    dateString
      ? new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(dateString))
      : "-";

  const handleCreateRate = async () => {
    try {
      if (!newRate.source.trim() || !newRate.rate.trim()) {
        Swal.fire("Campos requeridos", "Completa todos los campos", "warning");
        return;
      }

      const rateValue = parseFloat(newRate.rate);
      if (isNaN(rateValue) || rateValue <= 0) {
        Swal.fire("Valor inválido", "Debe ser un número positivo", "error");
        return;
      }

      // 🚫 Chequeo previo para evitar duplicados activos
      const activeExists = rates.some(
        (r) => r.source === newRate.source && r.is_active
      );

      if (activeExists && newRate.is_active) {
        const result = await Swal.fire({
          title: "Ya existe una cotización activa",
          text: "¿Deseas reemplazarla por la nueva?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sí, reemplazar",
          cancelButtonText: "Cancelar",
        });
        if (!result.isConfirmed) return;
      }

      // Desactivar otras activas (de esa fuente)
      await supabase
        .from("fx_rates")
        .update({ is_active: false })
        .eq("is_active", true);

      // Insertar nueva cotización
      const { error } = await supabase.from("fx_rates").insert([
        {
          source: newRate.source,
          rate: rateValue,
          is_active: newRate.is_active,
          notes: newRate.notes || null,
          created_by: currentUser,
        },
      ]);

      if (error) throw error;

      Swal.fire("Éxito", "Cotización agregada correctamente", "success");
      setIsDialogOpen(false);
      setNewRate({ source: "", rate: "", is_active: true, notes: "" });
      fetchFxRates();
    } catch (error) {
      Swal.fire("Error", "No se pudo agregar la cotización", "error");
    }
  };

  const handleAddNewFromEdit = async () => {
    try {
      if (!editingRate?.source.trim() || !editingRate?.rate) {
        Swal.fire("Campos requeridos", "Completa todos los campos", "warning");
        return;
      }

      const rateValue = parseFloat(editingRate.rate);
      if (isNaN(rateValue) || rateValue <= 0) {
        Swal.fire("Valor inválido", "Debe ser un número positivo", "error");
        return;
      }

      await supabase
        .from("fx_rates")
        .update({ is_active: false })
        .eq("is_active", true);

      const { error } = await supabase.from("fx_rates").insert([
        {
          source: editingRate.source,
          rate: rateValue,
          is_active: true,
          notes: editingRate.notes || null,
          created_by: currentUser,
        },
      ]);

      if (error) throw error;

      Swal.fire(
        "Actualizado",
        "Se creó una nueva cotización activa",
        "success"
      );
      setIsEditDialogOpen(false);
      setEditingRate(null);
      fetchFxRates();
    } catch {
      Swal.fire("Error", "No se pudo crear la nueva cotización", "error");
    }
  };

  // --- Agrupar por fuente (oficial, blue, etc.)
  const sources = [...new Set(rates.map((r) => r.source))];

  const filterByDate = (rate) => {
    const date = new Date(rate.created_at);
    if (!dateRange.from || !dateRange.to) return true;
    return date >= dateRange.from && date <= dateRange.to;
  };

  return (
    <>
      <SiteHeader titulo="Configuración de Cotizaciones" />

      <div className="mt-6 space-y-6">
        {/* Filtros globales */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  {dateRange?.from
                    ? `${dateRange.from.toLocaleDateString("es-AR")} → ${
                        dateRange.to
                          ? dateRange.to.toLocaleDateString("es-AR")
                          : "..."
                      }`
                    : "Seleccionar rango"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  className="rounded-lg border shadow-sm"
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              onClick={() => setDateRange(getDefaultWeekRange())}
            >
              Semana actual
            </Button>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchFxRates}
              disabled={refreshing}
            >
              <IconRefresh
                className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refrescar
            </Button>

            <Button
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <IconPlus className="h-4 w-4" />Nueva
            </Button>
          </div>
        </div>

        {/* Cards por cada tipo de fuente */}
        {sources.map((source) => {
          const currentRate =
            rates.find((r) => r.source === source && r.is_active) ||
            rates.find((r) => r.source === source);

          // Activa siempre primero
          const sourceRates = rates
            .filter((r) => r.source === source)
            .sort((a, b) => (a.is_active ? -1 : 1))
            .filter(filterByDate);

          return (
            <Card
              key={source}
              className="border border-green-200 shadow-sm relative"
            >
              {/* Badge de Activa */}

              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <IconSettingsDollar className="text-green-600" />
                  Cotización {source.toUpperCase()}
                  {currentRate?.is_active && (
                    <Badge className="bg-green-500 text-white shadow-md">
                      Activa
                    </Badge>
                  )}
                </CardTitle>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setEditingRate({ ...currentRate, notes: "" });
                    setIsEditDialogOpen(true);
                    setSelectedSource(source);
                  }}
                  title="Actualizar cotización"
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : currentRate ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-3xl font-bold text-green-700">
                          ${Number(currentRate.rate).toLocaleString("es-AR")}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Última actualización:{" "}
                          {formatDate(currentRate.created_at)}
                        </p>
                        {currentRate.notes && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <IconMessage size={14} />
                            {currentRate.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <Badge variant="outline">{currentRate.source}</Badge>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <IconUser size={12} />
                          {currentRate.created_by || "Desconocido"}
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-muted/30">
                      {sourceRates.map((r) => (
                        <div key={r.id} className="py-2">
                          <div>
                            <p className="font-medium">
                              ${Number(r.rate).toLocaleString("es-AR")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(r.created_at)}
                            </p>
                            {r.notes && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <IconMessage size={12} /> {r.notes}
                              </p>
                            )}
                            {r.created_by && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <IconUser size={12} /> {r.created_by}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No hay cotizaciones registradas.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal nueva cotización */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva cotización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Fuente</Label>
              <Input
                placeholder="Ej: oficial, blue, mep..."
                value={newRate.source}
                onChange={(e) =>
                  setNewRate({ ...newRate, source: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Valor en ARS</Label>
              <Input
                type="number"
                placeholder="Ej: 1045.50"
                value={newRate.rate}
                onChange={(e) =>
                  setNewRate({ ...newRate, rate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Comentario (opcional)</Label>
              <Textarea
                placeholder="Ej: ajuste semanal, carga manual..."
                value={newRate.notes}
                onChange={(e) =>
                  setNewRate({ ...newRate, notes: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={newRate.is_active}
                onCheckedChange={(checked) =>
                  setNewRate({ ...newRate, is_active: checked })
                }
              />
              <Label>Establecer como activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateRate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar cotización */}
      {/* Modal editar cotización */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar cotización ({selectedSource})</DialogTitle>
          </DialogHeader>

          {editingRate && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Valor en ARS</Label>
                <Input
                  type="number"
                  value={editingRate.rate}
                  onChange={(e) =>
                    setEditingRate({ ...editingRate, rate: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Comentario</Label>
                <Textarea
                  value={editingRate.notes || ""}
                  onChange={(e) =>
                    setEditingRate({ ...editingRate, notes: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between mt-4 border-t pt-3">
                <Label htmlFor="set-active" className="text-sm">
                  Establecer como nueva activa
                </Label>
                <Switch
                  id="set-active"
                  checked={editingRate.is_active}
                  onCheckedChange={(checked) =>
                    setEditingRate({ ...editingRate, is_active: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleAddNewFromEdit}>Guardar como nueva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FxRatesConfig;
