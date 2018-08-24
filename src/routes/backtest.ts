"use strict";
import * as express from "express";

import CandleMgoRepo from '../common/CandleMgoRepo'
import backtest from "../common/backtest";
import { Chandelier } from '../common/Chandelier';
import { Asset } from "../common/Asset";
import { AdvisorPeriodic } from "../common/AdvisorPeriodic";
import { oneDayInMilliseconds } from "../common/intervalPresets";
import * as cache from "../cache";
import { Timeseries, UnsafeSmoother, SafeSmoother } from "../common/TimeseriesHelper";

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

const from = '2017-07-23T00:00:00.000Z'
const to = '2018-08-23T00:00:00.000Z'

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

module Route {
  export class Backtest {

    async index(req: express.Request, res: express.Response, next: express.NextFunction) {
      console.log('index')
      try {
        const defaulta = await cache.getTimeseries(`${ from }_${ to }_once_a_day`)
        const balanced = await cache.getTimeseries(`${ from }_${ to }_default`)

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

    async smooth(req: express.Request, res: express.Response, next: express.NextFunction) {
      console.log('smooth')
      try {
        const defaulta = await cache.getTimeseries(`${ from }_${ to }_once_a_day_smooth`)
        const balanced = await cache.getTimeseries(`${ from }_${ to }_default_smooth`)

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

    async buildCache(req: express.Request, res: express.Response, next: express.NextFunction) {
      console.log('buildCache')
      try {
        const chandelier = new Chandelier(assets, candleRepo, from, to)
        {
          const balanceOnceADayResult = await backtest().backtest(chandelier, new AdvisorPeriodic(oneDayInMilliseconds, 0))
          await cache.setTimeseries(`${ from }_${ to }_once_a_day`, balanceOnceADayResult.timeseries)

          console.log('balanceOnceADayResult')
        }
        
        {
          const noBalanceResult = await backtest().backtest(chandelier, new AdvisorPeriodic(0, 0))
          await cache.setTimeseries(`${ from }_${ to }_default`, noBalanceResult.timeseries)

          console.log('noBalanceResult')
        }

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

    async buildSmoothCache(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        const defaulta = await cache.getTimeseries(`${ from }_${ to }_once_a_day`)
        const balanced = await cache.getTimeseries(`${ from }_${ to }_default`)

        const smoother = new SafeSmoother(0.01)

        await cache.setTimeseries(`${ from }_${ to }_once_a_day_smooth`, smoother.smoothTimeseries(defaulta))
        await cache.setTimeseries(`${ from }_${ to }_default_smooth`, smoother.smoothTimeseries(balanced))

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
  }
}
export = Route;
