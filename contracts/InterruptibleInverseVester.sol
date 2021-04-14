// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IInv, InverseVester } from "./InverseVester.sol";

/**
 * @title Interruptible inverse token vesting contract
 * @author Inverse Finance
 * @notice Vesting contract which can be interrupted by timelock
 */
contract InterruptibleInverseVester is InverseVester {
    using SafeERC20 for IInv;

    address public timelock;

    /**
     * @dev Prevents non timelock from calling a method
     */
    modifier onlyTimelock() {
        require(msg.sender == timelock, "InterruptibleInverseVester:ACCESS_DENIED");
        _;
    }

    constructor(
        IInv _inv,
        uint256 _vestingAmount,
        uint16 _vestingDurationInDays,
        bool _reverseVesting,
        address _timelock
    ) InverseVester(_inv, _vestingAmount, _vestingDurationInDays, _reverseVesting) {
        timelock = _timelock;
    }

    /**
     * @notice Interrupts this vesting agreement and returns
     *         all unvested tokens to the address provided
     * @param collectionAccount Where to send unvested tokens
     */
    function interrupt(address collectionAccount) external onlyTimelock {
        require(collectionAccount != address(0), "InterruptibleInverseVester:INVALID_ADDRESS");
        inv.safeTransfer(collectionAccount, unvested());
        vestingEnd = block.timestamp;
    }

    /**
     * @notice Replace timelock
     * @param newTimelock New timelock address
     */
    function setTimelock(address newTimelock) external onlyTimelock {
        require(newTimelock != address(0), "InterruptibleInverseVester:INVALID_ADDRESS");
        timelock = newTimelock;
    }
}
