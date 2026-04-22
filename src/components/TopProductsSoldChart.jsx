import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  quantity: {
    label: "Unidades",
    color: "var(--primary)",
  },
};

const getStartDate = () => {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return start.toISOString();
};

const trimProductName = (name) => {
  if (!name) return "Producto";
  return name.length > 20 ? `${name.slice(0, 20)}...` : name;
};

const getProductImage = (item, imageByVariantId) =>
  imageByVariantId.get(item.variant_id) || "/toexi.jpg";

const getVariantProduct = (variant) =>
  Array.isArray(variant?.products) ? variant.products[0] : variant?.products;

export default function TopProductsSoldChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: items, error } = await supabase
        .from("sale_items")
        .select(
          "product_name, quantity, variant_id, sales!inner(sale_date, status, voided_at)"
        )
        .gte("sales.sale_date", getStartDate())
        .eq("sales.status", "vendido")
        .is("sales.voided_at", null);

      if (error) {
        console.error(error);
        return;
      }

      const variantIds = Array.from(
        new Set((items || []).map((item) => item.variant_id).filter(Boolean))
      );
      const imageByVariantId = new Map();

      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("id, image_url, products(cover_image_url)")
          .in("id", variantIds);

        if (variantsError) {
          console.error("[TopProductsSoldChart] variants error", variantsError);
        } else {
          (variants || []).forEach((variant) => {
            const product = getVariantProduct(variant);
            imageByVariantId.set(
              variant.id,
              product?.cover_image_url || variant.image_url || ""
            );
          });
        }
      }

      const grouped = new Map();
      (items || []).forEach((item) => {
        const productName = item.product_name || "Producto";
        const current = grouped.get(productName) || {
          name: productName,
          imageUrl: getProductImage(item, imageByVariantId),
          quantity: 0,
        };

        grouped.set(productName, {
          ...current,
          imageUrl: current.imageUrl || getProductImage(item, imageByVariantId),
          quantity: current.quantity + Number(item.quantity || 0),
        });
      });

      const rows = Array.from(grouped.values())
        .map((item) => ({
          ...item,
          shortName: trimProductName(item.name),
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setData(rows);
    };

    load();
  }, []);

  const total = useMemo(
    () => data.reduce((acc, item) => acc + item.quantity, 0),
    [data]
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Top 5 productos vendidos</CardTitle>
        <CardDescription>
          Ultimos 30 dias · Total {total.toLocaleString("es-AR")} unidades
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="flex h-[260px] gap-3">
          <div className="flex w-44 shrink-0 flex-col justify-around py-2">
            {data.map((item) => (
              <div key={item.name} className="flex min-w-0 items-center gap-2">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-9 w-9 shrink-0 rounded-md border bg-muted object-cover"
                  onError={(event) => {
                    event.currentTarget.src = "/toexi.jpg";
                  }}
                />
                <span className="truncate text-xs font-medium text-foreground">
                  {item.shortName}
                </span>
              </div>
            ))}
          </div>

          <ChartContainer config={chartConfig} className="aspect-auto h-full min-w-0 flex-1">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="shortName" type="category" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, _name, item) => (
                      <>
                        <span className="text-muted-foreground">
                          {item?.payload?.name || "Producto"}:
                        </span>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {Number(value || 0).toLocaleString("es-AR")} unidades
                        </span>
                      </>
                    )}
                  />
                }
              />
              <Bar dataKey="quantity" fill="var(--color-quantity)" radius={6} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
