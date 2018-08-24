"use strict";
import * as express from "express";

import CandleMgoRepo from '../common/CandleMgoRepo'
import backtest from "../common/backtest";
import { Chandelier } from '../common/Chandelier';
import { Asset } from "../common/Asset";
import { AdvisorPeriodic } from "../common/AdvisorPeriodic";
import { oneDayInMilliseconds } from "../common/intervalPresets";

const candleRepo = new CandleMgoRepo()

module Route {
  export class Backtest {

    async index(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        const assets: Asset[] = [
          {
            symbol: 'BTCUSDT',
            name: 'Bitcoin',
            icon: '',
            color: 'rgb(255, 205, 86)',
          },
          {
            symbol: 'ETHUSDT',
            name: 'Ethereum',
            icon: '',
            color: 'rgb(153, 102, 255)',
          },
          {
            symbol: 'BNBUSDT',
            name: 'BNB',
            icon: '',
            color: 'rgb(201, 203, 207)',
          },
        ]
  
        const balanceOnceADayResult = await backtest().backtest(new Chandelier(assets, candleRepo), new AdvisorPeriodic(oneDayInMilliseconds, 0))
        const noBalanceResult = await backtest().backtest(new Chandelier(assets, candleRepo), new AdvisorPeriodic(0, 0))
  
        res.json({
          default: noBalanceResult.porfolioBalanceHistoryXY,
          balanced: balanceOnceADayResult.porfolioBalanceHistoryXY,
        });
      } catch (err) {
        console.error(err)
        res.send({
          error: err,
        })
      }
    }
  }
}
export = Route;
