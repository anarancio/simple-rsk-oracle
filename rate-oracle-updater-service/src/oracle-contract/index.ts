import config from 'config'
import { Account } from 'web3-core'
import Eth, { TransactionReceipt } from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import BigNumber from 'bignumber.js'
import { AbiItem } from 'web3-utils'

import RateOracleAbi from './abi/SimpleRskOracle.json'
import { loggingFactory } from '../logger'
import { waitForReceipt } from './utils'

const logger = loggingFactory('oracle-contract')
const WEI = new BigNumber(10).pow(18)

export class RateOracleContract {
  private readonly eth: Eth
  private contract: Contract
  private account: Account

  constructor (eth: Eth, privateKey: string) {
    this.eth = eth
    this.account = this.eth.accounts.privateKeyToAccount(privateKey)
    this.contract = new eth.Contract(
        RateOracleAbi.abi as AbiItem[],
        config.get<string>('oracle.contractAddress')
    )
  }

  public async send (tx: any, gas: number | string, gasPrice: number | string, callBack: any): Promise<TransactionReceipt> {
    const encodedABI = tx.encodeABI()
    const signedTx = await this.account.signTransaction(
      {
        data: encodedABI,
        from: this.account.address,
        gas,
        gasPrice,
        to: this.contract.options.address
      }
    )
    return this.eth.sendSignedTransaction(signedTx.rawTransaction!, callBack)
  }

  async updateRate (rate: number): Promise<TransactionReceipt> {
    const gasPrice = await this.eth.getGasPrice()
      .catch((error: Error) => {
        logger.error('Error getting gas price, error:', error)
        throw error
      })
    logger.debug(`Send updateRate TX with rate ${new BigNumber(rate).times(WEI).toString(10)}, original rate = ${rate}`)
    const tx = this.contract.methods.updatePrice(new BigNumber(rate).times(WEI), Date.now())
    const gas = Math.ceil(await tx.estimateGas({
      from: this.account.address,
      gasPrice
    }) * 1.1)

    return await new Promise<TransactionReceipt>((resolve, reject) => {
      this.send(
        tx,
        gas,
        gasPrice,
        async (err: any, txHash: any) => {
          try {
            if (err) throw err
            const receipt = await waitForReceipt(txHash, this.eth)
            logger.debug('Receipt for oracle updateRate transaction', receipt)
            return resolve(receipt)
          } catch (e) {
            logger.error('Oracle updateRate transaction error', e)
            return reject(e)
          }
        })
    })
  }

  getPricing (): Promise<any> {
    const tx = this.contract.methods.getPricing()
    return tx.call()
  }
}
