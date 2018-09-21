"use strict";
import * as express from "express";

import CandleMgoRepo from '../common/CandleMgoRepo'
import { Chandelier } from '../common/Chandelier';
import { Asset, AssetSymbol } from "../common/Asset";
import { AdvisorPeriodic } from "../common/AdvisorPeriodic";
import { oneDayInMilliseconds } from "../common/intervalPresets";
import * as cache from "../cache";
import { Timeseries, UnsafeSmoother, SafeSmoother, TimelineSmoother } from "../common/TimeseriesHelper";
import { IAdvisor } from "../common/Advisor";
import HistoricalPriceDataFetcher from "../common/HistoricalPriceDataFetcher";
import { Simulator } from "../common/Simulator";
import { PorfolioBalance } from "../common/PorfolioBalance";
import { Big } from "big.js";

const candleRepo = new CandleMgoRepo()

const assets: Asset[] = [
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
  },
  {
    symbol: 'BNBUSDT',
    name: 'BNB',
  },
]

// const from = '2017-07-23T00:00:00.000Z'
// const to = '2018-08-23T00:00:00.000Z'
const from = '2017-07-23'
const to = '2018-08-23'

function timeseries2xy(timeseries: Timeseries): {
  x: Date;
  y: number;
}[] {
  return timeseries.map((t) => {
    return {
      x: new Date(t[0]),
      y: t[1],
    }
  })
}

// const cacheIndices = {
//   raw(advisor: IAdvisor): string {
//     return `${ from }_${ to }_${ advisor.name }_raw`
//   },
//   smooth(advisor: IAdvisor, smoothers: {readonly name: string}[]): string {
//     return `${ from }_${ to }_${ advisor.name }_${ smoothers.map((e) => e.name).join('_') }`
//   },
// }

function cacheKey(investment: number, advisor: IAdvisor, smoothers?: {readonly name: string}[]) {
  const parts: string[] = []
  parts.push(`${ investment }`)
  parts.push(`${ from }-${ to }`)
  parts.push(advisor.name)
  if (smoothers) {
    parts.push(smoothers.map((sm) => sm.name).join('-'))
  }

  return parts.join('_')
}

const neverPeriodicAdvisor = new AdvisorPeriodic(0, 0)
const onceADayPeriodicAdvisor = new AdvisorPeriodic(oneDayInMilliseconds, 0)
const advisors = [neverPeriodicAdvisor, onceADayPeriodicAdvisor]

const safeSmoother = new SafeSmoother(0.01)
const unsafeSmoother = new UnsafeSmoother(200)
const smoothers = [safeSmoother, unsafeSmoother]

const timelineSmoother = new TimelineSmoother(720) // once half day

async function build(investment: number, advisor: IAdvisor) {
  const chandelier = new Chandelier(assets, candleRepo, from, to)
  const assetCandles = await chandelier.fetchCandles()

  const backtester = new Simulator(assets, investment, assetCandles)
  
  const result = await backtester.backtest(advisor)
  const timeseries = result.timeseries
  await cache.setTimeseries(cacheKey(investment, advisor), timeseries)
  console.log('done: ', cacheKey(investment, advisor))

  const smoothData = unsafeSmoother.smoothTimeseries(timeseries)
  await cache.setTimeseries(cacheKey(investment, advisor, [unsafeSmoother]), smoothData)
  console.log('done: ', cacheKey(investment, advisor, [unsafeSmoother]))

  const timelineSmoothData = timelineSmoother.smoothTimeseries(smoothData)
  await cache.setTimeseries(cacheKey(investment, advisor, [unsafeSmoother, timelineSmoother]), timelineSmoothData)
  console.log('done: ', cacheKey(investment, advisor, [unsafeSmoother, timelineSmoother]))

  return timelineSmoothData
}

function makeAdvisor(rebalancePeriod: number, rebalancePeriodUnit: string) {
  let rebalanceAdvisor: IAdvisor
  switch (rebalancePeriodUnit) {
    case 'hour':
      rebalanceAdvisor = new AdvisorPeriodic(rebalancePeriod * 3600000, 0)
      break
    case 'day':
      rebalanceAdvisor = new AdvisorPeriodic(rebalancePeriod * 86400000, 0)
      break
    case 'week':
      rebalanceAdvisor = new AdvisorPeriodic(rebalancePeriod * 604800000, 0)
      break
    case 'never':
      rebalanceAdvisor = neverPeriodicAdvisor
      break
    default:
      throw new Error('unsupported rebalancePeriodUnit: ' + rebalancePeriodUnit)
  }

  return rebalanceAdvisor
}

