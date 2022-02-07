import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import fs from "fs";
import path from "path";

//new anchor.BN(0).toArrayLike(Buffer),

let cm2id = "H7xL44dQh7Z14tfupfjMF6EVCCiSSTd449jbqEfH6b4R";
const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const TOKEN_MINT = new PublicKey("6VybVzPmruwe7dJcet24vc1VMgK81A75cicRcQxD4ogT");
const TOKEN_ACCOUNT = new PublicKey("BEgMwJErSKHPYLtJhgYeL9pcdrSP5MFAfqe6ATTTZ9QR");

describe('incubator', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Incubator;

  let incubatorSigner = null;
  let user1 = null;
  let user2 = null;
  let draggosMetadataAccount = null;

  async function createUser(userIndex = 0) {
    //let airdropBalance = 2 * LAMPORTS_PER_SOL;
    const user = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(path.join(__dirname,`.keypairs/user${userIndex}.json`), {
            encoding: "utf-8",
          })
        )
      )
    );

    console.log(`User: ${userIndex}: ${user.publicKey.toString()} | ${await getAccountBalance(user.publicKey)}`)
    //let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    //await provider.connection.confirmTransaction(sig);

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


    const [updateAuthority, updateAuthorityBump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("update_authority"),
    ], mainProgram.programId);

    console.log("Main Program ID: ", mainProgram.programId.toString());
    console.log("Incubator PDA  : ", pda.toString());
    console.log("Update         : ", updateAuthority.toString());


    let program = programForUser(owner);
    await program.rpc.initialize(capacity, bump, updateAuthorityBump, {
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        updateAuthority: updateAuthority,
        systemProgram: SystemProgram.programId,
      }
    });


    //let incub = await program.account.incubator.fetch(pda);
    return {};
  }

  async function createDraggosMetadata(mint) {
    const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("metadata"),
      mint.toBuffer()
    ], mainProgram.programId);

    const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0")
    ], mainProgram.programId);

    let program = programForUser(incubatorSigner);
    await program.rpc.createMetadataAccount(draggosMetadataPDABump, 'https://arweave.net/_Nbo0fbgTDt78O_4UHH4QkySFLALagEotC84DmH-EBI', {
      accounts: {
        incubator: pda,
        authority: incubatorSigner.key.publicKey,
        draggosMetadataAccount: draggosMetadataPDA,
        mint: mint,
        systemProgram: SystemProgram.programId,
      },
    });

    let meta = await program.account.draggosMetadata.fetch(draggosMetadataPDA);
    return meta;
  }

  async function depositEgg(owner, token: PublicKey, mint: PublicKey) {
    const [pda, bump] = await PublicKey.findProgramAddress([
      Buffer.from("incubator_v0")
    ], mainProgram.programId);

    const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("metadata"),
      TOKEN_MINT.toBuffer()
    ], mainProgram.programId);



    /*const [metadataPDA, metadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("metadata"),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ], METAPLEX_PROGRAM_ID);*/

    const [metadataPDA, metadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("metadata"),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      TOKEN_MINT.toBuffer(),
    ], METAPLEX_METADATA_PROGRAM_ID);

    const [updateAuthority, updateAuthorityBump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("update_authority"),
    ], mainProgram.programId);

    let program = programForUser(owner);

    //let _u = await program.account.updateAuthority.fetch(updateAuthority);
    //console.log("DM: ", JSON.stringify(_u));

    console.log("Incubator: ", pda.toString());
    console.log("Owner    : ", owner.key.publicKey.toString());
    console.log("Update   : ", updateAuthority.toString());

    await program.rpc.deposit(draggosMetadataPDABump, updateAuthorityBump, {
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        draggosMetadataAccount: draggosMetadataPDA,
        metadata: metadataPDA,
        mint: TOKEN_MINT,
        updateAuthority,
        tokenMetadataProgram: METAPLEX_METADATA_PROGRAM_ID,
        tokenAccount: TOKEN_ACCOUNT,
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

  describe("#incubator", async function () {
    xit('creates an incubator', async () => {
      incubatorSigner = await createUser();
  
  
      let incubator = await createIncubator(incubatorSigner, 5);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      //expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });


  describe("#metadata", async function () {
    xit('creates a draggos metadata', async () => {
      if(!incubatorSigner) {
        incubatorSigner = await createUser();
      }

      let draggosMetdata = await createDraggosMetadata(TOKEN_MINT);
  
      //await depositEgg(owner1);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      // expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });


  describe("#depsit", async function () {
    it('deposit tokens', async () => {
      if(!user1) {
        user1 = await createUser(4);
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
