import config from 'config'

import { Application, RateProvider } from '../definitions'
import { loggingFactory } from '../logger'
import { CryptoCompareProvider } from './crypto-compare'

const logger = loggingFactory('rate-provider-manger')

export type RateEntity = { current: number, previous: number }

export class RateProviderManager {
  private provider?: RateProvider

  public register (provider: RateProvider): void {
    this.provider = provider
  }

  public fetchRate (from: string, to = 'USD'): Promise<number> {
    if (!this.provider) {
      throw new Error('Rate provider is not initialized!')
    }

    return this.provider.fetchRate(from, to)
  }
}

export default function (app: Application): void {
  const rateProviderManager = new RateProviderManager()
  const cryptoCompareProvider = new CryptoCompareProvider(config.get<string>('rateApi.url'), config.get<string>('rateApi.token'))
  rateProviderManager.register(cryptoCompareProvider)
  app.set('rateProvider', rateProviderManager)
}
