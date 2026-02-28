import { createClient } from '@/lib/supabase/server'

import Container from './../../components/ui/Container'
import Button from './../../components/ui/Button'
import { Card, CardContent, CardHeader } from './../../components/ui/Card'

function formatEUR(v: any) {
  const n = Number(v ?? 0)
  return `€ ${n.toFixed(2)}`
}

function formatPct(x: number | null) {
  if (x == null || !isFinite(x)) return '—'
  return `${(x * 100).toFixed(1)}%`
}

function toYYYYMM(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, 1)
  return date.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })
}

export default async function TotalDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Carregar categorias + plataformas (para agregações)
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

  // Compras total
  const { data: purchases, error: purchasesError } = await supabase
    .from('items')
    .select('purchase_price')

  // Vendidos total (usamos view enriched para profit + hold)
  const { data: soldAll, error: soldError } = await supabase
    .from('v_items_enriched')
    .select('id,title,purchase_price,sale_price,sale_date,profit,hold_days,status,platform_id,category_id')
    .eq('status', 'VENDIDO')

  // Capital preso global
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price')
    .eq('status', 'EM_STOCK')

  // Vendas por plataforma total (contagem)
  const { data: salesByPlatformRaw, error: platformError } = await supabase
    .from('items')
    .select('platform_id')
    .eq('status', 'VENDIDO')

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
    soldAll?.reduce((acc, s) => acc + Number((s as any).sale_price ?? 0), 0) ?? 0

  const lucro =
    soldAll?.reduce((acc, s) => acc + Number((s as any).profit ?? 0), 0) ?? 0

  const capitalPreso =
    inStock?.reduce((acc, i) => acc + Number((i as any).purchase_price ?? 0), 0) ?? 0

  const holdMedio =
    soldAll && soldAll.length > 0
      ? soldAll.reduce((acc, s) => acc + Number((s as any).hold_days ?? 0), 0) / soldAll.length
      : null

  // Profit margin e ROI
  const profitMargin = totalVendas > 0 ? lucro / totalVendas : null
  const roi = totalCompras > 0 ? lucro / totalCompras : null

  // ✅ Curva all-time (lucro acumulado por mês)
  const profitMonthMap = new Map<string, number>()
  for (const s of soldAll ?? []) {
    const raw = (s as any).sale_date
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const key = toYYYYMM(d)
    const p = Number((s as any).profit ?? 0)
    profitMonthMap.set(key, (profitMonthMap.get(key) ?? 0) + (isFinite(p) ? p : 0))
  }

  const monthsSorted = Array.from(profitMonthMap.entries())
    .map(([month, profit]) => ({ month, label: monthLabel(month), profit }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // cumulativo
  let running = 0
  const cumulative = monthsSorted.map((m) => {
    running += m.profit
    return { ...m, cumulative: running }
  })

  // ✅ Lucro por plataforma (€, não só count)
  const profitByPlatformMap = new Map<string, number>()
  for (const s of soldAll ?? []) {
    const pid = (s as any).platform_id
    const name = pid ? platformMap.get(Number(pid)) ?? 'Sem plataforma' : 'Sem plataforma'
    const p = Number((s as any).profit ?? 0)
    profitByPlatformMap.set(name, (profitByPlatformMap.get(name) ?? 0) + (isFinite(p) ? p : 0))
  }

  const profitByPlatform = Array.from(profitByPlatformMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // ✅ Hold médio por categoria
  const holdByCategoryAcc = new Map<number, { sum: number; count: number }>()
  for (const s of soldAll ?? []) {
    const catId = Number((s as any).category_id)
    const hold = Number((s as any).hold_days ?? 0)
    if (!isFinite(catId) || !isFinite(hold)) continue
    const prev = holdByCategoryAcc.get(catId) ?? { sum: 0, count: 0 }
    holdByCategoryAcc.set(catId, { sum: prev.sum + hold, count: prev.count + 1 })
  }

  const holdByCategory = Array.from(holdByCategoryAcc.entries())
    .map(([category_id, v]) => ({
      name: categoryMap.get(category_id) ?? `Categoria ${category_id}`,
      days: v.count > 0 ? v.sum / v.count : 0,
      count: v.count,
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)

  // ✅ Hold médio por plataforma
  const holdByPlatformAcc = new Map<string, { sum: number; count: number }>()
  for (const s of soldAll ?? []) {
    const pid = (s as any).platform_id
    const name = pid ? platformMap.get(Number(pid)) ?? 'Sem plataforma' : 'Sem plataforma'
    const hold = Number((s as any).hold_days ?? 0)
    if (!isFinite(hold)) continue
    const prev = holdByPlatformAcc.get(name) ?? { sum: 0, count: 0 }
    holdByPlatformAcc.set(name, { sum: prev.sum + hold, count: prev.count + 1 })
  }

  const holdByPlatform = Array.from(holdByPlatformAcc.entries())
    .map(([name, v]) => ({ name, days: v.count > 0 ? v.sum / v.count : 0, count: v.count }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)

  // Agrupar vendas por plataforma (contagem)
  const platformCountsMap = new Map<string, number>()
  for (const row of salesByPlatformRaw ?? []) {
    const pid = (row as any).platform_id
    const name = pid ? platformMap.get(Number(pid)) ?? 'Sem plataforma' : 'Sem plataforma'
    platformCountsMap.set(name, (platformCountsMap.get(name) ?? 0) + 1)
  }
  const salesByPlatformCount = Array.from(platformCountsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Top 10 por lucro (all-time)
  const topSold = [...(soldAll ?? [])]
    .sort((a: any, b: any) => Number(b.profit ?? 0) - Number(a.profit ?? 0))
    .slice(0, 10)

  return (
    <Container>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Global</h1>
          <p className="mt-1 text-sm text-zinc-600">Resumo all-time (desde o início).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button href="/dashboard" variant="ghost">
            Dashboard Mensal
          </Button>
          <Button href="/dashboard/annual" variant="ghost">
            Dashboard Anual
          </Button>
          <Button href="/items" variant="ghost">
            Inventário
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <Kpi title="Compras total" value={formatEUR(totalCompras)} />
        <Kpi title="Vendas total" value={formatEUR(totalVendas)} />
        <Kpi title="Lucro total" value={formatEUR(lucro)} />
        <Kpi title="Profit margin" value={formatPct(profitMargin)} />
        <Kpi title="ROI (lucro/compras)" value={formatPct(roi)} />
        <Kpi title="Capital preso" value={formatEUR(capitalPreso)} />
        <Kpi
          title="Hold médio (vendidos)"
          value={holdMedio == null ? '—' : `${holdMedio.toFixed(1)} dias`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ✅ Lucro por plataforma (€) */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Lucro por plataforma</div>
              <div className="text-xs text-zinc-500">Somatório do lucro por plataforma (all-time)</div>
            </div>
          </CardHeader>
          <CardContent>
            {profitByPlatform.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas ainda.</p>
            ) : (
              <MoneyBarList data={profitByPlatform} />
            )}
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <div className="text-xs font-medium text-zinc-500 mb-2">Extra: nº vendas por plataforma</div>
              {salesByPlatformCount.length === 0 ? (
                <p className="text-sm text-zinc-500">—</p>
              ) : (
                <CountBarList data={salesByPlatformCount} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ✅ Top 10 por lucro */}
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Top vendidos (por lucro)</div>
              <div className="text-xs text-zinc-500">Top 10 itens vendidos all-time</div>
            </div>
          </CardHeader>
          <CardContent>
            {topSold.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas ainda.</p>
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
      </div>

      {/* ✅ Hold médio por categoria / plataforma */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Hold médio por categoria</div>
              <div className="text-xs text-zinc-500">Média de dias (itens vendidos)</div>
            </div>
          </CardHeader>
          <CardContent>
            {holdByCategory.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem dados suficientes.</p>
            ) : (
              <HoldList data={holdByCategory} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Hold médio por plataforma</div>
              <div className="text-xs text-zinc-500">Média de dias (itens vendidos)</div>
            </div>
          </CardHeader>
          <CardContent>
            {holdByPlatform.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem dados suficientes.</p>
            ) : (
              <HoldList data={holdByPlatform} />
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

function CountBarList({ data }: { data: { name: string; count: number }[] }) {
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

function HoldList({ data }: { data: { name: string; days: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.days), 1)
  return (
    <div className="grid gap-3">
      {data.map((d) => {
        const widthPct = (d.days / max) * 100
        return (
          <div key={d.name} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="tabular-nums text-zinc-600">
                {d.days.toFixed(1)} dias <span className="text-zinc-400">({d.count})</span>
              </span>
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

function CumulativeLineChart({
  data,
}: {
  data: { month: string; label: string; profit: number; cumulative: number }[]
}) {
  // SVG simples: polyline (0..100) baseado em cumulative
  const w = 900
  const h = 180
  const padX = 20
  const padY = 20

  const max = Math.max(...data.map((d) => d.cumulative), 1)
  const min = Math.min(...data.map((d) => d.cumulative), 0)
  const span = Math.max(max - min, 1)

  const points = data.map((d, idx) => {
    const x = padX + (idx / Math.max(data.length - 1, 1)) * (w - padX * 2)
    const yNorm = (d.cumulative - min) / span
    const y = h - padY - yNorm * (h - padY * 2)
    return `${x},${y}`
  })

  const last = data[data.length - 1]

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium tabular-nums">
        Atual: {formatEUR(last.cumulative)}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          points={points.join(' ')}
        />
      </svg>

      <div className="text-xs text-zinc-500">
        {data.length} mês(es) • primeiro: {data[0].label} • último: {last.label}
      </div>
    </div>
  )
}