import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddCategory from "./AddCategory";
import AddBrand from "./AddBrand";

export default function CatalogTable() {
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Traer categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*");

      // Traer marcas
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("*");

      if (categoriesError)
        console.error("Error fetching categories:", categoriesError);
      else setCategories(categoriesData);

      if (brandsError) console.error("Error fetching brands:", brandsError);
      else setBrands(brandsData);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Tabla de categorías */}
      <div>
        <AddCategory
          onCategoryAdded={(newCat) => setCategories([...categories, newCat])}
        />
        <h2 className="text-xl font-semibold mb-2">Categorias</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.id}</TableCell>
                <TableCell>{category.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Tabla de marcas */}
      <div>
        <AddBrand
          categories={categories}
          onBrandAdded={(newBrand) => setBrands([...brands, newBrand])}
        />
        <h2 className="text-xl font-semibold mb-2">Marcas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell>{brand.id}</TableCell>
                <TableCell>{brand.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
