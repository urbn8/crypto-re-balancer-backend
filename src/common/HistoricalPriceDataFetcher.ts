import Binance, { CandleChartInterval } from 'binance-api-node'
import * as moment from 'moment'

import CandleMgoRepo from './CandleMgoRepo'

const client = Binance()

const candleRepo = new CandleMgoRepo()

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))

export const fromTime = '2017-09-01'
export const toTime = '2018-09-27'

export default class HistoricalPriceDataFetcher {
  public async execute() {
    console.log('START')
    for (const symbol of [
      "BTCUSDT", "ETHUSDT",
      "BNBUSDT", "BCCUSDT", "NEOUSDT", "LTCUSDT",
      "QTUMUSDT", "ADAUSDT", "XRPUSDT", "TUSDUSDT",
      "XLMUSDT", "ONTUSDT", "TRXUSDT", "ETCUSDT",
      "ICXUSDT", "VENUSDT"]) {
      console.log('symbol', symbol)
      await this.executeSymbol(symbol, '1m')
      // await this.executeSymbol(symbol, '1h')
      // await this.executeSymbol(symbol, '1d')
    }

    console.log('DONE')
  }

  public async executeSymbol(symbol: string, interval: CandleChartInterval) {
    const limit = 500
    let tsLast = moment(fromTime).valueOf()
    // let tsLast = 1483243199000
    // let tsLast = 1538366399000

    while (true) {
      console.log('tsLast', tsLast)
      const data = await client.candles({
        symbol,
        interval,
        limit,
        startTime: tsLast,
      })
      console.log('data.length', data.length)

      if (data.length === 0) {
        break
      }

      await candleRepo.saveAll(symbol, interval, data)

      if (data.length !== limit) { // last
        break
      }

      tsLast = data[data.length - 1].closeTime + 1
      await sleep(100)
    }
  }
}
