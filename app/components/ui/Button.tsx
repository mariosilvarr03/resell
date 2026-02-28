import Link from 'next/link'

type Props =
  | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)

export default function Button(props: Props & { variant?: 'primary' | 'ghost' }) {
  const variant = (props as any).variant ?? 'primary'
  const base =
    'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition'
  const styles =
    variant === 'primary'
      ? 'bg-zinc-900 text-white hover:bg-zinc-800'
      : 'bg-transparent text-zinc-700 hover:bg-zinc-100'

  if ('href' in props && props.href) {
    const { href, className, ...rest } = props
    return (
      <Link href={href} className={`${base} ${styles} ${className ?? ''}`} {...rest}>
        {(props as any).children}
      </Link>
    )
  }

  const { className, ...rest } = props as any
  return (
    <button className={`${base} ${styles} ${className ?? ''}`} {...rest}>
      {props.children}
    </button>
  )
}