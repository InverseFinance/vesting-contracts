import { expect } from "chai";
import { constants } from "ethers";
import { waffle } from "hardhat";
import InverseVesterABI from "../../artifacts/contracts/InverseVester.sol/InverseVester.json";
import InvABI from "../../artifacts/contracts/test/INV.sol/INV.json";
import { INV as InvToken, InverseVester } from "../../typechain";
import { INV } from "../../utils/utils";
import { advanceBlockAtTime, getCurrentTimeStamp, SECONDS_IN_DAY } from "../utils/utils";

describe("Inverse Vester", function () {
  const amount = INV(1000);
  const durationInDays = 365;
  let inv: InvToken;
  let invAsTimelock: InvToken;

  let contract: InverseVester;
  let contractAsUser: InverseVester;

  const provider = waffle.provider;
  const [deployerWallet, userWallet, delegateWallet, timelockWallet] = provider.getWallets();
  const { deployContract } = waffle;

  beforeEach(async () => {
    inv = (await deployContract(deployerWallet, InvABI, [deployerWallet.address])) as InvToken;
    await inv.openTheGates();
    contract = (await deployContract(deployerWallet, InverseVesterABI, [
      inv.address,
      timelockWallet.address,
      amount,
      durationInDays,
      0,
      true,
      false,
      userWallet.address,
    ])) as InverseVester;
    contractAsUser = contract.connect(userWallet);
    invAsTimelock = inv.connect(timelockWallet);
    await inv.transfer(contract.address, amount);
  });

  describe("Initialisation", function () {
    async function assertInitializedValues(
      vestingStartDelayInDays: number,
      reverseVesting: boolean,
      interruptible: boolean,
    ) {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        vestingStartDelayInDays,
        reverseVesting,
        interruptible,
        userWallet.address,
      ])) as InverseVester;
      contractAsUser = contract.connect(userWallet);
      await inv.transfer(contract.address, amount);
      expect(await contract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await contract.interruptible()).to.be.equal(interruptible);
      expect(await contract.inv()).to.be.equal(inv.address);
      expect(await contract.timelock()).to.be.equal(timelockWallet.address);
      expect(await contract.vestingAmount()).to.be.equal(amount);
      expect(await contract.vestingDurationInDays()).to.be.equal(durationInDays);
      expect(await contract.vestingStartDelayInDays()).to.be.equal(vestingStartDelayInDays);
      expect(await contract.owner()).to.be.equal(userWallet.address);
      await contractAsUser.activate();
      const now = await getCurrentTimeStamp();
      const vestingBegin = now + vestingStartDelayInDays * SECONDS_IN_DAY;
      expect(await contract.vestingBegin()).to.be.equal(vestingBegin);
      expect(await contract.lastClaimTimestamp()).to.be.equal(vestingBegin);
      expect(await contract.vestingEnd()).to.be.equal(vestingBegin + durationInDays * SECONDS_IN_DAY);
      expect(await inv.balanceOf(contract.address)).to.be.equal(amount);
      expect(await inv.getCurrentVotes(userWallet.address)).to.be.equal(reverseVesting ? amount : 0);
      expect(await inv.getCurrentVotes(timelockWallet.address)).to.be.equal(!reverseVesting ? amount : 0);
    }

    it("initializes values correctly with no delay, reverse vesting and interruptible", async function () {
      await assertInitializedValues(0, true, true);
    });

    it("initializes values correctly with no delay, reverse vesting and not interruptible", async function () {
      await assertInitializedValues(0, true, false);
    });
    it("initializes values correctly with no delay, direct vesting and interruptible", async function () {
      await assertInitializedValues(0, false, true);
    });

    it("initializes values correctly with no delay, direct vesting and not interruptible", async function () {
      await assertInitializedValues(0, false, false);
    });

    it("initializes values correctly with delay, reverse vesting and interruptible", async function () {
      await assertInitializedValues(10, true, true);
    });

    it("initializes values correctly with delay, reverse vesting and not interruptible", async function () {
      await assertInitializedValues(10, true, false);
    });
    it("initializes values correctly with delay, direct vesting and interruptible", async function () {
      await assertInitializedValues(10, false, true);
    });
    it("initializes values correctly with delay, direct vesting and not interruptible", async function () {
      await assertInitializedValues(10, false, false);
    });

    it("can only activate once", async function () {
      await invAsTimelock.approve(contract.address, amount);
      await contractAsUser.activate();
      await expect(contractAsUser.activate()).to.be.revertedWith("InverseVester:ALREADY_ACTIVE");
    });
  });

  describe("Claiming and vesting", function () {
    it("calculates claimable amount correctly on first claim", async function () {
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = amount.mul(elapsed).div(durationInDays * SECONDS_IN_DAY);
      expect(await contract.claimable()).to.be.equal(expectedClaimable);
      await contract.claim();
      // Give some tolerance for timestamp drift
      expect((await inv.balanceOf(userWallet.address)).sub(expectedClaimable)).to.be.lt(INV(0.0001));
    });

    it("calculates claimable amount correctly on second claim", async function () {
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      await contract.claim();
      await advanceBlockAtTime(start + 2 * elapsed);
      const expectedClaimable = amount.mul(elapsed).div(durationInDays * SECONDS_IN_DAY);
      // Give some tolerance for timestamp drift
      expect((await contract.claimable()).sub(expectedClaimable)).to.be.lt(INV(0.0001));
    });

    it("calculates claimable amount correctly on vesting ended", async function () {
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 400 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = amount;
      expect(await contract.claimable()).to.be.equal(expectedClaimable);
      await contract.claim();
      // Give some tolerance for timestamp drift
      expect((await inv.balanceOf(userWallet.address)).sub(expectedClaimable)).to.be.lt(INV(0.0001));
    });

    it("fails to claim on vesting not started", async function () {
      expect(await contract.claimable()).to.be.equal(constants.Zero);
      await expect(contract.claim()).to.be.revertedWith("InverseVester:NOT_STARTED");
    });

    it("calculates unvested amount correctly on vesting just started", async function () {
      await contractAsUser.activate();
      const expectedClaimable = amount;
      expect(await contract.unvested()).to.be.equal(expectedClaimable);
    });

    it("calculates unvested amount", async function () {
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = amount.mul(elapsed).div(durationInDays * SECONDS_IN_DAY);
      expect(await contract.unvested()).to.be.equal(amount.sub(expectedClaimable));
    });

    it("calculates unvested amount correctly on vesting ended", async function () {
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 400 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = constants.Zero;
      expect(await contract.unvested()).to.be.equal(expectedClaimable);
    });
  });

  describe("Delegate", async function () {
    it("allows delegations on reverse vesting", async function () {
      await contractAsUser.activate();
      await contractAsUser.delegate(delegateWallet.address);
      expect(await inv.getCurrentVotes(delegateWallet.address)).to.be.equal(amount);
    });
    it("does not allow delegations on direct vesting", async function () {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        0,
        false,
        false,
        userWallet.address,
      ])) as InverseVester;
      contractAsUser = contract.connect(userWallet);
      await inv.transfer(contract.address, amount);
      await contractAsUser.activate();
      await expect(contractAsUser.delegate(delegateWallet.address)).to.be.revertedWith(
        "InverseVester:DELEGATION_NOT_ALLOWED",
      );
    });
  });

  describe("Interrupt", function () {
    it("can interrupt before active even if uninterruptible", async function () {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        0,
        false,
        false,
        userWallet.address,
      ])) as InverseVester;
      const contractAsTimelock = contract.connect(timelockWallet);
      await inv.transfer(contract.address, amount);
      await expect(contractAsTimelock.interrupt(delegateWallet.address)).to.emit(contract, "VestingInterrupted");
      // Returns balance in full
      expect(await inv.balanceOf(delegateWallet.address)).to.be.eq(amount);
      expect(await contract.vestingEnd()).to.be.equal(0);
    });

    it("interrups correctly soon after active", async function () {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        0,
        false,
        true,
        userWallet.address,
      ])) as InverseVester;
      contractAsUser = contract.connect(userWallet);
      const contractAsTimelock = contract.connect(timelockWallet);
      await inv.transfer(contract.address, amount);
      await contractAsUser.activate();
      await expect(contractAsTimelock.interrupt(delegateWallet.address)).to.emit(contract, "VestingInterrupted");
      const now = await getCurrentTimeStamp();
      // Give some tolerance for timestamp drift
      expect(amount.sub(await inv.balanceOf(delegateWallet.address))).to.be.lt(INV(0.0001));
      expect(await contract.vestingEnd()).to.be.equal(now);
    });

    it("cannot interrups non interruptible active contract", async function () {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        0,
        false,
        false,
        userWallet.address,
      ])) as InverseVester;
      contractAsUser = contract.connect(userWallet);
      const contractAsTimelock = contract.connect(timelockWallet);
      await inv.transfer(contract.address, amount);
      await contractAsUser.activate();
      await expect(contractAsTimelock.interrupt(delegateWallet.address)).to.be.revertedWith(
        "InverseVester:CANNOT_INTERRUPT",
      );
    });

    it("interrups correctly after first claim", async function () {
      contract = (await deployContract(deployerWallet, InverseVesterABI, [
        inv.address,
        timelockWallet.address,
        amount,
        durationInDays,
        0,
        false,
        true,
        userWallet.address,
      ])) as InverseVester;
      contractAsUser = contract.connect(userWallet);
      const contractAsTimelock = contract.connect(timelockWallet);
      await inv.transfer(contract.address, amount);
      await contractAsUser.activate();
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      await contract.claim();
      await contractAsTimelock.interrupt(delegateWallet.address);
      const claimed = await inv.balanceOf(userWallet.address);
      const expectedUnvestedAmount = amount.sub(claimed);
      // Give some tolerance for timestamp drift
      expect(expectedUnvestedAmount.sub(await inv.balanceOf(delegateWallet.address))).to.be.lt(INV(0.0001));
      expect((await contract.vestingEnd()).sub(start + elapsed)).to.be.lt(10);
    });
  });

  describe("ACL", async function () {
    it("Forbids non owner to call activate", async function () {
      // After creation user wallet becomes owner
      await expect(contract.activate()).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Forbids non owner to delegate", async function () {
      // After creation user wallet becomes owner
      await expect(contract.delegate(userWallet.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Forbids non timelock to interrupt", async function () {
      await expect(contractAsUser.interrupt(userWallet.address)).to.be.revertedWith("InverseVester:ACCESS_DENIED");
    });

    it("Forbids non timelock to set timelock", async function () {
      await expect(contractAsUser.setTimelock(userWallet.address)).to.be.revertedWith("InverseVester:ACCESS_DENIED");
    });
  });
});
