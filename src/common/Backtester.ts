import * as moment from 'moment'
import * as _ from 'lodash'
import { PeriodicRebalanceConfig, Porfolio, AssetBalance } from "./Rebalancer";

import CandleMgoRepo from './CandleMgoRepo'
import { CandleChartResult } from 'binance-api-node';

const candleRepo = new CandleMgoRepo()

interface BacktestAssetBalance {
  assetBalance: AssetBalance
  value: number
}

interface PorfolioTick {
  datetime: Date,
  assetBalances: BacktestAssetBalance[]
  sumValue: number
}

export default class Backtester {
  async oneYearBacktest(): Promise<[Porfolio, PorfolioTick[]]> {
    const porfolio: Porfolio = {
      account: 'Test',
      assetBalances: [
        {
          asset: {
            symbol: 'BTCUSDT',
            name: 'Bitcoin',
            icon: '',
            color: 'rgb(255, 205, 86)',
          },
          amount: 1,
        },
        {
          asset: {
            symbol: 'ETHUSDT',
            name: 'Ethereum',
            icon: '',
            color: 'rgb(153, 102, 255)',
          },
          amount: 10,
        },
        {
          asset: {
            symbol: 'BNBUSDT',
            name: 'BNB',
            icon: '',
            color: 'rgb(201, 203, 207)',
          },
          amount: 300,
        },
      ]
    } 

    const fromTime = moment().add(-1, 'year')
    const assetsCandles = await Promise.all(porfolio.assetBalances.map(async (assetBalance) => {
      const candles = await candleRepo.findAllSince(assetBalance.asset.symbol, '1d', fromTime.toDate())
      return candles
    }))

    const minOpenTime = this.minOpenTime(assetsCandles)
    const maxOpenTime = this.maxOpenTime(assetsCandles)

    let assetsReverseCandles = assetsCandles.map((candles) => candles.reverse())

    const timestamp1h = 86400000

    const porfolioTicks: PorfolioTick[] = []

    let lastTs = minOpenTime
    while (lastTs <= maxOpenTime) {
      const [currentAssetsCandle, remainedAssetsReverseCandles] = this.popCandleIfOpenAt(lastTs, assetsReverseCandles)
      assetsReverseCandles = remainedAssetsReverseCandles

      porfolioTicks.push(this.makePorfolioTick(porfolio.assetBalances, lastTs, currentAssetsCandle))

      lastTs += timestamp1h
    }

    return [porfolio, porfolioTicks]
  }

  makePorfolioTick(assetBalances: AssetBalance[], ts: number, assetsCandle: CandleChartResult[]): PorfolioTick {
    let sumValue = 0
    let backtestAssetBalances: BacktestAssetBalance[] = []

    let i = -1
    for (const assetBalance of assetBalances) {
      i++
      const candle = assetsCandle[i]
      if (!candle) {
        backtestAssetBalances.push({
          assetBalance,
          value: 0,
        })
        continue
      }

      // TODO: big.js
      const value = (+candle.close * assetBalance.amount)
      backtestAssetBalances.push({
        assetBalance,
        value,
      })
      sumValue += value
    }

    return {
      datetime: new Date(ts),
      assetBalances: backtestAssetBalances,
      sumValue,
    }
  }

  popCandleIfOpenAt(ts: number, assetsReverseCandles: CandleChartResult[][]): [CandleChartResult[], CandleChartResult[][]] {
    const currentAssetsCandle: CandleChartResult[] = []

    const remainedAssetsReverseCandles = assetsReverseCandles.map((reverseCandles: CandleChartResult[], i) => {
      const last: CandleChartResult = _.last<CandleChartResult>(reverseCandles)
      if (!last) {
        return reverseCandles
      }

      if (last.openTime !== ts) {
        return reverseCandles
      }

      const candle = reverseCandles.pop()
      currentAssetsCandle[i] = candle
      return reverseCandles
    })

    return [currentAssetsCandle, remainedAssetsReverseCandles]
  }

  minOpenTime(assetsCandles: CandleChartResult[][]): number {
    const assetsFirstCandle = assetsCandles.map((candles) => _.first(candles))
    const assetsCompactFirstCandle = _.compact(assetsFirstCandle)
    const minAssetCandle = _.minBy(assetsCompactFirstCandle, (candle) => candle.openTime)
    return minAssetCandle.openTime
  }

  maxOpenTime(assetsCandles: CandleChartResult[][]): number {
    const assetsFirstCandle = assetsCandles.map((candles) => _.last(candles))
    const assetsCompactFirstCandle = _.compact(assetsFirstCandle)
    const maxAssetCandle = _.maxBy(assetsCompactFirstCandle, (candle) => candle.openTime)
    return maxAssetCandle.openTime
  }

  async execute(
    fromTime: Date, toTime: Date,
    porfolio: Porfolio,
    strategy: PeriodicRebalanceConfig,
  ) {
    let time = moment(fromTime)

    const porfolioTicks: PorfolioTick[] = []

    // calculate porfolio value every hour
    while (time.valueOf() <= toTime.valueOf()) {
      const porfolioTick = await this.calculatePorfolioValue(porfolio.assetBalances, time)
      porfolioTicks.push(porfolioTick)

      time = time.add(1, 'hour')
    }

    return porfolioTicks
  }

  async calculatePorfolioValue(assets: AssetBalance[], time: moment.Moment): Promise<PorfolioTick> {
    let sumValue = 0
    let assetBalances: BacktestAssetBalance[] = []

    for (const asset of assets) {
      const candle = await candleRepo.findOneByOpenTime(asset.asset.symbol, '1h', time.toDate())
      if (!candle) {
        throw new Error(``)
      }

      // TODO: big.js
      const value = (+candle.close * asset.amount)
      assetBalances.push({
        assetBalance: asset,
        value,
      })
      sumValue += value
    }

    return {
      datetime: time.toDate(),
      assetBalances,
      sumValue,
    }
  }
}


interface ISimulator {
  calculate(candles, transactionFee)
}

interface IBacktest {
  start(advisor: TradingAdvisor, simulator: ISimulator)
}

interface TradingAdvisor {
  
}
