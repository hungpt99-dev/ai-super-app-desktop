import React, { useCallback, useEffect, useState } from 'react'
import { getDesktopBridge } from '../../lib/bridge.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IMarketData {
  symbol: string
  price: number
  change24h: number
  volume: number
  marketCap: number
  high24h: number
  low24h: number
  fetchedAt: string
}

interface IAiAnalysis {
  output: string
  tokensUsed: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'] as const
type CryptoSymbol = (typeof SYMBOLS)[number]

const SYMBOL_NAMES: Record<CryptoSymbol, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'positive' | 'negative' | 'neutral'
}): React.JSX.Element {
  const color =
    highlight === 'positive'
      ? 'text-emerald-400'
      : highlight === 'negative'
        ? 'text-red-400'
        : 'text-[var(--color-text-primary)]'
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-secondary)]">{sub}</p>}
    </div>
  )
}

function Spinner(): React.JSX.Element {
  return (
    <svg
      className="animate-spin text-[var(--color-accent)]"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ICryptoPanelProps {
  /** Back-navigation handler — required in standalone mode, unused in embedded mode. */
  onBack?: () => void
  /** When true, hides the panel header so it can live inside another layout (e.g. BotsPanel). */
  embedded?: boolean
}

/**
 * CryptoPanel — real-time market data + AI analysis for crypto assets.
 *
 * Data source: modules.invokeTool('crypto', 'get_market_data', { symbol })
 * Analysis:    ai.generate('analysis', prompt)
 */
export function CryptoPanel({ onBack, embedded = false }: ICryptoPanelProps): React.JSX.Element {
  const [activeSymbol, setActiveSymbol] = useState<CryptoSymbol>('BTC')
  const [marketData, setMarketData] = useState<IMarketData | null>(null)
  const [analysis, setAnalysis] = useState<IAiAnalysis | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMarketData = useCallback(async (symbol: CryptoSymbol) => {
    setIsLoadingData(true)
    setError(null)
    try {
      const bridge = getDesktopBridge()
      const result = (await bridge.modules.invokeTool('crypto', 'get_market_data', {
        symbol,
      })) as IMarketData
      setMarketData(result)
      setLastUpdated(new Date())
      setAnalysis(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    void fetchMarketData(activeSymbol)
  }, [activeSymbol, fetchMarketData])

  const handleAnalyze = async () => {
    if (!marketData) return
    setIsLoadingAnalysis(true)
    setAnalysis(null)
    try {
      const bridge = getDesktopBridge()
      const prompt =
        `Analyze the current ${marketData.symbol} market data: ` +
        `Price $${marketData.price.toLocaleString()}, ` +
        `24h change ${marketData.change24h > 0 ? '+' : ''}${String(marketData.change24h)}%, ` +
        `volume $${(marketData.volume / 1e9).toFixed(2)}B. ` +
        `Give a short market outlook and one key risk.`
      const result = await bridge.ai.generate('analysis', prompt, { symbol: marketData.symbol })
      setAnalysis(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoadingAnalysis(false)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

  const fmtVol = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`

  return (
    <div className={embedded ? 'flex flex-col' : 'flex h-full flex-col bg-[var(--color-bg)]'}>
      {/* Header — only shown in standalone mode */}
      {!embedded && (
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="text-xl">📈</div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Crypto Analysis</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <button
          onClick={() => { void fetchMarketData(activeSymbol) }}
          disabled={isLoadingData}
          className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingData ? <Spinner /> : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          )}
          Refresh
        </button>
      </div>
      )}

      <div className={embedded ? 'px-1 py-3' : 'flex-1 overflow-y-auto px-6 py-5'}>
        {/* Embedded toolbar: symbol switcher + refresh in a compact row */}
        {embedded && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setActiveSymbol(s) }}
                  className={[
                    'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                    s === activeSymbol
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => { void fetchMarketData(activeSymbol) }}
                disabled={isLoadingData}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
              >
                {isLoadingData ? <Spinner /> : '↻'} Refresh
              </button>
            </div>
          </div>
        )}
        {/* Symbol tabs — standalone mode only */}
        {!embedded && (
        <div className="mb-5 flex gap-2">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => { setActiveSymbol(s) }}
              className={[
                'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                s === activeSymbol
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Price hero */}
        {isLoadingData && !marketData ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : marketData ? (
          <>
            <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-1 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {fmt(marketData.price)}
                </span>
                <span
                  className={[
                    'rounded-full px-2.5 py-0.5 text-sm font-semibold',
                    marketData.change24h >= 0
                      ? 'bg-emerald-950/50 text-emerald-400'
                      : 'bg-red-950/30 text-red-400',
                  ].join(' ')}
                >
                  {marketData.change24h >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(marketData.change24h).toFixed(2)}%
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {SYMBOL_NAMES[activeSymbol]} · 24h change
              </p>
            </div>

            {/* Stat grid */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="24h High"
                value={fmt(marketData.high24h)}
                highlight="positive"
              />
              <StatCard
                label="24h Low"
                value={fmt(marketData.low24h)}
                highlight="negative"
              />
              <StatCard
                label="Volume"
                value={fmtVol(marketData.volume)}
              />
              <StatCard
                label="Market Cap"
                value={fmtVol(marketData.marketCap)}
              />
            </div>

            {/* AI Analysis section */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Market Analysis</h3>
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={isLoadingAnalysis}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingAnalysis && <Spinner />}
                  {isLoadingAnalysis ? 'Analyzing…' : '✦ Analyze'}
                </button>
              </div>

              {analysis ? (
                <div className="animate-fade-in">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {analysis.output}
                  </p>
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                    {analysis.tokensUsed} tokens used
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Click "Analyze" to get an AI-powered market outlook for {activeSymbol}.
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
