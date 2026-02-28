'use client'

import { useMemo, useState } from 'react'
import Button from './../../../components/ui/Button'
import { sellItemAction } from './actions'

type Platform = { id: number; name: string }

export default function SellForm({
  itemId,
  platforms,
}: {
  itemId: number
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

  return (
    <form action={sellItemAction} className="grid gap-4">
      <input type="hidden" name="item_id" value={itemId} />

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
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
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
        <Button type="submit">Confirmar venda</Button>
        <Button href="/items" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  )
}