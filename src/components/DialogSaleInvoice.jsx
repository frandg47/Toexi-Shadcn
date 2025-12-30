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

export default function DialogSaleInvoice({ open, onClose, sale, subtotalWithSurcharge }) {
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
      // Preparamos la estructura EXACTA que recibe la función SQL.
      const payload = {
        p_customer_id: safeSale.customer_id,
        p_seller_id: safeSale.seller_id || null,
        p_lead_id: safeSale.lead_id,
        p_fx_rate: safeSale.fx_rate_used,
        p_notes: safeSale.notes,

        p_discount_type: safeSale.discount_type || null,
        p_discount_value: safeSale.discount_value || 0,
        p_discount_amount: safeSale.discount_amount || 0,

        p_items: safeSale.variants.map(v => ({
          variant_id: v.variant_id ?? v.id,
          quantity: v.quantity,
          imeis: v.imeis,
          usd_price: v.usd_price,
        })),

        p_payments: safeSale.payments.map(p => ({
          payment_method_id: p.payment_method_id, // 🔑 clave
          amount: Number(p.amount),
          installments: p.installments ? Number(p.installments) : null,
          reference: p.reference || null,
        })),


        p_total_ars: safeSale.total_final_ars,
        p_total_usd: safeSale.total_usd,
      };

      const { data, error } = await supabase.rpc("create_sale_with_imeis", payload);

      if (error) throw error;

      toast.success("Venta registrada con éxito");

      handleDownloadPDF({ id: data.sale_id });
      resetSale();
      onClose();

    } catch (err) {
      console.error("❌ Error al confirmar venta:", err);
      toast.error("Error procesando venta", err.message);
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
        ? `${safeSale.seller_name}${safeSale.seller_last_name ? ' ' + safeSale.seller_last_name : ''} (Tel: ${safeSale.seller_phone || "3816783617"})`
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
      head: [["Producto", "Variante", "Color", "Cant", "IMEI/s", "Subtotal USD", "Subtotal ARS"]],
      body: safeSale.variants.map((v) => [
        v.product_name,
        v.variant_name ? v.variant_name : "Modelo Base",
        v.color || "-",
        v.imeis.length,                      // 📌 cantidad = largo del array
        (v.imeis || []).join("\n"),          // 📌 IMEIs separados por saltos de línea
        `USD ${v.usd_price.toFixed(2)}`,
        `$ ${(v.usd_price * v.imeis.length * safeSale.fx_rate_used)
          .toLocaleString("es-AR")}`,
      ]),

      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 32 },
        2: { cellWidth: 18 },
        3: { cellWidth: 12 },
        4: { cellWidth: 30 },
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

    // doc.text(`Subtotal USD: USD ${safeSale.total_usd.toFixed(2)}`, margin, y);
    // y += 6;
    doc.text(
      `Subtotal: $ ${subtotalWithSurcharge.toLocaleString("es-AR")}`,
      margin,
      y
    );
    y += 6;

    if (safeSale.discount_amount > 0) {
      doc.text(
        `Descuento: -$ ${safeSale.discount_amount.toLocaleString("es-AR")}`,
        margin,
        y
      );
      y += 6;
    }

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

    doc.text(`Nota: ${safeSale.notes || "-"}`, margin, y + 8);
    y += 4;

    // =============================
    //  FOOTER LEGAL + DATOS EMPRESA
    // =============================
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerCenter = pageWidth / 2;

    let fY = pageHeight - 24;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text("TOEXI TECH", footerCenter, fY, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text("Teléfono: 381 364 5246", footerCenter, fY + 5, { align: "center" });
    doc.text("Instagram: @toexi.tech", footerCenter, fY + 10, { align: "center" });

    // Legal
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Gracias por su compra", footerCenter, fY + 17, { align: "center" });

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
                <div className="font-medium">
                  {v.product_name} {v.variant_name} — {v.imeis.length}u · USD {v.usd_price}
                </div>

                {v.imeis?.length > 0 && (
                  <div className="text-muted-foreground">
                    IMEIs: {v.imeis.join(", ")}
                  </div>
                )}

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

          <div className="text-right space-y-1 mt-2">
            <div className="text-sm text-muted-foreground">
              Subtotal con recargos: ${Number(subtotalWithSurcharge).toLocaleString("es-AR")}
            </div>

            {safeSale.discount_amount > 0 && (
              <div className="text-sm text-green-600">
                Descuento: −${safeSale.discount_amount.toLocaleString("es-AR")}
              </div>
            )}

            <div className="font-bold text-lg text-primary">
              Total a pagar: ${safeSale.total_final_ars.toLocaleString("es-AR")}
            </div>
          </div>

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
