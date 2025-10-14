"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconBallpen,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import DialogCatalog from "../components/DialogCatalog";
import ConcentricLoader from "../components/ui/loading";

export default function CatalogTable({ tipo }) {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState("");
  const [productCounts, setProductCounts] = useState({});

  // Modales
  const [modal, setModal] = useState({
    open: false,
    editId: null,
    initial: "",
    type: "",
  });

  useEffect(() => {
    fetchData();
  }, [tipo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let catData = [];
      let brData = [];

      if (tipo === "brands") {
        const { data, error } = await supabase.from("brands").select("*");
        if (error) throw error;
        brData = data || [];
        setBrands(brData);
      } else if (tipo === "categories") {
        const { data, error } = await supabase.from("categories").select("*");
        if (error) throw error;
        catData = data || [];
        setCategories(catData);
      } else {
        const [{ data: cat }, { data: br }] = await Promise.all([
          supabase.from("categories").select("*"),
          supabase.from("brands").select("*"),
        ]);
        catData = cat || [];
        brData = br || [];
        setCategories(catData);
        setBrands(brData);
      }

      // 🔹 Contar productos por marca y categoría
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("id, brand_id, category_id");

      if (prodError) throw prodError;

      // Agrupar manualmente
      const counts = {};
      products.forEach((p) => {
        if (p.brand_id)
          counts[`brand-${p.brand_id}`] =
            (counts[`brand-${p.brand_id}`] || 0) + 1;
        if (p.category_id)
          counts[`category-${p.category_id}`] =
            (counts[`category-${p.category_id}`] || 0) + 1;
      });

      setProductCounts(counts);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- CRUD ---------- */
  const saveItem = async (name, id = null, type) => {
    if (!name) return toast.error("El nombre no puede estar vacío");
    const table = type === "brand" ? "brands" : "categories";

    if (id) {
      const { data, error } = await supabase
        .from(table)
        .update({ name })
        .eq("id", id)
        .select();
      if (error) return toast.error(`Error al editar ${type}`);
      if (type === "brand")
        setBrands((prev) => prev.map((b) => (b.id === id ? data[0] : b)));
      else
        setCategories((prev) => prev.map((c) => (c.id === id ? data[0] : c)));
      toast.success(`${capitalize(type)} actualizada`);
    } else {
      const { data, error } = await supabase
        .from(table)
        .insert([{ name }])
        .select();
      if (error) return toast.error(`Error al agregar ${type}`);
      if (type === "brand") setBrands((prev) => [...prev, data[0]]);
      else setCategories((prev) => [...prev, data[0]]);
      toast.success(`${capitalize(type)} agregada`);
    }
  };

  const deleteItem = async (id, type) => {
    const table = type === "brand" ? "brands" : "categories";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(`Error al eliminar ${type}`);
    if (type === "brand") setBrands((prev) => prev.filter((b) => b.id !== id));
    else setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success(`${capitalize(type)} eliminada`);
  };

  const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  const filterByName = (items) =>
    items.filter((i) =>
      i.name.toLowerCase().includes(nameFilter.toLowerCase())
    );

  if (loading)
    return (
      <div className="p-6">
        <ConcentricLoader />
      </div>
    );

  const renderCards = (items, type) => {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filterByName(items).map((item) => (
          <Card
            key={item.id}
            className="relative border shadow-sm hover:shadow-md transition-all"
          >
            <CardHeader>
              <CardTitle className={`flex items-center justify-between`}>
                <span className={`font-semibold`}>{item.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="hover:bg-green-50"
                    onClick={() =>
                      setModal({
                        open: true,
                        editId: item.id,
                        initial: item.name,
                        type,
                      })
                    }
                  >
                    <IconBallpen className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="bg-red-400 hover:bg-red-500 text-white hover:text-white"
                    onClick={() => deleteItem(item.id, type)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="px-3 py-1"
              >
                {productCounts[`${type}-${item.id}`] || 0} productos
              </Badge>
            </CardContent>
          </Card>
        ))}

        {filterByName(items).length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-6">
            <Badge variant="secondary">No hay resultados</Badge>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex justify-between items-center my-4 flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre..."
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-72"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <IconRefresh className="h-4 w-4" /> Refrescar
          </Button>
          <Button
            onClick={() =>
              setModal({
                open: true,
                editId: null,
                initial: "",
                type: tipo === "brands" ? "brand" : "category",
              })
            }
          >
            <IconPlus className="h-4 w-4" /> Agregar
          </Button>
        </div>
      </div>
      <div className="container my-6 space-y-10 ">
        {(tipo === "all" || tipo === "categories") && (
          <>{renderCards(categories, "category")}</>
        )}

        {(tipo === "all" || tipo === "brands") && (
          <>{renderCards(brands, "brand")}</>
        )}

        {/* 🪟 Modal de creación/edición */}
        <DialogCatalog
          open={modal.open}
          onClose={() =>
            setModal({ open: false, editId: null, initial: "", type: "" })
          }
          onConfirm={(val) => {
            saveItem(val, modal.editId, modal.type);
            setModal({ open: false, editId: null, initial: "", type: "" });
          }}
          label={
            modal.editId
              ? `Editar ${capitalize(modal.type)}`
              : `Agregar ${capitalize(modal.type)}`
          }
          initialValue={modal.initial}
        />
      </div>
    </>
  );
}
