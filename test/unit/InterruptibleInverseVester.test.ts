import { expect } from "chai";
import { constants } from "ethers";
import { waffle } from "hardhat";
import InterruptibleInverseVesterABI from "../../artifacts/contracts/InterruptibleInverseVester.sol/InterruptibleInverseVester.json";
import InvABI from "../../artifacts/contracts/test/INV.sol/INV.json";
import { INV as InvToken, InterruptibleInverseVester } from "../../typechain";
import { INV } from "../../utils/utils";
import { advanceBlockAtTime, getCurrentTimeStamp, SECONDS_IN_DAY } from "../utils/utils";

describe("Interruptible Inverse Vester", function () {
  const amount = INV(1000);
  const durationInDays = 365;
  const reverseVesting = true;
  let inv: InvToken;

  let contract: InterruptibleInverseVester;
  let contractAsUser: InterruptibleInverseVester;

  const provider = waffle.provider;
  const [deployerWallet, userWallet, delegateWallet] = provider.getWallets();
  const { deployContract } = waffle;

  beforeEach(async () => {
    inv = (await deployContract(deployerWallet, InvABI, [deployerWallet.address])) as InvToken;
    await inv.openTheGates();
    contract = (await deployContract(deployerWallet, InterruptibleInverseVesterABI, [
      inv.address,
      amount,
      durationInDays,
      reverseVesting,
      deployerWallet.address,
    ])) as InterruptibleInverseVester;
    contractAsUser = contract.connect(userWallet);
  });

  describe("Start", function () {
    it("initializes values correctly on reverse vesting start", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const now = await getCurrentTimeStamp();
      expect(await contract.vestingAmount()).to.be.equal(amount);
      expect(await contract.vestingBegin()).to.be.equal(now);
      expect(await contract.vestingEnd()).to.be.equal(now + durationInDays * SECONDS_IN_DAY);
      expect(await contract.lastClaimTimestamp()).to.be.equal(now);
      expect(await contract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await contract.inv()).to.be.equal(inv.address);
      expect(await contract.owner()).to.be.equal(userWallet.address);
      // All votes are available
      expect(await inv.getCurrentVotes(userWallet.address)).to.be.equal(amount);
    });

    it("initializes values correctly on vesting start", async function () {
      const reverseVesting = false;
      contract = (await deployContract(deployerWallet, InterruptibleInverseVesterABI, [
        inv.address,
        amount,
        durationInDays,
        reverseVesting,
        deployerWallet.address,
      ])) as InterruptibleInverseVester;
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const now = await getCurrentTimeStamp();
      expect(await contract.vestingAmount()).to.be.equal(amount);
      expect(await contract.vestingBegin()).to.be.equal(now);
      expect(await contract.vestingEnd()).to.be.equal(now + durationInDays * SECONDS_IN_DAY);
      expect(await contract.lastClaimTimestamp()).to.be.equal(now);
      expect(await contract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await contract.inv()).to.be.equal(inv.address);
      expect(await contract.owner()).to.be.equal(userWallet.address);
      //No votes available yet
      expect(await inv.getCurrentVotes(userWallet.address)).to.be.equal(0);
    });
    it("can only start once", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      await expect(contractAsUser.start(userWallet.address, deployerWallet.address)).to.be.revertedWith(
        "InverseVester:ALREADY_STARTED",
      );
    });
  });

  describe("Claiming and vesting", function () {
    it("calculates claimable amount correctly on first claim", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
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
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
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
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
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
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const expectedClaimable = amount;
      expect(await contract.unvested()).to.be.equal(expectedClaimable);
    });

    it("calculates unvested amount", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = amount.mul(elapsed).div(durationInDays * SECONDS_IN_DAY);
      expect(await contract.unvested()).to.be.equal(amount.sub(expectedClaimable));
    });

    it("calculates unvested amount correctly on vesting ended", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const start = await getCurrentTimeStamp();
      const elapsed = 400 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      const expectedClaimable = constants.Zero;
      expect(await contract.unvested()).to.be.equal(expectedClaimable);
    });
  });

  describe("Interrupt", function () {
    it("interrups correctly on start", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      await contract.interrupt(delegateWallet.address);
      const now = await getCurrentTimeStamp();
      // Give some tolerance for timestamp drift
      expect(amount.sub(await inv.balanceOf(delegateWallet.address))).to.be.lt(INV(0.0001));
      expect(await contract.vestingEnd()).to.be.equal(now);
    });

    it("interrups correctly after first claim", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      const start = await getCurrentTimeStamp();
      const elapsed = 100 * SECONDS_IN_DAY;
      await advanceBlockAtTime(start + elapsed);
      await contract.claim();
      await contract.interrupt(delegateWallet.address);
      const claimed = await inv.balanceOf(userWallet.address);
      const expectedUnvestedAmount = amount.sub(claimed);
      // Give some tolerance for timestamp drift
      expect(expectedUnvestedAmount.sub(await inv.balanceOf(delegateWallet.address))).to.be.lt(INV(0.0001));
      expect((await contract.vestingEnd()).sub(start + elapsed)).to.be.lt(10);
    });
  });

  describe("Delegate", async function () {
    it("allows delegations on reverse vesting", async function () {
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      await contractAsUser.delegate(delegateWallet.address);
      expect(await inv.getCurrentVotes(delegateWallet.address)).to.be.equal(amount);
    });
    it("does not allow delegations on direct vesting", async function () {
      contract = (await deployContract(deployerWallet, InterruptibleInverseVesterABI, [
        inv.address,
        amount,
        durationInDays,
        false,
        deployerWallet.address,
      ])) as InterruptibleInverseVester;
      contractAsUser = contract.connect(userWallet);
      await inv.approve(contract.address, amount);
      await contract.start(userWallet.address, deployerWallet.address);
      await expect(contractAsUser.delegate(delegateWallet.address)).to.be.revertedWith(
        "InverseVester:DELEGATION_NOT_ALLOWED",
      );
    });
  });
  describe("ACL", async function () {
    it("Forbids non owner to call start", async function () {
      await expect(contractAsUser.start(userWallet.address, deployerWallet.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("Forbids non owner to delegate", async function () {
      await expect(contractAsUser.delegate(userWallet.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Forbids non timelock to interrupt", async function () {
      await expect(contractAsUser.interrupt(userWallet.address)).to.be.revertedWith(
        "InterruptibleInverseVester:ACCESS_DENIED",
      );
    });

    it("Forbids non timelock to set timelock", async function () {
      await expect(contractAsUser.setTimelock(userWallet.address)).to.be.revertedWith(
        "InterruptibleInverseVester:ACCESS_DENIED",
      );
    });
  });
});
