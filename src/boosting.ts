import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import { getBalances } from "./utils";
import { ensureAllowance, toBN, toStringFromBN } from './utils';
import { curve, ALIASES } from "./curve";
import { DictInterface } from "./interfaces";


export const getCrv = async (...addresses: string[] | string[][]): Promise<DictInterface<string> | string> => {
    if (addresses.length == 1 && Array.isArray(addresses[0])) addresses = addresses[0];
    if (addresses.length === 0) addresses = [curve.signerAddress];
    addresses = addresses as string[];

    const rawBalances = (await getBalances(addresses, [ALIASES.crv]));

    const balances: DictInterface<string> = {};
    for (const address of addresses) {
        balances[address] = rawBalances[address].shift() as string;
    }

    return addresses.length === 1 ? balances[addresses[0]] : balances
}

export const getLockedAmountAndUnlockTime = async (...addresses: string[] | string[][]):
    Promise<DictInterface<{ lockedAmount: string, unlockTime: number }> | { lockedAmount: string, unlockTime: number }> => {
    if (addresses.length == 1 && Array.isArray(addresses[0])) addresses = addresses[0];
    if (addresses.length === 0) addresses = [curve.signerAddress];
    addresses = addresses as string[];

    const veContract = curve.contracts[ALIASES.voting_escrow].multicallContract;
    const contractCalls = addresses.map((address: string) => veContract.locked(address));

    const response: (string | number)[][] = (await curve.multicallProvider.all(contractCalls)).map(
        (value: ethers.BigNumber[]) => [ethers.utils.formatUnits(value[0]), Number(ethers.utils.formatUnits(value[1], 0)) * 1000]);

    const result: DictInterface<{ lockedAmount: string, unlockTime: number }> = {};
    addresses.forEach((addr: string, i: number) => {
        result[addr] = { lockedAmount: response[i][0] as string, unlockTime: response[i][1] as number};
    });

    return addresses.length === 1 ? result[addresses[0]] : result
}

export const getVeCrv = async (...addresses: string[] | string[][]): Promise<DictInterface<string> | string> => {
    if (addresses.length == 1 && Array.isArray(addresses[0])) addresses = addresses[0];
    if (addresses.length === 0) addresses = [curve.signerAddress];
    addresses = addresses as string[];

    const veContract = curve.contracts[ALIASES.voting_escrow].multicallContract;
    const contractCalls = addresses.map((address: string) => veContract.balanceOf(address));
    const response: string[] = (await curve.multicallProvider.all(contractCalls)).map((value: ethers.BigNumber) => ethers.utils.formatUnits(value));

    const result: DictInterface<string> = {};
    addresses.forEach((addr: string, i: number) => {
        result[addr] = response[i];
    });

    return addresses.length === 1 ? result[addresses[0]] : result
}

export const getVeCrvPct = async (...addresses: string[] | string[][]): Promise<DictInterface<string> | string> => {
    if (addresses.length == 1 && Array.isArray(addresses[0])) addresses = addresses[0];
    if (addresses.length === 0) addresses = [curve.signerAddress];
    addresses = addresses as string[];

    const veContract = curve.contracts[ALIASES.voting_escrow].multicallContract;
    const contractCalls = [veContract.totalSupply()];
    addresses.forEach((address: string) => {
        contractCalls.push(veContract.balanceOf(address));
    });
    const response: BigNumber[] = (await curve.multicallProvider.all(contractCalls)).map((value: ethers.BigNumber) => toBN(value));

    const [veTotalSupply] = response.splice(0, 1);

    const resultBN: DictInterface<BigNumber> = {};
    addresses.forEach((acct: string, i: number) => {
        resultBN[acct] = response[i].div(veTotalSupply).times(100);
    });

    const result: DictInterface<string> = {};
    for (const entry of Object.entries(resultBN)) {
        result[entry[0]] = toStringFromBN(entry[1]);
    }

    return addresses.length === 1 ? result[addresses[0]] : result
}

export const createLock = async (amount: string, days: number): Promise<string> => {
    const _amount = ethers.utils.parseUnits(amount);
    const unlockTime = Math.floor(Date.now() / 1000) + (days * 86400);
    await ensureAllowance([ALIASES.crv], [_amount], ALIASES.voting_escrow);

    return (await curve.contracts[ALIASES.voting_escrow].contract.create_lock(_amount, unlockTime)).hash
}

export const increaseAmount = async (amount: string): Promise<string> => {
    const _amount = ethers.utils.parseUnits(amount);
    await ensureAllowance([ALIASES.crv], [_amount], ALIASES.voting_escrow);

    return (await curve.contracts[ALIASES.voting_escrow].contract.increase_amount(_amount)).hash
}

export const increaseUnlockTime = async (days: number): Promise<string> => {
    const { unlockTime } = await getLockedAmountAndUnlockTime() as { lockedAmount: string, unlockTime: number };
    const newUnlockTime = Math.floor(unlockTime / 1000) + (days * 86400);

    return (await curve.contracts[ALIASES.voting_escrow].contract.increase_unlock_time(newUnlockTime)).hash
}

export const withdrawLockedCrv = async (): Promise<string> => {
    return (await curve.contracts[ALIASES.voting_escrow].contract.withdraw()).hash
}