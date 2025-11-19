"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { BarChart, Bar, XAxis, YAxis } from "recharts";

// MEDALLAS
const medals = ["🥇", "🥈", "🥉"];

export default function SellersTop() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc("get_top_sellers");
      if (error) return console.error(error);

      // Ordenar por ventas DESC
      const sorted = [...data].sort((a, b) => b.total_sales - a.total_sales);

      // Agregar avatar + medalla
      const formatted = sorted.map((s, i) => ({
        ...s,
        medal: medals[i] || "",
        fill: `var(--chart-${(i % 5) + 1})`,
      }));

      setData(formatted);
    };

    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de vendedores</CardTitle>
        <CardDescription>Ventas completadas por vendedor</CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <ChartContainer config={{}}>
          <BarChart
            data={data}
            layout="vertical"
            barSize={28} // altura exacta de cada barra
            margin={{ top: 10, right: 20, bottom: 10, left: 120 }} // importante
          >
            {/* EJE Y CUSTOM */}
            <YAxis
              dataKey="seller_name"
              type="category"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload, index }) => {
                const item = data[index];
                return (
                  <g transform={`translate(${x - 110}, ${y - 8})`}>
                    {/* Avatar */}
                    <image
                      href={item.avatar_url}
                      x={0}
                      y={0}
                      width={24}
                      height={24}
                      clipPath="inset(0 round 50%)"
                    />

                    {/* Texto */}
                    <text x={32} y={16} fontSize={13} fill="#333">
                      {item.medal} {item.seller_name}
                    </text>
                  </g>
                );
              }}
            />

            <XAxis type="number" hide />

            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

            {/* barra */}
            <Bar dataKey="total_sales" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
