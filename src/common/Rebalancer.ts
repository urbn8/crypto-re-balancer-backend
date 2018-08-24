import { Asset } from "./Asset";

export interface AssetBalance {
  asset: Asset
  amount: number
}

export interface Porfolio {
  account: string
  assetBalances: AssetBalance[]
}

interface AssetProportion {
  asset: Asset
  ratio: number
}

export interface PeriodicRebalanceConfig {
  everyHours: number
  assetProportions: AssetProportion[]
}

interface AssetValueGetter {
  (asset: Asset): Promise<number>
}

class Rebalancer {
  public async execute(
    assetBalances: AssetBalance[],
    assetProportionsConfig: AssetProportion[],
    assetValueGetter: AssetValueGetter,
  ): Promise<AssetBalance[]> {
    this.validateAssetsConfig(assetBalances, assetProportionsConfig)

    const assetValues = []
    for (const assetBalance of assetBalances) {
      const assetValue = await assetValueGetter(assetBalance.asset)
      assetValues.push(assetValue)
    }

    const totalBalance = assetValues.map((v, i) => {
      return v * assetBalances[i].amount
    }).reduce((currentValue, sum) => sum + currentValue, 0)

    const balancedAssetBalances = assetProportionsConfig.map((config): AssetBalance => {
      return {
        asset: config.asset,
        amount: totalBalance * config.ratio
      }
    })

    return balancedAssetBalances
  }

  private validateAssetsConfig(
    assetBalances: AssetBalance[],
    assetProportionsConfig: AssetProportion[],
  ) {
    if (assetBalances.length !== assetProportionsConfig.length) {
      throw new Error('mismatch assetBalances and assetProportionsConfig length')
    }

    const l = assetBalances.length
    for (let i = 0; i < l; i++) {
      if (assetBalances[i].asset.symbol !== assetProportionsConfig[i].asset.symbol) {
        throw new Error(`mismatch asset balance[${ assetBalances[i].asset.symbol }] with config[${ assetProportionsConfig[i].asset.symbol }] at balance position ${ i }`)
      }
    }
  }
}
