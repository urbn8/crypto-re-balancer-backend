import * as timeseries from 'timeseries-analysis'

export type Timeseries = [number, number][] // timestamp, value

export class SafeSmoother {
  constructor(private alpha: number = 0.7) {}

  get name(): string {
    return `safesm-${ this.alpha }`
  }

  public smoothTimeseries(ts: Timeseries): Timeseries {
    const t = new timeseries.main(ts).dsp_itrend({
      alpha: this.alpha,
    })
    const smoothTimeseriesData = t.slice().data
    return smoothTimeseriesData
  }
}

export class UnsafeSmoother {
  constructor(private period: number = 20) {}

  get name(): string {
    return `unsafesm-${ this.period }`
  }

  public smoothTimeseries(ts: Timeseries): Timeseries {
    const t = new timeseries.main(ts).smoother({
      period: this.period,
    })
    const smoothTimeseriesData = t.slice().data
    return smoothTimeseriesData
  }
}

export class TimelineSmoother {
  constructor(private period: number) {}

  get name(): string {
    return `tlsm-${ this.period }`
  }

  public smoothTimeseries(ts: Timeseries): Timeseries {
    if (ts.length === 0) {
      return []
    }

    let count = this.period
    const out: Timeseries = []
    // need to keep the first and last items
    for (const unit of ts) {
      if (count === this.period) {
        out.push(unit)
        count = 0
        continue
      }

      count++
    }

    if (out[out.length - 1][0] !== ts[out.length - 1][0]) {
      out.push(ts[out.length - 1])
    }

    return out
  }
}
