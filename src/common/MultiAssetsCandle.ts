import { AssetSymbol } from "./Asset";
import { CandleChartResult } from "binance-api-node";
import { Big } from "big.js";

export class MultiAssetsCandle {
  constructor(
    public timestamp: number,
    public data: Map<AssetSymbol, CandleChartResult | undefined>,
  ) {}

  get exchangeRate(): Map<AssetSymbol, Big> {
    const data: Map<AssetSymbol, Big> = new Map()
    this.data.forEach((candle, assetSymbol) => {
      if (!candle) {
        data.set(assetSymbol, new Big(0))
        return
      }

      data.set(assetSymbol, new Big(candle.close))
    })

    return data
  }

  toJSON() {
    const { timestamp, data } = this
    return {
      timestamp,
      datetime: new Date(timestamp),
      data: Array.from(data.keys()).map((k) => ({[k]: data.get(k)}))
    }
  }

  static fromCandlesSet(timestamp: number, assetSymbols: AssetSymbol[], candlesSet: Map<AssetSymbol, CandleChartResult | undefined>): MultiAssetsCandle {
    if (assetSymbols.length !== candlesSet.size) {
      // console.error('assetSymbols', assetSymbols, 'candlesSet', candlesSet)
      throw new Error('assetSymbols.length !== candlesSet.length')
    }

    const data: Map<AssetSymbol, CandleChartResult> = new Map()
    for (const symbol of assetSymbols) {
      data.set(symbol, candlesSet.get(symbol))
    }

    return new MultiAssetsCandle(timestamp, data)
  }
}
