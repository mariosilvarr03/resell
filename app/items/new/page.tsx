import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import Container from './../../components/ui/Container'
import { Card, CardContent, CardHeader } from './../../components/ui/Card'
import Button from './../../components/ui/Button'

import NewItemForm from './NewItemForm'

export default async function NewItemPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id,name')
    .order('name')

  if (error) {
    return (
      <Container>
        <div className="text-rose-700">Erro ao carregar categorias: {error.message}</div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Adicionar compra</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Regista uma compra com fees incluídas, categoria e data.
          </p>
        </div>

        <Button href="/items" variant="ghost">
          Voltar ao inventário
        </Button>
      </div>

      <div className="mt-5 max-w-xl">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Detalhes da compra</div>
            <div className="text-xs text-zinc-500">Preenche os campos e guarda.</div>
          </CardHeader>
          <CardContent>
            <NewItemForm categories={categories ?? []} />
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}