import Binance, { CandleChartInterval } from 'binance-api-node'

import CandleMgoRepo from './CandleMgoRepo'

const client = Binance()

const candleRepo = new CandleMgoRepo()

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))

export default class HistoricalPriceDataFetcher {
  public async execute() {
    console.log('START')
    for (const symbol of ['BTCUSDT', 'EOSUSDT', 'ETHUSDT', 'BNBUSDT', 'NEOUSDT', 'BCCUSDT', 'TRXUSDT', 'XRPUSDT', 'ETCUSDT', 'LTCUSDT']) {
      console.log('symbol', symbol)
      await this.executeSymbol(symbol, '1m')
      await this.executeSymbol(symbol, '1h')
      await this.executeSymbol(symbol, '1d')
    }

    console.log('DONE')
  }

  public async executeSymbol(symbol: string, interval: CandleChartInterval) {
    const limit = 500
    // let tsLast = 1483243199000
    let tsLast = 1538366399000

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
