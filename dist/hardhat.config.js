"use strict";
// import '@nomiclabs/hardhat-ethers';
// import '@nomiclabs/hardhat-etherscan';
// import '@nomiclabs/hardhat-waffle';
// import '@typechain/hardhat';
// import '@typechain/hardhat/dist/type-extensions';
// import 'dotenv/config';
// import 'hardhat-contract-sizer';
// import 'hardhat-deploy';
// import 'hardhat-gas-reporter';
// import { removeConsoleLog } from 'hardhat-preprocessor';
// import { HardhatUserConfig } from 'hardhat/types';
// import 'solidity-coverage';
// import 'tsconfig-paths/register';
require('dotenv').config(); // .env
require("@nomiclabs/hardhat-waffle"); // BigNumber, The address of signers/wallets.
require("@nomiclabs/hardhat-etherscan");
require('hardhat-deploy'); // avoids unnecessary compilation.
const colors = require('colors'); // .yellow
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
        console.log("accounts", account.address);
    }
});
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    networks: {
        hardhat: {
            gasPrice: "auto",
            gasMultiplier: 2
        },
        localnet: {
            url: "http://127.0.0.1:8545",
            gasPrice: "auto",
            gasMultiplier: 2
        },
        rinkeby: {
            url: "https://rinkeby.infura.io/v3/" + process.env.Infura_Key,
            accounts: [
                process.env.MyTestPrivateKey,
                process.env.Test_Private_Key_Alice,
                process.env.Test_Private_Key_Bob,
                process.env.Test_Private_Key_Charlie,
            ],
        },
        mainnet: {
            url: "https://mainnet.infura.io/v3/" + process.env.Infura_Key,
            accounts: [
                process.env.MyTestPrivateKey,
                process.env.Test_Private_Key_Alice,
                process.env.Test_Private_Key_Bob,
                process.env.Test_Private_Key_Charlie,
            ],
        },
        bscmainnet: {
            url: "https://bsc-dataseed2.defibit.io/",
            accounts: [
                process.env.MyTestPrivateKey,
                process.env.Test_Private_Key_Alice,
                process.env.Test_Private_Key_Bob,
                process.env.Test_Private_Key_Charlie,
            ],
        },
        bsctestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
            accounts: [
                process.env.MyTestPrivateKey,
                process.env.Test_Private_Key_Alice,
                process.env.Test_Private_Key_Bob,
                process.env.Test_Private_Key_Charlie,
            ],
        },
        fantomtestnet: {
            url: "https://rpc.testnet.fantom.network",
            accounts: [
                process.env.MyTestPrivateKey,
                process.env.Test_Private_Key_Alice,
                process.env.Test_Private_Key_Bob,
                process.env.Test_Private_Key_Charlie,
            ],
            chainId: 4002,
            gasPrice: "auto",
            gasMultiplier: 2
        },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: process.env.Etherscan_API_Key
    },
    solidity: {
        compilers: [
            {
                version: "0.6.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
            {
                version: "0.4.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
            {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
            {
                version: "0.8.4",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
            {
                version: "0.7.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
            {
                version: '0.8.7',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    outputSelection: {
                        '*': {
                            '*': ['storageLayout'],
                        },
                    },
                },
            },
        ],
    },
    mocha: {
        timeout: 200000
    },
    paths: {
        sources: "./solidity",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
