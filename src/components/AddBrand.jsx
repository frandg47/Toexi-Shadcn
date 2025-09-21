import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Input, Select, Button } from "@/components/ui/input";

export default function AddBrand({ categories, onBrandAdded }) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name || !categoryId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("brands")
      .insert([{ name, category_id: parseInt(categoryId) }])
      .select();

    setLoading(false);
    if (error) {
      console.error("Error adding brand:", error);
    } else {
      setName("");
      setCategoryId("");
      if (onBrandAdded) onBrandAdded(data[0]);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <Input
        placeholder="New brand"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="border rounded px-2 py-1"
      >
        <option value="">Select category</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
      <Button onClick={handleAdd} disabled={loading}>
        {loading ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
