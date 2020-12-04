import fetch from 'node-fetch'

import type { RateProvider } from '../definitions'
import { RateProviderError } from '../errors'
import { loggingFactory } from '../logger'

const logger = loggingFactory('crypto-compare-rate-provider')

export class CryptoCompareProvider implements RateProvider {
  private readonly url: string
  private readonly token: string

  constructor (url: string, token: string) {
    this.url = url
    this.token = token
  }

  public async fetchRate (from = 'BTC', to = 'USD'): Promise<number> {
    logger.debug(`Retrieving rate for ${from} to ${to}`)

    try {
      const response = await fetch(`${this.url}?fsyms=${from}&tsyms=${to}&api_key=${this.token}`, { method: 'GET' })
      const json = await response.json()
      logger.debug('Receive response', json)
      logger.debug(`Rate received ${from}/${to} = ${json[from][to]}`)
      return json[from][to]
    } catch (e) {
      throw new RateProviderError(e.message)
    }
  }
}
