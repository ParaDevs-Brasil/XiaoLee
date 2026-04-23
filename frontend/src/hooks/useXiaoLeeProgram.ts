import { useState, useEffect } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM');

// Mock structure for the IDL
const IDL = {
  version: '0.1.0',
  name: 'xiaolee_core',
  instructions: [],
  accounts: [
    {
      name: 'UserState',
      type: {
        kind: 'struct',
        fields: [
          { name: 'twitterId', type: 'string' },
          { name: 'swapCount', type: 'u64' },
          { name: 'totalVolume', type: 'u64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
};

export function useXiaoLeeProgram(twitterId: string | null) {
  const [userState, setUserState] = useState<{ swapCount: number; totalVolume: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!twitterId) return;

    const fetchState = async () => {
      setLoading(true);
      try {
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const wallet = {
          publicKey: PublicKey.default,
          signTransaction: async <T>(transaction: T) => transaction,
          signAllTransactions: async <T>(transactions: T[]) => transactions,
        } as unknown as anchor.Wallet;
        const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
        const idlWithAddress = { ...IDL, address: PROGRAM_ID.toBase58() } as unknown as anchor.Idl;
        const program = new anchor.Program(idlWithAddress, provider);

        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from('user'), Buffer.from(twitterId)],
          PROGRAM_ID
        );

        // Fetch account
        const userStateAccount = program.account as { userState: { fetch: (address: PublicKey) => Promise<{ swapCount: anchor.BN; totalVolume: anchor.BN }> } };
        const account = await userStateAccount.userState.fetch(pda);
        setUserState({
          swapCount: account.swapCount.toNumber(),
          totalVolume: account.totalVolume.toNumber(),
        });
      } catch (err: unknown) {
        console.warn('Failed to fetch user PDA', err);
        setError('Nenhum dado on-chain encontrado para esta conta. Faça seu primeiro swap!');
        setUserState(null);
      } finally {
        setLoading(false);
      }
    };

    fetchState();
  }, [twitterId]);

  return { userState, loading, error };
}
