import { Contract } from "ethers";
import hre, { ethers } from "hardhat";
export const SECONDS_IN_DAY = 3600 * 24;
export const A_NON_ZERO_ADDRESS = "0x1234000000000000000000000000000000000000";

export async function getCurrentTimeStamp(): Promise<number> {
  const blockNumber = await ethers.provider.getBlockNumber();
  return (await ethers.provider.getBlock(blockNumber)).timestamp;
}

export async function advanceBlockAtTime(time: number): Promise<void> {
  await ethers.provider.send("evm_mine", [time]);
}

export async function advanceBlockBySeconds(secondsToAdd: number): Promise<void> {
  const newTimestamp = (await getCurrentTimeStamp()) + secondsToAdd;
  await ethers.provider.send("evm_mine", [newTimestamp]);
}

export async function deployedContract<T extends Contract>(contractName: string, address: string): Promise<T> {
  return (await hre.ethers.getContractAt(contractName, address)) as T;
}
