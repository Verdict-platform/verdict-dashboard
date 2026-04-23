import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My Verdict Dashboard',
  description: 'Track your financial position across rent, salary, and more.',
  robots: { index: false, follow: false },
}

const NAV_SITES = [
  { label: 'Spend', href: 'https://spendverdict.com', color: '#7c3aed' },
  { label: 'Comp',  href: 'https://compverdict.com',  color: '#2563eb' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen font-sans antialiased">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
            <span className="text-sm font-bold tracking-tight text-gray-900">
              My Dashboard
            </span>
            <nav className="flex items-center gap-1">
              {NAV_SITES.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
