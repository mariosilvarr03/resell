'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type SellActionState = {
  ok: boolean
  error?: string
}

function humanizeSupabaseError(message: string) {
  const m = message.toLowerCase()

  // constraint sale_after_purchase
  if (m.includes('sale_after_purchase')) {
    return 'A data de venda não pode ser anterior à data de compra.'
  }

  // constraint sold_requires_sale_fields
  if (m.includes('sold_requires_sale_fields')) {
    return 'Para marcar como vendido, tens de preencher preço, data e plataforma.'
  }

  // RLS
  if (m.includes('row-level security') || m.includes('rls')) {
    return 'Sem permissões para executar esta ação. Faz logout/login e tenta novamente.'
  }

  // generic
  return message
}

export async function sellItemAction(
  _prevState: SellActionState,
  formData: FormData
): Promise<SellActionState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Precisas de estar autenticado.' }
  }

  const itemId = Number(formData.get('item_id'))
  const sale_price = Number(formData.get('sale_price'))
  const sale_date = String(formData.get('sale_date') ?? '')
  const platform_choice = String(formData.get('platform_choice') ?? '')
  const new_platform = String(formData.get('new_platform') ?? '').trim()

  if (!itemId || !Number.isFinite(itemId)) {
    return { ok: false, error: 'Item inválido.' }
  }

  if (!sale_date) {
    return { ok: false, error: 'A data de venda é obrigatória.' }
  }

  if (!Number.isFinite(sale_price) || sale_price <= 0) {
    return { ok: false, error: 'O preço de venda tem de ser maior que 0.' }
  }

  // 🔎 Buscar a compra para validar data e ownership
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id,user_id,purchase_date,status')
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    return { ok: false, error: 'Não foi possível carregar o item.' }
  }

  if (item.user_id !== user.id) {
    return { ok: false, error: 'Sem permissões para alterar este item.' }
  }

  if (item.status === 'VENDIDO') {
    return { ok: false, error: 'Este item já está marcado como vendido.' }
  }

  // ✅ validar data venda >= compra
  // purchase_date vem como 'YYYY-MM-DD' (date)
  const purchaseDateStr = String(item.purchase_date)
  if (sale_date < purchaseDateStr) {
    return {
      ok: false,
      error: 'A data de venda não pode ser anterior à data de compra.',
    }
  }

  // ✅ resolver platform_id (selecionada ou criada)
  let platform_id: number | null = null

  if (platform_choice === 'new') {
    if (!new_platform) {
      return { ok: false, error: 'Nome da nova plataforma é obrigatório.' }
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('platforms')
      .upsert({ user_id: user.id, name: new_platform }, { onConflict: 'user_id,name' })
      .select('id')
      .single()

    if (upsertError || !upserted) {
      return { ok: false, error: 'Não foi possível criar a plataforma.' }
    }

    platform_id = upserted.id
  } else {
    platform_id = Number(platform_choice)
    if (!platform_id || !Number.isFinite(platform_id)) {
      return { ok: false, error: 'Plataforma inválida.' }
    }
  }

  const { error } = await supabase
    .from('items')
    .update({
      status: 'VENDIDO',
      sale_price,
      sale_date,
      platform_id,
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) {
    return { ok: false, error: humanizeSupabaseError(error.message) }
  }

  redirect('/items')
}