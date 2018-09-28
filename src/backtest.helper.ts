import { Asset } from "./common/Asset";
import { IAdvisor } from "./common/Advisor";
import { Chandelier } from "./common/Chandelier";
import { Simulator } from "./common/Simulator";
import CandleMgoRepo from "./common/CandleMgoRepo";
import { Timeseries, SafeSmoother, UnsafeSmoother, TimelineSmoother } from "./common/TimeseriesHelper";
import * as cache from "./cache";
import { AdvisorPeriodic } from "./common/AdvisorPeriodic";
import { fromTime, toTime } from "./common/HistoricalPriceDataFetcher";

const candleRepo = new CandleMgoRepo()

export const supportedAssetPairs = [
  "BTCUSDT", "ETHUSDT",
  "BNBUSDT", "BCCUSDT", "NEOUSDT", "LTCUSDT",
  "QTUMUSDT", "ADAUSDT", "XRPUSDT", "TUSDUSDT",
  "XLMUSDT", "ONTUSDT", "TRXUSDT", "ETCUSDT",
  "ICXUSDT", "VENUSDT"]

export function timeseries2xy(timeseries: Timeseries): {
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

export function cacheKey(assets: Asset[], investment: number, advisor: IAdvisor, smoothers?: {readonly name: string}[]) {
  const parts: string[] = []
  parts.push(assets.map((a) => a.symbol).sort().join('-'))
  parts.push(`${ investment }`)
  parts.push(`${ fromTime }-${ toTime }`)
  parts.push(advisor.name)
  if (smoothers) {
    parts.push(smoothers.map((sm) => sm.name).join('-'))
  }

  return parts.join('_')
}

export const safeSmoother = new SafeSmoother(0.01)
export const unsafeSmoother = new UnsafeSmoother(200)
export const timelineSmoother = new TimelineSmoother(720) // once half day

export async function build(assets: Asset[], investment: number, advisor: IAdvisor) {
  const chandelier = new Chandelier(assets, candleRepo, fromTime, toTime)
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

export const neverPeriodicAdvisor = new AdvisorPeriodic(0, 0)

export function makeAdvisor(rebalancePeriod: number, rebalancePeriodUnit: string) {
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

export function powerSet( list: string[] ): string[][] {
  const set: string[][] = []
  const listSize = list.length
  const combinationsCount = (1 << listSize)
  let combination: string[] = []

  for (let i = 1; i < combinationsCount ; i++ ){
      combination = [];
      for (let j = 0; j < listSize; j++) {
          if ((i & (1 << j))){
              combination.push(list[j]);
          }
      }
      set.push(combination);
  }
  return set;
}