'use client'

import { useMemo, useState } from 'react'
import Button from './../../components/ui/Button'
import { createItemAction } from './actions'

type Category = { id: number; name: string }

export default function NewItemForm({ categories }: { categories: Category[] }) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  )

  const [choice, setChoice] = useState<string>(
    sorted[0]?.id ? String(sorted[0].id) : 'new'
  )
  const isNew = choice === 'new'

  return (
    <form action={createItemAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Produto</label>
        <input
          name="title"
          placeholder="ex: Jordan 1, RAM 32GB..."
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Preço de compra (com fees)</label>
        <input
          name="purchase_price"
          type="number"
          step="0.01"
          placeholder="ex: 145.00"
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Data de compra</label>
        <input
          name="purchase_date"
          type="date"
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-zinc-600">Categoria</label>
        <select
          name="category_choice"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          required
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        >
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ Adicionar nova…</option>
        </select>
      </div>

      {isNew && (
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Nova categoria</label>
          <input
            name="new_category"
            placeholder="ex: Sneakers"
            required
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit">Guardar</Button>
        <Button href="/items" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  )
}