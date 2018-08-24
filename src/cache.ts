var cacheManager = require('cache-manager');
var mongoStore = require('cache-manager-mongodb');

var ttl = 60000000;

let mongoCache = null

// using promises with createCollectionCallback that handles race conditions.
const mongoCachePromise = () => {
  return new Promise((resolve) => {
    if (mongoCache) {
      resolve(mongoCache)
      return
    }

    mongoCache = cacheManager.caching({
      store: mongoStore,
      uri: 'mongodb://localhost:27017/crypto-re-balancer',
      options: {
        host: '127.0.0.1',
        port: '27017',

        // username: 'username',
        // password: 'pass',
        database: 'crypto-re-balancer',
        collection: 'cache',
        compression: false,
        server: {
          poolSize: 5,
          auto_reconnect: true,
        },
      },
      createCollectionCallback: () => {
        console.log('done creating cache collection');
        return resolve(mongoCache);
      },
    });
  });
};

export function set(k: string, v) {
  return new Promise((resolve, reject) => {
    mongoCachePromise().then((cache: any) => {
      cache.set(k, v, ttl, function(err) {
        if (err) {
          reject(err)
          return
        }
  
        resolve()
      })
    })
  })
}

export function get(k: string) {
  return new Promise((resolve, reject) => {
    mongoCachePromise().then((cache: any) => {
      cache.get(k, function(err, v) {
        if (err) {
          reject(err)
          return
        }
  
        resolve(v)
      })
    })
  })
}
