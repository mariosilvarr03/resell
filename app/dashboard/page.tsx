import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

import Container from './../components/ui/Container'
import Button from './../components/ui/Button'
import { Card, CardContent, CardHeader } from './../components/ui/Card'

function startOfMonthFromYYYYMM(yyyymm: string) {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, 1)
}

function endOfMonthFromStart(start: Date) {
  return new Date(start.getFullYear(), start.getMonth() + 1, 1)
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toYYYYMM(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, 1)
  return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function formatEUR(v: any) {
  const n = Number(v ?? 0)
  return `€ ${n.toFixed(2)}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const sp = await searchParams
  const selectedMonth =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : toYYYYMM(new Date())

  const start = startOfMonthFromYYYYMM(selectedMonth)
  const end = endOfMonthFromStart(start)

  const from = toISODate(start)
  const to = toISODate(end)

  // ✅ Compras do mês (por purchase_date)
  const { data: purchases, error: purchasesError } = await supabase
    .from('items')
    .select('id,title,purchase_price,purchase_date,status')
    .gte('purchase_date', from)
    .lt('purchase_date', to)
    .order('purchase_date', { ascending: false })

  // ✅ Vendidos do mês (por sale_date) via view enriched
  const { data: soldThisMonth, error: soldError } = await supabase
    .from('v_items_enriched')
    .select(
      'id,title,purchase_price,purchase_date,sale_price,sale_date,profit,hold_days,status,platform_id'
    )
    .eq('status', 'VENDIDO')
    .gte('sale_date', from)
    .lt('sale_date', to)
    .order('sale_date', { ascending: false })

  // ✅ Capital preso (estado atual)
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price')
    .eq('status', 'EM_STOCK')

  // ✅ Nº vendas por plataforma (no mês)
  const { data: salesByPlatformRaw, error: platformError } = await supabase
    .from('items')
    .select('platform_id, platforms(name)')
    .eq('status', 'VENDIDO')
    .gte('sale_date', from)
    .lt('sale_date', to)

  if (purchasesError || soldError || stockError || platformError) {
    const msg =
      purchasesError?.message ||
      soldError?.message ||
      stockError?.message ||
      platformError?.message

    return (
      <Container>
        <div className="text-rose-700">Erro: {msg}</div>
      </Container>
    )
  }

  const totalComprasMes =
    purchases?.reduce((acc, p) => acc + Number(p.purchase_price ?? 0), 0) ?? 0

  const totalVendasMes =
    soldThisMonth?.reduce((acc, s) => acc + Number(s.sale_price ?? 0), 0) ?? 0

  const lucroMes =
    soldThisMonth?.reduce((acc, s) => acc + Number(s.profit ?? 0), 0) ?? 0

  const capitalPreso =
    inStock?.reduce((acc, i) => acc + Number(i.purchase_price ?? 0), 0) ?? 0

  const holdMedio =
    soldThisMonth && soldThisMonth.length > 0
      ? soldThisMonth.reduce((acc, s) => acc + Number(s.hold_days ?? 0), 0) /
        soldThisMonth.length
      : null

  // Agrupar vendas por plataforma
  const platformCountsMap = new Map<string, number>()
  for (const row of salesByPlatformRaw ?? []) {
    const p: any = (row as any).platforms
    const platformName = Array.isArray(p) ? p?.[0]?.name : p?.name
    const name = platformName ?? 'Sem plataforma'
    platformCountsMap.set(name, (platformCountsMap.get(name) ?? 0) + 1)
  }
  const salesByPlatform = Array.from(platformCountsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Lista meses (últimos 12)
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(toYYYYMM(d))
  }

  return (
    <Container>
      {/* Top header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Mês selecionado: <span className="font-semibold text-zinc-900">{monthLabel(selectedMonth)}</span>{' '}
            <span className="text-zinc-500">({from} → {to})</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthSelect selected={selectedMonth} months={months} />
          <Button href="/items/new">+ Nova Compra</Button>
          <Button href="/items" variant="ghost">
            Ver Inventário
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Compras do mês" value={formatEUR(totalComprasMes)} />
        <Kpi title="Vendas do mês" value={formatEUR(totalVendasMes)} />
        <Kpi title="Lucro do mês" value={formatEUR(lucroMes)} />
        <Kpi title="Capital preso" value={formatEUR(capitalPreso)} />
        <Kpi
          title="Hold médio (vendidos no mês)"
          value={holdMedio == null ? '—' : `${holdMedio.toFixed(1)} dias`}
        />
      </div>

      {/* Lists */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Comprados neste mês</div>
                <div className="text-xs text-zinc-500">{purchases?.length ?? 0} item(s)</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {purchases && purchases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-100">
                      <th className="py-2 text-left font-medium">Produto</th>
                      <th className="py-2 text-left font-medium">Data</th>
                      <th className="py-2 text-right font-medium">Preço</th>
                      <th className="py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="py-3 pr-3 font-medium">{p.title}</td>
                        <td className="py-3 pr-3 text-zinc-700">{p.purchase_date}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{formatEUR(p.purchase_price)}</td>
                        <td className="py-3 pr-3 text-zinc-700">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Sem compras neste mês.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Vendidos neste mês</div>
                <div className="text-xs text-zinc-500">{soldThisMonth?.length ?? 0} item(s)</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {soldThisMonth && soldThisMonth.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-100">
                      <th className="py-2 text-left font-medium">Produto</th>
                      <th className="py-2 text-left font-medium">Venda</th>
                      <th className="py-2 text-right font-medium">Lucro</th>
                      <th className="py-2 text-right font-medium">Hold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldThisMonth.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="py-3 pr-3 font-medium">{s.title}</td>
                        <td className="py-3 pr-3 text-zinc-700">
                          {formatEUR(s.sale_price)} <span className="text-zinc-500">({s.sale_date})</span>
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">{formatEUR(s.profit)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{s.hold_days} dias</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Sem vendas neste mês.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <div className="mt-5">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Vendas por plataforma</div>
              <div className="text-xs text-zinc-500">Nº de vendas no mês por plataforma</div>
            </div>
          </CardHeader>
          <CardContent>
            {salesByPlatform.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas neste mês.</p>
            ) : (
              <BarChart data={salesByPlatform} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shortcuts */}
      <div className="mt-6">
        <div className="text-sm font-semibold">Atalhos</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button href="/items" variant="ghost">Inventário</Button>
          <Button href="/items/new" variant="ghost">Adicionar compra</Button>
        </div>
      </div>
    </Container>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-xs font-medium text-zinc-500">{title}</div>
        <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function MonthSelect({ selected, months }: { selected: string; months: string[] }) {
  return (
    <form method="get" action="/dashboard" className="flex items-center gap-2">
      <select
        name="month"
        defaultValue={selected}
        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost">Aplicar</Button>
    </form>
  )
}

function BarChart({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count))

  return (
    <div className="grid gap-3">
      {data.map((d) => {
        const widthPct = max === 0 ? 0 : (d.count / max) * 100
        return (
          <div key={d.name} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-zinc-600">{d.count}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div
                className="h-2 rounded-full bg-zinc-900"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}