export interface AddressesConfig {
  timelock: string;
  invToken: string;
}

const kovan: AddressesConfig = {
  timelock: "0x0f43eB2bfC014Cd7Bea6A3DA0f23406465e62626",
  invToken: "0x7bf3BE5685bf15Dc7a9C79D08988902d877a36F4",
};

const mainnet: AddressesConfig = {
  timelock: "0x926dF14a23BE491164dCF93f4c468A50ef659D5B",
  invToken: "0x41d5d79431a913c4ae7d69a668ecdfe5ff9dfb68",
};

export const ADDRESSES = new Map<string, AddressesConfig>([
  ["42", kovan],
  ["1", mainnet],
]);
