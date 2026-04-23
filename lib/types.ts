// ─── Site identifiers ────────────────────────────────────────────────────────

export type VerdictSiteId = 'spend' | 'comp' | 'salary' | 'city' | 'earn' | 'path'

// ─── Domain types ─────────────────────────────────────────────────────────────

export type SpendTier   = 'comfortable' | 'normal' | 'stretch' | 'risky'
export type CompVerdict = 'weak' | 'fair' | 'strong'

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface VerdictProfile {
  id: string           // UUID v4, generated client-side
  created_at: string   // ISO 8601
  first_site: VerdictSiteId
}

// ─── Entry inputs ─────────────────────────────────────────────────────────────

export interface SpendInput {
  annual_salary: number
  monthly_rent: number
  city: string
  currency: string
}

export interface CompInput {
  role: string
  city: string
  annual_salary: number
  currency: string
  yoe: number
  bonus: number
  equity: number
  total_comp: number
}

// ─── Entry outputs ────────────────────────────────────────────────────────────

export interface SpendOutput {
  rent_percent: number            // 0–100, user's rent-to-income %
  tier: SpendTier
  monthly_overspend: number       // vs 30% guideline; positive = over
  rent_amount_percentile: number  // % of city renters paying less than this
  city_ratio_p50: number          // city median rent-to-income ratio
  city_median_rent_low: number
  city_median_rent_high: number
}

export interface CompOutput {
  percentile: number              // 0–100
  verdict: CompVerdict
  gap_to_median: number           // p50 − totalComp; negative = above median
  salary_p25: number
  salary_p50: number
  salary_p75: number
  band: string                    // 'junior' | 'mid' | 'senior' | 'staff'
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export interface VerdictEntry<TInput = unknown, TOutput = unknown> {
  id: string
  profile_id: string
  type: VerdictSiteId
  created_at: string

  // Denormalized top-level fields for cross-verdict queries
  city: string
  annual_salary: number
  currency: string

  input: TInput
  output: TOutput
}

export type SpendEntry = VerdictEntry<SpendInput, SpendOutput>
export type CompEntry  = VerdictEntry<CompInput, CompOutput>

// ─── Convenience union for dashboard reads ────────────────────────────────────

export type AnyEntry = SpendEntry | CompEntry | VerdictEntry
