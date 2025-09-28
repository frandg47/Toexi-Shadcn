"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { Loader2Icon } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DialogCatalog from "../components/DialogCatalog";
import { IconBallpen, IconPlus, IconTrash } from "@tabler/icons-react";

export default function CatalogTable() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);

  // Modales
  const [categoryModal, setCategoryModal] = useState({ open: false, editId: null, initial: "" });
  const [brandModal, setBrandModal] = useState({ open: false, editId: null, initial: "" });

  // Operaciones
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState({ cat: false, brand: false });

  // Filtros / columnas
  const [nameFilter, setNameFilter] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(["ID", "Nombre", "Acciones"]);

  const toggleColumn = (col) =>
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: cat }, { data: br }] = await Promise.all([
        supabase.from("categories").select("*"),
        supabase.from("brands").select("*"),
      ]);
      if (cat) setCategories(cat); else toast.error("Error al cargar categorías");
      if (br) setBrands(br); else toast.error("Error al cargar marcas");
      setLoading(false);
    };
    fetchData();
  }, []);

  /* ---------- CRUD ---------- */
  const saveCategory = async (name, id = null) => {
    if (!name) return;
    if (id) {
      const { data, error } = await supabase.from("categories").update({ name }).eq("id", id).select();
      if (error) return toast.error("Error al editar categoría");
      setCategories(categories.map((c) => (c.id === id ? data[0] : c)));
      toast.success("Categoría actualizada");
    } else {
      const { data, error } = await supabase.from("categories").insert([{ name }]).select();
      if (error) return toast.error("Error al agregar categoría");
      setCategories([...categories, data[0]]);
      toast.success("Categoría agregada");
    }
  };

  const saveBrand = async (name, id = null) => {
    if (!name) return;
    if (id) {
      const { data, error } = await supabase.from("brands").update({ name }).eq("id", id).select();
      if (error) return toast.error("Error al editar marca");
      setBrands(brands.map((b) => (b.id === id ? data[0] : b)));
      toast.success("Marca actualizada");
    } else {
      const { data, error } = await supabase.from("brands").insert([{ name }]).select();
      if (error) return toast.error("Error al agregar marca");
      setBrands([...brands, data[0]]);
      toast.success("Marca agregada");
    }
  };

  const deleteCategory = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setDeletingIds((p) => { const copy = new Set(p); copy.delete(id); return copy; });
    if (error) return toast.error("Error al eliminar categoría");
    setCategories(categories.filter((c) => c.id !== id));
    setSelectedCategories((sel) => sel.filter((x) => x !== id));
    toast.success("Categoría eliminada");
  };

  const deleteBrand = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    const { error } = await supabase.from("brands").delete().eq("id", id);
    setDeletingIds((p) => { const copy = new Set(p); copy.delete(id); return copy; });
    if (error) return toast.error("Error al eliminar marca");
    setBrands(brands.filter((b) => b.id !== id));
    setSelectedBrands((sel) => sel.filter((x) => x !== id));
    toast.success("Marca eliminada");
  };

  const deleteSelected = async (type) => {
    const selected = type === "cat" ? selectedCategories : selectedBrands;
    if (!selected.length) return;
    setBulkDeleting((p) => ({ ...p, [type]: true }));
    const { error } = await supabase
      .from(type === "cat" ? "categories" : "brands")
      .delete().in("id", selected);
    setBulkDeleting((p) => ({ ...p, [type]: false }));
    if (error) return toast.error("Error al eliminar seleccionados");
    if (type === "cat") {
      setCategories(categories.filter((c) => !selected.includes(c.id)));
      setSelectedCategories([]);
    } else {
      setBrands(brands.filter((b) => !selected.includes(b.id)));
      setSelectedBrands([]);
    }
    toast.success("Eliminados correctamente");
  };

  const toggle = (id, type) => {
    if (type === "cat") {
      setSelectedCategories((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelectedBrands((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  const filterByName = (items) =>
    items.filter((i) => i.name.toLowerCase().includes(nameFilter.toLowerCase()));

  return (
    <div className="container my-10 space-y-10 p-4 border rounded-lg bg-background shadow-sm">
      <HeaderBar
        title="Categorías"
        onAdd={() => setCategoryModal({ open: true, editId: null, initial: "" })}
        selected={selectedCategories}
        onDeleteSelected={() => deleteSelected("cat")}
        bulkDeleting={bulkDeleting.cat}
        setNameFilter={setNameFilter}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
      />
      <Section
        items={filterByName(categories)}
        selected={selectedCategories}
        toggle={(id) => toggle(id, "cat")}
        onEdit={(item) => setCategoryModal({ open: true, editId: item.id, initial: item.name })}
        onDelete={deleteCategory}
        deletingIds={deletingIds}
        visibleColumns={visibleColumns}
      />

      <HeaderBar
        title="Marcas"
        onAdd={() => setBrandModal({ open: true, editId: null, initial: "" })}
        selected={selectedBrands}
        onDeleteSelected={() => deleteSelected("brand")}
        bulkDeleting={bulkDeleting.brand}
        setNameFilter={setNameFilter}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
      />
      <Section
        items={filterByName(brands)}
        selected={selectedBrands}
        toggle={(id) => toggle(id, "brand")}
        onEdit={(item) => setBrandModal({ open: true, editId: item.id, initial: item.name })}
        onDelete={deleteBrand}
        deletingIds={deletingIds}
        visibleColumns={visibleColumns}
      />

      {/* Modales */}
      <DialogCatalog
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false, editId: null, initial: "" })}
        onConfirm={(val) => { saveCategory(val, categoryModal.editId); setCategoryModal({ open: false, editId: null, initial: "" }); }}
        label={categoryModal.editId ? "Editar Categoría" : "Categoría"}
        initialValue={categoryModal.initial}
      />
      <DialogCatalog
        open={brandModal.open}
        onClose={() => setBrandModal({ open: false, editId: null, initial: "" })}
        onConfirm={(val) => { saveBrand(val, brandModal.editId); setBrandModal({ open: false, editId: null, initial: "" }); }}
        label={brandModal.editId ? "Editar Marca" : "Marca"}
        initialValue={brandModal.initial}
      />
    </div>
  );
}

/* ---------- Barra superior con filtros / toggles ---------- */
function HeaderBar({ title, onAdd, selected, onDeleteSelected, bulkDeleting,
  setNameFilter, visibleColumns, toggleColumn }) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Buscar por nombre..."
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-48"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">Columnas</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            {["ID", "Nombre", "Acciones"].map((col) => (
              <DropdownMenuCheckboxItem
                key={col}
                checked={visibleColumns.includes(col)}
                onCheckedChange={() => toggleColumn(col)}
              >
                {col}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onAdd} size="sm" className="bg-gray-400 hover:bg-gray-500">
          <IconPlus className="mr-1 h-4 w-4" />Agregar
        </Button>
        {selected.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={bulkDeleting}
          >
            {bulkDeleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            <IconTrash className="mr-1 h-4 w-4" />Eliminar ({selected.length})
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Sección con tabla ---------- */
function Section({ items, selected, toggle, onEdit, onDelete, deletingIds, visibleColumns }) {
  return (
    <Table className="w-full border rounded-md">
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          {visibleColumns.includes("ID") && <TableHead className="w-[80px]">ID</TableHead>}
          {visibleColumns.includes("Nombre") && <TableHead>Nombre</TableHead>}
          {visibleColumns.includes("Acciones") && <TableHead>Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length ? items.map((item) => (
          <TableRow key={item.id} className={selected.includes(item.id) ? "bg-gray-100" : ""}>
            <TableCell>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
            </TableCell>
            {visibleColumns.includes("ID") && <TableCell>{item.id}</TableCell>}
            {visibleColumns.includes("Nombre") && (
              <TableCell className="font-medium">{item.name}</TableCell>
            )}
            {visibleColumns.includes("Acciones") && (
              <TableCell className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-300 hover:bg-green-400"
                  onClick={() => onEdit(item)}
                >
                  <IconBallpen className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(item.id)}
                  disabled={deletingIds.has(item.id)}
                  className="bg-red-400 hover:bg-red-500"
                >
                  {deletingIds.has(item.id) && (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <IconTrash className="h-4 w-4" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        )) : (
          <TableRow>
            <TableCell colSpan={visibleColumns.length + 1} className="text-center py-6">
              <Badge variant="secondary">No hay resultados</Badge>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
