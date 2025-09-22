import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AddBrand({ onBrandAdded }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("brands")
      .insert([{ name: name.toUpperCase() }])
      .select();

    setLoading(false);
    if (error) {
      console.error("Error adding brand:", error);
    } else {
      setName("");
      if (onBrandAdded) onBrandAdded(data[0]);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <Input
        placeholder="Nueva marca"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={handleAdd} disabled={loading}>
        {loading ? "Agregando..." : "Agregar"}
      </Button>
    </div>
  );
}
