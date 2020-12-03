const SimpleRskOracle = artifacts.require("SimpleRskOracle");

const PROVIDER_ACCOUNT = process.env['ORACLE_PROVIDER_ACCOUNT']

module.exports = async function(deployer) {
  await deployer
      .deploy(SimpleRskOracle)
      .then(async (ins) => {
        return await ins.setOracleAddress(PROVIDER_ACCOUNT)
      })
};
