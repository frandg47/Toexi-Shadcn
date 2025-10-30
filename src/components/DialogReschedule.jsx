import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function DialogReschedule({ open, onClose, lead, onSaved }) {
  const [when, setWhen] = useState(() => {
    if (!lead?.appointment_datetime) return "";
    const d = new Date(lead.appointment_datetime);
    // formateo a yyyy-MM-ddTHH:mm (sin zona)
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      const iso = when ? new Date(when).toISOString() : null;
      const { error } = await supabase
        .from("leads")
        .update({
          appointment_datetime: iso,
          status: "confirmado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Cita reprogramada");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error("No se pudo reprogramar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogramar cita</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="when">Nueva fecha y hora</Label>
            <input
              id="when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Al guardar se marcará como <strong>confirmado</strong>.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
