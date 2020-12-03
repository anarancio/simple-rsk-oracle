// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleRskOracle is Ownable {

    address private oracle;

    uint private _price;
    uint private _timestamp;

    modifier isOracle() {
        require(msg.sender == oracle, "The address is not the oracle");
        _;
    }

    function updatePrice(uint price, uint timestamp) public isOracle {
        _price = price;
        _timestamp = timestamp;
    }

    function getPricing() public view returns(uint price, uint timestamp) {
        return (_price, _timestamp);
    }

    function setOracleAddress(address addr) public onlyOwner {
        oracle = addr;
    }

    function clearOracleAddress() public onlyOwner {
        oracle = address(0);
    }

}
