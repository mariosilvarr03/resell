'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function sellItemAction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const itemId = Number(formData.get('item_id'))
  const sale_price = Number(formData.get('sale_price'))
  const sale_date = String(formData.get('sale_date'))
  const platform_choice = String(formData.get('platform_choice') ?? '')
  const new_platform = String(formData.get('new_platform') ?? '').trim()

  if (!itemId || !sale_price || !sale_date) {
    throw new Error('Campos inválidos')
  }

  let platform_id: number | null = null

  if (platform_choice === 'new') {
    if (!new_platform) throw new Error('Nome da nova plataforma é obrigatório')

    // criar (ou reutilizar se já existir)
    const { data: upserted, error: upsertError } = await supabase
      .from('platforms')
      .upsert(
        { user_id: user.id, name: new_platform },
        { onConflict: 'user_id,name' }
      )
      .select('id')
      .single()

    if (upsertError) throw new Error(upsertError.message)
    platform_id = upserted.id
  } else {
    platform_id = Number(platform_choice)
    if (!platform_id) throw new Error('Plataforma inválida')
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

  if (error) throw new Error(error.message)

  redirect('/items')
}