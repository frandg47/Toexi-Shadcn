import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { IconFileTypePdf } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconBox,
  IconColorSwatch,
  IconCreditCard,
  IconCurrencyDollar,
} from "@tabler/icons-react";

const currencyFormatterARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});
const currencyFormatterUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatCurrencyARS = (v) =>
  v == null || Number.isNaN(Number(v)) ? "-" : currencyFormatterARS.format(v);
const formatCurrencyUSD = (v) =>
  v == null || Number.isNaN(Number(v)) ? "-" : currencyFormatterUSD.format(v);

export default function ProductDetailDialog({
  open,
  onClose,
  product,
  fxRate = 1000,
  paymentMethods = [],
  paymentInstallments = [],
}) {
  if (!product) return null;

  // 🔹 Variantes reales
  const realVariants = useMemo(
    () =>
      (product.variants || []).filter(
        (v) => v.storage || v.ram || (v.color && v.color.trim() !== "")
      ),
    [product.variants]
  );

  // 🔹 Agrupar variantes por Storage / RAM
  const grouped = useMemo(() => {
    const map = new Map();
    for (const v of realVariants) {
      const key =
        [v.storage || "", v.ram || ""].filter(Boolean).join(" / ").trim() ||
        "Modelo Base";
      if (!map.has(key)) map.set(key, { key, variants: [] });
      map.get(key).variants.push(v);
    }
    return [...map.values()];
  }, [realVariants]);

  const [activeTab, setActiveTab] = useState(grouped[0]?.key || "");
  const selectedGroup = grouped.find((g) => g.key === activeTab);
  const firstVariant = selectedGroup?.variants[0] || realVariants[0];

  // 🔹 Colores disponibles
  const colors = selectedGroup
    ? selectedGroup.variants.map((v) => v.color).filter(Boolean)
    : [];

  // 🔹 Relacionar métodos con sus cuotas
  const enrichedMethods = useMemo(() => {
    return paymentMethods.map((m) => ({
      ...m,
      installments: paymentInstallments.filter(
        (i) => i.payment_method_id === m.id
      ),
    }));
  }, [paymentMethods, paymentInstallments]);

  // 🔹 Función para exportar el producto a PDF (con imagen y estructura)
  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 10;

    // 🔹 Si hay imagen, convertir a Base64 y agregarla
    if (product.coverImageUrl) {
      try {
        const img = await fetch(product.coverImageUrl);
        const blob = await img.blob();
        const reader = new FileReader();
        const imagePromise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        reader.readAsDataURL(blob);
        const imageData = await imagePromise;

        const imgWidth = 60;
        const imgHeight = 60;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(imageData, "JPEG", imgX, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      } catch (error) {
        console.warn("No se pudo cargar la imagen para el PDF:", error);
      }
    }

    // 🔹 Encabezado principal
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(product.name, pageWidth / 2, currentY, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${product.brandName} — ${product.categoryName}`,
      pageWidth / 2,
      currentY + 8,
      { align: "center" }
    );

    currentY += 18;

    // 🔹 Datos generales
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Cotización actual: ${formatCurrencyARS(fxRate)}`, 14, currentY);
    if (product.allowBackorder) {
      doc.setTextColor(200, 120, 0);
      doc.text("Producto con pedido anticipado", 14, currentY + 6);
    }

    currentY += 12;

    // 🔹 Tabla de variantes
    const variantRows = realVariants.map((v) => [
      v.color || "—",
      v.storage || "—",
      v.ram || "—",
      formatCurrencyUSD(v.usd_price),
      formatCurrencyARS(v.usd_price * fxRate),
      v.stock ?? 0,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        ["Color", "Almacenamiento", "RAM", "Precio USD", "Precio ARS", "Stock"],
      ],
      body: variantRows,
      styles: { fontSize: 10 },
      headStyles: {
        fillColor: [25, 118, 210],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // 🔹 Tabla de métodos de pago
    const methodRows = enrichedMethods.flatMap((m) => {
      const basePriceUSD = product.usdPrice;
      if (m.installments.length === 0) {
        return [
          [m.name, "1 pago", formatCurrencyARS(basePriceUSD * fxRate), "—"],
        ];
      }

      return m.installments.map((i) => {
        const total = basePriceUSD * fxRate * i.multiplier;
        const cuota = total / i.installments;
        const extra = (i.multiplier - 1) * 100;
        return [
          m.name,
          `${i.installments} cuotas`,
          formatCurrencyARS(cuota),
          `+${extra.toFixed(1)}%`,
        ];
      });
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Método", "Cuotas", "Monto por cuota", "Recargo"]],
      body: methodRows,
      styles: { fontSize: 10 },
      headStyles: {
        fillColor: [46, 125, 50],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // 🔹 Pie con cotización
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Cotización utilizada: ${formatCurrencyARS(
        fxRate
      )} — Generado automáticamente`,
      pageWidth / 2,
      currentY,
      { align: "center" }
    );

    // 🔹 Guardar PDF
    doc.save(`Producto_${product.name}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto p-2 sm:p-6 rounded-lg sm:rounded-xl">
        {/* 🔹 Encabezado */}
        <DialogHeader className="space-y-2 text-center">
          <DialogTitle className="text-lg sm:text-2xl font-bold tracking-tight break-words">
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-base text-muted-foreground">
            {product.brandName} — {product.categoryName}
          </DialogDescription>
        </DialogHeader>

        {/* 🔹 Botón Exportar PDF */}
        <div className="flex justify-center mt-2 sm:mt-3 mb-2 sm:mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="w-full sm:w-auto flex items-center gap-2 text-xs sm:text-sm py-2"
          >
            <IconFileTypePdf className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
            <span>Exportar PDF</span>
          </Button>
        </div>

        {/* 🔹 Imagen + Datos básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mt-2">
          {/* Imagen */}
          <div className="flex justify-center items-center bg-muted/20 rounded-lg p-2 sm:p-4">
            <img
              src={product.coverImageUrl}
              alt={product.name}
              className="max-w-full h-auto w-48 sm:w-72 object-contain rounded-md"
            />
          </div>

          {/* Datos principales */}
          <div className="flex flex-col justify-between text-xs sm:text-base leading-relaxed">
            <div className="space-y-2 sm:space-y-3">
              <p>
                <span className="font-semibold text-foreground">Marca:</span>{" "}
                {product.brandName}
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  Categoría:
                </span>{" "}
                {product.categoryName}
              </p>
              <p>
                <span className="font-semibold text-foreground">Variante:</span>{" "}
                {activeTab || "—"}
              </p>

              {colors.length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">
                    Colores disponibles:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {colors.map((color, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="flex items-center gap-1 text-xs sm:text-sm"
                      >
                        <IconColorSwatch className="h-3 w-3 text-muted-foreground" />
                        {color}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Precios y stock */}
              <div className="flex flex-col gap-1">
                <p>
                  <span className="font-semibold">Precio en USD:</span>{" "}
                  {formatCurrencyUSD(
                    firstVariant?.usd_price || product.usdPrice
                  )}
                </p>
                <p>
                  <span className="font-semibold">Precio en ARS:</span>{" "}
                  {formatCurrencyARS(
                    (firstVariant?.usd_price || product.usdPrice) * fxRate
                  )}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-semibold">Stock:</span>{" "}
                  <Badge
                    variant={
                      firstVariant?.stock === 0 ? "destructive" : "secondary"
                    }
                  >
                    {firstVariant?.stock ?? 0}
                  </Badge>
                </p>
              </div>

              {product.allowBackorder && (
                <div className="mt-3 p-3 border-l-4 border-amber-500 bg-amber-50 rounded text-xs sm:text-sm text-amber-700">
                  🔸 Este producto admite pedidos.{" "}
                  {product.leadTimeLabel
                    ? `Plazo estimado: ${product.leadTimeLabel}`
                    : "Sin plazo definido."}
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        {/* 🔹 Variantes */}
        {grouped.length > 0 && (
          <div>
            <h3 className="mb-4 text-lg sm:text-xl font-semibold flex items-center gap-2">
              <IconBox className="w-5 h-5 text-primary" />
              Variantes disponibles
            </h3>

            {/* Tabs responsivos */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap gap-1 sm:gap-2 bg-muted/30 rounded-lg p-1 sm:p-2 overflow-x-auto max-w-full">
                {grouped.map((g) => (
                  <TabsTrigger
                    key={g.key}
                    value={g.key}
                    className={`py-1 sm:py-2 px-2 sm:px-4 rounded-md border transition-all text-[10px] sm:text-sm whitespace-nowrap ${
                      activeTab === g.key
                        ? "bg-primary border-primary shadow-sm"
                        : "hover:bg-muted"
                    }`}
                  >
                    {g.key}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Contenido de cada grupo */}
              {grouped.map((g) => (
                <TabsContent
                  key={g.key}
                  value={g.key}
                  className="mt-3 sm:mt-5 space-y-4 sm:space-y-6"
                >
                  {/* 🔹 Grilla de variantes */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                    {g.variants.map((v) => (
                      <div
                        key={v.id}
                        className={`relative rounded-lg sm:rounded-xl border bg-card p-2 sm:p-4 shadow-sm hover:shadow-md transition-all ${
                          v.stock === 0
                            ? "opacity-60 border-destructive/60"
                            : "hover:border-primary/70"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center p-1 sm:p-3 gap-0.5 sm:gap-1">
                          {v.color && (
                            <p className="text-xs sm:text-sm font-semibold">{v.color}</p>
                          )}
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {formatCurrencyUSD(v.usd_price)}
                          </p>
                          <p
                            className={`text-[10px] sm:text-xs font-medium ${
                              v.stock === 0
                                ? "text-destructive"
                                : "text-green-600"
                            }`}
                          >
                            Stock: {v.stock}
                          </p>
                        </div>

                        {v.stock === 0 && (
                          <span className="absolute top-1 sm:top-2 right-1 sm:right-2 text-[8px] sm:text-[10px] bg-destructive px-1 sm:px-2 py-0.5 rounded text-white uppercase shadow-sm">
                            SIN STOCK
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 🔹 Métodos de pago */}
                  <div className="text-xs sm:text-sm text-muted-foreground space-y-2 mt-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                      <IconCreditCard className="w-5 h-5 text-purple-600" />
                      Métodos de pago
                    </h3>

                    {enrichedMethods
                      .filter(
                        (m) =>
                          !["efectivo", "transferencia"].includes(
                            m.name.toLowerCase()
                          )
                      )
                      .map((m) => {
                        const basePriceUSD =
                          g.variants[0]?.usd_price || product.usdPrice;
                        return (
                          <div
                            key={m.id}
                            className="border-b pb-1 mb-2 last:border-0"
                          >
                            <p className="font-semibold text-sm text-foreground">
                              {m.name}
                            </p>
                            {m.installments.length > 0 ? (
                              m.installments.map((i) => {
                                const total =
                                  basePriceUSD * fxRate * i.multiplier;
                                const cuota = total / i.installments;
                                const extra = (i.multiplier - 1) * 100;
                                return (
                                  <div
                                    key={i.id}
                                    className="flex flex-col sm:flex-row sm:justify-between gap-1 text-muted-foreground"
                                  >
                                    <span>
                                      {i.installments} cuotas de{" "}
                                      {formatCurrencyARS(cuota)}{" "}
                                      <span className="text-amber-600">
                                        (+{extra.toFixed(1)}%)
                                      </span>
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {formatCurrencyARS(total)}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex justify-between">
                                <span>1 pago sin recargo</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrencyARS(
                                    basePriceUSD * fxRate * m.multiplier
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <Separator className="my-5" />

        {/* 🔹 Cotización actual */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm sm:text-base text-muted-foreground">
          <IconCurrencyDollar className="w-4 h-4 text-green-500" />
          <span>Cotización actual:</span>{" "}
          <span className="font-semibold text-foreground">
            {formatCurrencyARS(fxRate)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
