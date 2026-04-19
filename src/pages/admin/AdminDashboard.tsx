import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Eye, ShoppingCart, Users, TrendingUp, Crown } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid, defs } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const useStats = () =>
  useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const since30 = subDays(new Date(), 30).toISOString();
      const since7 = subDays(new Date(), 7).toISOString();
      const sinceToday = startOfDay(new Date()).toISOString();

      const [paidAll, paid7, paidToday, viewsAll, usersCount, vipCount, recentOrders] = await Promise.all([
        supabase.from("orders").select("amount, created_at, status").eq("status", "paid").gte("created_at", since30),
        supabase.from("orders").select("amount").eq("status", "paid").gte("created_at", since7),
        supabase.from("orders").select("amount").eq("status", "paid").gte("created_at", sinceToday),
        supabase.from("video_views").select("id", { count: "exact", head: true }).gte("created_at", since30),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("vip_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true).gt("expires_at", new Date().toISOString()),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      const sum = (rows: any[] | null) =>
        (rows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);

      const days: { date: string; label: string; revenue: number; orders: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(), i));
        days.push({
          date: d.toISOString(),
          label: format(d, "dd/MM", { locale: ptBR }),
          revenue: 0,
          orders: 0,
        });
      }
      (paidAll.data ?? []).forEach((o: any) => {
        const dayKey = format(startOfDay(new Date(o.created_at)), "dd/MM", { locale: ptBR });
        const slot = days.find((d) => d.label === dayKey);
        if (slot) { slot.revenue += Number(o.amount); slot.orders += 1; }
      });

      return {
        revenue30: sum(paidAll.data),
        revenue7: sum(paid7.data),
        revenueToday: sum(paidToday.data),
        viewsCount: viewsAll.count ?? 0,
        usersCount: usersCount.count ?? 0,
        vipCount: vipCount.count ?? 0,
        days,
        recentOrders: recentOrders.data ?? [],
      };
    },
  });

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const AdminDashboard = () => {
  const { data, isLoading } = useStats();

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const cards = [
    { label: "Hoje", value: fmtBRL(data.revenueToday), icon: DollarSign, tint: "bg-emerald-500/10 text-emerald-600" },
    { label: "7 dias", value: fmtBRL(data.revenue7), icon: TrendingUp, tint: "bg-blue-500/10 text-blue-600" },
    { label: "30 dias", value: fmtBRL(data.revenue30), icon: ShoppingCart, tint: "bg-primary/10 text-primary" },
    { label: "Views 30d", value: fmtCompact(data.viewsCount), icon: Eye, tint: "bg-purple-500/10 text-purple-600" },
    { label: "Usuários", value: fmtCompact(data.usersCount), icon: Users, tint: "bg-orange-500/10 text-orange-600" },
    { label: "VIPs", value: fmtCompact(data.vipCount), icon: Crown, tint: "bg-yellow-500/10 text-yellow-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl font-extrabold md:text-2xl">Dashboard</h1>
        <p className="text-xs text-muted-foreground md:text-sm">Visão geral do seu site</p>
      </div>

      {/* Stat cards — 2 cols on mobile, compact */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-3 shadow-card md:p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.tint}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:text-[11px]">{c.label}</p>
            <p className="mt-0.5 text-base font-extrabold leading-tight md:text-lg">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        {/* Revenue area chart */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Receita (30 dias)</h2>
            <span className="text-xs font-extrabold text-primary">{fmtBRL(data.revenue30)}</span>
          </div>
          <div className="mt-3 h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  formatter={(v: any) => fmtBRL(Number(v))}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders bar chart */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Vendas por dia</h2>
            <span className="text-xs font-extrabold text-primary">
              {data.days.reduce((a, d) => a + d.orders, 0)} pedidos
            </span>
          </div>
          <div className="mt-3 h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
        <h2 className="text-sm font-bold">Pedidos recentes</h2>

        {/* Mobile: card list */}
        <div className="mt-3 space-y-2 md:hidden">
          {data.recentOrders.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">
                  {o.purchase_type === "vip_global" ? "VIP" : "Modelo"} · {fmtBRL(Number(o.amount))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(o.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
          ))}
          {data.recentOrders.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhum pedido ainda.</p>
          )}
        </div>

        {/* Desktop: table */}
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-muted-foreground">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o: any) => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-xs">{format(new Date(o.created_at), "dd/MM HH:mm", { locale: ptBR })}</td>
                  <td className="py-2 pr-3 text-xs">{o.purchase_type === "vip_global" ? "VIP" : "Modelo"}</td>
                  <td className="py-2 pr-3 text-xs font-semibold">{fmtBRL(Number(o.amount))}</td>
                  <td className="py-2"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">Nenhum pedido ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-600",
    pending: "bg-yellow-500/15 text-yellow-700",
    cancelled: "bg-muted text-muted-foreground",
    refunded: "bg-blue-500/15 text-blue-600",
  };
  const labels: Record<string, string> = { paid: "Pago", pending: "Pendente", cancelled: "Cancelado", refunded: "Reembolsado" };
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[status] ?? "bg-muted"}`}>
      {labels[status] ?? status}
    </span>
  );
};

export default AdminDashboard;
