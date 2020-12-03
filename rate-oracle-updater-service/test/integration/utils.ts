import config from 'config'
import { Server } from 'http'
import Eth from 'web3-eth'
import BigNumber from 'bignumber.js'
import { Contract } from 'web3-eth-contract'
import { AbiItem } from 'web3-utils'

import OracleContract from '../../src/oracle-contract/abi/SimpleRskOracle.json'
import { ethFactory } from '../../src/blockchain'
import { loggingFactory } from '../../src/logger'
import { appFactory } from '../../src/app'
import { Application } from '../../src/definitions'
import { sleep } from '../utils'

export class TestingApp {
  private readonly logger = loggingFactory('test:test-app')
  public server: undefined | Server
  public app: { stop: () => void, app: Application } | undefined
  public eth?: Eth
  public contract?: Contract
  public providerAccount?: string

  async initAndStart (options?: any, force = false): Promise<void> {
    if (this.app && !force) {
      return
    }
    // TODO add oracle contract deploy
    await this.init()
    this.logger.info('App initialized')
    await this.start(options)
    this.logger.info('App started')
  }

  async getRate (): Promise<any> {
    const res = await this.contract?.methods.getPricing().call()
    return new BigNumber(res.price).div(10 ** 18)
  }

  async init (): Promise<void> {
    // Init blockchain provider
    this.eth = await ethFactory()
    const [owner] = await this.eth.getAccounts()
    this.providerAccount = owner

    // Deploy oracle contract
    await this.deployOracleContract()

    // @ts-ignore
    config.oracle.contractAddress = this.contract?.options.address
  }

  async deployOracleContract (): Promise<void> {
    if (!this.eth || !this.providerAccount) {
      throw new Error('Provider should be initialized and has at least 2 accounts')
    }
    const contract = new this.eth.Contract(OracleContract.abi as AbiItem[])
    const deploy = await contract.deploy({ data: OracleContract.bytecode })
    this.contract = await deploy.send({ from: this.providerAccount, gas: await deploy.estimateGas() })
    await this.contract?.methods.addToWhitelist(this.providerAccount).send({ from: this.providerAccount })
  }

  async start (options?: Partial<any>): Promise<void> {
    // Run Upload service
    this.app = await appFactory()

    // Start server
    const port = config.get('port')
    this.server = this.app.app.listen(port)
    this.logger.info('Oracle rate service started')

    this.server.on('listening', () =>
      this.logger.info(`Server started on port ${port}`)
    )

    process.on('unhandledRejection', err =>
      this.logger.error(`Unhandled Rejection at: ${err}`)
    )
  }

  async stop (): Promise<void> {
    if (this.app) {
      await this.app.stop()
    }

    this.server?.close()
    this.app = undefined
    await sleep(1000)
  }
}
