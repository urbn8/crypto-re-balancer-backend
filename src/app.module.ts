import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BacktestController } from './backtest.controller';

@Module({
  imports: [],
  controllers: [AppController, BacktestController],
  providers: [AppService],
})
export class AppModule {}
