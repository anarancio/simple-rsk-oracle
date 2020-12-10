import config from 'config'
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { RateProviderManager } from '../../src/rate-provider'
import { sleep } from '../utils'

import { TestingApp } from './utils'

chai.use(sinonChai)
const expect = chai.expect

describe('Oracle rates updater service', function () {
  this.timeout(60000)
  let app: TestingApp
  let fetchRateStub: sinon.SinonStub

  before(() => {
    fetchRateStub = sinon.stub(RateProviderManager.prototype, 'fetchRate')
  })
  after(() => {
    sinon.restore()
    sinon.resetBehavior()
  })

  it('Should update rate based on update interval', async () => {
    // @ts-ignore
    config.rateUpdateThreshold = 100
    // @ts-ignore
    config.rateUpdateInterval = 2000
    fetchRateStub.resolves(2)

    app = new TestingApp()
    await app.initAndStart()
    await sleep(1000)

    fetchRateStub.resolves(3)
    await sleep(2000)

    expect((await app.getRate()).toString(10)).to.be.eql('3')

    await app.stop()
  })
  it('Should update rate based on threshold', async () => {
    // @ts-ignore
    config.rateUpdateThreshold = 50
    // @ts-ignore
    config.rateUpdateInterval = 99999999999

    fetchRateStub
      .onFirstCall()
      .resolves(2)
      .onSecondCall() // Increase for 50%
      .resolves(3)

    app = new TestingApp()
    await app.initAndStart()
    await sleep(1000)

    expect((await app.getRate()).toString(10)).to.be.eql('3')

    await app.stop()
  })
  it('Should not update rate if threshold not reached', async () => {
    // @ts-ignore
    config.rateUpdateThreshold = 50
    // @ts-ignore
    config.rateUpdateInterval = 99999999999

    fetchRateStub
      .onFirstCall().resolves(10)
      .onSecondCall().resolves(11) // Increase for 10% should not update as we have threshold for 50%

    app = new TestingApp()
    await app.initAndStart()
    await sleep(3000)

    expect((await app.getRate()).toString(10)).to.be.eql('10')

    await app.stop()
  })
})
