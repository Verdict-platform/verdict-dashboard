'use client'

import { useEffect, useState } from 'react'
import { getOrCreateUid, getAllEntries, withUid } from '@/lib/verdictStorage'
import { generateInsights, type VerdictInsight } from '@/lib/insightEngine'
import type { SpendEntry, CompEntry, VerdictEntry } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  const symbols: Record<string, string> = { GBP: '£', EUR: '€', USD: '$', CHF: 'CHF ' }
  const s = symbols[currency] ?? currency + ' '
  const abs = Math.abs(Math.round(n))
  return abs >= 1000 ? `${s}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `${s}${abs}`
}

function isSpend(e: VerdictEntry): e is SpendEntry { return e.type === 'spend' }
function isComp(e: VerdictEntry):  e is CompEntry  { return e.type === 'comp'  }

const TIER_COLOR: Record<string, string> = {
  comfortable: '#059669',
  normal:      '#d97706',
  stretch:     '#dc2626',
  risky:       '#dc2626',
}
const VERDICT_COLOR: Record<string, string> = {
  strong: '#059669',
  fair:   '#d97706',
  weak:   '#dc2626',
}
const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  warning:  '#d97706',
  positive: '#059669',
  neutral:  '#6b7280',
}

// ─── Section components ───────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-4xl mb-4">📊</div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">No data yet</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Run a Spend or Comp check, then click "Track this" to start building your dashboard.
      </p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <a
          href={withUid('https://spendverdict.com')}
          className="block py-2.5 px-4 rounded-xl text-sm font-semibold text-white text-center transition-opacity hover:opacity-90"
          style={{ background: '#7c3aed' }}
        >
          Check rent affordability →
        </a>
        <a
          href={withUid('https://compverdict.com')}
          className="block py-2.5 px-4 rounded-xl text-sm font-semibold text-white text-center transition-opacity hover:opacity-90"
          style={{ background: '#2563eb' }}
        >
          Check your comp →
        </a>
      </div>
    </div>
  )
}

function SnapshotSection({ spend, comp }: { spend?: SpendEntry; comp?: CompEntry }) {
  return (
    <section className="fade-up mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Snapshot</h2>
      <div className="grid grid-cols-2 gap-3">

        {/* Spend card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Rent</div>
          {spend ? (
            <>
              <div
                className="text-2xl font-black tracking-tight mb-0.5"
                style={{ color: TIER_COLOR[spend.output.tier] }}
              >
                {spend.output.rent_percent.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 capitalize">{spend.output.tier}</div>
              <div className="text-xs text-gray-400 mt-1">{spend.input.city}</div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">No data</div>
          )}
        </div>

        {/* Comp card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Salary</div>
          {comp ? (
            <>
              <div
                className="text-2xl font-black tracking-tight mb-0.5"
                style={{ color: VERDICT_COLOR[comp.output.verdict] }}
              >
                P{comp.output.percentile}
              </div>
              <div className="text-xs text-gray-500 capitalize">{comp.output.verdict}</div>
              <div className="text-xs text-gray-400 mt-1">{comp.input.role?.split(' ').slice(-1)[0]}, {comp.input.city}</div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">No data</div>
          )}
        </div>

        {/* Monthly position — full width, only if both data sources */}
        {spend && comp && (
          <div className="col-span-2 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Monthly position</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Take-home (est.)</span>
              <span className="font-semibold">{fmt(spend.input.annual_salary / 12, spend.input.currency)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Rent</span>
              <span className="font-semibold text-gray-700">−{fmt(spend.input.monthly_rent, spend.input.currency)}</span>
            </div>
            <div className="my-2 border-t border-gray-100" />
            <div className="flex justify-between text-sm font-bold">
              <span>Remaining</span>
              <span style={{ color: spend.output.monthly_overspend > 0 ? '#dc2626' : '#059669' }}>
                {fmt((spend.input.annual_salary / 12) - spend.input.monthly_rent, spend.input.currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function TrendsSection({ spendEntries, compEntries }: { spendEntries: SpendEntry[]; compEntries: CompEntry[] }) {
  if (spendEntries.length < 2 && compEntries.length < 2) return null

  return (
    <section className="fade-up mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Trends</h2>
      <div className="flex flex-col gap-3">

        {spendEntries.length >= 2 && (() => {
          const [a, b] = spendEntries
          const delta = a.output.rent_percent - b.output.rent_percent
          const improving = delta < 0
          return (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Rent ratio</div>
                <div className="text-sm font-semibold text-gray-700">
                  {b.output.rent_percent.toFixed(1)}% → {a.output.rent_percent.toFixed(1)}%
                </div>
              </div>
              <div
                className="text-lg font-black"
                style={{ color: improving ? '#059669' : '#dc2626' }}
              >
                {improving ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}pp
              </div>
            </div>
          )
        })()}

        {compEntries.length >= 2 && (() => {
          const [a, b] = compEntries
          const delta = a.output.percentile - b.output.percentile
          const improving = delta > 0
          return (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Salary percentile</div>
                <div className="text-sm font-semibold text-gray-700">
                  P{b.output.percentile} → P{a.output.percentile}
                </div>
              </div>
              <div
                className="text-lg font-black"
                style={{ color: improving ? '#059669' : '#dc2626' }}
              >
                {improving ? '↑' : '↓'} {Math.abs(delta)}pp
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}

function InsightCard({ insight }: { insight: VerdictInsight }) {
  const color = SEVERITY_COLOR[insight.severity]
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="w-1.5 rounded-full flex-shrink-0 mt-1"
          style={{ height: '36px', background: color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{insight.headline}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{insight.detail}</p>
          {insight.cta && (
            <a
              href={insight.cta.href}
              className="inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: color }}
            >
              {insight.cta.label} →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightsSection({ insights }: { insights: VerdictInsight[] }) {
  if (!insights.length) return null
  return (
    <section className="fade-up mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Insights</h2>
      <div className="flex flex-col gap-3">
        {insights.map(i => <InsightCard key={i.id} insight={i} />)}
      </div>
    </section>
  )
}

function ActionsSection({ spend, comp }: { spend?: SpendEntry; comp?: CompEntry }) {
  return (
    <section className="fade-up mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        <a
          href={withUid('https://spendverdict.com')}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center hover:border-violet-200 transition-colors"
        >
          <div className="text-lg mb-1">🏠</div>
          <div className="text-xs font-semibold text-gray-700">{spend ? 'Update rent' : 'Check rent'}</div>
        </a>
        <a
          href={withUid('https://compverdict.com')}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center hover:border-blue-200 transition-colors"
        >
          <div className="text-lg mb-1">💼</div>
          <div className="text-xs font-semibold text-gray-700">{comp ? 'Update salary' : 'Check comp'}</div>
        </a>
        <a
          href={withUid('https://salaryverdict.com')}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center hover:border-cyan-200 transition-colors"
        >
          <div className="text-lg mb-1">📊</div>
          <div className="text-xs font-semibold text-gray-700">Market rates</div>
        </a>
        <a
          href={withUid('https://compverdict.com/negotiate')}
          className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center hover:border-gray-200 transition-colors"
        >
          <div className="text-lg mb-1">🤝</div>
          <div className="text-xs font-semibold text-gray-700">Negotiate</div>
        </a>
      </div>
    </section>
  )
}

function UnlockCard({
  emoji, title, teaser, href,
}: { emoji: string; title: string; teaser: string; href: string }) {
  return (
    <div className="relative bg-white rounded-2xl p-4 border border-gray-100 shadow-sm overflow-hidden">
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-2xl">
        <a
          href={href}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          Notify me →
        </a>
      </div>
      <div className="opacity-40">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">{emoji}</span>
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <span className="text-xs text-gray-400 ml-auto">🔒</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{teaser}</p>
      </div>
    </div>
  )
}

function UnlockSection({ spend, comp }: { spend?: SpendEntry; comp?: CompEntry }) {
  const city = spend?.input.city ?? comp?.input.city ?? 'your city'
  const role = comp?.input.role ?? 'your role'
  const p75  = comp ? fmt(comp.output.salary_p75, comp.input.currency) : 'top market rate'

  return (
    <section className="fade-up mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Coming soon</h2>
      <p className="text-xs text-gray-400 mb-3">Unlock more Verdict tools as they launch</p>
      <div className="flex flex-col gap-3">
        <UnlockCard
          emoji="🏙️"
          title="CityVerdict"
          teaser={`See how ${city} compares on cost, salary, and quality of life — and whether moving could improve your financial position.`}
          href="https://cityverdict.com"
        />
        <UnlockCard
          emoji="📈"
          title="EarnVerdict"
          teaser={`The fastest path to ${p75} for ${role}. Mapped by role, city, and experience band.`}
          href="https://earnverdict.com"
        />
        <UnlockCard
          emoji="🗺️"
          title="PathVerdict"
          teaser={`At your current trajectory, see when you'll reach the next comp band — and what accelerates it.`}
          href="https://pathverdict.com"
        />
      </div>
    </section>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [entries, setEntries]   = useState<VerdictEntry[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const uid = getOrCreateUid('spend')
    if (!uid) { setLoading(false); return }
    getAllEntries(uid).then(data => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    )
  }

  const spendEntries = entries.filter(isSpend) as SpendEntry[]
  const compEntries  = entries.filter(isComp)  as CompEntry[]
  const latestSpend  = spendEntries[0]
  const latestComp   = compEntries[0]
  const hasData      = spendEntries.length > 0 || compEntries.length > 0

  if (!hasData) return <EmptyState />

  const insights = generateInsights({ spendEntries, compEntries })

  return (
    <div>
      <SnapshotSection  spend={latestSpend}  comp={latestComp} />
      <TrendsSection    spendEntries={spendEntries} compEntries={compEntries} />
      <InsightsSection  insights={insights} />
      <ActionsSection   spend={latestSpend}  comp={latestComp} />
      <UnlockSection    spend={latestSpend}  comp={latestComp} />
    </div>
  )
}
