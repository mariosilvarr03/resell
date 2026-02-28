import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

import Container from './../../../components/ui/Container'
import { Card, CardContent, CardHeader } from './../../../components/ui/Card'
import Button from './../../../components/ui/Button'

import SellForm from './SellForm'

export default async function SellPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const itemId = Number(id)

  const supabase = await createClient()

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single()

  const { data: platforms, error: platformsError } = await supabase
    .from('platforms')
    .select('id,name')
    .order('name')

  if (itemError) {
    return (
      <Container>
        <div className="text-rose-700">Erro ao carregar item: {itemError.message}</div>
      </Container>
    )
  }

  if (platformsError) {
    return (
      <Container>
        <div className="text-rose-700">
          Erro ao carregar plataformas: {platformsError.message}
        </div>
      </Container>
    )
  }

  if (!item) {
    return (
      <Container>
        <div className="text-zinc-600">Item não encontrado.</div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marcar como vendido</h1>
          <p className="mt-1 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{item.title}</span> — compra{' '}
            <span className="font-semibold text-zinc-900">€ {Number(item.purchase_price).toFixed(2)}</span> em{' '}
            {item.purchase_date}
          </p>
        </div>

        <Button href="/items" variant="ghost">
          Voltar ao inventário
        </Button>
      </div>

      <div className="mt-5 max-w-xl">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Detalhes da venda</div>
            <div className="text-xs text-zinc-500">Preço, data e plataforma.</div>
          </CardHeader>
          <CardContent>
            <SellForm itemId={itemId} platforms={platforms ?? []} />
          </CardContent>
        </Card>

        <div className="mt-3 text-sm">
          <Link href="/items" className="text-zinc-700 hover:underline">
            Voltar
          </Link>
        </div>
      </div>
    </Container>
  )
}