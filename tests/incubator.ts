import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import fs from "fs";
import path from "path";

const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const MINT_MAP = {
  "8DQHMZDQrSFjfhu86Fw9EwV9VmTz5qTunuvSMC7G7Xap":"https://smr-volume-1.s3.amazonaws.com/assets/899.json",
  "CbaDDGPBGRds3tyaThnG5xmyENL1dA3faaudXRFFSSUk":"https://smr-volume-1.s3.amazonaws.com/assets/898.json",
  "9qZJg7HLu4VbATj8oJtLCPbBVDWEmxVqQbaSpmW6ozKQ":"https://smr-volume-1.s3.amazonaws.com/assets/897.json",
  "EXCq5JxGcTdmGgXfTrfzrJawZ2vUb7JjP9cA6KjCfivn":"https://smr-volume-1.s3.amazonaws.com/assets/896.json",
  "3ZJDcSV4scDfN2vopL7YsSqMAEoA8RQqDxUZnWXmuhVk":"https://smr-volume-1.s3.amazonaws.com/assets/895.json",
  "uCA9efN1JgUyHSAQSwdRiCkTowRFHYBDKZbACfs4JYc" :"https://smr-volume-1.s3.amazonaws.com/assets/894.json",
  "7tZUJTvvjBWqpMHLZt2Y8Z4HP4LfS9FEiRfu1Qm3Bq5q":"https://smr-volume-1.s3.amazonaws.com/assets/893.json",
  "55CRGJ42weG7xLdDhgC9SQautPgQEH1CHZE2bV1Nbj5w":"https://smr-volume-1.s3.amazonaws.com/assets/892.json",
  "F1fxpCuopckoE9VFEtfyRbBTWG4mCz7VJqnsPCPeghrY":"https://smr-volume-1.s3.amazonaws.com/assets/891.json",
  "8oeDjfHevN8fKRHARHhfPtpWyrHb6bFYrAxHdnBAY76t":"https://smr-volume-1.s3.amazonaws.com/assets/890.json"
}

// Side rust enum used for the program's RPC API.
const IncubatorStatus = {
  Available: { available: {} },
  Hatching: { hatching: {} },
  Paused: { paused: {} },
};

