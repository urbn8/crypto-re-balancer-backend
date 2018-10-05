import { Db, MongoClient } from "mongodb";
import { Timeseries } from "./common/TimeseriesHelper";

const url = process.env.MONGO || 'mongodb://192.168.10.61:27017/crypto-re-balancer';
// const url = process.env.MONGO || 'mongodb://localhost:27017/crypto-re-balancer';

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

function chunkArray(myArray, chunk_size){
  let index = 0;
  const arrayLength = myArray.length;
  const tempArray = [];

  for (index = 0; index < arrayLength; index += chunk_size) {
      const myChunk = myArray.slice(index, index + chunk_size);
      // Do something if you want with the group
      tempArray.push(myChunk);
  }

  return tempArray;
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

  const chunks = chunkArray(v, 5000)
  for (const chunk of chunks) {

    const bulk = col.initializeUnorderedBulkOp()

    for (const ts of chunk) {
      bulk
        .find({_id: k + '_' + ts[0]})
        .upsert().updateOne({v: ts[1], t: ts[0], key: k})
    }

    try {
      await bulk.execute()
    } catch (err) {
      console.error(`error while insert for key ${ k } value ${ chunk }`)
      throw err
    }
  }
}

export async function getTimeseries(k: string): Promise<Timeseries> {
  const conn = await connect()

  const result = await conn.collection('timeseries').find({key: k}).sort({_id: 1}).toArray()
  return result.map((object): [number, number] => [object.t, object.v])
}
