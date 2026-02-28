import { createClient } from '@/lib/supabase/server'

import Container from './../../components/ui/Container'
import Button from './../../components/ui/Button'
import { Card, CardContent, CardHeader } from './../../components/ui/Card'

function formatEUR(v: any) {
  const n = Number(v ?? 0)
  return `€ ${n.toFixed(2)}`
}

function yearLabel(y: number) {
  return String(y)
}

function monthShortLabel(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1)
  return d.toLocaleDateString('pt-PT', { month: 'short' })
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default async function AnnualDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const sp = await searchParams
  const currentYear = new Date().getFullYear()
  const selectedYear =
    sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : currentYear

  const from = `${selectedYear}-01-01`
  const to = `${selectedYear + 1}-01-01`

  // Carregar categorias + plataformas (para labels e agregações)
  const [{ data: categories, error: catError }, { data: platforms, error: platError }] =
    await Promise.all([
      supabase.from('categories').select('id,name').order('name'),
      supabase.from('platforms').select('id,name').order('name'),
    ])

  if (catError || platError) {
    return (
      <Container>
        <div className="text-rose-700">
          Erro: {catError?.message || platError?.message}
        </div>
      </Container>
    )
  }

  const categoryMap = new Map<number, string>((categories ?? []).map((c) => [Number(c.id), c.name]))
  const platformMap = new Map<number, string>((platforms ?? []).map((p) => [Number(p.id), p.name]))

  // Compras do ano (para totals e sell-through)
  const { data: purchases, error: purchasesError } = await supabase
    .from('items')
    .select('purchase_price,purchase_date,category_id')
    .gte('purchase_date', from)
    .lt('purchase_date', to)

  // Vendidos do ano (sale_date) via view enriched (profit + hold)
  const { data: soldYear, error: soldError } = await supabase
    .from('v_items_enriched')
    .select('id,title,purchase_price,sale_price,sale_date,profit,hold_days,status,platform_id,category_id')
    .eq('status', 'VENDIDO')
    .gte('sale_date', from)
    .lt('sale_date', to)
    .order('sale_date', { ascending: false })

  // Capital preso global (estado atual)
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price,category_id')
    .eq('status', 'EM_STOCK')

  // Vendas por plataforma no ano (contagem)
  const { data: salesByPlatformRaw, error: platformError } = await supabase
    .from('items')
    .select('platform_id, sale_date')
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

  const totalCompras =
    purchases?.reduce((acc, p) => acc + Number((p as any).purchase_price ?? 0), 0) ?? 0

  const totalVendas =
    soldYear?.reduce((acc, s) => acc + Number((s as any).sale_price ?? 0), 0) ?? 0

  const lucro =
    soldYear?.reduce((acc, s) => acc + Number((s as any).profit ?? 0), 0) ?? 0

  const capitalPreso =
    inStock?.reduce((acc, i) => acc + Number((i as any).purchase_price ?? 0), 0) ?? 0

  const holdMedio =
    soldYear && soldYear.length > 0
      ? soldYear.reduce((acc, s) => acc + Number((s as any).hold_days ?? 0), 0) / soldYear.length
      : null

  // ✅ Lucro por mês (12 barras)
  const profitByMonth = Array.from({ length: 12 }, (_, i) => ({
    monthIndex0: i,
    label: monthShortLabel(selectedYear, i),
    profit: 0,
  }))

  for (const s of soldYear ?? []) {
    const saleDateRaw = (s as any).sale_date
    if (!saleDateRaw) continue
    const d = new Date(saleDateRaw)
    if (Number.isNaN(d.getTime())) continue
    const m = d.getMonth()
    const profit = Number((s as any).profit ?? 0)
    profitByMonth[m].profit += Number.isFinite(profit) ? profit : 0
  }

  // ✅ Best / Worst month (por lucro)
  const bestMonth = [...profitByMonth].sort((a, b) => b.profit - a.profit)[0]
  const worstMonth = [...profitByMonth].sort((a, b) => a.profit - b.profit)[0]

  // ✅ Sell-through rate por mês = vendidos_no_mes / comprados_no_mes
  const purchasesCountByMonth = Array.from({ length: 12 }, () => 0)
  for (const p of purchases ?? []) {
    const raw = (p as any).purchase_date
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    purchasesCountByMonth[d.getMonth()] += 1
  }

  const soldCountByMonth = Array.from({ length: 12 }, () => 0)
  for (const s of soldYear ?? []) {
    const raw = (s as any).sale_date
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    soldCountByMonth[d.getMonth()] += 1
  }

  const sellThroughByMonth = Array.from({ length: 12 }, (_, i) => {
    const bought = purchasesCountByMonth[i]
    const sold = soldCountByMonth[i]
    const rate = bought > 0 ? sold / bought : 0
    return {
      monthIndex0: i,
      label: monthShortLabel(selectedYear, i),
      sold,
      bought,
      rate,
    }
  })

  // ✅ Lucro por categoria (Top 5 + Outros)
  const profitByCategoryMap = new Map<number, number>()
  for (const s of soldYear ?? []) {
    const catId = Number((s as any).category_id)
    const profit = Number((s as any).profit ?? 0)
    if (!Number.isFinite(catId)) continue
    profitByCategoryMap.set(catId, (profitByCategoryMap.get(catId) ?? 0) + (Number.isFinite(profit) ? profit : 0))
  }

  const profitByCategoryAll = Array.from(profitByCategoryMap.entries())
    .map(([category_id, profit]) => ({
      category_id,
      name: categoryMap.get(category_id) ?? `Categoria ${category_id}`,
      profit,
    }))
    .sort((a, b) => b.profit - a.profit)

  const top5 = profitByCategoryAll.slice(0, 5)
  const othersSum = profitByCategoryAll.slice(5).reduce((acc, x) => acc + x.profit, 0)

  const profitByCategoryTop = othersSum !== 0
    ? [...top5, { category_id: -1, name: 'Outros', profit: othersSum }]
    : top5

  // ✅ Capital preso por categoria (EM_STOCK)
  const capitalByCategoryMap = new Map<number, number>()
  for (const row of inStock ?? []) {
    const catId = Number((row as any).category_id)
    const price = Number((row as any).purchase_price ?? 0)
    if (!Number.isFinite(catId)) continue
    capitalByCategoryMap.set(catId, (capitalByCategoryMap.get(catId) ?? 0) + (Number.isFinite(price) ? price : 0))
  }

  const capitalByCategory = Array.from(capitalByCategoryMap.entries())
    .map(([category_id, amount]) => ({
      category_id,
      name: categoryMap.get(category_id) ?? `Categoria ${category_id}`,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  // Vendas por plataforma (contagem)
  const platformCountsMap = new Map<string, number>()
  for (const row of salesByPlatformRaw ?? []) {
    const pid = (row as any).platform_id
    const name = pid ? platformMap.get(Number(pid)) ?? 'Sem plataforma' : 'Sem plataforma'
    platformCountsMap.set(name, (platformCountsMap.get(name) ?? 0) + 1)
  }
  const salesByPlatform = Array.from(platformCountsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // anos para dropdown (últimos 5)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Top 10 vendidos por lucro
  const topSold = [...(soldYear ?? [])]
    .sort((a: any, b: any) => Number(b.profit ?? 0) - Number(a.profit ?? 0))
    .slice(0, 10)

  // ✅ Top 10 por ROI (profit / purchase_price)
  const topROI = [...(soldYear ?? [])]
    .map((s: any) => {
      const purchase = Number(s.purchase_price ?? 0)
      const profit = Number(s.profit ?? 0)
      const roi = purchase > 0 ? profit / purchase : null
      return { ...s, roi }
    })
    .filter((s: any) => s.roi != null && isFinite(s.roi))
    .sort((a: any, b: any) => Number(b.roi) - Number(a.roi))
    .slice(0, 10)

  return (
    <Container>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Anual</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Ano selecionado:{' '}
            <span className="font-semibold text-zinc-900">{yearLabel(selectedYear)}</span>
            <span className="text-zinc-500"> ({from} → {to})</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <YearSelect selected={selectedYear} years={years} />
          <Button href="/dashboard" variant="ghost">
            Dashboard Mensal
          </Button>
          <Button href="/dashboard/total" variant="ghost">
            Dashboard Global
          </Button>
          <Button href="/items" variant="ghost">
            Inventário
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Compras no ano" value={formatEUR(totalCompras)} />
        <Kpi title="Vendas no ano" value={formatEUR(totalVendas)} />
        <Kpi title="Lucro no ano" value={formatEUR(lucro)} />
        <Kpi title="Capital preso" value={formatEUR(capitalPreso)} />
        <Kpi
          title="Hold médio (vendidos no ano)"
          value={holdMedio == null ? '—' : `${holdMedio.toFixed(1)} dias`}
        />
      </div>

      {/* ✅ Best / Worst month */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Kpi
          title="Melhor mês (lucro)"
          value={`${bestMonth.label} — ${formatEUR(bestMonth.profit)}`}
        />
        <Kpi
          title="Pior mês (lucro)"
          value={`${worstMonth.label} — ${formatEUR(worstMonth.profit)}`}
        />
      </div>

      {/* ✅ Lucro por mês */}
      <div className="mt-5">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Lucro por mês</div>
              <div className="text-xs text-zinc-500">Soma do lucro dos itens vendidos em cada mês</div>
            </div>
          </CardHeader>
          <CardContent>
            <ProfitByMonthChart data={profitByMonth} />
          </CardContent>
        </Card>
      </div>

      {/* ✅ Sell-through + Lucro por categoria */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Sell-through rate (por mês)</div>
              <div className="text-xs text-zinc-500">Vendidos / Comprados em cada mês</div>
            </div>
          </CardHeader>
          <CardContent>
            <SellThroughChart data={sellThroughByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Lucro por categoria</div>
              <div className="text-xs text-zinc-500">Top 5 + Outros (no ano)</div>
            </div>
          </CardHeader>
          <CardContent>
            {profitByCategoryTop.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas neste ano.</p>
            ) : (
              <MoneyBarList data={profitByCategoryTop.map((x) => ({ name: x.name, value: x.profit }))} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ Capital preso por categoria + Vendas por plataforma */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Capital preso por categoria</div>
              <div className="text-xs text-zinc-500">Somatório de EM_STOCK (top 8)</div>
            </div>
          </CardHeader>
          <CardContent>
            {capitalByCategory.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem itens em stock.</p>
            ) : (
              <MoneyBarList data={capitalByCategory.map((x) => ({ name: x.name, value: x.amount }))} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Vendas por plataforma</div>
              <div className="text-xs text-zinc-500">Nº de vendas no ano por plataforma</div>
            </div>
          </CardHeader>
          <CardContent>
            {salesByPlatform.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas neste ano.</p>
            ) : (
              <BarChart data={salesByPlatform} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ Top lucro + Top ROI */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Top vendidos (por lucro)</div>
              <div className="text-xs text-zinc-500">Top 10 itens vendidos neste ano</div>
            </div>
          </CardHeader>
          <CardContent>
            {topSold.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas neste ano.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-100">
                      <th className="py-2 text-left font-medium">Produto</th>
                      <th className="py-2 text-left font-medium">Data</th>
                      <th className="py-2 text-right font-medium">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSold.map((s: any) => (
                      <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="py-3 pr-3 font-medium">{s.title}</td>
                        <td className="py-3 pr-3 text-zinc-700">{s.sale_date}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{formatEUR(s.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Top vendidos (por ROI)</div>
              <div className="text-xs text-zinc-500">ROI = lucro / compra (top 10 no ano)</div>
            </div>
          </CardHeader>
          <CardContent>
            {topROI.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas com ROI calculável.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-100">
                      <th className="py-2 text-left font-medium">Produto</th>
                      <th className="py-2 text-right font-medium">Compra</th>
                      <th className="py-2 text-right font-medium">Lucro</th>
                      <th className="py-2 text-right font-medium">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topROI.map((s: any) => (
                      <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="py-3 pr-3 font-medium">{s.title}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{formatEUR(s.purchase_price)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{formatEUR(s.profit)}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{(Number(s.roi) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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

function YearSelect({ selected, years }: { selected: number; years: number[] }) {
  return (
    <form method="get" action="/dashboard/annual" className="flex items-center gap-2">
      <select
        name="year"
        defaultValue={String(selected)}
        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {yearLabel(y)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost">
        Aplicar
      </Button>
    </form>
  )
}

function BarChart({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="grid gap-3">
      {data.map((d) => {
        const widthPct = (d.count / max) * 100
        return (
          <div key={d.name} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-zinc-600">{d.count}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MoneyBarList({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="grid gap-3">
      {data.map((d) => {
        const widthPct = (d.value / max) * 100
        return (
          <div key={d.name} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-zinc-600">{formatEUR(d.value)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SellThroughChart({
  data,
}: {
  data: { label: string; rate: number; sold: number; bought: number; monthIndex0: number }[]
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-12 items-end gap-2">
        {data.map((d) => {
          const pct = clamp(d.rate, 0, 1) * 100
          return (
            <div key={d.monthIndex0} className="flex flex-col items-center gap-2">
              <div
                className="text-[11px] font-medium tabular-nums text-zinc-700"
                title={`${d.label}: ${d.sold} vendidos / ${d.bought} comprados`}
              >
                {d.bought > 0 ? `${(d.rate * 100).toFixed(0)}%` : '—'}
              </div>
              <div className="flex h-24 w-full items-end justify-center">
                <div className="h-24 w-full rounded-lg bg-zinc-100">
                  <div
                    className="w-full rounded-lg bg-zinc-900"
                    style={{ height: `${pct}%` }}
                    title={`${d.label}: ${d.sold} vendidos / ${d.bought} comprados`}
                  />
                </div>
              </div>
              <div className="text-[11px] text-zinc-600">{d.label}</div>
            </div>
          )
        })}
      </div>
      <div className="text-xs text-zinc-500">
        Dica: passa o rato nas barras para ver vendidos/comprados.
      </div>
    </div>
  )
}

function ProfitByMonthChart({
  data,
}: {
  data: { label: string; profit: number; monthIndex0: number }[]
}) {
  const max = Math.max(...data.map((d) => d.profit))
  const min = Math.min(...data.map((d) => d.profit))
  const scale = Math.max(Math.abs(max), Math.abs(min), 1)

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-12 items-end gap-3">
        {data.map((d) => {
          const pct = (Math.abs(d.profit) / scale) * 100
          const isNeg = d.profit < 0

          return (
            <div key={d.monthIndex0} className="flex flex-col items-center justify-end gap-2">
              <div className="text-[11px] font-medium tabular-nums text-zinc-700">
                {d.profit !== 0 ? formatEUR(d.profit) : ''}
              </div>

              <div className="relative h-32 w-full flex items-end justify-center">
                <div
                  className={`w-5 rounded-full ${isNeg ? 'bg-rose-500' : 'bg-zinc-900'}`}
                  style={{ height: `${pct}%` }}
                  title={`${d.label}: ${formatEUR(d.profit)}`}
                />
              </div>

              <div className="text-[11px] text-zinc-600">{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}