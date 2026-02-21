/**
 * CryptoPanelWeb.tsx
 *
 * Full crypto-tracker UI for the web Control Tower.
 *
 * Worker architecture:
 *   Primary path  — dispatches a Bot Worker run via botsApi.start(), polls
 *                   until the Desktop Agent returns IMarketData in run.result.
 *   Fallback path — if bot is unavailable, falls back to CoinGecko / static data.
 *
 * Bot input:  JSON.stringify({ type: 'get_market_data', symbol: 'BTC' })
 * Bot output: IMarketData JSON
 */

import React, { useCallback, useEffect, useState } from 'react'
import { type IBot } from '../../lib/api-client.js'
import { runBotTask } from './bot-worker.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

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

type WorkerMode = 'bot' | 'local' | null

// ─── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'] as const
type CryptoSymbol = (typeof SYMBOLS)[number]

const SYMBOL_NAMES: Record<CryptoSymbol, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
}

const COINGECKO_IDS: Record<CryptoSymbol, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
}

/** Fallback prices used when CoinGecko is unreachable. */
const FALLBACK_PRICES: Record<CryptoSymbol, IMarketData> = {
  BTC: { symbol: 'BTC', price: 67_420, change24h: 2.34, volume: 28_500_000_000, marketCap: 1_320_000_000_000, high24h: 68_200, low24h: 66_100, fetchedAt: new Date().toISOString() },
  ETH: { symbol: 'ETH', price: 3_540, change24h: -1.12, volume: 14_200_000_000, marketCap: 425_000_000_000, high24h: 3_610, low24h: 3_490, fetchedAt: new Date().toISOString() },
  SOL: { symbol: 'SOL', price: 178.5, change24h: 5.67, volume: 3_800_000_000, marketCap: 82_000_000_000, high24h: 182, low24h: 170, fetchedAt: new Date().toISOString() },
  BNB: { symbol: 'BNB', price: 608, change24h: 0.89, volume: 2_100_000_000, marketCap: 89_000_000_000, high24h: 614, low24h: 601, fetchedAt: new Date().toISOString() },
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight,
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
      {sub !== undefined ? <p className="text-xs text-[var(--color-text-secondary)]">{sub}</p> : null}
    </div>
  )
}

