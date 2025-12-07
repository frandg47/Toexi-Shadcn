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
        imei: v.imei || null,
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
  // ========================================
  // PDF – GENERACIÓN (CORREGIDO CON VENDEDOR + MISMOS TAMAÑOS)
  // ========================================
  const handleDownloadPDF = (savedSale) => {
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    // Logo
    const logoWidth = 22;
    const logoHeight = 22;
    const logoX = pageWidth - logoWidth - margin;
    doc.addImage("/toexi.jpg", "JPEG", logoX - 2, margin - 8, logoWidth, logoHeight);

    // Encabezado
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROBANTE DE VENTA", margin, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`N°: VTA-${String(savedSale.id).padStart(6, "0")}`, margin, y + 6);

    y += 26;

    // =============================
    //  CUADRO CLIENTE / FECHAS
    // =============================
    const fecha = new Date().toLocaleDateString("es-AR");

    doc.setFontSize(11);
    doc.rect(margin, y, 180, 22);

    doc.text("Fecha:", margin + 4, y + 6);
    doc.text(fecha, margin + 40, y + 6);

    doc.text("Cliente:", margin + 4, y + 12);
    doc.text(
      `${safeSale.customer_name} (Tel: ${safeSale.customer_phone || "-"})`,
      margin + 40,
      y + 12
    );

    y += 30;

    // =============================
    //  VENDEDOR (NUEVO - IGUAL QUE SALES LIST)
    // =============================
    const vendedorNombre =
      safeSale.seller_name && safeSale.seller_name.trim()
        ? `${safeSale.seller_name}${safeSale.seller_last_name ? " " + safeSale.seller_last_name : ""}`
        : "Toexi Tech";

    doc.setFontSize(11);
    doc.rect(margin, y, 180, 16);

    doc.text("Vendedor:", margin + 4, y + 6);
    doc.text(vendedorNombre, margin + 40, y + 6);

    y += 24;

    // =============================
    //  TABLA DE ITEMS (COLUMNAS IGUAL QUE SALES LIST)
    // =============================
    autoTable(doc, {
      startY: y,
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: "bold",
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 10,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      head: [["Producto", "Variante", "Color", "IMEI", "Cant", "Subtotal USD", "Subtotal ARS"]],
      body: safeSale.variants.map((v) => [
        v.product_name,
        v.variant_name,
        v.color || "-",
        v.imei || "-",
        v.quantity,
        `USD ${v.usd_price.toFixed(2)}`,
        `$ ${v.subtotal_ars.toLocaleString("es-AR")}`,
      ]),
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 32 },
        2: { cellWidth: 18 },
        3: { cellWidth: 30 },
        4: { halign: "center", cellWidth: 12 },
        5: { halign: "right", cellWidth: 30 },
        6: { halign: "right", cellWidth: 26 },
      },
      theme: "plain",
      margin: { top: 0, right: 0, bottom: 0, left: margin },
      didDrawCell: (data) => {
        const { table, row, column } = data;
        const totalRows = table.body.length;
        const totalCols = table.columns.length;

        if (row.index === 0 && column.index === 0) {
          data.cell.styles.lineWidth = [0, 0.3, 0.3, 0];
        } else if (row.index === 0 && column.index === totalCols - 1) {
          data.cell.styles.lineWidth = [0, 0, 0.3, 0.3];
        } else if (row.index === totalRows - 1 && column.index === 0) {
          data.cell.styles.lineWidth = [0.3, 0.3, 0, 0];
        } else if (row.index === totalRows - 1 && column.index === totalCols - 1) {
          data.cell.styles.lineWidth = [0.3, 0, 0, 0.3];
        } else if (row.index === 0) {
          data.cell.styles.lineWidth = [0, 0.3, 0.3, 0.3];
        } else if (row.index === totalRows - 1) {
          data.cell.styles.lineWidth = [0.3, 0.3, 0, 0.3];
        } else if (column.index === 0) {
          data.cell.styles.lineWidth = [0.3, 0.3, 0.3, 0];
        } else if (column.index === totalCols - 1) {
          data.cell.styles.lineWidth = [0.3, 0, 0.3, 0.3];
        } else {
          data.cell.styles.lineWidth = [0.3, 0.3, 0.3, 0.3];
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    // =============================
    //  RESUMEN FINANCIERO (SIN CAMBIOS)
    // =============================
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    doc.text(`Subtotal USD: USD ${safeSale.total_usd.toFixed(2)}`, margin, y);
    y += 6;

    doc.text(`Subtotal ARS: $ ${safeSale.total_ars.toLocaleString("es-AR")}`, margin, y);
    y += 6;

    doc.text(`Cotización aplicada: $ ${safeSale.fx_rate_used}`, margin, y);
    y += 6;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 100, 200);
    doc.text(`TOTAL: $ ${safeSale.total_final_ars.toLocaleString("es-AR")}`, margin, y);

    y += 14;

    // =============================
    // MÉTODOS DE PAGO (SIN CAMBIOS)
    // =============================
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Formas de Pago:", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    safeSale.payments.forEach((p) => {
      doc.text(
        `• ${p.method_name}${p.installments > 1 ? ` (${p.installments} cuotas)` : ""}: $ ${Number(p.amount).toLocaleString("es-AR")}`,
        margin,
        y
      );
      y += 5;
    });

    y += 4;

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(120);
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 14;

    const text1 = "Gracias por su compra - Toexi Tech ©";
    const text1Width = doc.getTextWidth(text1);

    doc.text(text1, (pageWidth - text1Width) / 2, footerY);

    doc.save(`venta_${savedSale.id}.pdf`);
  };


  // ==============================
  // UI
  // ==============================
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] sm:max-w-xl md:max-w-2xl max-h-[85svh] overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Confirmar Venta</DialogTitle>
          <DialogDescription>
            Revisá los datos antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p><strong>Cliente:</strong> {safeSale.customer_name}</p>
          <p><strong>Tel:</strong> {safeSale.customer_phone || "-"}</p>
          <p><strong>Vendedor:</strong> {safeSale.seller_name && safeSale.seller_name.trim() ? safeSale.seller_name : "Toexi Tech"}</p>
          <p><strong>Cotización:</strong> ${safeSale.fx_rate_used}</p>

          <div className="border rounded p-2 max-h-40 overflow-y-auto">
            {safeSale.variants.map((v, i) => (
              <div key={i} className="text-xs border-b py-1">
                <div className="font-medium">{v.product_name} {v.variant_name} — {v.quantity}u · USD {v.usd_price}</div>
                {v.imei && <div className="text-muted-foreground">IMEI: {v.imei}</div>}
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