describe('incubator', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const mainProgram = anchor.workspace.Incubator;
  const controllerProgram = anchor.workspace.Controller;

  console.log("Incubator : ", mainProgram.programId.toString());
  console.log("Controller: ", controllerProgram.programId.toString());

  let incubatorSigner = null;
  let user1 = null;
  let user2 = null;
  let draggosMetadataAccount = null;

  async function createUser(userIndex = 0) {
    //let airdropBalance = 2 * LAMPORTS_PER_SOL;
    const user = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          fs.readFileSync(path.join(__dirname,`.keypairs/user${userIndex}.json`), {
            encoding: "utf-8",
          })
        )
      )
    );

    //let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
    //await provider.connection.confirmTransaction(sig);
    console.log(`User: ${userIndex}: ${user.publicKey.toString()} | ${await getAccountBalance(user.publicKey)}`)

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

  async function createSlots(user, capacity: Number) {
    let program = programForUser(user);

    const slots = await fetchSlots(capacity);
    for(let i = 0; i < slots.length; i++) {
      const slot = slots[i]

      const [incubatorPDA, incubatorBump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], mainProgram.programId);

      console.log(`Create Slot: ${slot.index}`);
      await program.rpc.createSlot(slot.index, {
        accounts: {
          incubator: incubatorPDA,
          slot: slot.address,
          authority: user.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
    }
  }

  async function fetchSlots(capacity: Number) {
    let retval = [];
    for(let i = 0; i < capacity; i++) {
      const [slotPDA, slotPDABump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0"),
        Buffer.from("slot"),
        Uint8Array.from([i])
      ], mainProgram.programId);

      //console.log("Slot: ", slotPDA.toString());
      retval.push({ address: slotPDA, bump: slotPDABump, index: i });
    }

    return retval;
  }

  async function createIncubator(owner) {
    const [pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0")
    ], mainProgram.programId);

    const [updateAuthority] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("update_authority"),
    ], mainProgram.programId);

    const [depositAuthority] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("deposit_authority"),
    ], controllerProgram.programId);

    console.log("Main Program ID: ", mainProgram.programId.toString());
    console.log("Incubator PDA  : ", pda.toString());
    console.log("Update         : ", updateAuthority.toString());
    console.log("Deposit        : ", depositAuthority.toString());
    console.log("Controller     : ", controllerProgram.programId.toString());

    let cProgram = controllerProgramForUser(owner);
    await cProgram.rpc.createDepositAuthority({
      accounts: {
        authority: owner.key.publicKey,
        depositAuthority: depositAuthority,
        systemProgram: SystemProgram.programId,
      },
    });

    console.log("Creatred DA");

    let program = programForUser(owner);
    await program.rpc.createIncubator({
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        updateAuthority: updateAuthority,
        depositAuthority: depositAuthority,
        controllerProgram: controllerProgram.programId,
        systemProgram: SystemProgram.programId,
      },
    });
  }

    async function resetIncubator(tokens = []) {
      const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], mainProgram.programId);
      
      const slots = await fetchSlots(5);
      let program = programForUser(incubatorSigner);

      await program.rpc.resetIncubator({
        accounts: {
          incubator: pda,
          authority: incubatorSigner.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
        remainingAccounts: slots.map(s => ({ pubkey: s.address, isWritable: false, isSigner: false }))
      });


      let incub = await program.account.incubator.fetch(pda);
      return { incub };
    }

    async function updateIncubatorState(state) {
      const [pda] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], mainProgram.programId);
      
      let program = programForUser(incubatorSigner);

      await program.rpc.updateIncubatorState(state, {
        accounts: {
          incubator: pda,
          authority: incubatorSigner.key.publicKey,
          systemProgram: SystemProgram.programId,
        }
      });


      let incub = await program.account.incubator.fetch(pda);
      return { incub };
    }

  async function createDraggosMetadata(mint) {
    const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("metadata"),
      mint.toBuffer()
    ], mainProgram.programId);
    console.log("Create DM: ", draggosMetadataPDA.toString());

    const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0")
    ], mainProgram.programId);

    const uri = MINT_MAP[mint.toString()];

    let program = programForUser(incubatorSigner);
    await program.rpc.createDraggosMetadata(uri, {
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
      mint.toBuffer()
    ], mainProgram.programId);

    const [metadataPDA, metadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("metadata"),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ], METAPLEX_METADATA_PROGRAM_ID);

    const [updateAuthority] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("update_authority"),
    ], mainProgram.programId);

    const [depositAuthority] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("deposit_authority"),
    ], controllerProgram.programId);
    console.log("Update     : ", updateAuthority.toString());
    console.log("Incubator  : ", pda.toString());

    let program = programForUser(owner);
    let controllerProgramUser = controllerProgramForUser(owner);
    let incubator = await program.account.incubator.fetch(pda);

    let slots = await fetchSlots(incubator.slots.length);
    let slotAccounts = slots.map(s => ({ pubkey: s.address, isWritable: true, isSigner: false }));

    let metaplexMetadataAccounts = [];
    let draggosMetadataAccounts = [];
    for (var i = 0; i < incubator.mints.length; i++) {
      const mint = incubator.mints[i];

      const [metaplexMetadataPDA] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("metadata"),
        METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ], METAPLEX_METADATA_PROGRAM_ID);

      const [draggosMetadataPDA] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0"),
        Buffer.from("metadata"),
        mint.toBuffer()
      ], mainProgram.programId);

      metaplexMetadataAccounts.push({ pubkey: metaplexMetadataPDA, isWritable: true, isSigner: false });
      draggosMetadataAccounts.push({ pubkey: draggosMetadataPDA, isWritable: true, isSigner: false });
    }

    let remainingAccounts = slotAccounts.concat(metaplexMetadataAccounts).concat(draggosMetadataAccounts);

    const tx = await controllerProgramUser.rpc.depositController({
      accounts: {
        authority: owner.key.publicKey,
        incubator: pda,
        draggosMetadataAccount: draggosMetadataPDA,
        metaplexMetadataAccount: metadataPDA,
        mint: mint,
        updateAuthority,
        tokenAccount: token,
        tokenMetadataProgram: METAPLEX_METADATA_PROGRAM_ID,
        incubatorProgram: mainProgram.programId,
        depositAuthority: depositAuthority
      },
      remainingAccounts
    });

    const tx_destails = await program.provider.connection.getTransaction(tx, { commitment: 'confirmed' });

    console.log(`TX: ${tx}`);
    console.log(tx_destails.meta.logMessages);

    let incub = await program.account.incubator.fetch(pda);
    let metadata = await program.account.draggosMetadata.fetch(draggosMetadataPDA);
    //let slot = await program.account.slot.fetch(slots[2].address);

    return { incubator: incub, metadata };
  }

  function programForUser(user) {
    return new anchor.Program(mainProgram.idl, mainProgram.programId, user.provider);
  }

  function controllerProgramForUser(user) {
    return new anchor.Program(controllerProgram.idl, controllerProgram.programId, user.provider);
  }

  describe("#incubator", async function () {
    xit('creates an incubator', async () => {
      incubatorSigner = await createUser();
  
  
      let incubator = await createIncubator(incubatorSigner);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      //expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });

  describe("#slots", async function () {
    xit('creates slots', async () => {
      if(!incubatorSigner) {
        incubatorSigner = await createUser();
      }
  
      await createSlots(incubatorSigner, 5);
  
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

      if(!user1) {
        user1 = await createUser(8);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });

      for(const token of tokens) {
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        console.log("Toke: ", tokenMint.toString());
        let draggosMetdata = await createDraggosMetadata(tokenMint);
        //console.log("Created Metadata: ", JSON.stringify(draggosMetdata,null,2));
      }

  
      //await depositEgg(owner1);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      // expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });

  describe("#update-state", async function () {
    xit('update incubator state', async () => {
      if(!incubatorSigner) {
        incubatorSigner = await createUser();
      }

      const res = await updateIncubatorState(IncubatorStatus.Available);
      //console.log('Updated: ', JSON.stringify(res,null,2));
    });
  });

  describe("#depsit", async function () {
    it('deposit tokens', async () => {
      if(!user1) {
        user1 = await createUser(8);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });
      //console.log("Tokens: ", JSON.stringify(tokens.map(t => t.pubkey),null,2));
      let t = tokens.slice(7,8);
      for(const token of t) {
        const tokenAccount = new PublicKey(token.pubkey);
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        console.log("Deposit Token: ", tokenMint.toString());

        const { incubator } = await depositEgg(user1, tokenAccount, tokenMint);
        console.log("Update Incubator: ", JSON.stringify(incubator,null,2));
        //console.log('Updated: ', JSON.stringify(res, null, 2));
      }
    });
  });

  describe("#reset", async function () {
    xit('reset incubator', async () => {
      if(!incubatorSigner) {
        incubatorSigner = await createUser();
      }

      const res = await resetIncubator();
      //console.log('Updated: ', JSON.stringify(res,null,2));
    });
  });

  describe("#debug", async function () {
    xit('slots', async () => {
      if(!incubatorSigner) {
        incubatorSigner = await createUser();
      }

      if(!user1) {
        user1 = await createUser(8);
      }


      const program = programForUser(incubatorSigner);
      const slots = await fetchSlots(4);


      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });
      //console.log("Tokens: ", JSON.stringify(tokens.map(t => t.pubkey),null,2));
      for(const token of tokens) {
        const tokenAccount = new PublicKey(token.pubkey);
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
          Buffer.from("incubator_v0"),
          Buffer.from("metadata"),
          tokenMint.toBuffer()
        ], mainProgram.programId);
        let metadata = await program.account.draggosMetadata.fetch(draggosMetadataPDA);
        console.log('Meta: ', JSON.stringify(metadata,null,2));
      }

      for(const s of slots) {
        let slot = await program.account.slot.fetch(s.address);
        console.log(`Slot: ${JSON.stringify(slot,null,2)}`);
      }
    });
  });
});
