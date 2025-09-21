import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AddCategory({ onCategoryAdded }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .insert([{ name }])
      .select();

    setLoading(false);
    if (error) {
      console.error("Error adding category:", error);
    } else {
      setName("");
      if (onCategoryAdded) onCategoryAdded(data[0]); // notifica al padre
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <Input
        placeholder="New category"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button onClick={handleAdd} disabled={loading}>
        {loading ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
