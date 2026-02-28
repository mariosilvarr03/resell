export default function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'green' | 'red'
}) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'red'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-zinc-50 text-zinc-700 border-zinc-200'

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>
}