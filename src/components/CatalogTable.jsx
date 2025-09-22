import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CategoriesAndBrandsCRUDWithSelection() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);

  // loading states por operación
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [bulkDeletingCategories, setBulkDeletingCategories] = useState(false);
  const [bulkDeletingBrands, setBulkDeletingBrands] = useState(false);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("*");
    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("*");

    if (!categoriesError) setCategories(categoriesData);
    else toast.error("Error al cargar categorías");
    if (!brandsError) setBrands(brandsData);
    else toast.error("Error al cargar marcas");

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CRUD HANDLERS ---
  const handleAddCategory = async () => {
    if (!newCategory) return;
    setAddingCategory(true);
    const { data, error } = await supabase
      .from("categories")
      .insert([{ name: newCategory }])
      .select();
    setAddingCategory(false);
    if (!error) {
      setCategories([...categories, data[0]]);
      setNewCategory("");
      toast.success("Categoría agregada");
    } else toast.error("Error al agregar categoría");
  };

  const handleEditCategory = async (id, name) => {
    setEditingCategoryId(id);
    const { data, error } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id)
      .select();
    setEditingCategoryId(null);
    if (!error) {
      setCategories(categories.map((c) => (c.id === id ? data[0] : c)));
      toast.success("Categoría actualizada");
    } else toast.error("Error al editar categoría");
  };

  const handleDeleteCategory = async (id) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setDeletingIds((prev) => {
      const copy = new Set(prev);
      copy.delete(id);
      return copy;
    });
    if (!error) {
      setCategories(categories.filter((c) => c.id !== id));
      setSelectedCategories(selectedCategories.filter((x) => x !== id));
      toast.success("Categoría eliminada");
    } else toast.error("Error al eliminar categoría");
  };

  const handleDeleteSelectedCategories = async () => {
    if (selectedCategories.length === 0) return;
    setBulkDeletingCategories(true);
    const { error } = await supabase
      .from("categories")
      .delete()
      .in("id", selectedCategories);
    setBulkDeletingCategories(false);
    if (!error) {
      setCategories(
        categories.filter((c) => !selectedCategories.includes(c.id))
      );
      setSelectedCategories([]);
      toast.success("Categorías eliminadas");
    } else toast.error("Error al eliminar categorías seleccionadas");
  };

  const handleAddBrand = async () => {
    if (!newBrand) return;
    setAddingBrand(true);
    const { data, error } = await supabase
      .from("brands")
      .insert([{ name: newBrand }])
      .select();
    setAddingBrand(false);
    if (!error) {
      setBrands([...brands, data[0]]);
      setNewBrand("");
      toast.success("Marca agregada");
    } else toast.error("Error al agregar marca");
  };

  const handleEditBrand = async (id, name) => {
    setEditingBrandId(id);
    const { data, error } = await supabase
      .from("brands")
      .update({ name })
      .eq("id", id)
      .select();
    setEditingBrandId(null);
    if (!error) {
      setBrands(brands.map((b) => (b.id === id ? data[0] : b)));
      toast.success("Marca actualizada");
    } else toast.error("Error al editar marca");
  };

  const handleDeleteBrand = async (id) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    const { error } = await supabase.from("brands").delete().eq("id", id);
    setDeletingIds((prev) => {
      const copy = new Set(prev);
      copy.delete(id);
      return copy;
    });
    if (!error) {
      setBrands(brands.filter((b) => b.id !== id));
      setSelectedBrands(selectedBrands.filter((x) => x !== id));
      toast.success("Marca eliminada");
    } else toast.error("Error al eliminar marca");
  };

  const handleDeleteSelectedBrands = async () => {
    if (selectedBrands.length === 0) return;
    setBulkDeletingBrands(true);
    const { error } = await supabase
      .from("brands")
      .delete()
      .in("id", selectedBrands);
    setBulkDeletingBrands(false);
    if (!error) {
      setBrands(brands.filter((b) => !selectedBrands.includes(b.id)));
      setSelectedBrands([]);
      toast.success("Marcas eliminadas");
    } else toast.error("Error al eliminar marcas seleccionadas");
  };

  // --- CHECKBOX HANDLERS ---
  const toggleCategory = (id) =>
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleBrand = (id) =>
    setSelectedBrands((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-10">
      {/* --- TABLA CATEGORÍAS --- */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Categorías</h2>
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Nueva categoría"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1"
          />
          <Button className="bg-neutral-900 hover:bg-neutral-800 text-white" onClick={handleAddCategory} disabled={addingCategory}>
            {addingCategory && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            Agregar Categoría
          </Button>
          {selectedCategories.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedCategories}
              disabled={bulkDeletingCategories}
            >
              {bulkDeletingCategories && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar Seleccionadas ({selectedCategories.length})
            </Button>
          )}
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
            {categories.map((cat) => (
              <TableRow
                key={cat.id}
                className={selectedCategories.includes(cat.id) ? "bg-gray-100" : ""}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                </TableCell>
                <TableCell>{cat.id}</TableCell>
                <TableCell>
                  <Input
                    value={cat.name}
                    onChange={(e) =>
                      setCategories(
                        categories.map((c) =>
                          c.id === cat.id ? { ...c, name: e.target.value } : c
                        )
                      )
                    }
                  />
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleEditCategory(cat.id, cat.name)}
                    disabled={editingCategoryId === cat.id}
                  >
                    {editingCategoryId === cat.id && (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={deletingIds.has(cat.id)}
                  >
                    {deletingIds.has(cat.id) && (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- TABLA MARCAS --- */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Marcas</h2>
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Nueva marca"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            className="flex-1"
          />
          <Button className="bg-neutral-900 hover:bg-neutral-800 text-white" onClick={handleAddBrand} disabled={addingBrand}>
            {addingBrand && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            Agregar Marca
          </Button>
          {selectedBrands.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedBrands}
              disabled={bulkDeletingBrands}
            >
              {bulkDeletingBrands && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar Seleccionadas ({selectedBrands.length})
            </Button>
          )}
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
            {brands.map((brand) => (
              <TableRow
                key={brand.id}
                className={selectedBrands.includes(brand.id) ? "bg-gray-100" : ""}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand.id)}
                    onChange={() => toggleBrand(brand.id)}
                  />
                </TableCell>
                <TableCell>{brand.id}</TableCell>
                <TableCell>
                  <Input
                    value={brand.name}
                    onChange={(e) =>
                      setBrands(
                        brands.map((b) =>
                          b.id === brand.id ? { ...b, name: e.target.value } : b
                        )
                      )
                    }
                  />
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleEditBrand(brand.id, brand.name)}
                    disabled={editingBrandId === brand.id}
                  >
                    {editingBrandId === brand.id && (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteBrand(brand.id)}
                    disabled={deletingIds.has(brand.id)}
                  >
                    {deletingIds.has(brand.id) && (
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
