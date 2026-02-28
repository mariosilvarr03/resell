export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {children}
    </div>
  )
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-zinc-100 px-4 py-3">{children}</div>
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}