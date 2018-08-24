import { Big } from "big.js";
import * as _ from 'lodash'
import { AssetSymbol } from "./Asset";

// roundtrips, transaction
export class PorfolioBalance {
  constructor(private amountsByAssets: Map<AssetSymbol, Big>) {
  }
  get size(): number {
    return this.amountsByAssets.size;
  }
  get assetSymbols(): AssetSymbol[] {
    return Array.from(this.amountsByAssets.keys());
  }
  quote(assetSymbol: AssetSymbol, exchangeRate: Big): Big | undefined {
    const baseAmount = this.amountsByAssets.get(assetSymbol);
    if (typeof baseAmount === 'undefined') {
      return undefined;
    }
    return baseAmount.times(exchangeRate);
  }

  toJSON() {
    const { amountsByAssets } = this
    return {
      amountsByAssets: Array.from(amountsByAssets.keys()).map((k) => ({[k]: amountsByAssets.get(k).toString()}))
    }
  }
}