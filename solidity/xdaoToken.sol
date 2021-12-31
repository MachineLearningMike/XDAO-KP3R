// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './PancakeRouter.sol';
import './AnalyticMath.sol';
import './contracts/Keep3r.sol';
import 'hardhat/console.sol';

contract XDAOToken is Keep3r, Ownable {

    uint256 public constant MAGPOWER = 5;
    uint256 public constant MAGNIFIER = 10 ** MAGPOWER;
    uint256 public constant HUNDRED_PERCENT = MAGNIFIER * 100;

    uint256 public constant FEE_TRADE_BURN = 31416;     // this/MAGNIFIER = 0.31416 or 31.416%
    uint256 public constant FEE_SHIFT_BURN = 13374;     // this/MAGNIFIER = 0.13374 or 13.374%
    uint256 public constant FEE_TRADE_REWARDS = 10000;  // this/MAGNIFIER = 0.10000 or 10,000%

    uint256 public constant INTERVAL_VOTE_BURN = 3600 * 12;
    uint256 public constant INTERVAL_ALL_BURN = 3600 * 24;
    uint256 public constant INTERVAL_LP_REWARDS = 3600 * 12;
    uint256 public constant MIN_INTERVAL_SEC = 60;      // 

    uint256 public constant IMPACT_VOTE_BURN = 70;      // this/MAGNIFIER = 0.00070 or 0.070%
    uint256 public constant IMPACT_ALL_BURN = 777;        // this/MAGNIFIER = 0.00777 or 0.777%
    uint256 public constant IMPACT_LP_REWARDS = 690;        // this/MAGNIFIER = 0.00690 or 0.690%    

    address public constant ADDR_HERTZ_REWARDS = 0x5cA00f843cd9649C41fC5B71c2814d927D69Df95; // Account4

	using SafeMath for uint256;

    enum TransferType {
        OTHER, SELL_SURE, BUY_SURE, SWAP_SURE, SELL_PRESUMED, BUY_PRESUMED, SWAP_PRESUMED, SHIFT_SEND, SHIFT_RECEIVE, SHIFT_TRANSCEIVE }
    enum FeeType { TRADE_BURN, SHIFT_BURN, TRADE_REWARDS }
    enum PulseType { VOTE_BURN, ALL_BURN, LP_REWARDS }
    struct Fees {
        uint256 trade_burn;
        uint256 shift_burn;
        uint256 trade_rewards;
    }
    struct Pulse {
        uint256 intervalSec;
        uint256 impactScale;
    }
    struct Holder {
        uint256 lastTransferTime;
        uint256 lastCheckTimeSec;
    }
    event SetFees(Fees _fees);
    event SetPulse_VoteBurn(Pulse _pulse);
    event SetPulse_AllBurn(Pulse _pulse);
    event SetPulse_LpRewards(Pulse _pulse);
    event SwapAndLiquify(uint256 tokenSwapped, uint256 etherReceived, uint256 tokenLiquified, uint256 etherLiquified );

    uint256 public fee_trade_burn;
    uint256 public fee_shift_burn;
    uint256 public fee_trade_rewards;

    Pulse public pulse_vote_burn;
    Pulse public pulse_all_burn;
    Pulse public pulse_lp_rewards;

   	mapping(address => Holder) public holders;
    uint256 public beginingTimeSec;

	IPancakeRouter02 public dexRouter;
	address public pairWithWETH;
    address public pairWithHertz;

    mapping(address => bool) public knownDexContracts;

    bool public autoPulse; // Place this bool type at the bottom of storage.

    address public hertztoken;
    address public hertzRewardsAddress;
    AnalyticMath public math;



    function revertToInitialSettings(address _dexRouter, address _hertztoken, address _math) public virtual onlyOwner {

        uint256 _fee_trade_burn = FEE_TRADE_BURN;
        uint256 _fee_shift_burn = FEE_SHIFT_BURN;
        uint256 _fee_lp_rewards = FEE_TRADE_BURN;

        Fees memory _fees = Fees(_fee_trade_burn, _fee_shift_burn, _fee_lp_rewards);
        setFees(_fees);

        Pulse memory _pulse = Pulse(INTERVAL_VOTE_BURN, IMPACT_VOTE_BURN);
        setPulse_VoteBurn(_pulse);

        _pulse = Pulse(INTERVAL_ALL_BURN, IMPACT_ALL_BURN);
        setPulse_AllBurn(_pulse);

        _pulse = Pulse(INTERVAL_LP_REWARDS, IMPACT_LP_REWARDS);
        setPulse_LpRewards(_pulse);

        autoPulse = true;

        dexRouter = IPancakeRouter02(_dexRouter);
        pairWithWETH = createPoolWithWETH(_dexRouter);
        pairWithHertz = createPoolWithToken(_dexRouter, _hertztoken);
        hertztoken = _hertztoken;
        hertzRewardsAddress = ADDR_HERTZ_REWARDS;
        math = AnalyticMath(_math);

        knownDexContracts[_dexRouter] = true;
        knownDexContracts[pairWithWETH] = true;
        knownDexContracts[pairWithHertz] = true;
    }

    function setFees(Fees memory _fees) public virtual onlyOwner {
        uint256 total;
        require(_fees.trade_burn <= HUNDRED_PERCENT, "Fee rate out of range");
        require(_fees.shift_burn <= HUNDRED_PERCENT, "Fee rate out of range");
        require(_fees.trade_rewards <= HUNDRED_PERCENT, "Fee rate out of range");
        total = _fees.trade_burn + _fees.shift_burn + _fees.trade_rewards;
        require(total <= HUNDRED_PERCENT, "Fee rate out of range");

        fee_trade_burn = _fees.trade_burn;
        fee_shift_burn = _fees.shift_burn;
        fee_trade_rewards = _fees.trade_rewards;

        emit SetFees(_fees);
    }

    function setPulse_VoteBurn(Pulse memory _pulse) public virtual onlyOwner {
        require(_pulse.intervalSec > MIN_INTERVAL_SEC, "IntervalSec out of range");
        require(_pulse.impactScale <= HUNDRED_PERCENT, "ImpactScale out of range");

        pulse_vote_burn = _pulse;
        emit SetPulse_VoteBurn(_pulse);
    }

    function setPulse_AllBurn(Pulse memory _pulse) public virtual onlyOwner {
        require(_pulse.intervalSec > MIN_INTERVAL_SEC, "IntervalSec out of range");
        require(_pulse.impactScale <= HUNDRED_PERCENT, "ImpactScale out of range");

        pulse_all_burn = _pulse;
        emit SetPulse_AllBurn(_pulse);
    }

    function setPulse_LpRewards(Pulse memory _pulse) public virtual onlyOwner {
        require(_pulse.intervalSec > MIN_INTERVAL_SEC, "IntervalSec out of range");
        require(_pulse.impactScale <= HUNDRED_PERCENT, "ImpactScale out of range");

        pulse_all_burn = _pulse;
        emit SetPulse_LpRewards(_pulse);
    }

    function setAutoPulse( bool _autoPulse ) external virtual onlyOwner {
        autoPulse = _autoPulse;
    }

	bool hooked;
	modifier lockHook {
		require( ! hooked, "Nested hook");
		hooked = true;
		_;
		hooked = false;
	}

	function createPoolWithWETH( address _routerAddress ) virtual public onlyOwner returns(address pool) {
        IPancakeRouter02 _dexRouter = IPancakeRouter02(_routerAddress);
        pool = IPancakeFactory(_dexRouter.factory()).getPair(address(this), _dexRouter.WETH());
        if(pool == address(0)) {
    		pool = IPancakeFactory(_dexRouter.factory()).createPair(address(this), _dexRouter.WETH());
        }
    }   

	function createPoolWithToken(address _routerAddress, address token ) virtual public onlyOwner returns(address pool)  {
		IPancakeRouter02 _dexRouter = IPancakeRouter02(_routerAddress);
        pool = IPancakeFactory(_dexRouter.factory()).getPair(address(this), token);
        if(pool == address(0)) {
    		pool = IPancakeFactory(_dexRouter.factory()).createPair(address(this), token);
        }
    }

    //====================================================================================================

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _hookForPulses(from);
        _hookForPulses(to);
    }

   
    uint256 internal _call_level;
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        _call_level += 1;

        require(sender != address(0), "Transfer from zero address");
        require(recipient != address(0), "Transfer to zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "Transfer exceeds balance");

		if(_call_level == 1 && ! _isFeeFreeTransfer(sender, recipient) ) {
            amount -= _payFees2(sender, recipient, amount); // May revert if it's a swap transfer.
        }

        _balances[sender] = _balances[sender].sub( amount); // May revert if sender is a swapper and paid outside of original "amount"
        _balances[recipient] = _balances[recipient].add(amount);

        emit Transfer(sender, recipient, amount);

        _afterTokenTransfer(sender, recipient, amount);

        holders[sender].lastTransferTime = block.timestamp;
        holders[recipient].lastTransferTime = block.timestamp;

        _call_level -= 1;
    }

    function _isFeeFreeTransfer(address sender, address recipient) internal view virtual returns (bool feeFree) {
        // Start from highly frequent occurences.
        feeFree = 
            _isBidirFeeFreeAddress(sender) 
            || _isBidirFeeFreeAddress(recipient);
    }

    function _isBidirFeeFreeAddress(address _address) internal view virtual returns (bool feeFree) {
        feeFree =
               _address == owner()
            || _address == pairWithWETH
            || _address == pairWithHertz;
    }

    function _isHookable(address sender, address recipient) internal virtual view returns(bool _unmanageable) {
        _unmanageable =
            _isBidirHookableAddress(sender)
            || _isBidirHookableAddress(recipient);
    }

    function _isBidirHookableAddress(address _address) internal view virtual returns (bool feeFree) {
        feeFree =
               _address == owner()
            || _address == pairWithWETH
            || _address == pairWithHertz;
    }

    /**
    * This function is followed by the following lines, in the _transfer function.
    *  amount -= _payFees2(sender, recipient, amount);
    *  _balances[sender] = _balances[sender].sub( amount);
    *  _balances[recipient] = _balances[recipient].add(amount);
    **/
    function _payFees2(address sender, address recipient, uint256 principal) internal virtual returns(uint256 feesPaid) {
        TransferType tType = _getTransferType(sender, recipient);

        if(
            tType == TransferType.SELL_SURE
            || tType == TransferType.SELL_PRESUMED
            || tType == TransferType.BUY_SURE
            || tType == TransferType.BUY_PRESUMED
        ) {
            // If it's SELL, then the Seller == sender will pay 'feedPaid' > 0, effectively.
            // If it's BUY, then the Buyer == recipient will pay 'feesPaid' > 0, effiectively.
            // In both cases, payments are safe because they are debited from the 'principal', 
            // which is available from the sender's balance.
            // The underlying assumption: sending goes ahead of receiving in a Dex-mediated swap.
            // The assumption is quite natural, is the case in all known Dexes, and might be proven.


            // 31.4159265359% Fee burned on buys and sells.
            uint256 fee;
            fee = principal.mul(fee_trade_burn).div(MAGNIFIER);
            burnFrom(sender, fee); // burnt
            feesPaid += fee;

            // 1–55% Fee sold to HTZ and added to XDAO lps airdrop rewards depending on how much you are purchasing or selling. 
            fee = principal.mul(fee_trade_rewards).div(MAGNIFIER);
            _transfer(sender, address(this), fee);
            _swapForToken(fee, hertztoken, hertzRewardsAddress);
            feesPaid += fee;

        } else if (
            tType == TransferType.SWAP_SURE
            || tType == TransferType.SWAP_PRESUMED
        ) {
            // Both the Seller == sender and Buyer == recipient should pay.
            // We do not know who will pay 'feesPaid' > 0 effectively.
            // The Seller and Buyer have to pay outside of the principal.
            // So, the recipient's payment is not guaranteed.

            // 13.37420% fee on transfers burned.

            uint256 fee;
            fee = principal.mul(fee_trade_burn).div(MAGNIFIER);
            burnFrom(sender, fee); // sender pays for burn
            burnFrom(recipient, fee); // recipient pays for burn. // May revert.

            fee = principal.mul(fee_trade_rewards).div(MAGNIFIER);
            _transfer(sender, address(this), fee);
            _transfer(recipient, address(this), fee); // May revert.
            _swapForToken(fee, hertztoken, hertzRewardsAddress);

            feesPaid = 0; // just confirm.

        } else if(
            tType == TransferType.SHIFT_SEND
            || tType == TransferType.SHIFT_RECEIVE
            || tType == TransferType.SHIFT_TRANSCEIVE
        ) {
            // This is a uni-directional transaction.
            // The transfer itself pays, or the sender and recipient share the payment.
            uint256 fee;
            fee = principal.mul(fee_shift_burn).div(MAGNIFIER);
            burnFrom(sender, fee); // burnt
            feesPaid += fee;
        }
    }


    function _isContract(address account) internal view returns (bool) {
        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            codehash := extcodehash(account)
        }
        return (codehash != accountHash && codehash != 0x0);
    }

    function _getTransferType(address sender, address recipient) internal virtual returns(TransferType) {
        if(! _isContract(msg.sender) ) {
            if( ! _isContract(sender) ) {
                if ( ! _isContract(recipient) ) {
                    return TransferType.SHIFT_TRANSCEIVE;
                } else {
                    return TransferType.SHIFT_SEND;
                }
            } else {
                if ( ! _isContract(recipient) ) {
                    return TransferType.SHIFT_RECEIVE;
                } else {
                    return TransferType.OTHER;
                }
            }
        } else {
            if( ! _isContract(sender) ) {
                if( ! _isContract(recipient) ) {
                    if (knownDexContracts[msg.sender] == true ) {
                        return TransferType.SWAP_SURE;
                    } else {
                        return TransferType.SWAP_PRESUMED;
                    }
                } else {
                    if(knownDexContracts[recipient] == true || knownDexContracts[msg.sender] == true) {
                        return TransferType.SELL_SURE;
                    } else {
                        return TransferType.SELL_PRESUMED;
                    }
                }
            } else {
                if( ! _isContract(recipient) ) {
                    if(knownDexContracts[sender] == true || knownDexContracts[msg.sender] == true) {
                        return TransferType.BUY_SURE;
                    } else {
                        return TransferType.BUY_PRESUMED;
                    }
                } else {
                    return TransferType.OTHER;
                }
            }
        }
    }

    function getXDAOBalanceInAgency() virtual public returns(uint256) {
        return 0;
    }

    function burnXDAOBalanceInAgency(uint256 tokens) virtual public {

    }
    
    function getXDAOBalanceInCyberswap(address holder) virtual public returns(uint256) {
        return 0;
    }

    function _hookForPulses(address holderAddress) virtual internal returns (bool worked) {
       Holder storage holder = holders[holderAddress];
       if(holder.lastCheckTimeSec == block.timestamp) return false;

        uint256 timeLapsed = block.timestamp - (holder.lastCheckTimeSec != 0 ? holder.lastCheckTimeSec : beginingTimeSec);
        uint256 missingChecks; uint256 rate_p; uint256 rate_q; uint256 tokens; uint256 agencyTokens; uint tokensToBurn;

        //---------------------- vote_burn, 12 hours ------------------------------
        // 0.07% of tokens in the Agency dapp actively being used for voting burned every 12 hours.

        // We assume the Agency dapp maintains a pool of XDAO tokens, on the dapp's XDAO account, staked from users.
        // A user receives vote tokens, in proportion to XDAO tokens they stake, which represent their voting weight.
        // Burning a proportion from the pool as a whole, while keeping constant users' balances of the voke token,
        // is equivalent to burning from all individual users' XDAO tokens used for voting, in the same proportion.
        // Users will recieve, proportionally, reduced amount of XDAO tokens when they return their vote tokens.

        missingChecks = timeLapsed / pulse_all_burn.intervalSec;
        if(missingChecks > 0) {
            (rate_p, rate_q) = math.pow(MAGNIFIER.mul(MAGNIFIER - pulse_vote_burn.impactScale), MAGNIFIER, missingChecks, uint256(1));
            require(rate_p <= rate_q, "Invalid rate");
            agencyTokens = getXDAOBalanceInAgency();
            tokens = agencyTokens.mul(rate_p).div(rate_q);
            burnXDAOBalanceInAgency(tokens);
            agencyTokens -= tokens;
            worked = true;
        }

        //---------------------- all_burn, 24 hours, burn tokens (not in Cyberswap/Agency) ------------------------------
        // 0.777% of tokens(not in Cyberswap/Agency dapp) burned each 24 hours from users wallets. 
        missingChecks = timeLapsed / pulse_all_burn.intervalSec;
        if(missingChecks > 0) {
            (rate_p, rate_q) = math.pow(MAGNIFIER.mul(MAGNIFIER - pulse_all_burn.impactScale), MAGNIFIER, missingChecks, uint256(1));
            require(rate_p <= rate_q, "Invalid rate");
            tokens = worked == true? agencyTokens : getXDAOBalanceInAgency();
            tokens += getXDAOBalanceInCyberswap(holderAddress);
            tokens = balanceOf(holderAddress).sub(tokens);
            tokens = tokens.mul(rate_p).div(rate_q);
            _burn(holderAddress, tokens);
            worked = true;
        }

        //---------------------- lp_rewards, 12 hours ------------------------------
        // 0.69% of XDAO/FTM LP has the XDAO side sold for FTM, then the FTM is used to buy HTZ which is added to XDAO lps airdrop rewards every 12 hours.
        missingChecks = timeLapsed / pulse_lp_rewards.intervalSec;
        if(missingChecks > 0) {
            (rate_p, rate_q) = math.pow(MAGNIFIER.mul(MAGNIFIER - pulse_lp_rewards.impactScale), MAGNIFIER, missingChecks, uint256(1));

            uint256 reserveThis; uint256 reserveWeth;
            bool thisIsToken0 = IPancakePair(pairWithWETH).token0() == address(this);
            (uint256 reserve0, uint256 reserve1, ) = IPancakePair(pairWithWETH).getReserves();
            (reserveThis, reserveWeth) = thisIsToken0 ? (reserve0, reserve1) : (reserve1, reserve0);
            tokens = IPancakePair(pairWithWETH).totalSupply();
            tokens = tokens.mul(rate_p).div(rate_q);

            //------------------ Under construction --------------------


            // // No! require(_balances[address(this)] == uint256(0), "Non-empty store space");
            // uint256 amount = _balances[storeAddresses.rewards];
            // _sureTransfer(storeAddresses.rewards, address(this), amount);

            // _swapForToken(amount, hertztoken, hertzRewardsAddress);


            worked = true;
        }

        if( worked == true ) {
            holder.lastCheckTimeSec = block.timestamp;
        }
    }

	function _swapForEther(uint256 tokenAmount) virtual internal {
        require( _balances[address(this)] >= tokenAmount, "" );

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = dexRouter.WETH();

        // The router's assumption: the path[0] token has the address(this) account, and the amountIn amount belongs to that account.
        // The router tries to transferFrom( token = path[0], sender = msg.sender, recipient = pair, amount = amountIn );
        _approve(address(this), address(dexRouter), tokenAmount);

        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),  // targetAccount
            block.timestamp
        );
    }

	function _swapForToken(uint256 amountIn, address targetToken, address targetAccount) virtual internal {
        require( _balances[address(this)] >= amountIn, "" );

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = targetToken;

        // The router's assumption: the path[0] token has the address(this) account, and the amountIn amount belongs to that account.
        // The router tries to transferFrom( token = path[0], sender = msg.sender, recipient = pair, amount = amountIn );
        _approve(address(this), address(dexRouter), amountIn);  

        dexRouter.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            targetAccount,
            block.timestamp
        );
    }

    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) virtual internal {
        // The router's assumption: the path[0] token has the address(this) account, and the amountIn amount belongs to that account.
        // The router tries to transferFrom( token = path[0], sender = msg.sender, recipient = pair, amount = amountIn );
        _approve(address(this), address(dexRouter), tokenAmount);

        dexRouter.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(), // What if the owner changes? Why not use a 3rd, neutral address?
            block.timestamp
        );
    }

}