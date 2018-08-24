import * as timeseries from 'timeseries-analysis'

export type Timeseries = [number, number][] // timestamp, value

export class SafeSmoother {
  constructor(private alpha: number = 0.7) {}

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

  public smoothTimeseries(ts: Timeseries): Timeseries {
    const t = new timeseries.main(ts).smoother({
      period: this.period
    })
    const smoothTimeseriesData = t.slice().data
    return smoothTimeseriesData
  }
}
