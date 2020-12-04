import Eth from 'web3-eth'
import type { Application } from './definitions'

const HEALTHCHECK_ROUTE = '/healthcheck'
export default function (app: Application): void {
  app.use(HEALTHCHECK_ROUTE, async (req, res) => {
    const eth = app.get('eth') as Eth
    try {
      await eth.getProtocolVersion()
    } catch (e) {
      res.status(500).send('No blockchain node connection')
    }

    res.status(204).end()
  })
}
