/**
 * insightEngine — generates personalized, quantified insights from Verdict data.
 *
 * Rules:
 *  - Every insight must include a £/€/$ figure or a % difference — no generic copy
 *  - Most impactful insight always surfaces first (lowest priority number)
 *  - Cross-verdict insights (Spend + Comp combined) rank highest when both are present
 *  - Positive insights are always included but ranked below problems
 */

import type { SpendEntry, CompEntry, VerdictEntry, VerdictSiteId } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'neutral'
export type InsightSource   = 'spend' | 'comp' | 'cross' | 'trend'

export interface VerdictInsight {
  id: string
  priority: number          // 1 = highest. Sort ascending before display.
  source: InsightSource
  severity: InsightSeverity
  headline: string          // one line, personalized, shown in card title
  detail: string            // 1–2 sentences, quantified, actionable
  cta?: {
    label: string
    href: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(Math.round(n))
  if (abs >= 1000) return `${symbol}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${symbol}${abs.toLocaleString()}`
}

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    GBP: '£', EUR: '€', USD: '$', CHF: 'CHF ', SEK: 'kr', PLN: 'zł',
  }
  return map[currency] ?? currency + ' '
}

function monthsAgo(iso: string): string {
  const months = Math.round(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30),
  )
  if (months === 0) return 'this month'
  if (months === 1) return 'last month'
  return `${months} months ago`
}

// ─── Individual insight generators ───────────────────────────────────────────

function spendInsights(entry: SpendEntry): VerdictInsight[] {
  const insights: VerdictInsight[] = []
  const { output, input } = entry
  const { city, currency }  = input
  const annualOverspend     = output.monthly_overspend * 12

  // RENT_CRITICAL — risky tier
  if (output.tier === 'risky') {
    insights.push({
      id: 'rent_critical',
      priority: 1,
      source: 'spend',
      severity: 'critical',
      headline: `Rent is consuming a destabilising share of your income`,
      detail: `You're spending ${fmt(Math.abs(annualOverspend), currency)}/year above the 30% guideline in ${city}. A small income gap — a lost job, a rent increase — creates real hardship at this ratio.`,
      cta: { label: 'Update rent', href: withUidPlaceholder('https://spendverdict.com') },
    })
  }

  // RENT_STRETCHED — stretch tier
  if (output.tier === 'stretch') {
    insights.push({
      id: 'rent_stretched',
      priority: 2,
      source: 'spend',
      severity: 'warning',
      headline: `You're overspending ${fmt(Math.abs(annualOverspend), currency)}/year on rent`,
      detail: `At ${output.rent_percent.toFixed(1)}% of income, saving regularly is unlikely. The 30% guideline would save you ${fmt(Math.abs(annualOverspend), currency)} a year.`,
      cta: { label: 'Update rent', href: withUidPlaceholder('https://spendverdict.com') },
    })
  }

  // RENT_CITY_HIGH — paying more than most in this city
  if (output.rent_amount_percentile >= 70) {
    insights.push({
      id: 'rent_city_high',
      priority: 3,
      source: 'spend',
      severity: 'warning',
      headline: `Your rent is higher than ${output.rent_amount_percentile}% of renters in ${city}`,
      detail: `The city median is ${fmt(output.city_median_rent_low, currency)}–${fmt(output.city_median_rent_high, currency)}/month. You're paying ${fmt(input.monthly_rent, currency)}/month.`,
    })
  }

  // RENT_COMFORTABLE — positive reinforcement
  if (output.tier === 'comfortable') {
    const annualSaving = Math.abs(annualOverspend) // negative overspend = saving
    insights.push({
      id: 'rent_comfortable',
      priority: 5,
      source: 'spend',
      severity: 'positive',
      headline: `Your rent is well within range — ${fmt(annualSaving, currency)}/year below the guideline`,
      detail: `At ${output.rent_percent.toFixed(1)}% of income, you're in a strong position relative to most renters in ${city}. That gap is available for savings or investment.`,
    })
  }

  return insights
}

