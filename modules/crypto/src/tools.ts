import type { IToolInput, IModuleContext } from '@ai-super-app/sdk'

const SUPPORTED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'] as const
type CryptoSymbol = (typeof SUPPORTED_SYMBOLS)[number]

export interface IMarketDataInput extends IToolInput {
  symbol: string
}

export interface IMarketData {
  symbol: string
  price: number
  change24h: number
  volume: number
  fetchedAt: string
}

/**
 * In production: fetch from a real market data API endpoint
 * via ctx.ai or a dedicated data API.
 * For MVP: returns mock data to avoid direct external network calls from modules.
 */
export async function getMarketData(
  input: IMarketDataInput,
  _ctx: IModuleContext,
): Promise<IMarketData> {
  const symbol = input.symbol.toUpperCase()

  if (!SUPPORTED_SYMBOLS.includes(symbol as CryptoSymbol)) {
    throw new Error(`Unsupported symbol: ${symbol}. Supported: ${SUPPORTED_SYMBOLS.join(', ')}`)
  }

  // Mock data — replace with real API integration via orchestrator
  const MOCK_PRICES: Record<CryptoSymbol, number> = {
    BTC: 95_000,
    ETH: 3_400,
    SOL: 185,
    BNB: 420,
  }

  return {
    symbol,
    price: MOCK_PRICES[symbol as CryptoSymbol] ?? 0,
    change24h: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
    volume: Math.round(Math.random() * 1_000_000_000),
    fetchedAt: new Date().toISOString(),
  }
}
