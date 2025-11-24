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

  // Convertimos datos a seguros
  const safeSale = {
    ...sale,
    variants: Array.isArray(sale?.variants) ? sale.variants : [],
    payments: Array.isArray(sale?.payments) ? sale.payments : [],
  };

  const resetSale = () => {
    if (typeof safeSale.reset === "function") safeSale.reset();
  };

  // ==============================
  //  CONFIRMAR VENTA
  // ==============================
  const handleConfirmSale = async () => {
    try {
      const { data: savedSale, error } = await supabase
        .from("sales")
        .insert([
          {
            customer_id: safeSale.customer_id,
            seller_id: safeSale.seller_id,
            lead_id: safeSale.lead_id,
            total_usd: safeSale.total_usd,
            total_ars: safeSale.total_final_ars ?? safeSale.total_ars,
            fx_rate_used: safeSale.fx_rate_used,
            notes: safeSale.notes,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Ítems
      const items = safeSale.variants.map((v) => ({
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

      // Pagos
      const paymentsToInsert = safeSale.payments.map((p) => ({
        sale_id: savedSale.id,
        method: (() => {
          if (p.method_name?.toLowerCase().includes("efectivo")) return "efectivo";
          if (p.method_name?.toLowerCase().includes("transfer")) return "transferencia";
          return "tarjeta";
        })(),
        amount_ars: Number(p.amount) || 0,
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
      resetSale();
      onClose();
    } catch (err) {
      console.error("❌ Error guardando venta:", err);
      toast.error("Error procesando venta");
    }
  };

  // ========================================
  // PDF – GENERACIÓN ESTABLE (VERSIÓN ORIGINAL)
  // ========================================
  const handleDownloadPDF = (savedSale) => {
    const doc = new jsPDF();
    const margin = 14;
    let y = margin;

    // =============================
    //  ENCABEZADO
    // =============================
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROBANTE DE VENTA", margin, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`N°: VTA-${String(savedSale.id).padStart(6, "0")}`, margin, y + 6);

    y += 18;

    // =============================
    //  CUADRO CLIENTE / FECHAS
    // =============================
    const fecha = new Date().toLocaleDateString("es-AR");

    doc.setFontSize(11);
    doc.rect(margin, y, 180, 28);

    doc.text("Fecha:", margin + 4, y + 6);
    doc.text(fecha, margin + 40, y + 6);

    doc.text("Cliente:", margin + 4, y + 12);
    doc.text(
      `${safeSale.customer_name}  (Tel: ${safeSale.customer_phone || "-"})`,
      margin + 40,
      y + 12
    );

    y += 36;

    // =============================
    //  CUADRO VENDEDOR
    // =============================
    doc.rect(margin, y, 180, 18);
    doc.text("Vendedor:", margin + 4, y + 6);
    doc.text(safeSale.seller_name, margin + 40, y + 6);
    doc.text(`Email: ${safeSale.seller_email}`, margin + 40, y + 12);

    y += 28;

    // =============================
    //  TABLA DE ITEMS
    // =============================
    autoTable(doc, {
      startY: y,
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: 255,
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 10,
      },
      head: [["Producto", "Cant", "USD", "Subtotal ARS"]],
      body: safeSale.variants.map((v) => [
        `${v.product_name} ${v.variant_name} ` +
        `(${v.storage || "-"} / ${v.ram || "-"} / ${v.color || "-"})`,
        v.quantity,
        `USD ${v.usd_price}`,
        `$ ${v.subtotal_ars.toLocaleString("es-AR")}`,
      ]),
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      theme: "grid",
    });

    y = doc.lastAutoTable.finalY + 10;

    // =============================
    //  TOTAL
    // =============================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Subtotal: $${safeSale.total_ars.toLocaleString("es-AR")}`,
      margin,
      y
    );

    y += 6;

    doc.text(`Cotización aplicada: $${safeSale.fx_rate_used}`, margin, y);

    y += 6;

    doc.setFontSize(14);
    doc.setTextColor(0, 100, 200);
    doc.text(
      `TOTAL: $${safeSale.total_final_ars.toLocaleString("es-AR")}`,
      margin,
      y
    );

    y += 14;

    // =============================
    //  MÉTODOS DE PAGO
    // =============================
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Métodos de Pago", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    safeSale.payments.forEach((p) => {
      doc.text(
        `• ${p.method_name}${p.installments > 1 ? ` (${p.installments} cuotas)` : ""
        }: $${p.amount.toLocaleString("es-AR")}`,
        margin,
        y
      );
      y += 5;
    });

    // =============================
    //  FOOTER
    // =============================
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Gracias por su compra - Toexi Tech ©", margin, 290);

    // =============================
    //  DESCARGA
    // =============================
    doc.save(`venta_${savedSale.id}.pdf`);
  };

  // ==============================
  // UI
  // ==============================
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar Venta</DialogTitle>
          <DialogDescription>
            Revisá los datos antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p><strong>Cliente:</strong> {safeSale.customer_name}</p>
          <p><strong>Tel:</strong> {safeSale.customer_phone || "-"}</p>
          <p><strong>Vendedor:</strong> {safeSale.seller_name}</p>
          <p><strong>Cotización:</strong> ${safeSale.fx_rate_used}</p>

          <div className="border rounded p-2 max-h-40 overflow-y-auto">
            {safeSale.variants.map((v, i) => (
              <div key={i} className="text-xs border-b py-1">
                {v.product_name} {v.variant_name} — {v.quantity}u · USD {v.usd_price}
              </div>
            ))}
          </div>

          <div className="border rounded p-2 max-h-32 overflow-y-auto text-xs">
            <strong>Métodos de pago:</strong>
            {safeSale.payments.map((p, i) => (
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
            Total: ${safeSale.total_final_ars.toLocaleString("es-AR")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirmSale}>
            Confirmar & Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
