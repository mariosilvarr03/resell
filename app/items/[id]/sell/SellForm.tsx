'use client'

import { useMemo, useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Button from './../../../components/ui/Button'
import { sellItemAction, type SellActionState } from './actions'

type Platform = { id: number; name: string }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'A guardar…' : 'Confirmar venda'}
    </Button>
  )
}

export default function SellForm({
  itemId,
  purchaseDate,
  platforms,
}: {
  itemId: number
  purchaseDate: string // 'YYYY-MM-DD'
  platforms: Platform[]
}) {
  const sorted = useMemo(
    () => [...platforms].sort((a, b) => a.name.localeCompare(b.name)),
    [platforms]
  )

  const [choice, setChoice] = useState<string>(
    sorted[0]?.id ? String(sorted[0].id) : 'new'
  )
  const isNew = choice === 'new'

  const [state, action] = useActionState<SellActionState, FormData>(sellItemAction, {
    ok: true,
  })

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="item_id" value={itemId} />

      {state?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Preço de venda</label>
        <input
          name="sale_price"
          type="number"
          step="0.01"
          placeholder="ex: 180.00"
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Data de venda</label>
        <input
          name="sale_date"
          type="date"
          required
          min={purchaseDate} // ✅ evita escolher data antes da compra
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
        <p className="text-xs text-zinc-500">Mínimo: {purchaseDate}</p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Plataforma</label>
        <select
          name="platform_choice"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        >
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="new">+ Adicionar nova…</option>
        </select>
      </div>

      {isNew && (
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Nova plataforma</label>
          <input
            name="new_platform"
            placeholder="ex: Cardmarket"
            required
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <SubmitButton />
        <Button href="/items" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  )
}