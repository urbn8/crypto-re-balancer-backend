"use strict";
import * as cache from "../cache";
import { IAdvisor } from "../common/Advisor";
import { AdvisorPeriodic } from "../common/AdvisorPeriodic";
import { Asset } from "../common/Asset";
import CandleMgoRepo from '../common/CandleMgoRepo';
import { Chandelier } from '../common/Chandelier';
import { oneDayInMilliseconds } from "../common/intervalPresets";
import { Simulator } from "../common/Simulator";
import { SafeSmoother, TimelineSmoother, Timeseries, UnsafeSmoother } from "../common/TimeseriesHelper";


const candleRepo = new CandleMgoRepo()

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

function cacheKey(assets: Asset[], investment: number, advisor: IAdvisor, smoothers?: {readonly name: string}[]) {
  const parts: string[] = []
  parts.push(assets.map((a) => a.symbol).sort().join('-'))
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

async function build(assets: Asset[], investment: number, advisor: IAdvisor) {
  const chandelier = new Chandelier(assets, candleRepo, from, to)
  const assetCandles = await chandelier.fetchCandles()

  const backtester = new Simulator(assets, investment, assetCandles)
  
  const result = await backtester.backtest(advisor)
  const timeseries = result.timeseries
  await cache.setTimeseries(cacheKey(assets, investment, advisor), timeseries)
  console.log('done: ', cacheKey(assets, investment, advisor))

  const smoothData = unsafeSmoother.smoothTimeseries(timeseries)
  await cache.setTimeseries(cacheKey(assets, investment, advisor, [unsafeSmoother]), smoothData)
  console.log('done: ', cacheKey(assets, investment, advisor, [unsafeSmoother]))

  const timelineSmoothData = timelineSmoother.smoothTimeseries(smoothData)
  await cache.setTimeseries(cacheKey(assets, investment, advisor, [unsafeSmoother, timelineSmoother]), timelineSmoothData)
  console.log('done: ', cacheKey(assets, investment, advisor, [unsafeSmoother, timelineSmoother]))

  return timelineSmoothData
}

// receive message from master process
process.on('message', async (message) => {
  console.log('')
})
