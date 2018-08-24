import * as moment from 'moment'
import * as _ from 'lodash'
import { PeriodicRebalanceConfig, Porfolio, AssetBalance } from "./Rebalancer";
import { Asset } from "./Asset";
import { CandleChartResult, CandleChartInterval } from 'binance-api-node';
import { Big } from 'big.js';

type AmountsByAssets = Map<Asset, {
  baseAmount: number
  quoteAmount: number
}>

class RebalanceSession {
  rebalanced: AmountsByAssets

  constructor(
    private datetime: Date
  ) {}

  get amountByAsset(): AmountsByAssets {
    return this.rebalanced
  }

  get sumBaseAmount() {
    let sum = 0
    for (const v of this.rebalanced.values()) {
      sum += v.baseAmount
    }

    return sum
  }

  get sumQuoteAcount() {
    let sum = 0
    for (const v of this.rebalanced.values()) {
      sum += v.quoteAmount
    }

    return sum
  }
}

class RebalanceSessionsSet {

}

interface ICandleBalance {
  readonly amountsByAssets: AmountsByAssets
}

// class RebalanceCandle {
//   private candleData: CandleChartResult
//   private rebalanceSessions: RebalanceSession[]
//   private balance: ICandleBalance

//   constructor(
    

//   ) {

//   }

//   get amountByAsset(): AmountsByAssets {
//     return this.balance.amountsByAssets
//   }

//   static fromPrevCandle(prevCandle: RebalanceCandle): RebalanceCandle {
    
//   }
// }

// function rebalance(prevCandle: RebalanceCandle): RebalanceCandle {

// }