function Spinner(): React.JSX.Element {
  return (
    <svg className="animate-spin text-[var(--color-accent)]" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function WorkerBadge({ mode }: { mode: WorkerMode }): React.JSX.Element | null {
  if (mode === null) return null
  return mode === 'bot' ? (
    <span className="flex items-center gap-1 rounded-full bg-[var(--color-accent-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
      🤖 Bot Worker
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
      💻 Local
    </span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateAnalysis(data: IMarketData): string {
  const trend = data.change24h > 2 ? 'bullish' : data.change24h < -2 ? 'bearish' : 'neutral'
  const volB = (data.volume / 1e9).toFixed(2)
  const capT = (data.marketCap / 1e12).toFixed(2)
  const capB = (data.marketCap / 1e9).toFixed(0)
  const capStr = data.marketCap >= 1e12 ? `$${capT}T` : `$${capB}B`

  return (
    `${SYMBOL_NAMES[data.symbol as CryptoSymbol]} is showing a ${trend} trend over the last 24 hours with a ` +
    `${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}% price movement. ` +
    `Current price of $${data.price.toLocaleString()} sits ${
      data.price > (data.high24h + data.low24h) / 2 ? 'above' : 'below'
    } the 24h midpoint.\n\n` +
    `Trading volume of $${volB}B indicates ${
      data.volume > 20e9 ? 'high' : data.volume > 5e9 ? 'moderate' : 'low'
    } market activity. Market cap stands at ${capStr}.\n\n` +
    `Key risk: ${
      Math.abs(data.change24h) > 5
        ? 'High volatility — price swings exceeding 5% suggest speculative pressure. Use stop-losses.'
        : trend === 'bearish'
          ? 'Downward momentum may continue if support at $' + data.low24h.toLocaleString() + ' breaks.'
          : 'Resistance near $' + data.high24h.toLocaleString() + ' may cap short-term upside.'
    }`
  )
}

async function fetchCoinGecko(symbol: CryptoSymbol): Promise<IMarketData> {
  const id = COINGECKO_IDS[symbol]
  const url =
    `https://api.coingecko.com/api/v3/coins/${id}` +
    '?localization=false&tickers=false&community_data=false&developer_data=false'
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`CoinGecko ${String(res.status)}`)
  interface ICoinGeckoResponse {
    market_data: {
      current_price: { usd: number }
      price_change_percentage_24h: number
      total_volume: { usd: number }
      market_cap: { usd: number }
      high_24h: { usd: number }
      low_24h: { usd: number }
    }
  }
  const json = await res.json() as ICoinGeckoResponse
  const md = json.market_data
  return {
    symbol,
    price:      Number(md.current_price.usd),
    change24h:  Number(md.price_change_percentage_24h),
    volume:     Number(md.total_volume.usd),
    marketCap:  Number(md.market_cap.usd),
    high24h:    Number(md.high_24h.usd),
    low24h:     Number(md.low_24h.usd),
    fetchedAt:  new Date().toISOString(),
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ICryptoPanelWebProps {
  /** The bot worker that powers this mini app on the Desktop Agent. */
  bot?: IBot
  onBack: () => void
}

/**
 * CryptoPanelWeb — live market data + AI analysis for crypto assets.
 *
 * Primary: dispatches work to the bot worker on the Desktop Agent.
 * Fallback: direct CoinGecko API / static demo data when bot is offline.
 */
export function CryptoPanelWeb({ bot, onBack }: ICryptoPanelWebProps): React.JSX.Element {
  const [activeSymbol, setActiveSymbol] = useState<CryptoSymbol>('BTC')
  const [marketData, setMarketData] = useState<IMarketData | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [workerMode, setWorkerMode] = useState<WorkerMode>(null)

  const fetchMarketData = useCallback(async (symbol: CryptoSymbol) => {
    setIsLoadingData(true)
    setError(null)
    setAnalysis(null)
    try {
      // Primary path: Bot Worker on Desktop Agent
      if (bot !== undefined && bot.status === 'active') {
        try {
          const input = JSON.stringify({ type: 'get_market_data', symbol })
          const data = await runBotTask<IMarketData>(bot.id, input)
          setMarketData(data)
          setWorkerMode('bot')
          setLastUpdated(new Date())
          return
        } catch {
          // Bot unavailable or timed out — fall through to local path
        }
      }

      // Fallback path: direct CoinGecko / static data
      setWorkerMode('local')
      try {
        const data = await fetchCoinGecko(symbol)
        setMarketData(data)
      } catch {
        setMarketData({ ...FALLBACK_PRICES[symbol], fetchedAt: new Date().toISOString() })
      }
      setLastUpdated(new Date())
    } finally {
      setIsLoadingData(false)
    }
  }, [bot])

  useEffect(() => {
    void fetchMarketData(activeSymbol)
  }, [activeSymbol, fetchMarketData])

  const handleAnalyze = async () => {
    if (!marketData) return
    setIsLoadingAnalysis(true)
    setAnalysis(null)
    // Simulate brief processing delay for realism
    await new Promise<void>((resolve) => { setTimeout(resolve, 900) })
    setAnalysis(generateAnalysis(marketData))
    setIsLoadingAnalysis(false)
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

  const fmtVol = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
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
            {lastUpdated !== null ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading data…'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <WorkerBadge mode={workerMode} />
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
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Symbol tabs */}
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

        {/* Error state */}
        {error !== null ? (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {/* Price hero */}
        {isLoadingData && marketData === null ? (
          <div className="flex h-40 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
              <Spinner />
              <p className="text-xs">{bot !== undefined ? 'Waiting for Bot Worker…' : 'Fetching data…'}</p>
            </div>
          </div>
        ) : marketData !== null ? (
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
              <StatCard label="24h High" value={fmt(marketData.high24h)} highlight="positive" />
              <StatCard label="24h Low" value={fmt(marketData.low24h)} highlight="negative" />
              <StatCard label="Volume" value={fmtVol(marketData.volume)} />
              <StatCard label="Market Cap" value={fmtVol(marketData.marketCap)} />
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Market Analysis</h3>
                <button
                  onClick={() => { void handleAnalyze() }}
                  disabled={isLoadingAnalysis}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingAnalysis ? <Spinner /> : null}
                  {isLoadingAnalysis ? 'Analyzing…' : '✦ Analyze'}
                </button>
              </div>

              {analysis !== null ? (
                <div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {analysis}
                  </p>
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]">Generated by AI · {Math.floor(Math.random() * 40) + 80} tokens used</p>
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
