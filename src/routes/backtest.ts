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
    icon: '',
    color: 'rgb(255, 205, 86)',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
    icon: '',
    color: 'rgb(153, 102, 255)',
  },
  {
    symbol: 'BNBUSDT',
    name: 'BNB',
    icon: '',
    color: 'rgb(201, 203, 207)',
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
      try {
        const chandelier = new Chandelier(assets, candleRepo, from, to)

        let source: 'new' | 'cache' = 'new'
        if (req.query.source) {
          source = req.query.source
        }

        for (const advisor of advisors) {
          let timeseries: Timeseries
          
          if (source === 'new') {
            const result = await backtest().backtest(chandelier, advisor)
            timeseries = result.timeseries
            await cache.setTimeseries(cacheIndices.raw(advisor), timeseries)
          } else {
            timeseries = await cache.getTimeseries(cacheIndices.raw(advisor))
          }
          console.log('done: ', cacheIndices.raw(advisor))

          for (const smoother of smoothers) {
            const smoothData = smoother.smoothTimeseries(timeseries)
            await cache.setTimeseries(cacheIndices.smooth(advisor, [smoother]), smoothData)
            console.log('done: ', cacheIndices.smooth(advisor, [smoother]))

            const timelineSmoothData = timelineSmoother.smoothTimeseries(smoothData)
            await cache.setTimeseries(cacheIndices.smooth(advisor, [smoother, timelineSmoother]), timelineSmoothData)
            console.log('done: ', cacheIndices.smooth(advisor, [smoother, timelineSmoother]))
          }
        }

        console.log('success')
        res.json({
          success: true
        });
      } catch (err) {
        console.error(err)
        res.send({
          error: err,
        })
      }
    }

    async get(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        let source: 'raw' | 'safesmooth' | 'unsafesmooth' | 'safesmooth_t' | 'unsafesmooth_t' = 'raw'
        if (req.query.source) {
          source = req.query.source
        }

        let defaulta, balanced
        if (source === 'raw') {
          defaulta = await cache.getTimeseries(cacheIndices.raw(neverPeriodicAdvisor))
          balanced = await cache.getTimeseries(cacheIndices.raw(onceADayPeriodicAdvisor))
        } else if (source === 'safesmooth') {
          defaulta = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother]))
          balanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother]))
        } else if (source === 'unsafesmooth') {
          defaulta = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother]))
          balanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother]))
        } else if (source === 'safesmooth_t') {
          defaulta = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [safeSmoother, timelineSmoother]))
          balanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [safeSmoother, timelineSmoother]))
        } else if (source === 'unsafesmooth_t') {
          defaulta = await cache.getTimeseries(cacheIndices.smooth(neverPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
          balanced = await cache.getTimeseries(cacheIndices.smooth(onceADayPeriodicAdvisor, [unsafeSmoother, timelineSmoother]))
        }

        res.json({
          default: timeseries2xy(defaulta),
          balanced: timeseries2xy(balanced),
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
