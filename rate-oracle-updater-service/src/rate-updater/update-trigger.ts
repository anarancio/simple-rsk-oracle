import { loggingFactory } from '../logger'
import { RateProviderManager } from '../rate-provider'

const logger = loggingFactory('rate-updater-trigger')

export class RateUpdateTrigger {
  private readonly rateProviderManager: RateProviderManager
  private readonly updateRateCallback: (rate: number) => Promise<void>
  private readonly updateThreshold: number
  private readonly ratePollInterval: number
  private readonly updateInterval: number
  private intervalId?: NodeJS.Timeout
  private rateInContract = 0
  private lastUpdate = 0

  constructor (
    rateManager: RateProviderManager,
    rateUpdateThreshold: number,
    pollInterval: number,
    updateInterval: number,
    updateRateCallback: (rate: number) => Promise<void>
  ) {
    this.rateProviderManager = rateManager
    this.updateInterval = updateInterval
    this.updateThreshold = rateUpdateThreshold
    this.ratePollInterval = pollInterval
    this.updateRateCallback = updateRateCallback
  }

  private async updateRate (rate: number): Promise<void> {
    await this.updateRateCallback(rate)
    this.lastUpdate = Date.now()
    this.rateInContract = rate
  }

  private async checkRate (from: string, to: string): Promise<void> {
    const rate = await this.rateProviderManager.fetchRate(from, to)

    // Update oracle if reach update interval
    if (Date.now() - this.lastUpdate >= this.updateInterval) {
      logger.info('Trigger update oracle for interval')
      await this.updateRate(rate)
      return
    }

    // Calculate percentage change between current and previous rate
    const percentageChanges = Math.abs((rate - this.rateInContract) / this.rateInContract * 100)

    if (percentageChanges >= this.updateThreshold) {
      logger.info(`Trigger update oracle for threshold, changes is ${percentageChanges}% (current = ${rate}, previous = ${this.rateInContract})`)
      await this.updateRate(rate)
    }
  }

  async run (from: string, to: string): Promise<void> {
    const rate = await this.rateProviderManager.fetchRate(from, to)
    await this.updateRate(rate)

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
