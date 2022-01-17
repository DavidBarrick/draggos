import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

describe('incubator', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Incubator;

  let mintA: Token = null;
  let mintB: Token = null;
  let mintC: Token = null;
  let mintD: Token = null;

  let tokenAccounts = {};
  let otherTokenAccount: PublicKey = null;
  let mintAuthority = Keypair.generate();

  async function createUser(airdropBalance) {
    airdropBalance = airdropBalance ?? 10 * LAMPORTS_PER_SOL;
    let user = anchor.web3.Keypair.generate();
    let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    await provider.connection.confirmTransaction(sig);

    let wallet = new anchor.Wallet(user);
    let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);

    mintA = await Token.createMint(
      provider.connection,
      user,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    mintB = await Token.createMint(
      provider.connection,
      user,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    mintC = await Token.createMint(
      provider.connection,
      user,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    mintA = await Token.createMint(
      provider.connection,
      user,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    let tokenAccount = await mintA.createAccount(
      user.publicKey
    );

    tokenAccounts[user.publicKey.toString()] = tokenAccount;

    await mintA.mintTo(
      tokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      1
    );

    return {
      key: user,
      wallet,
      provider: userProvider,
    };
  }

  async function getAccountBalance(pubkey) {
    let account = await provider.connection.getAccountInfo(pubkey);
    return account?.lamports ?? 0;
  }

  async function createIncubator(owner, capacity=16) {
    const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator")
    ], mainProgram.programId);

    let program = programForUser(owner);
    await program.rpc.initialize(capacity, bump, {
      accounts: {
        incubator: pda,
        owner: owner.key.publicKey,
        systemProgram: SystemProgram.programId,
      },
    });

    let list = await program.account.incubator.fetch(pda);
      console.log(list);
      return list;
  }

  async function depositEgg(owner) {
    const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator")
    ], mainProgram.programId);


    let program = programForUser(owner);
    await program.rpc.deposit({
      accounts: {
        incubator: pda,
        owner: owner.key.publicKey,
        token: tokenAccounts[owner.key.publicKey.toString()],
        systemProgram: SystemProgram.programId,
      },
    });

    let list = await program.account.incubator.fetch(pda);
      console.log("eggs: ", list.eggs.length);
      return list;
  }

  function programForUser(user) {
    return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
  }

  describe('new list', () => {
    it('creates a list', async () => {
      const owner1 = await createUser();

      let list = await createIncubator(owner1, 10);
      console.log(list);

      for(var i = 0; i < 15; i++) {
        await depositEgg(owner1);
      }


      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      // expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });
});
