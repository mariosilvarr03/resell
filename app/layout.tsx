import './globals.css'
import Header from './components/Header'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <Header />
        {children}
      </body>
    </html>
  )
}