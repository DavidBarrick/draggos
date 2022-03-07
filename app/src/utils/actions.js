import fetch from "node-fetch";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_METADATA_PROGRAM_ID } from "./candymachine";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const CONTROLLER_PROGRAM = new PublicKey(
  process.env.REACT_APP_CONTROLLER_PROGRAM_ID
);

const INCUBATOR_PROGRAM = new PublicKey(
  process.env.REACT_APP_INCUBATOR_PROGRAM_ID
);

const INCUBATOR_SEED = "incubator_v0";
const UPDATE_AUTHORITY_SEED = "update_authority";
const DEPOSIT_AUTHORITY_SEED = "deposit_authority";

const ENDPOINT = process.env.REACT_APP_API_ENDPOINT;
const API_KEY = process.env.REACT_APP_API_KEY;

const fetchMetadata = async (uri) => {
  try {
    const response = await fetch(uri);
    return response.json();
  } catch (err) {
    const errData = err.response ? err.response.data : err;
    throw errData;
  }
};

const createDraggosMetadata = async (egg) => {
  try {
    const response = await fetch(`${ENDPOINT}/mints/${egg.mint}/metadata`, {
      method: "post",
      body: JSON.stringify({}),
      headers: { "x-api-key": API_KEY },
    });
    const data = await response.json();
    console.log(data);
  } catch (err) {
    const errData = err.response ? err.response.data : err;
    throw errData;
  }
};

const findAssociatedTokenAddress = async (walletAddress, tokenMintAddress) => {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];
};

const fetchSlotPDAs = async (capacity) => {
  let retval = [];
  for (let i = 0; i < capacity; i++) {
    const [slot_pda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from(INCUBATOR_SEED), Buffer.from("slot"), Uint8Array.from([i])],
      INCUBATOR_PROGRAM
    );

    retval.push({ address: slot_pda, bump, index: i });
  }

  return retval;
};

const depositEgg = async (draggo, connection, wallet) => {
  await createDraggosMetadata(draggo);

  const provider = new anchor.Provider(connection, wallet, {
    preflightCommitment: "processed",
  });
  const mint = new PublicKey(draggo.mint);
  const controllerIdl = await anchor.Program.fetchIdl(
    CONTROLLER_PROGRAM,
    provider
  );
  const controllerProgram = new anchor.Program(
    controllerIdl,
    CONTROLLER_PROGRAM,
    provider
  );

  const incubatorIdl = await anchor.Program.fetchIdl(
    INCUBATOR_PROGRAM,
    provider
  );
  const incubatorProgram = new anchor.Program(
    incubatorIdl,
    INCUBATOR_PROGRAM,
    provider
  );

  const [incubator_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED)],
    INCUBATOR_PROGRAM
  );

  const [draggos_metadata_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED), Buffer.from("metadata"), mint.toBuffer()],
    INCUBATOR_PROGRAM
  );

  const [token_metadata_pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const [update_authority_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED), Buffer.from(UPDATE_AUTHORITY_SEED)],
    INCUBATOR_PROGRAM
  );

  const [deposit_authority_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED), Buffer.from(DEPOSIT_AUTHORITY_SEED)],
    CONTROLLER_PROGRAM
  );

  let incubator = await incubatorProgram.account.incubator.fetch(incubator_pda);
  const capacity = incubator.slots.length;

  let slots = await fetchSlotPDAs(capacity);
  let slotAccounts = slots.map((s) => ({
    pubkey: s.address,
    isWritable: true,
    isSigner: false,
  }));

  const tokenAccount = await findAssociatedTokenAddress(wallet.publicKey, mint);
  console.log(
    "Token Account: ",
    await connection.getParsedAccountInfo(tokenAccount)
  );

  await controllerProgram.rpc.depositController({
    accounts: {
      authority: wallet.publicKey,
      incubator: incubator_pda,
      draggosMetadata: draggos_metadata_pda,
      tokenMetadata: token_metadata_pda,
      mint: mint,
      updateAuthority: update_authority_pda,
      tokenAccount: tokenAccount,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      incubatorProgram: incubatorProgram.programId,
      depositAuthority: deposit_authority_pda,
    },
    remainingAccounts: slotAccounts,
  });
};

const actions = {
  fetchMetadata,
  depositEgg,
};

export default actions;
