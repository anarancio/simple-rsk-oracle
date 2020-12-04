import { EventEmitter } from 'events'

import { loggingFactory } from '../logger'
import { RateProviderManager } from '../rate-provider'

const logger = loggingFactory('rate-updater-trigger')
export const OracleUpdateEvent = 'ORACLE_UPDATE'

export class RateUpdateTrigger extends EventEmitter {
  private readonly rateProviderManager: RateProviderManager
  private readonly updateThreshold: number
  private readonly ratePollInterval: number
  private readonly updateInterval: number
  private intervalId?: NodeJS.Timeout
  private lastUpdate = 0

  constructor (
    rateManager: RateProviderManager,
    rateUpdateThreshold: number,
    pollInterval: number,
    updateInterval: number
  ) {
    super()
    this.rateProviderManager = rateManager
    this.updateInterval = updateInterval
    this.updateThreshold = rateUpdateThreshold
    this.ratePollInterval = pollInterval
  }

  private async checkRate (from: string, to: string): Promise<void> {
    const rate = await this.rateProviderManager.fetchRate(from, to)

    // Update oracle if reach update interval
    if (Date.now() - this.lastUpdate >= this.updateInterval) {
      this.lastUpdate = Date.now()
      logger.info('Trigger update oracle for interval')
      this.emit(OracleUpdateEvent, rate)
      return
    }

    // Calculate percentage change between current and previous rate
    const { current, previous } = this.rateProviderManager.getLastRate(from, to)
    const percentageChanges = Math.abs((current - previous) / previous * 100)

    if (percentageChanges >= this.updateThreshold) {
      logger.info(`Trigger update oracle for threshold, changes is ${percentageChanges}% (current = ${current}, previous = ${previous})`)
      this.emit(OracleUpdateEvent, current)
      this.lastUpdate = Date.now()
    }
  }

  async run (from: string, to: string): Promise<void> {
    const rate = await this.rateProviderManager.fetchRate(from, to)
    this.lastUpdate = Date.now()
    this.emit(OracleUpdateEvent, rate)

    this.intervalId = setInterval(
      async () => {
        await this.checkRate(from, to).catch(e => logger.error('Check rate error, ', e.message))
      },
      this.ratePollInterval
    )
  }

  stop (): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }
}
