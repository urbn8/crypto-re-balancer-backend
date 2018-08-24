import { Advice, IAdvisor, ICandle } from "./Advisor";

export class AdvisorPeriodic implements IAdvisor {
  private lastRebalance: number = 0 // timestamp
  private firstCandle: ICandle

  constructor(
    private readonly rebalanceInterval: number, // milliseconds
    private readonly kickoffDelay: number, // milliseconds
  ) {

  }

  update(candle: ICandle): Advice {
    if (!this.firstCandle) {
      this.firstCandle = candle
    }

    if (this.rebalanceInterval === 0) {
      return {
        action: 'hold'
      }
    }

    if (candle.timestamp < (this.firstCandle.timestamp + this.kickoffDelay)) {
      return {
        action: 'hold'
      }
    }

    if (this.lastRebalance === 0) {
      return this.rebalance(candle.timestamp)
    }
    
    if (this.lastRebalance + this.rebalanceInterval <= candle.timestamp) {
      return this.rebalance(candle.timestamp)
    }

    return {
      action: 'hold'
    }
  }

  rebalance(timestamp: number): Advice {
    this.lastRebalance = timestamp

    return {
      action: 'rebalance'
    }
  }
}
