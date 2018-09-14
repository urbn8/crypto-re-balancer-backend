import { Db, MongoClient } from "mongodb";
import { Timeseries } from "./common/TimeseriesHelper";

var url = process.env.MONGO || 'mongodb://localhost:27017/crypto-re-balancer';

let db = null
function connect(): Promise<Db> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    MongoClient.connect(url, { useNewUrlParser: true }, (err, mgoClient) => {
      if (err) {
        reject(err)
        return
      }

      db = mgoClient.db('cache')

      resolve(db)
    })
  })
}

export async function setTimeseries(k: string, v: Timeseries) {
  const conn = await connect()

  await conn.createCollection('timeseries')
  const col = await conn.collection('timeseries')
  const exist = await col.indexExists('key')
  if (!exist) {
    await col.createIndex('key', {
      name: 'key',
      unique: false,
    })
  }

  const bulk = col.initializeUnorderedBulkOp()

  for (const ts of v) {
    bulk
      .find({_id: k + '_' + ts[0]})
      .upsert().updateOne({v: ts[1], t: ts[0], key: k})
  }

  await bulk.execute()
}

export async function getTimeseries(k: string): Promise<Timeseries> {
  const conn = await connect()

  const result = await conn.collection('timeseries').find({key: k}).sort({_id: 1}).toArray()
  return result.map((object): [number, number] => [object.t, object.v])
}
