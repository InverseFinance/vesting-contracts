import hre from "hardhat";
import { deploySingletonContract } from "../../utils/deployment";
import { ADDRESSES } from "./addresses";

async function main(): Promise<void> {
  const networkId = hre.network.config.chainId?.toString();
  const addresses = ADDRESSES.get(networkId ?? "");
  if (!addresses) throw new Error("Unsupported network");

  console.log(
    `Deployment Started. networkId = ${networkId} timelock = ${addresses.timelock} INV = ${addresses.invToken}`,
  );

  await deploySingletonContract(hre, true, true, "InverseVesterFactory", [addresses.invToken, addresses.timelock]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
