import { Contract, ContractFactory } from "@ethersproject/contracts";
import { ethers } from "ethers";
import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
const HISTORY_DIR = "deployment/history";
function persistAddress(hre: HardhatRuntimeEnvironment, label: string, address: string) {
  const fileName = `deployment/constants-${hre.network.name}.json`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let constants: any = {};
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR);
  }
  if (fs.existsSync(fileName)) {
    fs.copyFileSync(fileName, `${HISTORY_DIR}/constants-${hre.network.name}.${new Date().getTime()}`);
    const rawdata = fs.readFileSync(fileName).toString();
    constants = JSON.parse(rawdata);
  }
  constants[label] = address;
  fs.writeFileSync(fileName, JSON.stringify(constants));
}

export function deployedAddress(hre: HardhatRuntimeEnvironment, label: string): string {
  const fileName = `deployment/constants-${hre.network.name}.json`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let constants: any = {};
  if (fs.existsSync(fileName)) {
    const rawdata = fs.readFileSync(fileName).toString();
    constants = JSON.parse(rawdata);
  }
  return constants[label];
}

export async function deploySingletonContract<T extends Contract>(
  hre: HardhatRuntimeEnvironment,
  force: boolean,
  contractName: string,
  args: Array<unknown> = [],
): Promise<T> {
  return deployContractInstance(hre, force, contractName, contractName, args);
}

export async function deployContractInstance<T extends Contract>(
  hre: HardhatRuntimeEnvironment,
  force: boolean,
  contractName: string,
  instanceName: string,
  args: Array<unknown> = [],
): Promise<T> {
  if (force || !deployedAddress(hre, contractInstanceName(contractName, instanceName))) {
    console.log("Deploying ", contractName);
    const contractFactory: ContractFactory = await hre.ethers.getContractFactory(contractName);
    const contract: Contract = await contractFactory.deploy(...args);
    await contract.deployed();
    console.log(`${contractName}: ${contract.address}`);
    persistAddress(hre, contractInstanceName(contractName, instanceName), contract.address);
    return contract as T;
  } else {
    return deployedContract<T>(hre, contractName, instanceName);
  }
}

function contractInstanceName(contractName: string, instanceName: string): string {
  // We accept both fully qualified names or contract + label
  return instanceName.includes("::") ? instanceName : `${contractName}::${instanceName}`;
}

export async function deployedContract<T extends Contract>(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  instanceNameOrAddress: string = contractName, // In case of a singleton we use the default
): Promise<T> {
  // We try to look up by instance name first
  let address: string = deployedAddress(hre, contractInstanceName(contractName, instanceNameOrAddress));
  // If we can't find the instance we fall back to using the argument as address
  address = address ? address : instanceNameOrAddress;
  if (!address || !ethers.utils.isAddress(address)) {
    throw new Error(
      `${instanceNameOrAddress} is neither a valid instance name nor address for contract ${contractName}`,
    );
  } else {
    return (await hre.ethers.getContractAt(contractName, address)) as T;
  }
}
