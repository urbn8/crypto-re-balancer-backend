import { Db, MongoClient } from "mongodb";
import * as slug from 'slug'
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

  const col = await conn.collection(k)
  await col.deleteMany({})

  const bulk = col.initializeUnorderedBulkOp()

  for (const ts of v) {
    bulk
      .find({_id: ts[0]})
      .upsert().updateOne({v: ts[1]})
  }

  await bulk.execute()
}

export async function getTimeseries(k: string): Promise<Timeseries> {
  const conn = await connect()

  const result = await conn.collection(k).find().toArray()
  return result.map((object): [number, number] => [object._id, object.v])
}
