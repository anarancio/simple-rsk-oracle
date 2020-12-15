import config from 'config'
import { Eth } from 'web3-eth'

import { Application, RateUpdaterService } from '../definitions'
import { loggingFactory } from '../logger'
import { RateOracleContract } from '../oracle-contract'
import { RateProviderManager } from '../rate-provider'
import { waitForReadyApp } from '../utils'
import { RateUpdateTrigger } from './update-trigger'

const logger = loggingFactory('rate-updater')

const rateUpdaterService: RateUpdaterService = {
  async initialize (app: Application): Promise<{ stop: () => Promise<void> }> {
    await waitForReadyApp(app)
    const rateProviderManager = app.get('rateProvider') as RateProviderManager
    const eth = app.get('eth') as Eth

    if (!config.has('oracle.account')) {
      throw new Error('Oracle provider account not configured!')
    }

    if (!config.has('rateUpdateThreshold')) {
      throw new Error('Rate update threshold not configured!')
    }

    if (!config.has('rateUpdateInterval')) {
      throw new Error('Rate update interval not configured!')
    }

    if (!config.has('rateApi.ratePollInterval')) {
      throw new Error('Rate poll interval not configured!')
    }

    const oracleContract = new RateOracleContract(eth, config.get<string>('oracle.account'))
    const oracleRate = await oracleContract.getPricing()
    logger.info(`Oracle data: rate = ${oracleRate.price}, updateAt = ${new Date(oracleRate.timestamp)}`)

    const updateRate = async (rate: number): Promise<void> => {
      logger.info(`Updating Oracle with rate ${rate}`)
      await oracleContract.updateRate(rate).catch(() => logger.error('Oracle updateRate transaction error'))
    }

    const rateUpdateTrigger = new RateUpdateTrigger(
      rateProviderManager,
      config.get<number>('rateUpdateThreshold'),
      config.get<number>('rateApi.ratePollInterval'),
      config.get<number>('rateUpdateInterval'),
      updateRate
    )

    // Run polling job for BTC/USD
    await rateUpdateTrigger.run('BTC', 'USD', oracleRate)

    return {
      // eslint-disable-next-line require-await
      stop: async () => {
        rateUpdateTrigger.stop()
      }
    }
  }
}

export default rateUpdaterService
