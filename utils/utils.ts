import { BigNumber, utils } from "ethers";
export const SECONDS_IN_DAY = 3600 * 24;
export const A_NON_ZERO_ADDRESS = "0x1234000000000000000000000000000000000000";

export const SECONDS_IN_PERIOD = [
  0,
  3600,
  SECONDS_IN_DAY,
  SECONDS_IN_DAY * 7,
  SECONDS_IN_DAY * 14,
  SECONDS_IN_DAY * 30,
  SECONDS_IN_DAY * 90,
];

export function isNotZero(e: number | string): boolean {
  return !!e && e != "0";
}

export function toNumber(e: BigNumber): number {
  return e.toNumber();
}

export function toString(e: BigNumber): string {
  return e.toString();
}

export function ETH(val: string | number): BigNumber {
  return utils.parseEther(val.toString());
}

export function INV(val: string | number): BigNumber {
  return utils.parseEther(val.toString());
}
