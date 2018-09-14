"use strict";
import * as express from "express";

import CandleMgoRepo from '../common/CandleMgoRepo'
import backtest from "../common/backtest";
import { Chandelier } from '../common/Chandelier';
import { Asset } from "../common/Asset";
import { AdvisorPeriodic } from "../common/AdvisorPeriodic";
import { oneDayInMilliseconds } from "../common/intervalPresets";
import * as cache from "../cache";
import { Timeseries, UnsafeSmoother, SafeSmoother, TimelineSmoother } from "../common/TimeseriesHelper";
import { IAdvisor } from "../common/Advisor";
import HistoricalPriceDataFetcher from "../common/HistoricalPriceDataFetcher";

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

const cacheIndices = {
  raw(advisor: IAdvisor): string {
    return `${ from }_${ to }_${ advisor.name }_raw`
  },
  smooth(advisor: IAdvisor, smoothers: {readonly name: string}[]): string {
    return `${ from }_${ to }_${ advisor.name }_${ smoothers.map((e) => e.name).join('_') }`
  },
}

const neverPeriodicAdvisor = new AdvisorPeriodic(0, 0)
const onceADayPeriodicAdvisor = new AdvisorPeriodic(oneDayInMilliseconds, 0)
const advisors = [neverPeriodicAdvisor, onceADayPeriodicAdvisor]

const safeSmoother = new SafeSmoother(0.01)
const unsafeSmoother = new UnsafeSmoother(200)
const smoothers = [safeSmoother, unsafeSmoother]

const timelineSmoother = new TimelineSmoother(720) // once half day

async function build(advisor: IAdvisor) {
  const chandelier = new Chandelier(assets, candleRepo, from, to)
  const result = await backtest().backtest(chandelier, advisor)
  const timeseries = result.timeseries
  await cache.setTimeseries(cacheIndices.raw(advisor), timeseries)
  console.log('done: ', cacheIndices.raw(advisor))

  const smoothData = unsafeSmoother.smoothTimeseries(timeseries)
  await cache.setTimeseries(cacheIndices.smooth(advisor, [unsafeSmoother]), smoothData)
  console.log('done: ', cacheIndices.smooth(advisor, [unsafeSmoother]))

  const timelineSmoothData = timelineSmoother.smoothTimeseries(smoothData)
  await cache.setTimeseries(cacheIndices.smooth(advisor, [unsafeSmoother, timelineSmoother]), timelineSmoothData)
  console.log('done: ', cacheIndices.smooth(advisor, [unsafeSmoother, timelineSmoother]))

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

      for (const unit of rebalancePeriodUnits) {
        for (let i = 1; i <= 10; i++) {
          if (unit === 'hour' && i <= 6) {
            continue
          }

          rebalanceAdvisors.push(makeAdvisor(i, unit))
        }
      }

      for (const advisor of rebalanceAdvisors) {
        const rebalanced = await cache.getTimeseries(cacheIndices.smooth(advisor, [unsafeSmoother, timelineSmoother]))
        if (rebalanced.length !== 0) {
          console.log('EXIST, skipping: ', cacheIndices.smooth(advisor, [unsafeSmoother, timelineSmoother]))
          continue
        }

        await build(advisor)
      }

      res.json({
        success: true
      });

      // try {
      //   const chandelier = new Chandelier(assets, candleRepo, from, to)

      //   let source: 'new' | 'cache' = 'new'
      //   if (req.query.source) {
      //     source = req.query.source
      //   }

      //   for (const advisor of advisors) {
      //     let timeseries: Timeseries
          
      //     if (source === 'new') {
      //       const result = await backtest().backtest(chandelier, advisor)
      //       timeseries = result.timeseries
      //       await cache.setTimeseries(cacheIndices.raw(advisor), timeseries)
      //     } else {
      //       timeseries = await cache.getTimeseries(cacheIndices.raw(advisor))
      //     }
      //     console.log('done: ', cacheIndices.raw(advisor))

      //     for (const smoother of smoothers) {
      //       const smoothData = smoother.smoothTimeseries(timeseries)
      //       await cache.setTimeseries(cacheIndices.smooth(advisor, [smoother]), smoothData)
      //       console.log('done: ', cacheIndices.smooth(advisor, [smoother]))

      //       const timelineSmoothData = timelineSmoother.smoothTimeseries(smoothData)
      //       await cache.setTimeseries(cacheIndices.smooth(advisor, [smoother, timelineSmoother]), timelineSmoothData)
      //       console.log('done: ', cacheIndices.smooth(advisor, [smoother, timelineSmoother]))
      //     }
      //   }

      //   console.log('success')
      //   res.json({
      //     success: true
      //   });
      // } catch (err) {
      //   console.error(err)
      //   res.send({
      //     error: err,
      //   })
      // }
    }

    // default backtest
    async default(req: express.Request, res: express.Response, next: express.NextFunction) {
      console.log('default')
      const holdAdvisor = neverPeriodicAdvisor

      // TODO : assets

      const rebalancePeriod = parseInt(req.query.rebalancePeriod)
      const rebalancePeriodUnit = req.query.rebalancePeriodUnit
      
      const rebalanceAdvisor: IAdvisor = makeAdvisor(rebalancePeriod, rebalancePeriodUnit)

      const rebalanced = await cache.getTimeseries(cacheIndices.smooth(rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
      if (rebalanced.length !== 0) {
        console.log('loading from cache',
          cacheIndices.smooth(rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
          cacheIndices.smooth(holdAdvisor, [unsafeSmoother, timelineSmoother]),
        )
        const hold = await cache.getTimeseries(cacheIndices.smooth(holdAdvisor, [unsafeSmoother, timelineSmoother]))

        res.json({
          hold: timeseries2xy(hold),
          rebalance: timeseries2xy(rebalanced),
        })
        return
      }
      console.log('no cache found for ',
          cacheIndices.smooth(rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
          ' building backtest result'
      )

      let hold = await cache.getTimeseries(cacheIndices.smooth(holdAdvisor, [unsafeSmoother, timelineSmoother]))
      if (hold.length === 0) {
        hold = await build(holdAdvisor)
      }
      console.log('Done building for hold')

      let rebalance = await cache.getTimeseries(cacheIndices.smooth(rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
      if (rebalance.length === 0) {
        rebalance = await build(rebalanceAdvisor)
      }
      console.log('Done building for rebalance')

      res.json({
        hold: timeseries2xy(hold),
        rebalance: timeseries2xy(rebalanced),
      })
    }

    async get(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        let source: 'raw' | 'safesmooth' | 'unsafesmooth' | 'safesmooth_t' | 'unsafesmooth_t' = 'raw'
        if (req.query.source) {
          source = req.query.source
        }

        let hold, rebalanced
        if (source === 'raw') {
          hold = await cache.getTimeseries(cacheIndices.raw(neverPeriodicAdvisor))
          rebalanced = await cache.getTimeseries(cacheIndices.raw(onceADayPeriodicAdvisor))
        } else if (source === 'safesmooth') {
          hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother]))
          rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother]))
        } else if (source === 'unsafesmooth') {
          hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother]))
          rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother]))
        } else if (source === 'safesmooth_t') {
          hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother, timelineSmoother]))
          rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother, timelineSmoother]))
        } else if (source === 'unsafesmooth_t') {
          hold = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
          rebalanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
        }

        res.json({
          hold: timeseries2xy(hold),
          rebalance: timeseries2xy(rebalanced),
        });
      } catch (err) {
        console.error(err)
        res.send({
          error: err,
        })
      }
    }
  }
}
export = Route;
