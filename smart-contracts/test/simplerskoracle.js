const { constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const SimpleRskOracle = artifacts.require("SimpleRskOracle");

contract('SimpleRskOracle', (accounts) => {

    it('contract initial owner', async () => {
        const simpleRskOracle = await SimpleRskOracle.deployed();
        
        const deployerAddress = accounts[0];

        const actualOwner = await simpleRskOracle.owner.call();
        
        assert.equal(deployerAddress, actualOwner, 'Invalid initial owner');
    });

    it('contract change owner', async () => {
        const simpleRskOracle = await SimpleRskOracle.deployed();
        
        const deployerAddress = accounts[0];
        const newContractOwner = accounts[1];

        let actualOwner = await simpleRskOracle.owner.call();
        assert.equal(deployerAddress, actualOwner, 'Invalid initial owner');

        await simpleRskOracle.transferOwnership(newContractOwner, { from: actualOwner });

        actualOwner = await simpleRskOracle.owner.call();
        assert.equal(newContractOwner, actualOwner, "Invalid owner, the transfer ownership didn't worked");

        // we will try to change the ownership from an account which is not the owner
        await expectRevert(
            simpleRskOracle.transferOwnership(newContractOwner, { from: deployerAddress }),
            'Ownable: caller is not the owner',
          );

        await simpleRskOracle.transferOwnership(deployerAddress, { from: newContractOwner });
    });

    it('add/remove oracle address', async () => {
        const simpleRskOracle = await SimpleRskOracle.deployed();
        
        const ownerAddress = accounts[0];
        const otherOwner = accounts[1];
        const whitelistedAddress = accounts[2];

        // we will try to add an address to the whitelist using an account which is not the owner
        await expectRevert(
            simpleRskOracle.setOracleAddress(whitelistedAddress, { from: otherOwner }),
            'Ownable: caller is not the owner',
          );

        await simpleRskOracle.setOracleAddress(whitelistedAddress, { from: ownerAddress });

        // we will try to remove an address from the whitelist using an account which is not the owner
        await expectRevert(
            simpleRskOracle.clearOracleAddress({ from: otherOwner }),
            'Ownable: caller is not the owner',
          );

        await simpleRskOracle.clearOracleAddress({ from: ownerAddress });
    });

    it('update price function call', async () => {
        // the updatePrice function can be called only by whitelisted addresses
        const simpleRskOracle = await SimpleRskOracle.deployed();
        
        const ownerAddress = accounts[0];
        const otherOwner = accounts[1];
        const whitelistedAddress = accounts[2];

        // we will try to call the updatePrice function without adding the address in the whitelist
        await expectRevert(
            simpleRskOracle.updatePrice(10, 10, { from: whitelistedAddress }),
            'The address is not the oracle',
          );

        await simpleRskOracle.setOracleAddress(whitelistedAddress, { from: ownerAddress });
        
        await simpleRskOracle.updatePrice(10, 10, { from: whitelistedAddress });

        await simpleRskOracle.clearOracleAddress({ from: ownerAddress });
    });

    it('update price by Oracle', async () => {
        const simpleRskOracle = await SimpleRskOracle.deployed();
        
        const ownerAddress = accounts[0];
        const whitelistedAddress = accounts[2];
        const price = 19800;
        const timestamp = 1606853352;

        await simpleRskOracle.setOracleAddress(whitelistedAddress, { from: ownerAddress });
        
        await simpleRskOracle.updatePrice(price, timestamp, { from: whitelistedAddress });

        const pricing = await simpleRskOracle.getPricing.call();
        assert.equal(price, pricing.price.toNumber(), 'Invalid price returned');
        assert.equal(timestamp, pricing.timestamp.toNumber(), 'Invalid timestamp returned');

        await simpleRskOracle.clearOracleAddress({ from: ownerAddress });
    });

});