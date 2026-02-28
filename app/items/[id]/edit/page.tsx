import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import Container from './../../../components/ui/Container'
import Button from './../../../components/ui/Button'
import { Card, CardContent, CardHeader } from './../../../components/ui/Card'

function toDateInputValue(v: any) {
  if (!v) return ''
  const s = String(v)
  // suporta "YYYY-MM-DD" e timestamps "YYYY-MM-DDTHH..."
  return s.length >= 10 ? s.slice(0, 10) : ''
}

function toNullIfEmpty(v: FormDataEntryValue | null) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null
  return s
}

function toNumberOrNull(v: FormDataEntryValue | null) {
  const s = toNullIfEmpty(v)
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

async function updateItem(itemId: number, formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const title = String(formData.get('title') ?? '').trim()
  const notes = toNullIfEmpty(formData.get('notes'))
  const purchase_price = toNumberOrNull(formData.get('purchase_price'))
  const purchase_date = toNullIfEmpty(formData.get('purchase_date'))
  const category_id = toNumberOrNull(formData.get('category_id'))

  if (!title) throw new Error('Título é obrigatório')
  if (purchase_price == null) throw new Error('Preço de compra inválido')
  if (!purchase_date) throw new Error('Data de compra inválida')
  if (category_id == null) throw new Error('Categoria inválida')

  const status = String(formData.get('status') ?? 'EM_STOCK') as 'EM_STOCK' | 'VENDIDO'

  const payload: any = {
    title,
    notes,
    purchase_price,
    purchase_date,
    category_id,
  }

  if (status === 'VENDIDO') {
    const sale_price = toNumberOrNull(formData.get('sale_price'))
    const sale_date = toNullIfEmpty(formData.get('sale_date'))
    const platform_id = toNumberOrNull(formData.get('platform_id'))

    if (sale_price == null) throw new Error('Preço de venda inválido')
    if (!sale_date) throw new Error('Data de venda inválida')
    if (platform_id == null) throw new Error('Plataforma inválida')

    payload.status = 'VENDIDO'
    payload.sale_price = sale_price
    payload.sale_date = sale_date // ✅ nunca "null"
    payload.platform_id = platform_id
  } else {
    payload.status = 'EM_STOCK'
    payload.sale_price = null
    payload.sale_date = null
    payload.platform_id = null
  }

  const { error } = await supabase
    .from('items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  redirect('/items')
}

async function unmarkSale(itemId: number) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('items')
    .update({
      status: 'EM_STOCK',
      sale_price: null,
      sale_date: null,
      platform_id: null,
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  redirect('/items')
}

async function deleteItem(itemId: number) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  redirect('/items')
}

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const itemId = Number(id)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: item, error: itemErr }, { data: categories }, { data: platforms }] =
    await Promise.all([
      supabase.from('items').select('*').eq('id', itemId).eq('user_id', user.id).single(),
      supabase.from('categories').select('id,name').order('name'),
      supabase.from('platforms').select('id,name').order('name'),
    ])

  if (itemErr || !item) {
    return (
      <Container>
        <div className="text-rose-700">Item não encontrado.</div>
      </Container>
    )
  }

  const isSold = item.status === 'VENDIDO'

  return (
    <Container>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editar item</h1>
          <p className="mt-1 text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">{item.title}</span>{' '}
            <span className="text-zinc-400">•</span>{' '}
            <span className="font-medium">{item.status}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button href="/items" variant="ghost">
            Voltar
          </Button>

          {isSold ? (
            <form action={unmarkSale.bind(null, itemId)}>
              <Button type="submit" variant="ghost">
                Desmarcar venda
              </Button>
            </form>
          ) : null}

          <form action={deleteItem.bind(null, itemId)}>
            <button
              type="submit"
              className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Apagar
            </button>
          </form>
        </div>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Detalhes</div>
            <div className="text-xs text-zinc-500">
              Edita os dados da compra (e da venda se o item estiver vendido).
            </div>
          </CardHeader>

          <CardContent>
            <form action={updateItem.bind(null, itemId)} className="grid gap-4">
              {/* status vem do item; vender/desvender faz-se nos fluxos próprios */}
              <input type="hidden" name="status" value={item.status} />

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-zinc-600">Produto</label>
                <input
                  name="title"
                  defaultValue={item.title ?? ''}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-zinc-600">Notas</label>
                <textarea
                  name="notes"
                  defaultValue={item.notes ?? ''}
                  className="min-h-[84px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-zinc-600">Preço compra (€)</label>
                  <input
                    name="purchase_price"
                    type="number"
                    step="0.01"
                    defaultValue={Number(item.purchase_price ?? 0)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-zinc-600">Data compra</label>
                  <input
                    name="purchase_date"
                    type="date"
                    defaultValue={toDateInputValue(item.purchase_date)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-zinc-600">Categoria</label>
                  <select
                    name="category_id"
                    defaultValue={item.category_id ?? ''}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                    required
                  >
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Venda (só se vendido) */}
              {isSold ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4">
                  <div className="text-sm font-semibold">Venda</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Este item está marcado como vendido — podes editar os campos da venda.
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-zinc-600">Preço venda (€)</label>
                      <input
                        name="sale_price"
                        type="number"
                        step="0.01"
                        defaultValue={Number(item.sale_price ?? 0)}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                        required
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-zinc-600">Data venda</label>
                      <input
                        name="sale_date"
                        type="date"
                        defaultValue={toDateInputValue(item.sale_date)} // ✅ nunca "null"
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                        required
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-zinc-600">Plataforma</label>
                      <select
                        name="platform_id"
                        defaultValue={item.platform_id ?? ''}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
                        required
                      >
                        <option value="">Selecionar plataforma</option>
                        {platforms?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}