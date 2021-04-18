// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IInv, InverseVester } from "./InverseVester.sol";

/**
 * @title Inverse token vesting factory contract
 * @author Inverse Finance
 * @notice Factory contract to create configurable vesting agreement
 */
contract InverseVesterFactory is Ownable {
    /// @dev Emitted when vesting starts
    event VestingCreated(address recipient, address inverseVester, uint256 amount, uint16 vestingDuration);

    /// @dev Inverse finance governance timelock
    address public timelock;
    /// @dev Inverse finance treasury token
    address public immutable inv;
    /// @dev Registry of vesting agreements by recipient
    mapping(address => InverseVester[]) public inverseVestersByRecipient;
    /// @dev Registry of all vesting agreements
    InverseVester[] public allInverseVesters;

    constructor(address inv_, address timelock_) {
        require(inv_ != address(0) && timelock_ != address(0), "InverseVesterFactory:INVALID_ADDRESS");
        inv = inv_;
        timelock = timelock_;
    }

    /**
     * @notice Creates a new vesting agreement
     * @param recipient Recipient of the vesting agreement
     * @param vestingAmount Amount to vest
     * @param vestingDurationInDays Length of the vesting period express in days
     * @param vestingStartDelayInDays Delay between contract activation and vesting period start
     * @param reverseVesting True if tokens are owned but the recipient
     * @param interruptible True if governance can interrupt the agreement
     */
    function newInverseVester(
        address recipient,
        uint256 vestingAmount,
        uint16 vestingDurationInDays,
        uint16 vestingStartDelayInDays,
        bool reverseVesting,
        bool interruptible
    ) public onlyOwner {
        require(recipient != address(0), "InverseVesterFactory:INVALID_ADDRESS");
        InverseVester inverseVester =
            new InverseVester(
                inv,
                timelock,
                vestingAmount,
                vestingDurationInDays,
                vestingStartDelayInDays,
                reverseVesting,
                interruptible,
                recipient
            );

        inverseVestersByRecipient[recipient].push(inverseVester);
        allInverseVesters.push(inverseVester);

        emit VestingCreated(recipient, address(inverseVester), vestingAmount, vestingDurationInDays);
    }

    /**
     * @notice Convenience function to create a new non interruptible vesting agreement
     * @param recipient Recipient of the vesting agreement
     * @param vestingAmount Amount to vest
     * @param vestingDurationInDays Length of the vesting period express in days
     * @param vestingStartDelayInDays Delay between contract activation and vesting period start
     * @param reverseVesting True if tokens are owned but the recipient
     */
    function newNonInterruptibleVestingAgreement(
        address recipient,
        uint256 vestingAmount,
        uint16 vestingDurationInDays,
        uint16 vestingStartDelayInDays,
        bool reverseVesting
    ) public {
        newInverseVester(
            recipient,
            vestingAmount,
            vestingDurationInDays,
            vestingStartDelayInDays,
            reverseVesting,
            false
        );
    }

    /**
     * @notice Convenience function to create a new interruptible vesting agreement
     * @param recipient Recipient of the vesting agreement
     * @param vestingAmount Amount to vest
     * @param vestingDurationInDays Length of the vesting period express in days
     * @param vestingStartDelayInDays Delay between contract activation and vesting period start
     * @param reverseVesting True if tokens are owned but the recipient
     */
    function newInterruptibleVestingAgreement(
        address recipient,
        uint256 vestingAmount,
        uint16 vestingDurationInDays,
        uint16 vestingStartDelayInDays,
        bool reverseVesting
    ) public {
        newInverseVester(
            recipient,
            vestingAmount,
            vestingDurationInDays,
            vestingStartDelayInDays,
            reverseVesting,
            true
        );
    }

    /**
     * @notice Convenience function to create a new standard salary agreement
     * @param recipient Recipient of the vesting agreement
     * @param vestingAmount Amount to vest
     * @param vestingDurationInDays Length of the vesting period express in days
     * @param vestingStartDelayInDays Delay between contract activation and vesting period start
     */
    function newSalaryAgreement(
        address recipient,
        uint256 vestingAmount,
        uint16 vestingDurationInDays,
        uint16 vestingStartDelayInDays
    ) public {
        newInverseVester(recipient, vestingAmount, vestingDurationInDays, vestingStartDelayInDays, false, true);
    }

    /**
     * @notice Returns all vesting agreements
     * @return all vesting agreements
     */
    function getAllInverseVesters() public view returns (InverseVester[] memory) {
        return allInverseVesters;
    }

    /**
     * @notice Returns all vesting agreement for a recipient
     * @param recipient Recipient of the vesting agreements
     * @return all vesting agreements for recipient
     */
    function getInverseVestersByRecipient(address recipient) public view returns (InverseVester[] memory) {
        return inverseVestersByRecipient[recipient];
    }
}
