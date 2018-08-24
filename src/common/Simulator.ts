import { IAdvisor } from "./Advisor";
import { Chandelier } from "./Chandelier";
import { MultiAssetsCandle } from "./MultiAssetsCandle";
import { PorfolioBalance } from "./PorfolioBalance";
import { PorfolioCandle } from "./PorfolioCandle";
import { RebalanceTransaction } from "./RebalanceTransaction";
import { BacktestResult } from "./BacktestResult";


export class Simulator {
  private totalFeeCosts = 0
  private totalTradedVolume = 0
  // private transactions: RebalanceTransaction[] = []
  private latestTransaction: RebalanceTransaction
  private transactionsCount = 0

  constructor(
    private initialPorfolioBalance: PorfolioBalance,
  ) {}

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

  async backtest(chandelier: Chandelier, advisor: IAdvisor): Promise<BacktestResult> {
    const multiAssetsCandle = await chandelier.load()
    const porfolioCandles = this.porfolioCandles(chandelier, advisor)

    console.log('transactionsCount', this.transactionsCount)

    return new BacktestResult(
      chandelier.assets,
      chandelier.candlesByAssets,
      multiAssetsCandle,
      porfolioCandles,
    )
  }

  porfolioCandles(chandelier: Chandelier, advisor: IAdvisor): PorfolioCandle[] {
    const porfolioCandles: PorfolioCandle[] = []
    console.log('chandelier.candles.length', chandelier.candles.length)
    for (const candle of chandelier.candles) {
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
    // if (this.transactions.length === 0) {
    //   this.transactions.push(new RebalanceTransaction(
    //     this.initialPorfolioBalance,
    //     candle.exchangeRate,
    //   ))
    //   return
    // }

    // this.transactions.push(new RebalanceTransaction(
    //   this.transactions[this.transactions.length - 1].rebalanced,
    //   candle.exchangeRate,
    // ))
  }
}
