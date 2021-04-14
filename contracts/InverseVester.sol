// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IInv.sol";

/**
 * @title Inverse token vesting contract
 * @author Inverse Finance
 * @notice Base contract for vesting agreement on INV tokens
 *         Reverse vesting means tokens are owned but the recipient
 *         and can be used for voting.
 * @dev    Vesting calculation is linear
 */
contract InverseVester is Ownable {
    using SafeERC20 for IInv;

    uint256 public constant DAY = 1 days;

    // @dev Timestamp for the start of this vesting agreement
    uint256 public vestingBegin;

    // @dev Timestamp for the end of this vesting agreement
    uint256 public vestingEnd;

    // @dev Timestamp for the last time vested tokens were claimed
    uint256 public lastClaimTimestamp;

    // @dev Total amount to be vested
    uint256 public immutable vestingAmount;

    // @dev Inverse finance treasury token
    IInv public immutable inv;

    // @dev Amount of days the vesting period will last
    uint16 public immutable vestingDurationInDays;

    // @dev Whether this is a reverse vesting agreement
    bool public immutable reverseVesting;

    constructor(
        IInv _inv,
        uint256 _vestingAmount,
        uint16 _vestingDurationInDays,
        bool _reverseVesting
    ) {
        inv = _inv;
        vestingAmount = _vestingAmount;
        vestingDurationInDays = _vestingDurationInDays;
        reverseVesting = _reverseVesting;
    }

    /**
     * @notice Starts vesting period
     * @dev Transfers contract ownership
     * @param recipient recipient of the vested tokens (new owner)
     * @param treasury source of tokens
     */
    function start(address recipient, address treasury) public onlyOwner {
        require(vestingBegin == 0, "InverseVester:ALREADY_STARTED");
        require(recipient != address(0) && treasury != address(0), "InverseVester:INVALID_ADDRESS");
        inv.safeTransferFrom(treasury, address(this), vestingAmount);
        if (reverseVesting) {
            inv.delegate(recipient);
        } else {
            inv.delegate(treasury);
        }
        vestingBegin = lastClaimTimestamp = block.timestamp;
        vestingEnd = vestingBegin + (vestingDurationInDays * DAY);
        transferOwnership(recipient);
    }

    /**
     * @notice Delegates all votes owned by this contract
     * @dev Only available in reverse vesting
     * @param _delegate recipient of the votes
     */
    function delegate(address _delegate) public onlyOwner {
        // If this is non reverse vesting, tokens votes stay with treasury
        require(reverseVesting, "InverseVester:DELEGATION_NOT_ALLOWED");
        inv.delegate(_delegate);
    }

    /**
     * @notice Calculates amount of tokens ready to be claimed
     * @return amount Tokens ready to be claimed
     */
    function claimable() public view returns (uint256 amount) {
        if (block.timestamp >= vestingEnd) {
            amount = inv.balanceOf(address(this));
        } else {
            // Claim linearly starting from when claimed lastly
            amount = (vestingAmount * (block.timestamp - lastClaimTimestamp)) / (vestingEnd - vestingBegin);
        }
    }

    /**
     * @notice Calculates amount of tokens still to be vested
     * @return amount Tokens still to be vested
     */
    function unvested() public view returns (uint256 amount) {
        amount = inv.balanceOf(address(this)) - claimable();
    }

    /**
     * @notice Send claimable tokens to contract's owner
     */
    function claim() public {
        require(vestingBegin != 0 && vestingBegin <= block.timestamp, "InverseVester:NOT_STARTED");
        uint256 amount = claimable();
        lastClaimTimestamp = block.timestamp;
        inv.safeTransfer(owner(), amount);
    }
}
