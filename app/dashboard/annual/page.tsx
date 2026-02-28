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

  // Compras do ano
  const { data: purchases, error: purchasesError } = await supabase
    .from('items')
    .select('id,title,purchase_price,purchase_date,status')
    .gte('purchase_date', from)
    .lt('purchase_date', to)

  // Vendidos do ano (sale_date) via view enriched
  const { data: soldYear, error: soldError } = await supabase
    .from('v_items_enriched')
    .select('id,title,sale_price,sale_date,profit,hold_days,status,platform_id')
    .eq('status', 'VENDIDO')
    .gte('sale_date', from)
    .lt('sale_date', to)
    .order('sale_date', { ascending: false })

  // Capital preso global (estado atual)
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price')
    .eq('status', 'EM_STOCK')

  // Vendas por plataforma no ano
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

  const totalCompras =
    purchases?.reduce((acc, p) => acc + Number(p.purchase_price ?? 0), 0) ?? 0

  const totalVendas =
    soldYear?.reduce((acc, s) => acc + Number(s.sale_price ?? 0), 0) ?? 0

  const lucro =
    soldYear?.reduce((acc, s) => acc + Number(s.profit ?? 0), 0) ?? 0

  const capitalPreso =
    inStock?.reduce((acc, i) => acc + Number(i.purchase_price ?? 0), 0) ?? 0

  const holdMedio =
    soldYear && soldYear.length > 0
      ? soldYear.reduce((acc, s) => acc + Number(s.hold_days ?? 0), 0) /
        soldYear.length
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

  // anos para dropdown (últimos 5)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Top 10 vendidos por lucro
  const topSold = [...(soldYear ?? [])]
    .sort((a: any, b: any) => Number(b.profit ?? 0) - Number(a.profit ?? 0))
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

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}