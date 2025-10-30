import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function DialogSaleInvoice({ open, onClose, sale }) {
  if (!sale) return null

  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)

  const formatDate = (date) =>
    new Date(date).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Comprobante de Venta</DialogTitle>
          <DialogDescription>
            Detalle de la operación realizada
          </DialogDescription>
        </DialogHeader>

        {/* Datos del cliente */}
        <div className="text-sm space-y-1 border-b pb-2">
          <p className="font-semibold text-primary">Cliente</p>
          <p>{sale.customer_name}</p>
          {sale.customer_phone && <p>📞 {sale.customer_phone}</p>}
        </div>

        {/* Datos del vendedor */}
        <div className="text-sm space-y-1 border-b pb-2">
          <p className="font-semibold text-primary">Vendedor</p>
          <p>{sale.seller_name}</p>
          {sale.seller_email && <p>📧 {sale.seller_email}</p>}
        </div>

        {/* Productos */}
        <div className="space-y-2">
          <p className="font-semibold text-primary text-sm">Detalle de productos</p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
            {sale.variants?.map((v, i) => (
              <div key={i} className="flex justify-between text-sm border-b pb-1">
                <div>
                  <p className="font-medium">{v.product_name} - {v.variant_name}</p>
                  <p className="text-muted-foreground text-xs">
                    Color: {v.color} • {v.storage}GB {v.ram ? `• ${v.ram} RAM` : ""}
                  </p>
                  <p className="text-xs">Cantidad: {v.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatARS(v.subtotal_ars)}</p>
                  <p className="text-xs text-muted-foreground">
                    USD {v.usd_price} x {v.quantity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="space-y-1 border-t pt-2 text-sm font-medium">
          <p>Total USD: ${sale.total_usd}</p>
          <p>Total ARS: {formatARS(sale.total_ars)}</p>
          <p className="text-xs text-muted-foreground">
            Cotización aplicada: ${sale.fx_rate_used}
          </p>
          <p className="text-xs text-muted-foreground">Fecha: {formatDate(sale.created_at)}</p>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button
            onClick={() => window.print()}
            className="bg-green-600 hover:bg-green-700"
          >
            Imprimir / Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
