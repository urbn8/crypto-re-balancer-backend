import { IAdvisor } from "./Advisor";
import { Chandelier } from "./Chandelier";
import { MultiAssetsCandle } from "./MultiAssetsCandle";
import { PorfolioBalance } from "./PorfolioBalance";
import { PorfolioCandle } from "./PorfolioCandle";
import { RebalanceTransaction } from "./RebalanceTransaction";
import { BacktestResult } from "./BacktestResult";
import { AssetSymbol, Asset } from "./Asset";
import { Big } from "big.js";
import { CandleChartResult } from "binance-api-node";

export class Simulator {
  private totalFeeCosts = 0
  private totalTradedVolume = 0
  // private transactions: RebalanceTransaction[] = []
  private latestTransaction: RebalanceTransaction
  private transactionsCount = 0

  private initialPorfolioBalance: PorfolioBalance

  constructor(
    private assets: Asset[],
    investment: number,
    private priceCandles: MultiAssetsCandle[],
  ) {
    console.log('assets: ', assets)

    if (!priceCandles[0]) {
      throw new Error(`no candle found for assets ${ assets }`)
    }

    const initialPorfolio = this.initialPorfolio(investment, priceCandles[0])

    this.initialPorfolioBalance = new PorfolioBalance(
      initialPorfolio,
    )
  }

  get porfolioBalance(): PorfolioBalance {
    if (!this.latestTransaction) {
      return this.initialPorfolioBalance
    }

    return this.latestTransaction.rebalanced
    // if (this.transactions.length === 0) {
    //   return this.initialPorfolioBalance
    // }

    // return this.transactions[this.transactions.length - 1].rebalanced
  }

  public initialPorfolio(investment: number, firstCandle: MultiAssetsCandle): Map<AssetSymbol, Big> {
    const nonZeros = new Map<AssetSymbol, CandleChartResult>()
    firstCandle.data.forEach((candle, assetSymbol) => {
      if (!candle) return
      nonZeros.set(assetSymbol, candle)
    })

    const len = Array.from(nonZeros.values()).length
    const perSlotRatio = investment / len
    const investmentPerAsset = new Map<AssetSymbol, Big>()
    firstCandle.data.forEach((candle, assetSymbol) => {
      if (!candle) {
        investmentPerAsset.set(assetSymbol, new Big(0))
      }
      investmentPerAsset.set(assetSymbol, new Big(perSlotRatio))
    })

    return investmentPerAsset
  }

  async backtest(advisor: IAdvisor): Promise<BacktestResult> {
    // const multiAssetsCandle = await chandelier.load()
    const porfolioCandles = this.porfolioCandles(advisor)

    console.log('transactionsCount', this.transactionsCount)

    return new BacktestResult(
      this.assets,
      // chandelier.candlesByAssets,
      // multiAssetsCandle,
      porfolioCandles,
    )
  }

  porfolioCandles(advisor: IAdvisor): PorfolioCandle[] {
    const porfolioCandles: PorfolioCandle[] = []
    console.log('chandelier.candles.length', this.priceCandles.length)
    for (const candle of this.priceCandles) {
      // console.log('candle', JSON.stringify(candle))
      const advice = advisor.update(candle)
      if (advice.action === 'rebalance') {
        this.rebalance(candle)
      }

      const porfolioCandle = new PorfolioCandle(candle.timestamp, this.porfolioBalance, candle.exchangeRate)
      porfolioCandles.push(porfolioCandle)
    }

    // console.log('porfolioCandles', JSON.stringify(porfolioCandles))
    return porfolioCandles
  }

  rebalance(candle: MultiAssetsCandle) {
    this.transactionsCount = this.transactionsCount + 1

    if (!this.latestTransaction) {
      this.latestTransaction = new RebalanceTransaction(
        this.initialPorfolioBalance,
        candle.exchangeRate,
      )
      return
    }

    this.latestTransaction = new RebalanceTransaction(
      this.latestTransaction.rebalanced,
      candle.exchangeRate,
    )
  }
}
