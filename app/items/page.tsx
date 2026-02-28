import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

import Container from './../components/ui/Container'
import Button from './../components/ui/Button'
import Badge from './../components/ui/Badge'
import { Card, CardContent, CardHeader } from './../components/ui/Card'

type ItemStatus = 'EM_STOCK' | 'VENDIDO'
type StatusFilter = ItemStatus | 'ALL'

type SortKey = 'purchase_date' | 'purchase_price' | 'profit' | 'hold_days'
type SortDir = 'asc' | 'desc'

type SortOption =
  | 'purchase_date_desc'
  | 'purchase_date_asc'
  | 'purchase_price_desc'
  | 'purchase_price_asc'
  | 'profit_desc'
  | 'profit_asc'
  | 'hold_days_desc'
  | 'hold_days_asc'

function parseSort(sort?: string): { key: SortKey; dir: SortDir; option: SortOption } {
  const mapping: Record<SortOption, { key: SortKey; dir: SortDir }> = {
    purchase_date_desc: { key: 'purchase_date', dir: 'desc' },
    purchase_date_asc: { key: 'purchase_date', dir: 'asc' },

    purchase_price_desc: { key: 'purchase_price', dir: 'desc' },
    purchase_price_asc: { key: 'purchase_price', dir: 'asc' },

    profit_desc: { key: 'profit', dir: 'desc' },
    profit_asc: { key: 'profit', dir: 'asc' },

    hold_days_desc: { key: 'hold_days', dir: 'desc' },
    hold_days_asc: { key: 'hold_days', dir: 'asc' },
  }

  const fallback: SortOption = 'purchase_date_desc'
  const option = sort && (sort in mapping) ? (sort as SortOption) : fallback
  return { ...mapping[option], option }
}

function formatEUR(v: any) {
  const n = Number(v ?? 0)
  return `€ ${n.toFixed(2)}`
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; sort?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const sp = await searchParams

  const status: StatusFilter =
    sp.status === 'EM_STOCK' || sp.status === 'VENDIDO' ? sp.status : 'ALL'

  const categoryId = sp.category ? Number(sp.category) : null
  const { key: sortKey, dir: sortDir, option: sortOption } = parseSort(sp.sort)

  // Dropdowns (para filtros + labels)
  const [{ data: categories, error: catError }, { data: platforms, error: platError }] =
    await Promise.all([
      supabase.from('categories').select('id,name').order('name'),
      supabase.from('platforms').select('id,name').order('name'),
    ])

  if (catError) {
    return (
      <Container>
        <div className="text-rose-700">Erro a carregar categorias: {catError.message}</div>
      </Container>
    )
  }

  if (platError) {
    return (
      <Container>
        <div className="text-rose-700">Erro a carregar plataformas: {platError.message}</div>
      </Container>
    )
  }

  const categoryMap = new Map<number, string>((categories ?? []).map((c) => [c.id, c.name]))
  const platformMap = new Map<number, string>((platforms ?? []).map((p) => [p.id, p.name]))

  // Items (view enriched para profit + hold)
  let query = supabase
    .from('v_items_enriched')
    .select('*')
    .order(sortKey, { ascending: sortDir === 'asc' })

  if (status !== 'ALL') query = query.eq('status', status)
  if (categoryId) query = query.eq('category_id', categoryId)

  const { data: items, error: itemsError } = await query

  if (itemsError) {
    return (
      <Container>
        <div className="text-rose-700">Erro ao carregar itens: {itemsError.message}</div>
      </Container>
    )
  }

  // Capital preso global (independente de filtros)
  const { data: inStock, error: stockError } = await supabase
    .from('items')
    .select('purchase_price')
    .eq('status', 'EM_STOCK')

  if (stockError) {
    return (
      <Container>
        <div className="text-rose-700">Erro ao calcular capital preso: {stockError.message}</div>
      </Container>
    )
  }

  const capitalPreso = inStock?.reduce((acc, i) => acc + Number(i.purchase_price ?? 0), 0) ?? 0

  return (
    <Container>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventário</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Capital preso (EM_STOCK): <span className="font-semibold text-zinc-900">{formatEUR(capitalPreso)}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button href="/items/new">+ Nova Compra</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold">Filtros</div>
              <div className="text-xs text-zinc-500">Refina por status, categoria e ordenação</div>
            </div>
          </CardHeader>

          <CardContent>
            <form method="get" action="/items" className="flex flex-wrap gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-zinc-600">Status</label>
                <select
                  name="status"
                  defaultValue={status}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="ALL">Todos</option>
                  <option value="EM_STOCK">EM_STOCK</option>
                  <option value="VENDIDO">VENDIDO</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-zinc-600">Categoria</label>
                <select
                  name="category"
                  defaultValue={categoryId ?? ''}
                  className="h-10 min-w-[220px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="">Todas</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-zinc-600">Ordenar por</label>
                <select
                  name="sort"
                  defaultValue={sortOption}
                  className="h-10 min-w-[260px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="purchase_date_desc">Data de compra (desc)</option>
                  <option value="purchase_date_asc">Data de compra (asc)</option>

                  <option value="purchase_price_desc">Preço de compra (desc)</option>
                  <option value="purchase_price_asc">Preço de compra (asc)</option>

                  <option value="profit_desc">Lucro (desc)</option>
                  <option value="profit_asc">Lucro (asc)</option>

                  <option value="hold_days_desc">Tempo de hold (desc)</option>
                  <option value="hold_days_asc">Tempo de hold (asc)</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button type="submit">Aplicar</Button>
                <Button href="/items" variant="ghost">
                  Limpar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <div className="mt-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Itens</div>
                <div className="text-xs text-zinc-500">
                  {items?.length ?? 0} item(s) encontrados
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr className="border-b border-zinc-100">
                    <th className="py-2 text-left font-medium">Produto</th>
                    <th className="py-2 text-left font-medium">Categoria</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Compra</th>
                    <th className="py-2 text-left font-medium">Data</th>
                    <th className="py-2 text-left font-medium">Plataforma</th>
                    <th className="py-2 text-right font-medium">Lucro</th>
                    <th className="py-2 text-right font-medium">Hold</th>
                    <th className="py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {items && items.length > 0 ? (
                    items.map((item: any) => {
                      const catName = categoryMap.get(item.category_id) ?? '-'
                      const platformName =
                        item.status === 'VENDIDO' && item.platform_id
                          ? platformMap.get(item.platform_id) ?? '-'
                          : '-'

                      const badgeTone =
                        item.status === 'EM_STOCK' ? 'green' : 'neutral'

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-100 hover:bg-zinc-50/70"
                        >
                          <td className="py-3 pr-3 font-medium">{item.title}</td>
                          <td className="py-3 pr-3 text-zinc-700">{catName}</td>
                          <td className="py-3 pr-3">
                            <Badge tone={badgeTone}>{item.status}</Badge>
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {formatEUR(item.purchase_price)}
                          </td>
                          <td className="py-3 pr-3 text-zinc-700">{item.purchase_date}</td>
                          <td className="py-3 pr-3 text-zinc-700">{platformName}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {item.profit == null ? '—' : formatEUR(item.profit)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {item.hold_days} dias
                          </td>
                          <td className="py-3 text-right">
                            {item.status === 'EM_STOCK' ? (
                              <Link
                                href={`/items/${item.id}/sell`}
                                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                Marcar vendido
                              </Link>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-zinc-500">
                        Sem itens para estes filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}