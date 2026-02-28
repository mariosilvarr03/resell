'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function unmarkSale(itemId: number) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

export async function deleteItem(itemId: number) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  redirect('/items')
}