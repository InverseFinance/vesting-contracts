import { expect } from "chai";
import { waffle } from "hardhat";
import InverseVesterFactoryABI from "../../artifacts/contracts/InverseVesterFactory.sol/InverseVesterFactory.json";
import InvABI from "../../artifacts/contracts/test/INV.sol/INV.json";
import { INV as InvToken, InverseVester, InverseVesterFactory } from "../../typechain";
import { INV } from "../../utils/utils";
import { deployedContract } from "../utils/utils";

describe("Inverse Vester Factory", function () {
  const amount = INV(1000);
  const durationInDays = 365;
  let inv: InvToken;
  let invAsTimelock: InvToken;

  let contract: InverseVesterFactory;
  let contractAsUser: InverseVesterFactory;

  const provider = waffle.provider;
  const [deployerWallet, userWallet0, userWallet1, timelockWallet] = provider.getWallets();
  const { deployContract } = waffle;

  beforeEach(async () => {
    inv = (await deployContract(deployerWallet, InvABI, [deployerWallet.address])) as InvToken;
    invAsTimelock = inv.connect(timelockWallet);
    await inv.openTheGates();
    contract = (await deployContract(deployerWallet, InverseVesterFactoryABI, [
      inv.address,
      timelockWallet.address,
    ])) as InverseVesterFactory;
    // Timelock becomes owner after instantiation
    contract = contract.connect(timelockWallet);
    contractAsUser = contract.connect(userWallet0);
    // Simulate timelock
    await inv.mint(timelockWallet.address, amount);
    await invAsTimelock.approve(contract.address, amount);
  });

  describe("Initialisation", function () {
    async function assertInitializedValues(
      vestingStartDelayInDays: number,
      reverseVesting: boolean,
      interruptible: boolean,
    ) {
      await expect(
        contract.newInverseVester(
          userWallet0.address,
          amount,
          durationInDays,
          vestingStartDelayInDays,
          reverseVesting,
          interruptible,
        ),
      ).to.emit(contract, "VestingCreated");
      const vestingContractAddress = await contract.inverseVestersByRecipient(userWallet0.address, 0);
      const vestingContract: InverseVester = await deployedContract("InverseVester", vestingContractAddress);
      expect(await vestingContract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await vestingContract.interruptible()).to.be.equal(interruptible);
      expect(await vestingContract.inv()).to.be.equal(inv.address);
      expect(await vestingContract.owner()).to.be.equal(userWallet0.address);
      expect(await vestingContract.timelock()).to.be.equal(timelockWallet.address);
      expect(await vestingContract.vestingAmount()).to.be.equal(amount);
      expect(await vestingContract.vestingDurationInDays()).to.be.equal(durationInDays);
      expect(await vestingContract.vestingStartDelayInDays()).to.be.equal(vestingStartDelayInDays);
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

    it("initializes values correctly for NonInterruptibleVestingAgreement", async function () {
      const vestingStartDelayInDays = 10;
      const reverseVesting = true;
      await expect(
        contract.newNonInterruptibleVestingAgreement(
          userWallet0.address,
          amount,
          durationInDays,
          vestingStartDelayInDays,
          reverseVesting,
        ),
      ).to.emit(contract, "VestingCreated");
      const vestingContractAddress = await contract.inverseVestersByRecipient(userWallet0.address, 0);
      const vestingContract: InverseVester = await deployedContract("InverseVester", vestingContractAddress);
      expect(await vestingContract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await vestingContract.interruptible()).to.be.equal(false);
      expect(await vestingContract.inv()).to.be.equal(inv.address);
      expect(await vestingContract.owner()).to.be.equal(userWallet0.address);
      expect(await vestingContract.timelock()).to.be.equal(timelockWallet.address);
      expect(await vestingContract.vestingAmount()).to.be.equal(amount);
      expect(await vestingContract.vestingDurationInDays()).to.be.equal(durationInDays);
      expect(await vestingContract.vestingStartDelayInDays()).to.be.equal(vestingStartDelayInDays);
    });

    it("initializes values correctly for InterruptibleVestingAgreement", async function () {
      const vestingStartDelayInDays = 10;
      const reverseVesting = true;
      await expect(
        contract.newInterruptibleVestingAgreement(
          userWallet0.address,
          amount,
          durationInDays,
          vestingStartDelayInDays,
          reverseVesting,
        ),
      ).to.emit(contract, "VestingCreated");
      const vestingContractAddress = await contract.inverseVestersByRecipient(userWallet0.address, 0);
      const vestingContract: InverseVester = await deployedContract("InverseVester", vestingContractAddress);
      expect(await vestingContract.reverseVesting()).to.be.equal(reverseVesting);
      expect(await vestingContract.interruptible()).to.be.equal(true);
      expect(await vestingContract.inv()).to.be.equal(inv.address);
      expect(await vestingContract.owner()).to.be.equal(userWallet0.address);
      expect(await vestingContract.timelock()).to.be.equal(timelockWallet.address);
      expect(await vestingContract.vestingAmount()).to.be.equal(amount);
      expect(await vestingContract.vestingDurationInDays()).to.be.equal(durationInDays);
      expect(await vestingContract.vestingStartDelayInDays()).to.be.equal(vestingStartDelayInDays);
    });

    it("initializes values correctly for Salary Agreement", async function () {
      const vestingStartDelayInDays = 10;
      await expect(
        contract.newSalaryAgreement(userWallet0.address, amount, durationInDays, vestingStartDelayInDays),
      ).to.emit(contract, "VestingCreated");
      const vestingContractAddress = await contract.inverseVestersByRecipient(userWallet0.address, 0);
      const vestingContract: InverseVester = await deployedContract("InverseVester", vestingContractAddress);
      expect(await vestingContract.reverseVesting()).to.be.equal(false);
      expect(await vestingContract.interruptible()).to.be.equal(true);
      expect(await vestingContract.inv()).to.be.equal(inv.address);
      expect(await vestingContract.owner()).to.be.equal(userWallet0.address);
      expect(await vestingContract.timelock()).to.be.equal(timelockWallet.address);
      expect(await vestingContract.vestingAmount()).to.be.equal(amount);
      expect(await vestingContract.vestingDurationInDays()).to.be.equal(durationInDays);
      expect(await vestingContract.vestingStartDelayInDays()).to.be.equal(vestingStartDelayInDays);
    });
  });

  describe("Registry", function () {
    it("inverse vesters are correctly stored and retrieved", async function () {
      await contract.newInverseVester(userWallet0.address, 100, 100, 0, true, false);
      await contract.newInverseVester(userWallet0.address, 200, 200, 0, true, false);
      await contract.newInverseVester(userWallet1.address, 300, 300, 0, true, false);
      await contract.newInverseVester(userWallet1.address, 400, 400, 0, true, false);
      await contract.newInverseVester(userWallet1.address, 500, 500, 0, true, false);
      expect((await contract.getAllRecipients()).length).to.be.equal(2);
      expect((await contract.getInverseVestersByRecipient(userWallet0.address)).length).to.be.equal(2);
      expect((await contract.getInverseVestersByRecipient(userWallet1.address)).length).to.be.equal(3);
    });
  });

  describe("ACL", async function () {
    it("forbids non owner to create new vesting agreement ", async function () {
      // After creation user wallet becomes owner
      await expect(
        contractAsUser.newInverseVester(userWallet0.address, amount, durationInDays, 10, false, true),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("forbids non owner to create new interruptible vesting agreement ", async function () {
      await expect(
        contractAsUser.newInterruptibleVestingAgreement(userWallet0.address, amount, durationInDays, 10, false),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("forbids non owner to create new non interruptible vesting agreement ", async function () {
      await expect(
        contractAsUser.newNonInterruptibleVestingAgreement(userWallet0.address, amount, durationInDays, 10, false),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("forbids non owner to create new salary agreement ", async function () {
      await expect(
        contractAsUser.newSalaryAgreement(userWallet0.address, amount, durationInDays, 10),
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("allows timelock to set timelock", async function () {
      await contract.setTimelock(userWallet0.address);
      expect(await contract.owner()).to.be.equal(userWallet0.address);
      expect(await contract.timelock()).to.be.equal(userWallet0.address);
    });

    it("forbids non timelock to set timelock", async function () {
      await expect(contractAsUser.setTimelock(userWallet0.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
  });
});
