import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, XAxis } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  sales: {
    label: "Ventas",
    color: "var(--primary)",
  },
};

const getStartDate = () => {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return start.toISOString();
};

export default function SalesByChannelChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: sales, error } = await supabase
        .from("sales")
        .select("sales_channel_id, sales_channels(name), sale_date, status")
        .gte("sale_date", getStartDate())
        .neq("status", "anulado");

      if (error) {
        console.error(error);
        return;
      }

      const grouped = new Map();
      (sales || []).forEach((sale) => {
        const channelName = sale.sales_channels?.name || "Sin canal";
        grouped.set(channelName, (grouped.get(channelName) || 0) + 1);
      });

      const rows = Array.from(grouped.entries()).map(([name, count]) => ({
        name,
        sales: count,
      }));

      rows.sort((a, b) => b.sales - a.sales);
      setData(rows);
    };

    load();
  }, []);

  const total = useMemo(
    () => data.reduce((acc, item) => acc + item.sales, 0),
    [data]
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Ventas por canal</CardTitle>
        <CardDescription>
          Ultimos 30 dias · Total {total.toLocaleString("es-AR")}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="sales" fill="var(--color-sales)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
