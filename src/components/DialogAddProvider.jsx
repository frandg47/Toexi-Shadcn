import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = yup.object({
  name: yup.string().required("El nombre es obligatorio."),
  contact_name: yup.string().nullable(),
  phone: yup
    .string()
    .matches(/^[0-9+()\s-]*$/, "Formato de teléfono inválido.")
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  email: yup
    .string()
    .email("Correo electrónico inválido.")
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  address: yup.string().nullable(),
  city: yup.string().nullable(),
  notes: yup.string().nullable(),
});

export default function DialogAddProvider({ open, onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onSubmit = async (values) => {
    try {
      const { data, error } = await supabase
        .from("providers")
        .insert([{ ...values, is_active: true }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Proveedor agregado", {
        description: `${data.name} fue registrado correctamente.`,
      });

      if (onSuccess) onSuccess(data);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el proveedor", {
        description: error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Registrar nuevo proveedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="contact_name">Contacto</Label>
              <Input id="contact_name" {...register("contact_name")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register("address")} />
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" {...register("city")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Ej: entrega semanal, mejor horario de contacto..."
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
