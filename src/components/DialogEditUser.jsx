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
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
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
