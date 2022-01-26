import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import fs from "fs";
import path from "path";

//new anchor.BN(0).toArrayLike(Buffer),


const devNetConnection = new Connection("https://api.devnet.solana.com", "confirmed")

let cm2id = "RX2KsUUhYSSHLyRB1ax36kmqd8YCzrzKNxhCKitrxo5";
const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe('incubator', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Incubator;

  let incubatorSigner = null;
  let user1 = null;
  let user2 = null;

  async function createUser(userIndex = 0) {
    let airdropBalance = 2 * LAMPORTS_PER_SOL;
    const user = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(path.join(__dirname,`.keypairs/user${userIndex}.json`), {
            encoding: "utf-8",
          })
        )
      )
    );

    //console.log(`User: ${userIndex}: ${user.publicKey.toString()} | ${await getAccountBalance(user.publicKey)}`)
    let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    await provider.connection.confirmTransaction(sig);

    let wallet = new anchor.Wallet(user);
    let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);

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
      Buffer.from("incubator_v0")
    ], mainProgram.programId);
    console.log("Main Program ID: ", mainProgram.programId.toString());
    console.log("PDA: ", pda.toString());


    let program = programForUser(owner);
    await program.rpc.initialize(capacity, bump, {
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        systemProgram: SystemProgram.programId,
      },
    });

    //let incub = await program.account.incubator.fetch(pda);
    return {};
  }

  /*
    pub incubator: Account<'info, Incubator>,
    pub owner: Signer<'info>,
    #[account(
        has_one = owner
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [
            b"metadata",
            METAPLEX_PROGRAM_ID.as_bytes(),
            mint_account.key().as_ref()
        ],
        bump = metadata_account_bump,
    )]
    pub metadata_account: Account<'info, Metadata>,
    #[account(
        init,
        seeds = [
            b"incubator",
            mint_account.key().as_ref(),
            b"metadata"
        ],
        bump = draggos_metadata_account_bump,
        payer = owner,
        space = 10000,
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub mint_account: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
  */
  async function depositEgg(owner, token: PublicKey, mint: PublicKey) {
    const [pda, bump] = await PublicKey.findProgramAddress([
      Buffer.from("incubator_v0")
    ], mainProgram.programId);

    const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("metadata"),
    ], mainProgram.programId);

    /*const [metadataPDA, metadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("metadata"),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ], METAPLEX_PROGRAM_ID);*/


    let program = programForUser(owner);

    console.log("Incubator: ", pda.toString());
    console.log("Owner: ", owner.key.publicKey.toString());

    await program.rpc.deposit(draggosMetadataPDABump, {
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        //tokenAccount: token,
        //metadataAccount: owner.key.publicKey,
        draggosMetadataAccount: draggosMetadataPDA,
        //mintAccount: mint,
        systemProgram: SystemProgram.programId,
      },
    });


    let list = await program.account.incubator.fetch(pda);
    let meta = await program.account.draggosMetadata.fetch(draggosMetadataPDA);

    return { list, meta };
  }

  function programForUser(user) {
    return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
  }

  describe("#equals", async function () {
    it('creates an incubator', async () => {
      incubatorSigner = await createUser();
      user1 = await createUser(1);
  
  
      let incubator = await createIncubator(incubatorSigner, 5);
      console.log(JSON.stringify(incubator));
  
  
      //await depositEgg(owner1);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      // expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });


  describe("#depsit", async function () {
    it('deposit tokens', async () => {
      if(!user1) {
        user1 = await createUser(1);
      }

      /*let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });
      const validToken = tokens.filter(t => !t.account.data.parsed.info.isNative).pop();

      const tokenAccount = new PublicKey(validToken.pubkey);
      const tokenMint = new PublicKey(validToken.account.data.parsed.info.mint);
      const newIncubator = await depositEgg(user1, tokenAccount, tokenMint);
      console.log(JSON.stringify(newIncubator,null,2))*/
      const newIncubator = await depositEgg(user1, null, null);
      console.log('Updated: ', JSON.stringify(newIncubator,null,2))

    });
  });
});
