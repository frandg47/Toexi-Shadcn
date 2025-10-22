import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FormEditUser from "./FormEditUser";

export default function DialogEditUser({ open, onClose, userId, onSuccess }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          w-[90vw] max-w-md sm:w-full
          rounded-lg sm:rounded-xl
          p-4 sm:p-6
          max-h-[90vh] overflow-y-auto
        "
      >
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-center sm:text-left">
            Editar Usuario
          </DialogTitle>
        </DialogHeader>

        <FormEditUser userId={userId} onClose={onClose} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}
