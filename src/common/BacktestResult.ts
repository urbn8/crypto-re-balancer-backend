import { MultiAssetsCandle } from "./MultiAssetsCandle";
import { PorfolioCandle } from "./PorfolioCandle";
import { AssetSymbol, Asset } from "./Asset";
import { Big } from "big.js";
import { CandleChartResult } from "binance-api-node";
import { Timeseries, SafeSmoother, UnsafeSmoother } from "./TimeseriesHelper";

// const smoother = new SafeSmoother(0.01)
const smoother = new UnsafeSmoother(5000)

// roundtrips, transaction
export class BacktestResult {
  constructor(public assets: Asset[], public candlesByAssets: Map<AssetSymbol, CandleChartResult[]>, public ohlcCandles: MultiAssetsCandle[], public porfolioCandles: PorfolioCandle[]) { }
  get porfolioBalanceHistoryXY(): {
    x: Date;
    y: number;
  }[] {

    let timeseries: Timeseries = this.porfolioCandles.map((candle): [number, number] => {
      return [candle.timestamp, Number(candle.totalQuoteBalance)]
    })
    console.log('1 timeseries: ', timeseries.length)

    timeseries = smoother.smoothTimeseries(timeseries)

    console.log('2 timeseries: ', timeseries.length)

    const history: {
      x: Date;
      y: number;
    }[] = timeseries.map((tick) => {
      return {
        x: new Date(tick[0]),
        y: tick[1],
      }
    })

    return history

    // this.porfolioCandles.forEach((candle) => {
    //   history.push({
    //     x: new Date(candle.timestamp),
    //     y: Number(candle.totalQuoteBalance)
    //   });
    // });

    // return history;
  }

  get assetsBalanceHistory(): Map<AssetSymbol, [number, Big][]> {
    const m: Map<AssetSymbol, [number, Big][]> = new Map();
    for (const asset of this.assets) {
      m.set(asset.symbol, []);
    }
    this.porfolioCandles.forEach((candle) => {
      const quoteBalancesByAssets = candle.quoteBalancesByAssets;
      for (const asset of this.assets) {
        const quoteBalance = quoteBalancesByAssets.get(asset.symbol);
        m.get(asset.symbol).push([candle.timestamp, quoteBalance]);
      }
    });
    return m;
  }

  get assetsBalanceHistoryXY(): Map<AssetSymbol, {
    x: number;
    y: number;
  }[]> {
    const m: Map<AssetSymbol, {
      x: number;
      y: number;
    }[]> = new Map();
    for (const asset of this.assets) {
      m.set(asset.symbol, []);
    }
    this.porfolioCandles.forEach((candle) => {
      const quoteBalancesByAssets = candle.quoteBalancesByAssets;
      for (const asset of this.assets) {
        const quoteBalance = quoteBalancesByAssets.get(asset.symbol);
        m.get(asset.symbol).push({
          x: candle.timestamp, y: Number(quoteBalance)
        });
      }
    });
    return m;
  }
}