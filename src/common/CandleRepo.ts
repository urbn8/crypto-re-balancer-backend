import { CandleChartResult, CandleChartInterval } from "binance-api-node";

export default interface CandleRepo {

  findAll(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]>

  findAllOneYear(symbol: string, interval: CandleChartInterval): Promise<CandleChartResult[]>

  findAllSince(symbol: string, interval: CandleChartInterval, since: Date): Promise<CandleChartResult[]>
  findInRange(symbol: string, interval: CandleChartInterval, since: Date, to: Date): Promise<CandleChartResult[]>

  findOneByOpenTime(symbol: string, interval: CandleChartInterval, openTime: Date): Promise<CandleChartResult>

  saveAll(symbol: string, interval: CandleChartInterval, candles: CandleChartResult[])
}
