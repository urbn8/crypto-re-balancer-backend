// import * as moment from 'moment'
// const LinvoDB = require('linvodb3')
// const Promise = require("bluebird")
// import { CandleChartResult, CandleChartInterval } from 'binance-api-node';
// import { mockComponent } from 'react-dom/test-utils';
// import CandleRepo from './CandleRepo'

// LinvoDB.defaults.store = { db: require("level-js") }; // Comment out to use LevelDB instead of level-js
// LinvoDB.dbPath = process.cwd()
// console.log('LinvoDB.dbPath: ', LinvoDB.dbPath)

// export default class CandleLinvodb3Repo implements CandleRepo {
//   private collection(symbol: string, interval: CandleChartInterval) {
//     const col = new LinvoDB(`candles_BINA_${symbol}_${ interval }`, { /* schema, can be empty */ })
//     Promise.promisifyAll(col.find().__proto__)
//     Promise.promisifyAll(col.save)
//     return col
//   }

//   async findAll(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]> {
//     const data = await this.collection(symbol, interval).find().execAsync()
//     return data
//   }

//   async findAllOneYear(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]> {
//     const data = await this.collection(symbol, interval).find<CandleChartResult>({
//       openTime: {
//         $gte: moment().add(-1, 'year').unix(),
//       }
//     }).execAsync()
//     return data
//   }

//   async findAllSince(symbol: string, interval: CandleChartInterval, since: Date): Promise<CandleChartResult[]> {
//     const data = await this.collection(symbol, interval).find<CandleChartResult>({
//       openTime: {
//         $gte: since.getTime(),
//       }
//     }).execAsync()
//     return data
//   }

//   async findOneByOpenTime(symbol: string, interval: CandleChartInterval, openTime: Date): Promise<CandleChartResult> {
//     const data = await this.collection(symbol, interval).findOne<CandleChartResult>({
//       openTime: openTime.valueOf(),
//     }).execAsync()
//     return data
//   }

//   async saveAll(symbol: string, interval: CandleChartInterval, candles: CandleChartResult[]) {
//     if (candles.length === 0) {
//       return
//     }

//     await this.collection(symbol, interval).saveAsync(candles.map((candle) => {
//       return {
//         _id: candle.openTime.toString(),
//         ...candle
//       }
//     }))
//   }
// }