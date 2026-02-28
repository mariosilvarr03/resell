'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createItemAction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const title = String(formData.get('title') ?? '').trim()
  const purchase_price = Number(formData.get('purchase_price'))
  const purchase_date = String(formData.get('purchase_date') ?? '')

  const category_choice = String(formData.get('category_choice') ?? '')
  const new_category = String(formData.get('new_category') ?? '').trim()

  if (!title || !purchase_date || !purchase_price) {
    throw new Error('Campos inválidos')
  }

  let category_id: number | null = null

  if (category_choice === 'new') {
    if (!new_category) throw new Error('Nome da nova categoria é obrigatório')

    const { data: upserted, error: upsertError } = await supabase
      .from('categories')
      .upsert(
        { user_id: user.id, name: new_category },
        { onConflict: 'user_id,name' }
      )
      .select('id')
      .single()

    if (upsertError) throw new Error(upsertError.message)
    category_id = upserted.id
  } else {
    category_id = Number(category_choice)
    if (!category_id) throw new Error('Categoria inválida')
  }

  const { error } = await supabase.from('items').insert({
    user_id: user.id,
    title,
    purchase_price,
    purchase_date,
    category_id,
  })

  if (error) throw new Error(error.message)

  redirect('/items')
}