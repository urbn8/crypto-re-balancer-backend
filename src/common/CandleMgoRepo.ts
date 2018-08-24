import * as moment from 'moment'
import { MongoClient, Db } from 'mongodb'
import { CandleChartResult, CandleChartInterval } from 'binance-api-node';
import CandleRepo from './CandleRepo';

var url = process.env.MONGO || 'mongodb://localhost:27017';

export default class CandleMgoRepo implements CandleRepo {
  private db?: Db

  private collection(symbol: string, interval: CandleChartInterval) {
    return `BINA_${symbol}_${ interval }`
  }

  connect(): Promise<Db> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db)
        return
      }

      MongoClient.connect(url, (err, mgoClient) => {
        if (err) {
          reject(err)
          return
        }
        
        this.db = mgoClient.db('crypto-re-balancer')
        resolve(this.db)
      })
    })
  }

  async findAll(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]> {
    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))

    const data = await col.find<CandleChartResult>().toArray()
    return data
  }

  async findAllOneYear(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]> {
    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))

    const data = await col.find<CandleChartResult>({
      openTime: {
        $gte: moment().add(-1, 'year').unix(),
      }
    }).toArray()
    return data
  }

  async findAllSince(symbol: string, interval: CandleChartInterval, since: Date): Promise<CandleChartResult[]> {
    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))

    const data = await col.find<CandleChartResult>({
      openTime: {
        $gte: since.getTime(),
      }
    }).toArray()
    return data
  }

  async findInRange(symbol: string, interval: CandleChartInterval, since: Date, to: Date): Promise<CandleChartResult[]> {
    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))

    const data = await col.find<CandleChartResult>({
      openTime: {
        $gte: since.getTime(),
        $lte: to.getTime(),
      }
    }).toArray()
    return data
  }

  async findOneByOpenTime(symbol: string, interval: CandleChartInterval, openTime: Date): Promise<CandleChartResult> {
    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))

    const data = await col.findOne<CandleChartResult>({
      openTime: openTime.valueOf(),
    })
    return data
  }

  async saveAll(symbol: string, interval: CandleChartInterval, candles: CandleChartResult[]) {
    if (candles.length === 0) {
      return
    }

    const db = await this.connect()
    const col = db.collection(this.collection(symbol, interval))
    const bulk = col.initializeUnorderedBulkOp()

    for (const candle of candles) {
      bulk
        .find({_id: candle.openTime.toString()})
        .upsert().updateOne(candle)
    }

    await bulk.execute()
  }
}