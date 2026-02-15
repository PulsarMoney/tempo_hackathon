import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Address,
  Hex,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  http,
  isAddressEqual,
  keccak256,
  parseUnits,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tip20Abi } from './tip20.abi';

@Injectable()
export class ChainService {
  private readonly chainId: number;
  private readonly rpcUrl: string;
  private readonly tokenAddress: Address;
  private readonly escrowAddress: Address;
  private readonly tokenDecimals: number;

  constructor(private readonly configService: ConfigService) {
    this.chainId = Number(this.configService.get<string>('TEMPO_CHAIN_ID') ?? 42431);
    this.rpcUrl = this.configService.get<string>('TEMPO_RPC_URL') ?? 'https://rpc.moderato.tempo.xyz';
    this.tokenAddress = this.configService.get<string>('DEMO_TOKEN_ADDRESS', '') as Address;
    this.escrowAddress = this.configService.get<string>('OPERATOR_ESCROW_ADDRESS', '') as Address;
    this.tokenDecimals = Number(this.configService.get<string>('DEMO_TOKEN_DECIMALS') ?? 6);
  }

  makeJoinReference(poolId: string, participantId: string): string {
    return `pool:${poolId}:join:${participantId}:v1`;
  }

  makePayoutReference(poolId: string, participantId: string): string {
    return `pool:${poolId}:payout:${participantId}:v1`;
  }

  memoHex(reference: string): Hex {
    return keccak256(toBytes(reference));
  }

  async verifyJoinTransfer(input: {
    txHash: Hex;
    expectedAmount: string;
    expectedMemoHex: Hex;
  }): Promise<{ valid: boolean; reason?: string }> {
    const client = createPublicClient({ transport: http(this.rpcUrl) });

    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: input.txHash }),
      client.getTransactionReceipt({ hash: input.txHash }),
    ]);

    if (receipt.status !== 'success') {
      return { valid: false, reason: 'transaction_not_successful' };
    }

    if (!tx.to || !isAddressEqual(tx.to, this.tokenAddress)) {
      return { valid: false, reason: 'wrong_token_contract' };
    }

    let decoded: ReturnType<typeof decodeFunctionData<typeof tip20Abi>>;
    try {
      decoded = decodeFunctionData({ abi: tip20Abi, data: tx.input });
    } catch {
      return { valid: false, reason: 'invalid_tip20_call' };
    }

    if (decoded.functionName !== 'transferWithMemo') {
      return { valid: false, reason: 'invalid_function' };
    }

    const [to, amount, memo] = decoded.args as [Address, bigint, Hex];

    if (!isAddressEqual(to, this.escrowAddress)) {
      return { valid: false, reason: 'wrong_recipient' };
    }

    const expectedAmount = parseUnits(input.expectedAmount, this.tokenDecimals);
    if (amount !== expectedAmount) {
      return { valid: false, reason: 'wrong_amount' };
    }

    if (memo.toLowerCase() !== input.expectedMemoHex.toLowerCase()) {
      return { valid: false, reason: 'wrong_memo' };
    }

    return { valid: true };
  }

  async executePayout(input: {
    to: Address;
    amount: string;
    memoHex: Hex;
  }): Promise<{ txHash: Hex }> {
    const privateKey = this.configService.get<string>('OPERATOR_PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('OPERATOR_PRIVATE_KEY is required for payout execution');
    }

    const account = privateKeyToAccount(privateKey as Hex);
    const walletClient = createWalletClient({
      account,
      chain: {
        id: this.chainId,
        name: 'Tempo Testnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [this.rpcUrl] } },
      },
      transport: http(this.rpcUrl),
    });

    const hash = await walletClient.writeContract({
      address: this.tokenAddress,
      abi: tip20Abi,
      functionName: 'transferWithMemo',
      args: [input.to, parseUnits(input.amount, this.tokenDecimals), input.memoHex],
      account,
    });

    return { txHash: hash };
  }
}
