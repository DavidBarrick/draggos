const {
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
} = require("@solana/web3.js");
const bs58 = require("bs58");
const BN = require("bn.js");
const fs = require("fs");
const path = require("path");
const Anchor = require("@project-serum/anchor");

const TOKEN_METADATA_PROGRAM = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const CANDY_MACHINE_V2_PROGRAM = new PublicKey(
  "cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ"
);

const INCUBATOR_SEED = "incubator_v0";
const UPDATE_AUTHORITY_SEED = "update_authority";

const { programs } = require("@metaplex/js");

require("dotenv").config();
const CANDY_MACHINE_ID = process.env.CANDY_MACHINE_ID;
console.log("CM ID: ", CANDY_MACHINE_ID);
const candyMachineProgram = new PublicKey(CANDY_MACHINE_ID);
const connection = new Connection("https://api.devnet.solana.com");

const MAX_NAME_LENGTH = 32;
const MAX_URI_LENGTH = 200;
const MAX_SYMBOL_LENGTH = 10;
const MAX_CREATOR_LEN = 32 + 1 + 1;
const MAX_CREATOR_LIMIT = 5;
const MAX_DATA_SIZE =
  4 +
  MAX_NAME_LENGTH +
  4 +
  MAX_SYMBOL_LENGTH +
  4 +
  MAX_URI_LENGTH +
  2 +
  1 +
  4 +
  MAX_CREATOR_LIMIT * MAX_CREATOR_LEN;
const MAX_METADATA_LEN = 1 + 32 + 32 + MAX_DATA_SIZE + 1 + 1 + 9 + 172;
const CREATOR_ARRAY_START =
  1 +
  32 +
  32 +
  4 +
  MAX_NAME_LENGTH +
  4 +
  MAX_URI_LENGTH +
  4 +
  MAX_SYMBOL_LENGTH +
  2 +
  1 +
  4;

const loadWallet = (name) => {
  const jsonKeypair = fs.readFileSync(
    path.join(__dirname, `../tests/.keypairs/${name}.json`),
    {
      encoding: "utf-8",
    }
  );
  const wallet = Keypair.fromSecretKey(Buffer.from(JSON.parse(jsonKeypair)));

  return wallet;
};

const getCandyMachineCreator = async (candyMachine) =>
  PublicKey.findProgramAddress(
    [Buffer.from("candy_machine"), candyMachine.toBuffer()],
    CANDY_MACHINE_V2_PROGRAM
  );

const incubatorProgram = () => {
  const incubatorIdl = fs.readFileSync(
    path.join(__dirname, `../target/idl/incubator.json`),
    {
      encoding: "utf-8",
    }
  );

  const incubatorIdlJson = JSON.parse(incubatorIdl);

  return new PublicKey(incubatorIdlJson.metadata.address);
};

const revertCandyMachineAuthority = async () => {
  const incubatorProgramPubkey = incubatorProgram();
  const [incubator_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED)],
    incubatorProgramPubkey
  );

  const [update_authority_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED), Buffer.from(UPDATE_AUTHORITY_SEED)],
    incubatorProgramPubkey
  );

  console.log("Update Authority: ", update_authority_pda.toString());

  const keypair = loadWallet("user0");
  console.log("Signer: ", keypair.publicKey.toString());
  const wallet = new Anchor.Wallet(keypair);
  const provider = new Anchor.Provider(connection, wallet, {
    commitment: "confirmed",
  });

  const idl = await Anchor.Program.fetchIdl(incubatorProgramPubkey, provider);
  const program = new Anchor.Program(idl, incubatorProgramPubkey, provider);

  const incubator = await program.account.incubator.fetch(incubator_pda);
  console.log("Incubator: ", JSON.stringify(incubator, null, 2));
  await program.rpc.revertCandyMachineAuthority({
    accounts: {
      incubator: incubator_pda,
      authority: keypair.publicKey,
      updateAuthority: update_authority_pda,
      candyMachine: candyMachineProgram,
      candyMachineProgram: CANDY_MACHINE_V2_PROGRAM,
    },
  });

  console.log("Reverted To: ", incubator.authority.toString());
};

const updateUpdateAuthority = async (mint, update_authority) => {
  let {
    metadata: { Metadata, UpdateMetadataV2 },
  } = programs;
  let signer = loadWallet(`devnet`);
  let mintAccount = new PublicKey(mint);
  let metadataAccount = await Metadata.getPDA(mintAccount);
  const metadata = await Metadata.load(connection, metadataAccount);

  console.log("Update Authority: ", metadata.data.updateAuthority);

  if (metadata.data.updateAuthority != update_authority.toString()) {
    const updateTx = new UpdateMetadataV2(
      { feePayer: signer.publicKey },
      {
        metadata: metadataAccount,
        updateAuthority: signer.publicKey,
        metadataData: null,
        newUpdateAuthority: update_authority,
        primarySaleHappened: null,
        isMutable: null,
      }
    );

    let sig = await connection.sendTransaction(updateTx, [signer]);
    console.log("result: ", sig);
    await connection.confirmTransaction(sig, "confirmed");
  } else {
    console.log(`Mint Ready: `, mint);
  }
};

const getMintAddresses = async (firstCreatorAddress) => {
  const metadataAccounts = await connection.getProgramAccounts(
    TOKEN_METADATA_PROGRAM,
    {
      // The mint address is located at byte 33 and lasts for 32 bytes.
      dataSlice: { offset: 33, length: 32 },

      filters: [
        // Only get Metadata accounts.
        { dataSize: MAX_METADATA_LEN },

        // Filter using the first creator.
        {
          memcmp: {
            offset: CREATOR_ARRAY_START,
            bytes: firstCreatorAddress.toBase58(),
          },
        },
      ],
    }
  );

  console.log("Metadata Accounts: ", metadataAccounts.length);

  return metadataAccounts.map((metadataAccountInfo) =>
    bs58.encode(metadataAccountInfo.account.data)
  );
};

/*const main = async () => {
  try {
    const [UPDATE_AUTHORITY_PDA] = await PublicKey.findProgramAddress(
      [Buffer.from(INCUBATOR_SEED), Buffer.from(UPDATE_AUTHORITY_SEED)],
      incubatorProgram()
    );

    console.log("Update Authority: ", UPDATE_AUTHORITY_PDA.toString());
    const [creator] = await getCandyMachineCreator(candyMachineProgram);
    console.log("Creator: ", creator.toString());
    const mints = await getMintAddresses(creator);
    console.log(mints);
    for (const mint of mints) {
      //await updateUpdateAuthority(mint, UPDATE_AUTHORITY_PDA);
    }
  } catch (err) {
    console.error(err);
  }
};*/

const main = async () => {
  try {
    await revertCandyMachineAuthority();
  } catch (err) {
    console.error(err);
  }
};

main();
