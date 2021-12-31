//SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4 <0.9.0;
//pragma solidity 0.6.12;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol';

contract HertzSubstitute is ERC20PresetFixedSupply {
    // constructor( 
    //     string memory name,
    //     string memory symbol,
    //     uint256 initialSupply,
    //     address owner
    // ) public {
    //     __ERC20PresetFixedSupply_init(name, symbol, initialSupply, owner);
    // }

    constructor( 
    ) public ERC20PresetFixedSupply(
        "Hertz Substitute Token", 
        "HTZ", 
        1e33, 
        msg.sender
    ) {
        //__ERC20PresetFixedSupply_init("Hertz Substitute Token", "HTZ", 1e33, msg.sender);
    }

}

