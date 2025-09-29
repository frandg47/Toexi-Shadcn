import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2Icon, PlusIcon, PencilIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartSalesByUser } from "./ChartSalesByUser";
import ConcentricLoader from "../components/ui/loading";

export default function ProductsTable() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // --- Modal States ---
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    brand_id: "",
    category_id: "",
    usd_price: "",
    commission_pct: "",
    commission_fixed: "",
    allow_backorder: false,
    lead_time_label: "",
    active: true,
  });

  // ---- Fetch data ----
  const fetchData = async () => {
    setLoading(true);

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        usd_price,
        commission_pct,
        commission_fixed,
        allow_backorder,
        lead_time_label,
        active,
        created_at,
        cover_image_url,

        brands:brand_id ( id, name ),
        categories:category_id ( id, name ),
        inventory:inventory ( stock, updated_at )
      `
      )
      .order("id");

    const { data: brandsData } = await supabase.from("brands").select("*");
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*");

    if (productsError) toast.error("Error al cargar productos");
    else setProducts(productsData || []);

    setBrands(brandsData || []);
    setCategories(categoriesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CRUD ---
  const handleDeleteProduct = async (id) => {
    setUpdatingId(id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    setUpdatingId(null);

    if (error) toast.error("Error al eliminar");
    else {
      setProducts(products.filter((p) => p.id !== id));
      setSelectedProducts(selectedProducts.filter((x) => x !== id));
      toast.success("Producto eliminado");
    }
  };

  const handleCreateProduct = async () => {
    const { data, error } = await supabase
      .from("products")
      .insert([formData])
      .select();

    if (error) toast.error("Error al crear producto");
    else {
      toast.success("Producto creado");
      setProducts([...products, data[0]]);
      setOpenCreate(false);
      resetForm();
    }
  };

  const handleUpdateProduct = async () => {
    if (!editProduct) return;
    const { data, error } = await supabase
      .from("products")
      .update(formData)
      .eq("id", editProduct.id)
      .select();

    if (error) toast.error("Error al actualizar");
    else {
      toast.success("Producto actualizado");
      setProducts(products.map((p) => (p.id === editProduct.id ? data[0] : p)));
      setOpenEdit(false);
      resetForm();
    }
  };

  // --- Helpers ---
  const toggleProduct = (id) =>
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const resetForm = () =>
    setFormData({
      name: "",
      brand_id: "",
      category_id: "",
      usd_price: "",
      commission_pct: "",
      commission_fixed: "",
      allow_backorder: false,
      lead_time_label: "",
      active: true,
    });

  const openEditModal = (product) => {
    setEditProduct(product);
    setFormData({
      name: product.name || "",
      brand_id: product.brand_id || "",
      category_id: product.category_id || "",
      usd_price: product.usd_price || "",
      commission_pct: product.commission_pct || "",
      commission_fixed: product.commission_fixed || "",
      allow_backorder: product.allow_backorder,
      lead_time_label: product.lead_time_label || "",
      active: product.active,
    });
    setOpenEdit(true);
  };

  if (loading) return <div><ConcentricLoader /></div>;

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Productos</h2>
        <Button onClick={() => setOpenCreate(true)}>
          <PlusIcon className="mr-2 h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={
                  selectedProducts.length === products.length &&
                  products.length > 0
                }
                onCheckedChange={(value) =>
                  setSelectedProducts(value ? products.map((p) => p.id) : [])
                }
              />
            </TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>USD Precio</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.map((p) => (
            <TableRow
              key={p.id}
              className={selectedProducts.includes(p.id) ? "bg-gray-100" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selectedProducts.includes(p.id)}
                  onCheckedChange={() => toggleProduct(p.id)}
                />
              </TableCell>
              <TableCell>{p.id}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.brands?.name || "—"}</TableCell>
              <TableCell>{p.categories?.name || "—"}</TableCell>
              <TableCell>{p.usd_price}</TableCell>
              <TableCell>
                <Checkbox checked={p.active} disabled />
              </TableCell>
              <TableCell className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditModal(p)}
                >
                  <PencilIcon className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteProduct(p.id)}
                  disabled={updatingId === p.id}
                >
                  {updatingId === p.id ? (
                    <Loader2Icon className="animate-spin h-4 w-4" />
                  ) : (
                    "Eliminar"
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Gráfico de ventas por usuario */}
      <ChartSalesByUser />

      {/* ---- Modal Crear ---- */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Producto</DialogTitle>
          </DialogHeader>
          <ProductForm
            formData={formData}
            setFormData={setFormData}
            brands={brands}
            categories={categories}
          />
          <DialogFooter>
            <Button onClick={handleCreateProduct}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Modal Editar ---- */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <ProductForm
            formData={formData}
            setFormData={setFormData}
            brands={brands}
            categories={categories}
          />
          <DialogFooter>
            <Button onClick={handleUpdateProduct}>Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Subcomponente para el formulario de producto */
function ProductForm({ formData, setFormData, brands, categories }) {
  const handleChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="grid gap-4 py-4">
      <Input
        placeholder="Nombre"
        value={formData.name}
        onChange={(e) => handleChange("name", e.target.value)}
      />
      <Select
        value={formData.brand_id}
        onValueChange={(v) => handleChange("brand_id", v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Marca" />
        </SelectTrigger>
        <SelectContent>
          {brands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={formData.category_id}
        onValueChange={(v) => handleChange("category_id", v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        placeholder="Precio USD"
        value={formData.usd_price}
        onChange={(e) => handleChange("usd_price", e.target.value)}
      />
      <Input
        type="number"
        placeholder="Comisión %"
        value={formData.commission_pct}
        onChange={(e) => handleChange("commission_pct", e.target.value)}
      />
      <Input
        type="number"
        placeholder="Comisión fija"
        value={formData.commission_fixed}
        onChange={(e) => handleChange("commission_fixed", e.target.value)}
      />
      <Input
        placeholder="Lead time"
        value={formData.lead_time_label}
        onChange={(e) => handleChange("lead_time_label", e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.allow_backorder}
          onCheckedChange={(v) => handleChange("allow_backorder", v)}
        />
        <span>Permitir backorder</span>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.active}
          onCheckedChange={(v) => handleChange("active", v)}
        />
        <span>Activo</span>
      </div>
    </div>
  );
}
