import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { useAuth } from "@/context/AuthContextProvider";
import { supabase } from "@/lib/supabaseClient";
import SalesByChannelChart from "@/components/SalesByChannelChart";
import TopProductsSoldChart from "@/components/TopProductsSoldChart";
import SectionCardsProducts from "../components/SectionCardsProducts";

const ALERT_WINDOW_DAYS = 5;

const addInterval = (dateValue, amount, unit) => {
  if (!dateValue || !amount) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const value = Number(amount);
  if (!value) return null;

  if (unit === "weeks") {
    date.setDate(date.getDate() + value * 7);
    return date;
  }

  if (unit === "months") {
    date.setMonth(date.getMonth() + value);
    return date;
  }

  date.setDate(date.getDate() + value);
  return date;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getFixedExpenseDueDate = (expense) => {
  const anchorDate = normalizeDate(
    expense?.next_due_date || expense?.due_date || expense?.expense_date
  );
  if (!anchorDate) return null;

  if (!expense?.frequency_value || !expense?.frequency_unit) {
    return anchorDate;
  }

  const paidAt = normalizeDate(expense?.last_paid_at);
  if (!paidAt) {
    return anchorDate;
  }

  let dueDate = new Date(anchorDate);
  let guard = 0;

  while (dueDate <= paidAt && guard < 500) {
    const nextDueDate = addInterval(
      dueDate,
      expense.frequency_value,
      expense.frequency_unit
    );

    if (!nextDueDate) break;

    dueDate = normalizeDate(nextDueDate);
    guard += 1;
  }

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
  const { role } = useAuth();
  const isOwner = role?.toLowerCase() === "owner";
  const [dueSoonExpenses, setDueSoonExpenses] = useState([]);

  useEffect(() => {
    if (!isOwner) {
      setDueSoonExpenses([]);
      return;
    }

    const fetchDueSoonFixedExpenses = async () => {
      const { data, error } = await supabase.from("expenses").select("*");

      if (error) {
        console.error("Error loading fixed_expenses", error);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const limit = new Date(today);
      limit.setDate(limit.getDate() + ALERT_WINDOW_DAYS);

      const upcoming = (data || [])
        .filter(
          (expense) => expense?.is_active !== false && expense?.type === "fixed"
        )
        .map((expense, index) => {
          const dueDate = getFixedExpenseDueDate(expense);
          if (!dueDate) return null;
          if (dueDate > limit) return null;

          return {
            ...expense,
            dueDate,
            label: getFixedExpenseLabel(expense, index),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.dueDate - b.dueDate);

      setDueSoonExpenses(upcoming);
    };

    fetchDueSoonFixedExpenses();
  }, [isOwner]);

  const highlightedExpenses = useMemo(
    () => dueSoonExpenses.slice(0, 3),
    [dueSoonExpenses]
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-4 ">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:p-6">
          {isOwner && dueSoonExpenses.length > 0 && (
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
                      {dueSoonExpenses.length === 1 ? "" : "s"} vencido
                      {dueSoonExpenses.length === 1 ? "" : "s"} o por vencer en{" "}
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
                  to="/dashboard/expenses"
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
          <div className="grid gap-4 lg:grid-cols-2">
            <SalesByChannelChart />
            <TopProductsSoldChart />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
