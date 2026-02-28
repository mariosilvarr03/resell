import { createClient } from '@/lib/supabase/server'

import Container from './../../components/ui/Container'
import Button from './../../components/ui/Button'
import { Card, CardContent, CardHeader } from './../../components/ui/Card'

function formatEUR(v: any) {
  const n = Number(v ?? 0)
  return `€ ${n.toFixed(2)}`
}

export default async function TotalDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Compras total
  const { data: purchases, error: purchasesError } = await supabase
    .from('items')
    .select('purchase_price')

  // Vendidos total
  const { data: soldAll, error: soldError } = await supabase
    .from('v_items_enriched')
    .select('id,title,sale_price,sale_date,profit,hold_days,status,platform_id')
    .eq('status', 'VENDIDO')

  // Capital preso global
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price')
    .eq('status', 'EM_STOCK')

  // Vendas por plataforma total
  const { data: salesByPlatformRaw, error: platformError } = await supabase
    .from('items')
    .select('platform_id, platforms(name)')
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
    purchases?.reduce((acc, p) => acc + Number(p.purchase_price ?? 0), 0) ?? 0

  const totalVendas =
    soldAll?.reduce((acc, s) => acc + Number(s.sale_price ?? 0), 0) ?? 0

  const lucro =
    soldAll?.reduce((acc, s) => acc + Number(s.profit ?? 0), 0) ?? 0

  const capitalPreso =
    inStock?.reduce((acc, i) => acc + Number(i.purchase_price ?? 0), 0) ?? 0

  const holdMedio =
    soldAll && soldAll.length > 0
      ? soldAll.reduce((acc, s) => acc + Number(s.hold_days ?? 0), 0) /
        soldAll.length
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

  // Top 10 vendidos por lucro (all-time)
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

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Compras total" value={formatEUR(totalCompras)} />
        <Kpi title="Vendas total" value={formatEUR(totalVendas)} />
        <Kpi title="Lucro total" value={formatEUR(lucro)} />
        <Kpi title="Capital preso" value={formatEUR(capitalPreso)} />
        <Kpi
          title="Hold médio (vendidos)"
          value={holdMedio == null ? '—' : `${holdMedio.toFixed(1)} dias`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <div className="text-sm font-semibold">Vendas por plataforma</div>
              <div className="text-xs text-zinc-500">Nº de vendas total por plataforma</div>
            </div>
          </CardHeader>
          <CardContent>
            {salesByPlatform.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem vendas ainda.</p>
            ) : (
              <BarChart data={salesByPlatform} />
            )}
          </CardContent>
        </Card>

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