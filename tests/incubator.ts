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

const MINT_MAP = {
  "6QXAQf4YsQTrUwLeGUUf44MbmZ8DFL2Yz94tNdE8GLX8":"https://smr-volume-1.s3.amazonaws.com/assets/899.json",
  "CgbJ6w5GiZGbVQvtfuZudVzBkgSGmYG6issWcgv57PyT":"https://smr-volume-1.s3.amazonaws.com/assets/898.json",
  "48BKnMi7g8o2QX7icULHrELQ6aACfX8Bi5yzr9jspSzc":"https://smr-volume-1.s3.amazonaws.com/assets/897.json",
  "4RBAVfJwJWfjEoZVxTFDGQJ4aLBYtiMyUsK8MnMbLWom":"https://smr-volume-1.s3.amazonaws.com/assets/896.json",
  "2Q1BvcsnhzpVw5VmETLvoxY6sq4AXYu4iAhJ4nYSaUXy":"https://smr-volume-1.s3.amazonaws.com/assets/895.json",
  "FUsNqm6dX4nJZVrqXpP5qtXy1JqbabcYy6nKKvPTqxzu":"https://smr-volume-1.s3.amazonaws.com/assets/894.json",
  "7ZDMygGDtsbAb31UYXrHJkyXDe7YLL5YqGtgwv4WkyMr":"https://smr-volume-1.s3.amazonaws.com/assets/893.json",
  "12QE12JxbB2SqYCZJ7n8JVhtfwvoJSupKk1KrWhteLjz":"https://smr-volume-1.s3.amazonaws.com/assets/892.json",
  "8SKFjfW5ckhDmt56oqqVPHsSyeVbouD4mGfxsHDqi2pn":"https://smr-volume-1.s3.amazonaws.com/assets/891.json",
  "C8zZxfXJmdnnNQdZKxC6Jkhkse5UeVv1QXiRUMNv1UjW":"https://smr-volume-1.s3.amazonaws.com/assets/890.json"
}

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

  async function createSlots(user, capacity: Number) {
    let program = programForUser(user);

    const slots = await fetchSlots(capacity);
    for(let i = 0; i < slots.length; i++) {
      const slot = slots[i]

      const [incubatorPDA, incubatorBump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], mainProgram.programId);

      console.log(`Create Slot: ${slot.address} | ${slot.bump}`);
      await program.rpc.createSlot(incubatorBump, slot.bump, i, {
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
      retval.push({ address: slotPDA, bump: slotPDABump });
    }

    return retval;
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
    await program.rpc.createIncubator(capacity, bump, updateAuthorityBump, {
      accounts: {
        incubator: pda,
        authority: owner.key.publicKey,
        updateAuthority: updateAuthority,
        systemProgram: SystemProgram.programId,
      },
    });
  }

    async function resetIncubator(tokens = []) {
      const [pda, bump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], mainProgram.programId);
      
      const slots = await fetchSlots(4);
      let program = programForUser(incubatorSigner);

      await program.rpc.resetIncubator({
        accounts: {
          incubator: pda,
          authority: incubatorSigner.key.publicKey,
          systemProgram: SystemProgram.programId,
          slot1: slots[0].address,
          slot2: slots[1].address,
          slot3: slots[2].address,
          slot4: slots[3].address
        },
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
    await program.rpc.createDraggosMetadata(draggosMetadataPDABump, uri, {
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

    const [updateAuthority, updateAuthorityBump] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("incubator_v0"),
      Buffer.from("update_authority"),
    ], mainProgram.programId);
    console.log("Update     : ", updateAuthority.toString());
    console.log("Incubator  : ", pda.toString());

    let program = programForUser(owner);
    let controllerProgramUser = controllerProgramForUser(owner);
    let incubator = await program.account.incubator.fetch(pda);

    let slots = await fetchSlots(incubator.capacity);
    let slotAccounts = slots.map(s => ({ pubkey: s.address, isWritable: true, isSigner: false }));

    let metaplexMetadataAccounts = [];
    let draggosMetadataAccounts = [];
    for (var i = 0; i < incubator.mints.length; i++) {
      const mint = incubator.mints[i];

      const [metaplexMetadataPDA, metaplexMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("metadata"),
        METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ], METAPLEX_METADATA_PROGRAM_ID);

      const [draggosMetadataPDA, draggosMetadataPDABump] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0"),
        Buffer.from("metadata"),
        mint.toBuffer()
      ], mainProgram.programId);

      metaplexMetadataAccounts.push({ pubkey: metaplexMetadataPDA, isWritable: true, isSigner: false });
      draggosMetadataAccounts.push({ pubkey: draggosMetadataPDA, isWritable: true, isSigner: false });
    }

    let remainingAccounts = slotAccounts.concat(metaplexMetadataAccounts).concat(draggosMetadataAccounts);

    const tx = await controllerProgramUser.rpc.depositController(updateAuthorityBump, {
      accounts: {
        authority: owner.key.publicKey,
        incubator: pda,
        draggosMetadataAccount: draggosMetadataPDA,
        metaplexMetadataAccount: metadataPDA,
        mint: mint,
        updateAuthority,
        tokenAccount: token,
        tokenMetadataProgram: METAPLEX_METADATA_PROGRAM_ID,
        incubatorProgram: mainProgram.programId
      },
      remainingAccounts,
      instructions: [
        
      ]
    });

    const tx_destails = await program.provider.connection.getTransaction(tx, { commitment: 'confirmed' });

    console.log(`TX: ${tx}`);
    console.log(tx_destails.meta.logMessages);

    let incub = await program.account.incubator.fetch(pda);
    let metadata = await program.account.draggosMetadata.fetch(draggosMetadataPDA);
    let slot = await program.account.slot.fetch(slots[2].address);

    return { incubator: incub, metadata, slot };
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
  
  
      let incubator = await createIncubator(incubatorSigner, 4);
  
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
  
      await createSlots(incubatorSigner, 4);
  
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
        user1 = await createUser(9);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });

      for(const token of tokens) {
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        //console.log("Tokens: ", tokenMint.toString());
        let draggosMetdata = await createDraggosMetadata(tokenMint);
        //console.log("Created Metadata: ", JSON.stringify(draggosMetdata,null,2));
      }

  
      //await depositEgg(owner1);
  
      //expect(list.data.listOwner.toString(), 'List owner is set').equals(owner.key.publicKey.toString());
      // expect(list.data.name, 'List name is set').equals('A list');
      //expect(list.data.lines.length, 'List has no items').equals(0);
    });
  });


  describe("#depsit", async function () {
    it('deposit tokens', async () => {
      if(!user1) {
        user1 = await createUser(9);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user1.key.publicKey, { programId: TOKEN_PROGRAM_ID });
      //console.log("Tokens: ", JSON.stringify(tokens.map(t => t.pubkey),null,2));
      let t = tokens.slice(0,4);
      for(const token of t) {
        const tokenAccount = new PublicKey(token.pubkey);
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        const res = await depositEgg(user1, tokenAccount, tokenMint);
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
        user1 = await createUser(9);
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
