import * as anchor from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import assert from "assert";

const MINT_MAP = JSON.parse(
  fs.readFileSync(path.join(__dirname,`.keypairs/mint_map.json`), {
    encoding: "utf-8",
  })
)

const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const INCUBATOR_SEED = "incubator_v0";
const UPDATE_AUTHORITY_SEED = "update_authority";
const DEPOSIT_AUTHORITY_SEED = "deposit_authority";

//rust enum used for the program's RPC API.
const IncubatorState = {
  Available: { available: {} },
  Hatching: { hatching: {} },
  Paused: { paused: {} },
};

const CURRENT_USER_INDEX = 8;

describe('incubator', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const incubatorProgram = anchor.workspace.Incubator;
  const controllerProgram = anchor.workspace.Controller;

  console.log("Incubator : ", incubatorProgram.programId.toString());
  console.log("Controller: ", controllerProgram.programId.toString());

  let incubatorAuthority = null;
  let user = null;

  const createUser = async (userIndex = 0) => {
    const user = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          fs.readFileSync(path.join(__dirname,`.keypairs/user${userIndex}.json`), {
            encoding: "utf-8",
          })
        )
      )
    );

    
      //Uncomment if on localnet
      let airdropBalance = 2 * LAMPORTS_PER_SOL;
      let sig = await provider.connection.requestAirdrop(user.publicKey, airdropBalance);
      await provider.connection.confirmTransaction(sig);
    
    console.log(`User: ${userIndex}: ${user.publicKey.toString()} | ${await getAccountBalance(user.publicKey)}`)

    let wallet = new anchor.Wallet(user);
    let userProvider = new anchor.Provider(provider.connection, wallet, provider.opts);

    return {
      key: user,
      wallet,
      provider: userProvider,
    };
  }

  const incubatorProgramForUser = (user) => {
    return new anchor.Program(incubatorProgram.idl, incubatorProgram.programId, user.provider);
  }

  const controllerProgramForUser = (user) => {
    return new anchor.Program(controllerProgram.idl, controllerProgram.programId, user.provider);
  }

  const getAccountBalance = async (pubkey: PublicKey) => {
    let account = await provider.connection.getAccountInfo(pubkey);
    return account?.lamports ?? 0;
  }

  const createSlots = async (user, capacity: Number) => {
    let program = incubatorProgramForUser(user);
    const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED)
    ], incubatorProgram.programId);

    const slots = await fetchSlotPDAs(capacity);
    for(let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      console.log(`Create Slot: ${slot.index} | ${slot.address.toString()}`);
      await program.rpc.createSlot(slot.index, {
        accounts: {
          incubator: incubator_pda,
          slot: slot.address,
          authority: user.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
      });
    }

    return program.account.incubator.fetch(incubator_pda);
  }

  const fetchSlotPDAs = async (capacity: Number) => {
    let retval = [];
    for(let i = 0; i < capacity; i++) {
      const [slot_pda] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from(INCUBATOR_SEED),
        Buffer.from("slot"),
        Uint8Array.from([i])
      ], incubatorProgram.programId);

      retval.push({ address: slot_pda, index: i });
    }

    return retval;
  }

  const createDepositAuthority = async (owner) => {
    const [deposit_authority_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from(DEPOSIT_AUTHORITY_SEED),
    ], controllerProgram.programId);

    let program = controllerProgramForUser(owner);
    await program.rpc.createDepositAuthority({
      accounts: {
        authority: owner.key.publicKey,
        depositAuthority: deposit_authority_pda,
        systemProgram: SystemProgram.programId,
      },
    });

    return program.account.depositAuthority.fetch(deposit_authority_pda);
  }

  const createIncubator = async (owner) => {
    const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED)
    ], incubatorProgram.programId);

    const [update_authority_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from(UPDATE_AUTHORITY_SEED),
    ], incubatorProgram.programId);

    const [deposit_authority_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from(DEPOSIT_AUTHORITY_SEED),
    ], controllerProgram.programId);

    console.log("Incubator PDA    : ", incubator_pda.toString());
    console.log("Update Authority : ", update_authority_pda.toString());
    console.log("Deposit Authority: ", deposit_authority_pda.toString());

    let program = incubatorProgramForUser(owner);
    await program.rpc.createIncubator({
      accounts: {
        incubator: incubator_pda,
        authority: owner.key.publicKey,
        updateAuthority: update_authority_pda,
        depositAuthority: deposit_authority_pda,
        controllerProgram: controllerProgram.programId,
        systemProgram: SystemProgram.programId,
      },
    });

    return program.account.incubator.fetch(incubator_pda);
  }

    const resetIncubator = async () => {
      const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from(INCUBATOR_SEED)
      ], incubatorProgram.programId);
      
      const slots = await fetchSlotPDAs(5);
      let program = incubatorProgramForUser(incubatorAuthority);

      await program.rpc.resetIncubator({
        accounts: {
          incubator: incubator_pda,
          authority: incubatorAuthority.key.publicKey,
          systemProgram: SystemProgram.programId,
        },
        remainingAccounts: slots.map(s => ({ pubkey: s.address, isWritable: false, isSigner: false }))
      });

      return program.account.incubator.fetch(incubator_pda);
    }

    const updateIncubatorState = async (state) => {
      const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress([
        Buffer.from(INCUBATOR_SEED)
      ], incubatorProgram.programId);
      
      let program = incubatorProgramForUser(incubatorAuthority);
      await program.rpc.updateIncubatorState(state, {
        accounts: {
          incubator: incubator_pda,
          authority: incubatorAuthority.key.publicKey,
          systemProgram: SystemProgram.programId,
        }
      });

      return program.account.incubator.fetch(incubator_pda);
    }

  const createDraggosMetadata = async (mint: PublicKey) => {
    const [draggos_metadata_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from("metadata"),
      mint.toBuffer()
    ], incubatorProgram.programId);
    console.log("Draggos Metadata PDA: ", draggos_metadata_pda.toString());

    const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED)
    ], incubatorProgram.programId);

    const uri = MINT_MAP[mint.toString()];
    let program = incubatorProgramForUser(incubatorAuthority);
    await program.rpc.createDraggosMetadata(uri, {
      accounts: {
        incubator: incubator_pda,
        authority: incubatorAuthority.key.publicKey,
        draggosMetadataAccount: draggos_metadata_pda,
        mint: mint,
        systemProgram: SystemProgram.programId,
      },
    });

    return program.account.draggosMetadata.fetch(draggos_metadata_pda);;
  }

  const depositEgg = async (owner, token: PublicKey, mint: PublicKey) => {
    const [incubator_pda] = await PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED)
    ], incubatorProgram.programId);

    const [draggos_metadata_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from("metadata"),
      mint.toBuffer()
    ], incubatorProgram.programId);

    const [token_metadata_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from("metadata"),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ], METAPLEX_METADATA_PROGRAM_ID);

    const [update_authority_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from(UPDATE_AUTHORITY_SEED),
    ], incubatorProgram.programId);

    const [deposit_authority_pda] = await anchor.web3.PublicKey.findProgramAddress([
      Buffer.from(INCUBATOR_SEED),
      Buffer.from(DEPOSIT_AUTHORITY_SEED),
    ], controllerProgram.programId);

    let incubatorProgramUser = incubatorProgramForUser(owner);
    let controllerProgramUser = controllerProgramForUser(owner);
    let incubator = await incubatorProgramUser.account.incubator.fetch(incubator_pda);
    const capacity = incubator.slots.length;

    let slots = await fetchSlotPDAs(capacity);
    let slotAccounts = slots.map(s => ({ pubkey: s.address, isWritable: true, isSigner: false }));
    await controllerProgramUser.rpc.depositController({
      accounts: {
        authority: owner.key.publicKey,
        incubator: incubator_pda,
        draggosMetadataAccount: draggos_metadata_pda,
        tokenMetadataAccount: token_metadata_pda,
        mint: mint,
        updateAuthority: update_authority_pda,
        tokenAccount: token,
        tokenMetadataProgram: METAPLEX_METADATA_PROGRAM_ID,
        incubatorProgram: incubatorProgram.programId,
        depositAuthority: deposit_authority_pda
      },
      remainingAccounts: slotAccounts
    });

    return incubatorProgram.account.incubator.fetch(incubator_pda);
  }

  /*
  *
  * BEGIN TESTS
  * 
  */

  describe("#controller", async () => {
    it('creates a deposit authority', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }

      let depositAuthority = await createDepositAuthority(incubatorAuthority);
      assert(depositAuthority.authority.toString() === incubatorAuthority.key.publicKey.toString());
    });
  });

  describe("#incubator", async () => {
    it('creates an incubator', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }

      let incubator = await createIncubator(incubatorAuthority);
      assert(incubator.authority.toString() === incubatorAuthority.key.publicKey.toString());
    });
  });

  describe("#slots", async () => {
    it('creates slots', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }
      
      const num_slots = 5;
      const incurbator = await createSlots(incubatorAuthority, num_slots);
      assert(incurbator.slots.length === num_slots);
    });
  });

  describe("#metadata", async () => {
    xit('creates all draggos metadata for a wallet', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }

      if(!user) {
        user = await createUser(CURRENT_USER_INDEX);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user.key.publicKey, { programId: TOKEN_PROGRAM_ID });

      for(const token of tokens) {
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        console.log("Create Draggos Metadata For Token: ", tokenMint.toString());
        let draggosMetdata = await createDraggosMetadata(tokenMint);
        assert(draggosMetdata.mint.toString === tokenMint.toString());
      }
    });
  });

  describe("#update state", async () => {
    xit('update incubator state', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }

      const incubator = await updateIncubatorState(IncubatorState.Available);
      console.log("Updated Incubator State: ", incubator.state);
    });
  });

  describe("#depsit", async () => {
    xit('deposit tokens', async () => {
      if(!user) {
        user = await createUser(CURRENT_USER_INDEX);
      }

      let { value: tokens = [] } = await provider.connection.getParsedTokenAccountsByOwner(user.key.publicKey, { programId: TOKEN_PROGRAM_ID });

      for(const token of tokens) {
        const tokenAccount = new PublicKey(token.pubkey);
        const tokenMint = new PublicKey(token.account.data.parsed.info.mint);
        console.log("Deposit Token: ", tokenMint.toString());

        const incubator = await depositEgg(user, tokenAccount, tokenMint);
        console.log("Update Incubator: ", JSON.stringify(incubator,null,2));
      }
    });
  });

  describe("#reset", async () => {
    xit('reset incubator', async () => {
      if(!incubatorAuthority) {
        incubatorAuthority = await createUser();
      }

      const incubator = await resetIncubator();
      assert(incubator.mints.length === 0);
    });
  });
});