module Route {
  export class Backtest {

    async fetchData(req: express.Request, res: express.Response, next: express.NextFunction) {
      const fetcher = new HistoricalPriceDataFetcher()
      await fetcher.execute()
      res.send({
        ok: true,
      })
    }

    async indexData(req: express.Request, res: express.Response, next: express.NextFunction) {

      const rebalanceAdvisors: IAdvisor[] = []
      const rebalancePeriodUnits = ['hour', 'day', 'week', 'never']
      const investment = 5000

      for (const unit of rebalancePeriodUnits) {
        for (let i = 1; i <= 10; i++) {
          if (unit === 'hour' && i <= 6) {
            continue
          }

          rebalanceAdvisors.push(makeAdvisor(i, unit))
        }
      }

      for (const advisor of rebalanceAdvisors) {
        const rebalanced = await cache.getTimeseries(cacheKey(investment, advisor, [unsafeSmoother, timelineSmoother]))
        if (rebalanced.length !== 0) {
          console.log('EXIST, skipping: ', cacheKey(investment, advisor, [unsafeSmoother, timelineSmoother]))
          continue
        }

        await build(5000, advisor)
      }

      res.json({
        success: true
      });
    }

    // default backtest
    async default(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        console.log('default')
        const holdAdvisor = neverPeriodicAdvisor

        // TODO : assets

        const rebalancePeriod = parseInt(req.query.rebalancePeriod)
        const rebalancePeriodUnit = req.query.rebalancePeriodUnit
        const investment = req.query.initialInvestment ? parseFloat(req.query.initialInvestment) : 5000

        const rebalanceAdvisor: IAdvisor = makeAdvisor(rebalancePeriod, rebalancePeriodUnit)

        const rebalanced = await cache.getTimeseries(cacheKey(investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
        if (rebalanced.length !== 0) {
          console.log('loading from cache',
            cacheKey(investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
            cacheKey(investment, holdAdvisor, [unsafeSmoother, timelineSmoother]),
          )
          const hold = await cache.getTimeseries(cacheKey(investment, holdAdvisor, [unsafeSmoother, timelineSmoother]))

          res.json({
            hold: timeseries2xy(hold),
            rebalance: timeseries2xy(rebalanced),
          })
          return
        }
        console.log('no cache found for ',
          cacheKey(investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
            ' building backtest result'
        )

        let hold = await cache.getTimeseries(cacheKey(investment, holdAdvisor, [unsafeSmoother, timelineSmoother]))
        if (hold.length === 0) {
          console.log('Start building for hold')
          hold = await build(investment, holdAdvisor)
        }
        console.log('Done building for hold')

        let rebalance = await cache.getTimeseries(cacheKey(investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
        if (rebalance.length === 0) {
          console.log('Start building for rebalance')
          rebalance = await build(investment, rebalanceAdvisor)
        }
        console.log('Done building for rebalance')

        res.json({
          hold: timeseries2xy(hold),
          rebalance: timeseries2xy(rebalanced),
        })
      } catch(err) {
        console.error(err)
        res.status(500).json({
          err,
        })
      }
    }

    // async get(req: express.Request, res: express.Response, next: express.NextFunction) {
    //   try {
    //     let source: 'raw' | 'safesmooth' | 'unsafesmooth' | 'safesmooth_t' | 'unsafesmooth_t' = 'raw'
    //     if (req.query.source) {
    //       source = req.query.source
    //     }

    //     let hold, rebalanced
    //     if (source === 'raw') {
    //       hold = await cache.getTimeseries(cacheKey(investment, neverPeriodicAdvisor))
    //       rebalanced = await cache.getTimeseries(cacheKey(investment, onceADayPeriodicAdvisor))
    //     } else if (source === 'safesmooth') {
    //       hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother]))
    //       rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother]))
    //     } else if (source === 'unsafesmooth') {
    //       hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother]))
    //       rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother]))
    //     } else if (source === 'safesmooth_t') {
    //       hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother, timelineSmoother]))
    //       rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother, timelineSmoother]))
    //     } else if (source === 'unsafesmooth_t') {
    //       hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
    //       rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
    //     }

    //     res.json({
    //       hold: timeseries2xy(hold),
    //       rebalance: timeseries2xy(rebalanced),
    //     });
    //   } catch (err) {
    //     console.error(err)
    //     res.send({
    //       error: err,
    //     })
    //   }
    // }
  }
}
export = Route;
