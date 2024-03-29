// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply
    ) public ERC20(name, symbol) {
        _mint(msg.sender, supply);
    }

    function mintTo(address _account, uint _amount) public {
        _mint(_account, _amount);
    }

    function setDecimals(uint8 _decimals) public {
        _setupDecimals(_decimals);
    }
}