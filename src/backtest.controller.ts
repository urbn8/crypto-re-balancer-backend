import { Get, Controller, Query, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import HistoricalPriceDataFetcher from './common/HistoricalPriceDataFetcher';
import { IAdvisor } from './common/Advisor';
import { Asset } from './common/Asset';
import * as cache from "./cache";
import { cacheKey, makeAdvisor, unsafeSmoother, timelineSmoother, build, neverPeriodicAdvisor, timeseries2xy, supportedAssetPairs, powerSet } from './backtest.helper';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async root(@Query() query) {
    try {
      console.log('default')
      const holdAdvisor = neverPeriodicAdvisor

      // TODO : assets

      const rebalancePeriod = parseInt(query.rebalancePeriod, 10)
      const rebalancePeriodUnit = query.rebalancePeriodUnit
      const investment = query.initialInvestment ? parseFloat(query.initialInvestment) : 5000
      const assets: Asset[] = query.assets.split(',').map((asset) => ({
        symbol: asset + 'USDT',
        name: asset,
      }))

      const rebalanceAdvisor: IAdvisor = makeAdvisor(rebalancePeriod, rebalancePeriodUnit)

      const rebalanced = await cache.getTimeseries(cacheKey(assets, investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
      if (rebalanced.length !== 0) {
        console.log('loading from cache',
          cacheKey(assets, investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
          cacheKey(assets, investment, holdAdvisor, [unsafeSmoother, timelineSmoother]),
        )
        const holdData = await cache.getTimeseries(cacheKey(assets, investment, holdAdvisor, [unsafeSmoother, timelineSmoother]))

        return {
          hold: timeseries2xy(holdData),
          rebalance: timeseries2xy(rebalanced),
        }
      }
      console.log('no cache found for ',
        cacheKey(assets, investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]),
          ' building backtest result',
      )

      let hold = await cache.getTimeseries(cacheKey(assets, investment, holdAdvisor, [unsafeSmoother, timelineSmoother]))
      if (hold.length === 0) {
        console.log('Start building for hold')
        hold = await build(assets, investment, holdAdvisor)
      }
      console.log('Done building for hold')

      let rebalance = await cache.getTimeseries(cacheKey(assets, investment, rebalanceAdvisor, [unsafeSmoother, timelineSmoother]))
      if (rebalance.length === 0) {
        console.log('Start building for rebalance')
        rebalance = await build(assets, investment, rebalanceAdvisor)
      }
      console.log('Done building for rebalance')

      return {
        hold: timeseries2xy(hold),
        rebalance: timeseries2xy(rebalanced),
      }
    } catch (err) {
      console.error(err)
      throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('historical')
  async historical() {
    const fetcher = new HistoricalPriceDataFetcher()
    await fetcher.execute()
    return {
      ok: true,
    }
  }

  @Get('index')
  async index() {
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

    const combinations: Asset[][] = powerSet(supportedAssetPairs).map((combination) => {
      return combination.map((asset) => ({
        symbol: asset + 'USDT',
        name: asset,
      }))
    })
    console.log('combinations: ', JSON.stringify(combinations))

    for (const advisor of rebalanceAdvisors) {
      for (const assets of combinations) {
        const rebalanced = await cache.getTimeseries(cacheKey(assets, investment, advisor, [unsafeSmoother, timelineSmoother]))
        if (rebalanced.length !== 0) {
          console.log('EXIST, skipping: ', cacheKey(assets, investment, advisor, [unsafeSmoother, timelineSmoother]))
          continue
        }

        await build(assets, 5000, advisor)
      }
    }

    return {
      success: true,
    }
  }
}
