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
import { Loader2Icon } from "lucide-react";
import { ChartSalesByUser } from "./ChartSalesByUser";

export default function ProductsTable() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  // Fetch products, brands, categories
  const fetchData = async () => {
    setLoading(true);
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        brand_id,
        category_id,
        usd_price,
        commission_pct,
        commission_fixed,
        allow_backorder,
        lead_time_label,
        active,
        cover_image_url,
        brands(name),
        categories(name)
      `);
    const { data: brandsData } = await supabase.from("brands").select("*");
    const { data: categoriesData } = await supabase.from("categories").select("*");

    if (productsError) toast.error("Error fetching products");
    else setProducts(productsData);

    setBrands(brandsData);
    setCategories(categoriesData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CRUD HANDLERS ---
  const handleDeleteProduct = async (id) => {
    setUpdatingId(id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    setUpdatingId(null);

    if (!error) {
      setProducts(products.filter((p) => p.id !== id));
      setSelectedProducts(selectedProducts.filter((x) => x !== id));
      toast.success("Producto eliminado");
    } else toast.error("Error al eliminar producto");
  };

  const handleEditProduct = async (id, field, value) => {
    setUpdatingId(id);
    const { data, error } = await supabase
      .from("products")
      .update({ [field]: value })
      .eq("id", id)
      .select();
    setUpdatingId(null);

    if (!error) {
      setProducts(products.map((p) => (p.id === id ? data[0] : p)));
      toast.success("Producto actualizado");
    } else toast.error("Error al actualizar producto");
  };

  // --- SELECTION HANDLERS ---
  const toggleProduct = (id) =>
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox
                checked={
                  selectedProducts.length === products.length
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
            <TableHead>Comisión %</TableHead>
            <TableHead>Comisión fija</TableHead>
            <TableHead>Backorder</TableHead>
            <TableHead>Lead time</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id} className={selectedProducts.includes(p.id) ? "bg-gray-100" : ""}>
              <TableCell>
                <Checkbox
                  checked={selectedProducts.includes(p.id)}
                  onCheckedChange={() => toggleProduct(p.id)}
                />
              </TableCell>
              <TableCell>{p.id}</TableCell>
              <TableCell>
                <Input
                  value={p.name ?? ""}
                  onChange={(e) =>
                    setProducts(products.map((prod) =>
                      prod.id === p.id ? { ...prod, name: e.target.value } : prod
                    ))
                  }
                  onBlur={(e) => handleEditProduct(p.id, "name", e.target.value)}
                />
              </TableCell>
              <TableCell>{p.brands?.name || "—"}</TableCell>
              <TableCell>{p.categories?.name || "—"}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={p.usd_price ?? ""}
                  onChange={(e) =>
                    setProducts(products.map((prod) =>
                      prod.id === p.id ? { ...prod, usd_price: e.target.value } : prod
                    ))
                  }
                  onBlur={(e) => handleEditProduct(p.id, "usd_price", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={p.commission_pct ?? ""}
                  onChange={(e) =>
                    setProducts(products.map((prod) =>
                      prod.id === p.id ? { ...prod, commission_pct: e.target.value } : prod
                    ))
                  }
                  onBlur={(e) => handleEditProduct(p.id, "commission_pct", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={p.commission_fixed ?? ""}
                  onChange={(e) =>
                    setProducts(products.map((prod) =>
                      prod.id === p.id ? { ...prod, commission_fixed: e.target.value } : prod
                    ))
                  }
                  onBlur={(e) => handleEditProduct(p.id, "commission_fixed", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={p.allow_backorder}
                  onCheckedChange={(value) => handleEditProduct(p.id, "allow_backorder", value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={p.lead_time_label ?? ""}
                  onChange={(e) =>
                    setProducts(products.map((prod) =>
                      prod.id === p.id ? { ...prod, lead_time_label: e.target.value } : prod
                    ))
                  }
                  onBlur={(e) => handleEditProduct(p.id, "lead_time_label", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={p.active}
                  onCheckedChange={(value) => handleEditProduct(p.id, "active", value)}
                />
              </TableCell>
              <TableCell className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteProduct(p.id)}
                  disabled={updatingId === p.id}
                >
                  {updatingId === p.id ? <Loader2Icon className="animate-spin" /> : "Eliminar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ChartSalesByUser />
    </div>
  );
}
