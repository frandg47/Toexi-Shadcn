import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { supabase } from "@/lib/supabaseClient";
import SalesByChannelChart from "@/components/SalesByChannelChart";
import SectionCardsProducts from "../components/SectionCardsProducts";

const ALERT_WINDOW_DAYS = 5;

const getFixedExpenseDueDate = (expense) => {
  const rawDate = [
    expense?.next_due_date,
    expense?.due_date,
    expense?.expense_date,
    expense?.payment_date,
    expense?.last_paid_at,
    expense?.created_at,
  ].find(Boolean);

  if (!rawDate) return null;

  const dueDate = new Date(rawDate);
  if (Number.isNaN(dueDate.getTime())) return null;

  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
};

const getFixedExpenseLabel = (expense, index) =>
  expense?.name ||
  expense?.title ||
  expense?.category ||
  expense?.description ||
  expense?.notes ||
  `Gasto fijo ${index + 1}`;

const Dashboard = () => {
  const [dueSoonExpenses, setDueSoonExpenses] = useState([]);

  useEffect(() => {
    const fetchDueSoonFixedExpenses = async () => {
      const { data, error } = await supabase.from("expenses").select("*");

      console.log("[Dashboard] fixed_expenses raw response", { data, error });

      if (error) {
        console.error("Error loading fixed_expenses", error);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const limit = new Date(today);
      limit.setDate(limit.getDate() + ALERT_WINDOW_DAYS);

      const upcoming = (data || [])
        .filter((expense) => expense?.is_active !== false)
        .map((expense, index) => {
          const dueDate = getFixedExpenseDueDate(expense);
          console.log("[Dashboard] fixed_expense parsed", {
            expense,
            derivedLabel: getFixedExpenseLabel(expense, index),
            dueDate,
            today,
            limit,
          });
          if (!dueDate) return null;
          if (dueDate < today || dueDate > limit) return null;

          return {
            ...expense,
            dueDate,
            label: getFixedExpenseLabel(expense, index),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.dueDate - b.dueDate);

      console.log("[Dashboard] fixed_expenses due soon", upcoming);
      setDueSoonExpenses(upcoming);
    };

    fetchDueSoonFixedExpenses();
  }, []);

  const highlightedExpenses = useMemo(
    () => dueSoonExpenses.slice(0, 3),
    [dueSoonExpenses]
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-4 ">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:p-6">
          {dueSoonExpenses.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-background to-amber-100 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-500">
              <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between md:px-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-amber-500/15 p-2 text-amber-700">
                    <IconAlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-950">
                      Hay {dueSoonExpenses.length} gasto
                      {dueSoonExpenses.length === 1 ? "" : "s"} fijo
                      {dueSoonExpenses.length === 1 ? "" : "s"} por vencer en{" "}
                      {ALERT_WINDOW_DAYS} dias o menos
                    </p>
                    <p className="text-sm text-amber-900/80">
                      {highlightedExpenses
                        .map(
                          (expense) =>
                            `${expense.label} (${expense.dueDate.toLocaleDateString("es-AR")})`
                        )
                        .join(" - ")}
                      {dueSoonExpenses.length > highlightedExpenses.length
                        ? ` - +${dueSoonExpenses.length - highlightedExpenses.length} mas`
                        : ""}
                    </p>
                  </div>
                </div>

                <Link
                  to="/dashboard/settings/expenses"
                  className="inline-flex items-center gap-1 self-start rounded-full border border-amber-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-white"
                >
                  Ver gastos
                  <IconChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          <div className="">
            <SectionCardsProducts />
          </div>
          <SectionCards />
          <div className="">
            <ChartAreaInteractive />
          </div>
          <div className="">
            <SalesByChannelChart />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
