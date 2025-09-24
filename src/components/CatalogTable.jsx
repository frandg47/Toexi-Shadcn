import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon, Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DialogCatalog from "../components/DialogCatalog";
import { IconBallpen, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

export default function CatalogTable() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);

  // Estados para modales
  const [categoryModal, setCategoryModal] = useState({
    open: false,
    editId: null,
    initial: "",
  });
  const [brandModal, setBrandModal] = useState({
    open: false,
    editId: null,
    initial: "",
  });

  // Estados de operaciones
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState({
    cat: false,
    brand: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: cat }, { data: br }] = await Promise.all([
        supabase.from("categories").select("*"),
        supabase.from("brands").select("*"),
      ]);
      if (cat) setCategories(cat);
      else toast.error("Error al cargar categorías");
      if (br) setBrands(br);
      else toast.error("Error al cargar marcas");
      setLoading(false);
    };
    fetchData();
  }, []);

  /* ---------- CRUD ---------- */
  const saveCategory = async (name, id = null) => {
    if (!name) return;
    if (id) {
      // Editar
      const { data, error } = await supabase
        .from("categories")
        .update({ name })
        .eq("id", id)
        .select();
      if (error) return toast.error("Error al editar categoría");
      setCategories(categories.map((c) => (c.id === id ? data[0] : c)));
      toast.success("Categoría actualizada");
    } else {
      // Crear
      const { data, error } = await supabase
        .from("categories")
        .insert([{ name }])
        .select();
      if (error) return toast.error("Error al agregar categoría");
      setCategories([...categories, data[0]]);
      toast.success("Categoría agregada");
    }
  };

  const saveBrand = async (name, id = null) => {
    if (!name) return;
    if (id) {
      const { data, error } = await supabase
        .from("brands")
        .update({ name })
        .eq("id", id)
        .select();
      if (error) return toast.error("Error al editar marca");
      setBrands(brands.map((b) => (b.id === id ? data[0] : b)));
      toast.success("Marca actualizada");
    } else {
      const { data, error } = await supabase
        .from("brands")
        .insert([{ name }])
        .select();
      if (error) return toast.error("Error al agregar marca");
      setBrands([...brands, data[0]]);
      toast.success("Marca agregada");
    }
  };

  const deleteCategory = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setDeletingIds((p) => {
      const copy = new Set(p);
      copy.delete(id);
      return copy;
    });
    if (error) return toast.error("Error al eliminar categoría");
    setCategories(categories.filter((c) => c.id !== id));
    setSelectedCategories((sel) => sel.filter((x) => x !== id));
    toast.success("Categoría eliminada");
  };

  const deleteBrand = async (id) => {
    setDeletingIds((p) => new Set(p).add(id));
    const { error } = await supabase.from("brands").delete().eq("id", id);
    setDeletingIds((p) => {
      const copy = new Set(p);
      copy.delete(id);
      return copy;
    });
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
      .delete()
      .in("id", selected);
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

  /* ---------- Helpers ---------- */
  const toggle = (id, type) => {
    if (type === "cat") {
      setSelectedCategories((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedBrands((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="space-y-10">
      {/* ===== CATEGORÍAS ===== */}
      <Section
        title="Categorías"
        items={categories}
        selected={selectedCategories}
        toggle={(id) => toggle(id, "cat")}
        onAdd={() =>
          setCategoryModal({ open: true, editId: null, initial: "" })
        }
        onEdit={(item) =>
          setCategoryModal({ open: true, editId: item.id, initial: item.name })
        }
        onDelete={deleteCategory}
        onDeleteSelected={() => deleteSelected("cat")}
        deletingIds={deletingIds}
        bulkDeleting={bulkDeleting.cat}
      />

      {/* ===== MARCAS ===== */}
      <Section
        title="Marcas"
        items={brands}
        selected={selectedBrands}
        toggle={(id) => toggle(id, "brand")}
        onAdd={() => setBrandModal({ open: true, editId: null, initial: "" })}
        onEdit={(item) =>
          setBrandModal({ open: true, editId: item.id, initial: item.name })
        }
        onDelete={deleteBrand}
        onDeleteSelected={() => deleteSelected("brand")}
        deletingIds={deletingIds}
        bulkDeleting={bulkDeleting.brand}
      />

      {/* === DIALOGS === */}
      <DialogCatalog
        open={categoryModal.open}
        onClose={() =>
          setCategoryModal({ open: false, editId: null, initial: "" })
        }
        onConfirm={(val) => {
          saveCategory(val, categoryModal.editId);
          setCategoryModal({ open: false, editId: null, initial: "" });
        }}
        label={categoryModal.editId ? "Editar Categoría" : "Categoría"}
        initialValue={categoryModal.initial}
      />

      <DialogCatalog
        open={brandModal.open}
        onClose={() =>
          setBrandModal({ open: false, editId: null, initial: "" })
        }
        onConfirm={(val) => {
          saveBrand(val, brandModal.editId);
          setBrandModal({ open: false, editId: null, initial: "" });
        }}
        label={brandModal.editId ? "Editar Marca" : "Marca"}
        initialValue={brandModal.initial}
      />
    </div>
  );
}

/* ---------- Sección reutilizable ---------- */
function Section({
  title,
  items,
  selected,
  toggle,
  onAdd,
  onEdit,
  onDelete,
  onDeleteSelected,
  deletingIds,
  bulkDeleting,
}) {
  return (
    <div>
      <div className="flex justify-between items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <div className="flex gap-2">
          <Button onClick={onAdd} className="bg-gray-300 hover:bg-gray-400">
            Agregar<IconPlus />
          </Button>
          {selected.length > 0 && (
            <Button
              variant="destructive"
              onClick={onDeleteSelected}
              disabled={bulkDeleting}
              className="bg-red-400 hover:bg-red-500"
            >
              {bulkDeleting && (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              )}
              <IconTrash />Eliminar ({selected.length})
            </Button>
          )}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={selected.includes(item.id) ? "bg-gray-100" : ""}
            >
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
              </TableCell>
              <TableCell>{item.id}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell className="flex gap-2">
                <Button size="sm" className="bg-green-300 hover:bg-green-400" onClick={() => onEdit(item)}>
                  <IconBallpen />
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
                  <IconTrash />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
