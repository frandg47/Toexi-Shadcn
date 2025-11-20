import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function DialogSaleInvoice({ open, onClose, sale }) {
  if (!sale) return null;

  const handleConfirmSale = async () => {
    try {
      // 1) Insertar venta
      const { data: savedSale, error } = await supabase
        .from("sales")
        .insert([
          {
            customer_id: sale.customer_id,
            seller_id: sale.seller_id,
            lead_id: sale.lead_id,
            total_usd: sale.total_usd,
            total_ars: sale.total_final_ars ?? sale.total_ars,
            fx_rate_used: sale.fx_rate_used,
            notes: sale.notes,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // 2) Insertar sale_items
      const items = sale.variants.map((v) => ({
        sale_id: savedSale.id,
        variant_id: v.variant_id ?? v.id,
        product_name: v.product_name,
        variant_name: v.variant_name,
        color: v.color,
        storage: v.storage,
        ram: v.ram,
        usd_price: v.usd_price,
        quantity: v.quantity,
        subtotal_usd: v.subtotal_usd,
        subtotal_ars: v.subtotal_ars,
      }));

      await supabase.from("sale_items").insert(items);

      // 3) Insertar sale_payments (NUEVO — CORRECTO)
      const paymentsToInsert = sale.payments.map((p) => ({
        sale_id: savedSale.id,
        method: (() => {
          if (p.method_name?.toLowerCase().includes("efectivo")) return "efectivo";
          if (p.method_name?.toLowerCase().includes("transfer")) return "transferencia";
          return "tarjeta"; // cualquier tarjeta va acá
        })(),
        amount_ars: p.amount,
        amount_usd: null,
        reference: p.reference || null,
        card_brand: p.method_name.replace(/tarjeta/i, "").trim() || null,
        installments: p.installments ? Number(p.installments) : null,
      }));

      const { error: payErr } = await supabase
        .from("sale_payments")
        .insert(paymentsToInsert);

      if (payErr) throw payErr;

      toast.success("Venta registrada con éxito");

      handleDownloadPDF(savedSale);
      onClose();
    } catch (err) {
      console.error("❌ Error guardando venta:", err);
      toast.error("Error procesando venta");
    }
  };


  const handleDownloadPDF = (savedSale) => {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Comprobante de Venta", 14, 14);

    doc.setFontSize(10);
    doc.text(`Cliente: ${sale.customer_name}`, 14, 25);
    doc.text(`Tel: ${sale.customer_phone || "-"}`, 14, 30);
    doc.text(`Vendedor: ${sale.seller_name}`, 14, 35);
    doc.text(`Email vendedor: ${sale.seller_email}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 45);
    doc.text(`Cotización: $${sale.fx_rate_used}`, 14, 50);

    autoTable(doc, {
      head: [
        ["Producto", "Alm.", "Color", "RAM", "Cant.", "USD", "Subtotal ARS"],
      ],
      body: sale.variants.map((v) => [
        `${v.product_name} ${v.variant_name}`,
        v.storage ?? "-",
        v.color ?? "-",
        v.ram ?? "-",
        v.quantity,
        `USD ${v.usd_price}`,
        `$ ${v.subtotal_ars.toLocaleString("es-AR")}`,
      ]),
      startY: 60,
    });

    let y = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.text(`Total ARS: ${sale.total_final_ars.toLocaleString("es-AR")}`, 14, y);
    y += 6;

    doc.text("Pagos:", 14, y);
    y += 6;

    sale.payments.forEach((p) => {
      doc.text(
        `${p.method_name}${p.installments > 1 ? ` (${p.installments} cuotas)` : ""
        }: $${p.amount.toLocaleString("es-AR")}`,
        14,
        y
      );
      y += 5;
    });

    doc.save(`venta_${savedSale.id}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar Venta</DialogTitle>
          <DialogDescription>
            Verificá antes de registrar la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p><strong>Cliente:</strong> {sale.customer_name}</p>
          <p><strong>Tel:</strong> {sale.customer_phone || "-"}</p>
          <p><strong>Vendedor:</strong> {sale.seller_name}</p>
          <p><strong>Cotización:</strong> ${sale.fx_rate_used}</p>

          <div className="border rounded p-2 max-h-40 overflow-y-auto">
            {sale.variants.map((v, i) => (
              <div key={i} className="text-xs border-b py-1">
                {v.product_name} {v.variant_name} — {v.quantity}u · USD {v.usd_price}
              </div>
            ))}
          </div>

          <div className="border rounded p-2 max-h-32 overflow-y-auto text-xs">
            <strong>Métodos de pago:</strong>
            {sale.payments.map((p, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>
                  {p.method_name}
                  {p.installments > 1 ? ` (${p.installments} cuotas)` : ""}
                </span>
                <span>${Number(p.amount).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>

          <p className="font-bold text-right text-lg text-primary mt-2">
            Total: ${sale.total_final_ars.toLocaleString("es-AR")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirmSale}>Confirmar & Descargar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