function compInsights(entry: CompEntry): VerdictInsight[] {
  const insights: VerdictInsight[] = []
  const { output, input } = entry
  const annualGap         = Math.abs(output.gap_to_median)
  const twoYearGap        = annualGap * 2
  const { currency, role, city } = input

  // SALARY_WEAK — well below market
  if (output.verdict === 'weak') {
    insights.push({
      id: 'salary_weak',
      priority: 1,
      source: 'comp',
      severity: 'critical',
      headline: `Your salary is in the bottom ${100 - output.percentile}% for ${role} in ${city}`,
      detail: `You're ${fmt(annualGap, currency)}/year below the market median. Left unaddressed, that compounds to ${fmt(twoYearGap, currency)} over two years.`,
      cta: { label: 'Re-run comp check', href: withUidPlaceholder('https://compverdict.com') },
    })
  }

  // SALARY_FAIR — below median but not critical
  if (output.verdict === 'fair' && output.gap_to_median > 0) {
    insights.push({
      id: 'salary_fair',
      priority: 2,
      source: 'comp',
      severity: 'warning',
      headline: `You're ${fmt(annualGap, currency)}/year below the market median`,
      detail: `${role} in ${city} earns ${fmt(output.salary_p50, currency)} at median. Your current salary puts you at the ${output.percentile}th percentile — there's a negotiation conversation worth having.`,
      cta: { label: 'Re-run comp check', href: withUidPlaceholder('https://compverdict.com') },
    })
  }

  // SALARY_STRONG — above market, positive
  if (output.verdict === 'strong') {
    insights.push({
      id: 'salary_strong',
      priority: 5,
      source: 'comp',
      severity: 'positive',
      headline: `Your salary is in the top ${100 - output.percentile}% for ${role} in ${city}`,
      detail: `You're ${fmt(Math.abs(output.gap_to_median), currency)}/year above the market median. Your comp is competitive — focus on equity, benefits, and long-term trajectory.`,
    })
  }

  return insights
}

function crossInsights(spend: SpendEntry, comp: CompEntry): VerdictInsight[] {
  const insights: VerdictInsight[] = []
  const currency = spend.input.currency

  // DOUBLE_SQUEEZE — high rent AND below-market salary
  const rentStretched = spend.output.rent_percent > 30
  const salaryBelowMedian = comp.output.gap_to_median > 0

  if (rentStretched && salaryBelowMedian) {
    const rentGap   = Math.abs(spend.output.monthly_overspend * 12)
    const salaryGap = comp.output.gap_to_median
    const totalGap  = rentGap + salaryGap
    insights.push({
      id: 'double_squeeze',
      priority: 1,
      source: 'cross',
      severity: 'critical',
      headline: `You're losing ${fmt(totalGap, currency)}/year — on rent and salary simultaneously`,
      detail: `Your rent is ${fmt(rentGap, currency)}/year above the 30% guideline, and your salary is ${fmt(salaryGap, currency)}/year below market median. Addressing either one significantly changes your financial position.`,
      cta: { label: 'Re-run comp check', href: withUidPlaceholder('https://compverdict.com') },
    })
  }

  // SALARY_RAISE_FIXES_RENT — getting to market median would fix the rent ratio
  if (rentStretched && salaryBelowMedian) {
    const currentRatio    = spend.output.rent_percent
    const medianSalary    = comp.output.salary_p50
    const newRatio        = (spend.input.monthly_rent / (medianSalary / 12)) * 100
    if (newRatio < 30) {
      insights.push({
        id: 'salary_raise_fixes_rent',
        priority: 2,
        source: 'cross',
        severity: 'warning',
        headline: `Reaching market salary would drop your rent ratio from ${currentRatio.toFixed(0)}% to ${newRatio.toFixed(0)}%`,
        detail: `At the market median of ${fmt(medianSalary, currency)}, your ${fmt(spend.input.monthly_rent, currency)}/month rent would fall within the 30% guideline. The rent problem is partly a salary problem.`,
        cta: { label: 'Re-run comp check', href: withUidPlaceholder('https://compverdict.com') },
      })
    }
  }

  // HIGH_SALARY_SOFTENS_RENT — strong salary offsets high rent
  if (comp.output.verdict === 'strong' && spend.output.rent_percent > 30) {
    insights.push({
      id: 'high_salary_softens_rent',
      priority: 3,
      source: 'cross',
      severity: 'neutral',
      headline: `Your strong salary partially offsets a high rent ratio`,
      detail: `You're above the 30% guideline on rent, but your top-${100 - comp.output.percentile}% salary gives you more buffer than most renters at this ratio.`,
    })
  }

  return insights
}

