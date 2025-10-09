import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FormEditUser from "./FormEditUser";

export default function DialogEditUser({ open, onClose, userId }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        <FormEditUser userId={userId} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}