import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/lib/supabaseClient";

const chartConfig = {
  sales: {
    label: "Cantidad de ventas",
    color: "var(--primary)",
  },
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-");
    if (year && month && day) {
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const fallback = new Date(value);
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate()
  );
};

const buildDailySeries = (startDate, endDate, totalsByDate) => {
  const result = [];
  const cursor = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  while (cursor <= end) {
    const key = toDateKey(cursor);
    result.push({
      date: key,
      sales: totalsByDate.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");
  const [chartData, setChartData] = React.useState([]);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  React.useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      const startKey = toDateKey(start);

      const { data, error } = await supabase
        .from("sales")
        .select("sale_date, status")
        .gte("sale_date", startKey)
        .neq("status", "anulado")
        .order("sale_date", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      const totals = new Map();
      (data || []).forEach((sale) => {
        const key = toDateKey(parseDateKey(sale.sale_date));
        const next = (totals.get(key) ?? 0) + 1;
        totals.set(key, next);
      });

      setChartData(buildDailySeries(start, now, totals));
    };

    load();
  }, []);

  const filteredData = React.useMemo(() => {
    if (!chartData.length) return [];
    const now = new Date();
    const days = timeRange === "30d" ? 30 : timeRange === "7d" ? 7 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startKey = parseDateKey(startDate);
    return chartData.filter((item) => parseDateKey(item.date) >= startKey);
  }, [chartData, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Ventas por dia</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total en los ultimos {timeRange === "90d" ? "3 meses" : timeRange === "30d" ? "30 dias" : "7 dias"}
          </span>
          <span className="@[540px]/card:hidden">Ultimos 3 meses</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Ultimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Ultimos 30 dias</ToggleGroupItem>
            <ToggleGroupItem value="7d">Ultimos 7 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Seleccionar rango"
            >
              <SelectValue placeholder="Ultimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Ultimos 3 meses
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Ultimos 30 dias
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Ultimos 7 dias
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = parseDateKey(value);
                return date.toLocaleDateString("es-AR", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return parseDateKey(value).toLocaleDateString("es-AR", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="sales"
              type="monotone"
              fill="url(#fillSales)"
              stroke="var(--color-sales)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
