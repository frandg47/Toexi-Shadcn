import { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconHomeDollar, IconDatabase } from "@tabler/icons-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function SectionCardsProducts() {
  const COLORS = [
    "#FFB74D", // naranja medio claro
    "#FFA726", // naranja brillante estándar
    "#FB8C00", // naranja intenso
    "#F57C00", // naranja oscuro
    "#EF6C00", // naranja tostado
    "#E65100", // naranja quemado
    "#D84315", // naranja rojizo
    "#FFE0B2", // naranja muy claro (suave, para áreas grandes)
    "#BF360C", // naranja profundo
    "#A23E12", // terracota oscuro (buen contraste con blanco)
  ];

  const [fxRate, setFxRate] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [rateDiff, setRateDiff] = useState(null);
  const [categoriesData, setCategoriesData] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalStock, setTotalStock] = useState(0); // 🟢 nuevo estado
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1️⃣ Obtener la cotización activa
      const { data: fxActive, error: fxActiveError } = await supabase
        .from("fx_rates")
        .select("id, source, rate, is_active, created_at")
        .eq("is_active", true)
        .limit(1);

      if (fxActiveError) throw fxActiveError;
      if (!fxActive || fxActive.length === 0) {
        toast.info("No hay cotización activa.");
        setLoading(false);
        return;
      }

      const active = fxActive[0];
      setFxRate(Number(active.rate));
      setLastUpdate(new Date(active.created_at));

      // 2️⃣ Buscar la cotización anterior del mismo source
      const { data: fxPrev, error: fxPrevError } = await supabase
        .from("fx_rates")
        .select("id, source, rate, is_active, created_at")
        .eq("source", active.source)
        .eq("is_active", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fxPrevError) throw fxPrevError;

      if (fxPrev?.length > 0) {
        const prev = fxPrev[0];
        const diff =
          ((Number(active.rate) - Number(prev.rate)) / Number(prev.rate)) * 100;
        setRateDiff(diff);
      } else {
        setRateDiff(null);
      }

      // 3️⃣ Traer categorías
      const { data: categories, error: catError } = await supabase
        .from("categories")
        .select("id, name");
      if (catError) throw catError;

      // 4️⃣ Traer productos con variantes
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select(
          `
        id,
        category_id,
        usd_price,
        product_variants (id, stock)
      `
        );
      if (prodError) throw prodError;

      // 5️⃣ Calcular cantidad de productos por categoría
      const counts = categories.map((cat) => {
        const productsInCat = products.filter((p) => p.category_id === cat.id);
        const totalVariants = productsInCat.reduce((sum, p) => {
          const variants = p.product_variants || [];
          return sum + (variants.length > 0 ? variants.length : 1);
        }, 0);
        return { name: cat.name, value: totalVariants };
      });

      setCategoriesData(counts);
      setTotalProducts(counts.reduce((sum, c) => sum + (c.value || 0), 0));

      // 6️⃣ Calcular el total de stock de todas las variantes
      const { data: stockResult, error: stockError } = await supabase
        .from("product_variants")
        .select("stock", { count: "exact" });

      if (stockError) throw stockError;

      // Supabase no hace SUM directamente, así que sumamos manualmente:
      const stockSum = stockResult?.reduce(
        (acc, item) => acc + (item.stock || 0),
        0
      );
      setTotalStock(stockSum || 0);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar datos", {
        description:
          err.message ||
          "Ocurrió un error al cargar la información del dashboard.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const getRateBadge = () => {
    if (rateDiff === null) return null;
    const diffAbs = Math.abs(rateDiff).toFixed(2);
    if (rateDiff > 0)
      return (
        <Badge variant="outline" className="text-green-600">
          ▲ +{diffAbs}%
        </Badge>
      );
    if (rateDiff < 0)
      return (
        <Badge variant="outline" className="text-red-600">
          ▼ {diffAbs}%
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-gray-600">
        = 0%
      </Badge>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
      {/* 🔹 Columna izquierda */}
      <div className="flex flex-col gap-4">
        {/* Card 1: Cotización */}
        <Card className="flex-1 flex flex-col justify-between relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <IconHomeDollar className="text-green-500" />
              Cotización actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-3">
              {fxRate ? `$${fxRate.toLocaleString("es-AR")}` : "Cargando..."}
              {getRateBadge()}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">USD → ARS</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Última actualización: {formatDate(lastUpdate)}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          {/* Card 2: Total de productos */}
          <Card className="flex-1 flex flex-col justify-between relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <IconDatabase className="text-blue-500" />
                Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "Cargando..." : totalProducts}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Unidades ofrecidas en tienda
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Incluye todas las variantes de los productos
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Total de stock */}
          <Card className="flex-1 flex flex-col justify-between relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <IconDatabase className="text-amber-500" />
                Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? "Cargando..." : totalStock}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Unidades disponibles en tienda
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Suma total de todas las distintas variantes
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 🔹 Columna derecha (gráfico) */}
      <Card className="flex flex-col justify-center">
        <CardHeader>
          <CardTitle>Distribución por categoría</CardTitle>
          <CardDescription>Cantidad de productos por categoría</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center flex-1">
          {loading ? (
            <p className="text-muted-foreground">Cargando gráfico...</p>
          ) : (
            <div className="w-full pb-3 h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriesData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius="80%"
                    label
                  >
                    {categoriesData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
