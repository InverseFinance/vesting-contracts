// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "./InverseVester.sol";

/**
 * @title Interruptible inverse token vesting contract
 * @author Inverse Finance
 * @notice Vesting contract which can be interrupted by governance
 */
contract InterruptibleInverseVester is InverseVester {
    address public governance;

    /**
     * @dev Prevents non governance from calling a method
     */
    modifier onlyGovernance() {
        require(msg.sender == governance, "InterruptibleInverseVester:ACCESS_DENIED");
        _;
    }

    constructor(
        IInv _inv,
        uint256 _vestingAmount,
        uint16 _vestingDurationInDays,
        bool _reverseVesting,
        address _governance
    ) InverseVester(_inv, _vestingAmount, _vestingDurationInDays, _reverseVesting) {
        governance = _governance;
    }

    /**
     * @notice Interrupts this vesting agreement and returns
     *         all unvested tokens to the address provided
     * @param collectionAccount Where to send unvested tokens
     */
    function interrupt(address collectionAccount) public onlyGovernance {
        require(collectionAccount != address(0), "InterruptibleInverseVester:INVALID_ADDRESS");
        inv.transfer(collectionAccount, unvested());
        vestingEnd = block.timestamp;
    }
}