function trendInsights(
  spendEntries: SpendEntry[],
  compEntries: CompEntry[],
): VerdictInsight[] {
  const insights: VerdictInsight[] = []

  // RENT_TREND — compare two most recent spend entries
  if (spendEntries.length >= 2) {
    const [latest, prev] = spendEntries
    const delta = latest.output.rent_percent - prev.output.rent_percent
    const currency = latest.input.currency
    const annualDelta = Math.abs(delta / 100 * latest.input.annual_salary)

    if (delta > 2) {
      insights.push({
        id: 'rent_worsening',
        priority: 1,
        source: 'trend',
        severity: 'warning',
        headline: `Your rent burden has increased ${delta.toFixed(1)}pp since ${monthsAgo(prev.created_at)}`,
        detail: `Rent-to-income ratio moved from ${prev.output.rent_percent.toFixed(1)}% to ${latest.output.rent_percent.toFixed(1)}% — an effective ${fmt(annualDelta, currency)}/year increase in housing cost.`,
      })
    } else if (delta < -2) {
      insights.push({
        id: 'rent_improving',
        priority: 4,
        source: 'trend',
        severity: 'positive',
        headline: `Your rent burden has improved ${Math.abs(delta).toFixed(1)}pp since ${monthsAgo(prev.created_at)}`,
        detail: `Rent-to-income ratio dropped from ${prev.output.rent_percent.toFixed(1)}% to ${latest.output.rent_percent.toFixed(1)}% — equivalent to ${fmt(annualDelta, currency)}/year freed up.`,
      })
    }
  }

  // SALARY_TREND — compare two most recent comp entries
  if (compEntries.length >= 2) {
    const [latest, prev] = compEntries
    const delta = latest.output.percentile - prev.output.percentile

    if (delta < -5) {
      insights.push({
        id: 'salary_falling_behind',
        priority: 1,
        source: 'trend',
        severity: 'warning',
        headline: `Your market position has dropped ${Math.abs(delta)} percentile points since ${monthsAgo(prev.created_at)}`,
        detail: `Market benchmarks have moved. You were at the ${prev.output.percentile}th percentile — now at the ${latest.output.percentile}th. This is a signal to renegotiate.`,
        cta: { label: 'Re-run comp check', href: withUidPlaceholder('https://compverdict.com') },
      })
    } else if (delta > 5) {
      insights.push({
        id: 'salary_improving',
        priority: 4,
        source: 'trend',
        severity: 'positive',
        headline: `Your market position has improved ${delta} percentile points since ${monthsAgo(prev.created_at)}`,
        detail: `You moved from the ${prev.output.percentile}th to the ${latest.output.percentile}th percentile. Your compensation is becoming more competitive.`,
      })
    }
  }

  return insights
}

// ─── Placeholder for withUid — replaced by real util at runtime ───────────────

function withUidPlaceholder(url: string): string {
  // At runtime in each site, replace this with withUid() from verdictStorage
  return url
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface InsightInput {
  spendEntries: SpendEntry[]
  compEntries: CompEntry[]
}

/**
 * Generate all applicable insights, sorted by priority (most impactful first).
 * Pass the two most recent entries of each type — older entries are used for
 * trends only.
 */
export function generateInsights(input: InsightInput): VerdictInsight[] {
  const { spendEntries, compEntries } = input
  const all: VerdictInsight[] = []

  const latestSpend = spendEntries[0] as SpendEntry | undefined
  const latestComp  = compEntries[0]  as CompEntry  | undefined

  if (latestSpend) all.push(...spendInsights(latestSpend))
  if (latestComp)  all.push(...compInsights(latestComp))
  if (latestSpend && latestComp) all.push(...crossInsights(latestSpend, latestComp))

  all.push(...trendInsights(spendEntries, compEntries))

  // Sort by priority ascending, then severity (critical before warning before positive)
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0, warning: 1, neutral: 2, positive: 3,
  }
  return all.sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority
      : severityOrder[a.severity] - severityOrder[b.severity],
  )
}

/**
 * Returns a single headline insight — used in nav badges and email subjects.
 */
export function topInsight(input: InsightInput): VerdictInsight | null {
  return generateInsights(input)[0] ?? null
}

/**
 * Returns only cross-verdict insights — used in the Cross-Verdict section.
 */
export function crossVerdictInsights(input: InsightInput): VerdictInsight[] {
  return generateInsights(input).filter(i => i.source === 'cross')
}
