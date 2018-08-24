import * as moment from 'moment';
import * as _ from 'lodash'
import { Asset, AssetSymbol } from "./Asset";
import CandleRepo from "./CandleRepo";
import { MultiAssetsCandle } from "./MultiAssetsCandle";
import { MultiAssetsCandleFactory } from "./MultiAssetsCandleFactory";
import { CandleChartResult } from 'binance-api-node';

export class Chandelier {
  public candles: MultiAssetsCandle[]
  public candlesByAssets: Map<AssetSymbol, CandleChartResult[]>

  constructor(
    public assets: Asset[],
    private candleRepo: CandleRepo,
  ) {

  }

  async load() {
    // const fromTime = moment().add(-10, 'day')
    // const fromTime = moment('2017-11-07')
    // const fromTime = moment('2018-02-09')
    // const toTime = moment('2018-02-10')
    // const fromTime = moment('2018-08-10')
    // const fromTime = moment('Fri May 01 2018 09:31:00 GMT+0700 (+07)')
    const fromTime = moment('2017-07-23T00:00:00.000Z')
    const toTime = moment('2018-08-23T00:00:00.000Z')
    let candlesOfAssets = await Promise.all(this.assets.map(async (asset) => {
      // const candles = await this.candleRepo.findAllSince(asset.symbol, '1m', fromTime.toDate())
      const candles = await this.candleRepo.findInRange(asset.symbol, '1m', fromTime.toDate(), toTime.toDate())
      // const candles = await this.candleRepo.findInRange(asset.symbol, '1h', fromTime.toDate(), toTime.toDate())
      // console.log('candles.length', asset.symbol, candles.length, JSON.stringify(candles))
      return candles
    }))
    candlesOfAssets = this.roundToMinuteCandlesOfAssets(candlesOfAssets)

    // TODO: trim candles at the end to make sure they all finished at the same time interval?

    // this.analyzeCandlesOfAssets(candlesOfAssets)

    this.candlesByAssets = new Map()
    this.assets.map((asset, i) => {
      this.candlesByAssets.set(asset.symbol, candlesOfAssets[i])
    })

    const fac = new MultiAssetsCandleFactory(this.assets, candlesOfAssets)
    // console.log('fac.candles.length', fac.candles.length, JSON.stringify(fac.candles))
    this.candles = fac.candles
    return this.candles
  }

  /*
  sometimes, openTime of the candles at the same time interval unit might have some diff:
  Chandelier.ts?ad0c:51 BTCUSDT
  Chandelier.ts?ad0c:56 1518193694789 Fri Feb 09 2018 23:28:14 GMT+0700 (+07)
  Chandelier.ts?ad0c:51 ETHUSDT
  Chandelier.ts?ad0c:56 1518193694800 Fri Feb 09 2018 23:28:14 GMT+0700 (+07)
  Chandelier.ts?ad0c:51 BNBUSDT
  Chandelier.ts?ad0c:56 1518193695787 Fri Feb 09 2018 23:28:15 GMT+0700 (+07)
  */
 roundToMinuteCandlesOfAssets(candlesOfAssets: CandleChartResult[][]): CandleChartResult[][] {
  return candlesOfAssets.map((candles) => {
    return candles.map((candle) => {
      candle.openTime = moment(candle.openTime).startOf('minute').valueOf()
      return candle
    })
  })
 }

  analyzeCandlesOfAssets(candlesOfAssets: CandleChartResult[][]) {
    console.log('=====')
    const max = _.max(candlesOfAssets.map(candles => candles.length))
    console.log('max', max)
    for (let i = 0; i < max; i++) {
      this.assets.map((asset, j) => {
        console.log(asset.symbol)
        const candle = candlesOfAssets[j][i]
        if (!candle) {
          console.log(candle)
        } else {
          console.log(candle.openTime, new Date(candle.openTime))
        }
      })
      console.log('-----')
    }
    console.log('=====')
  }
}
