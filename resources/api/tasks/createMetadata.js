/* eslint-disable import/no-unresolved */
/* eslint-disable no-throw-literal */
/* eslint-disable no-console */
/* eslint-disable strict */
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const {
  PublicKey,
  Connection,
  Keypair,
  SystemProgram,
} = require("@solana/web3.js");
const bs58 = require("bs58");
const Anchor = require("@project-serum/anchor");
const { Metadata } = require("@metaplex-foundation/mpl-token-metadata");

const RPC_URL = process.env.RPC_URL;
const S3_BUCKET = process.env.S3_BUCKET;
const INCUBATOR_PROGRAM_ID = process.env.INCUBATOR_PROGRAM_ID;

module.exports.handler = async (event = {}) => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  const { pathParameters = {} } = event;
  const { mint } = pathParameters;

  try {
    const connection = new Connection(RPC_URL);
    const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(SECRET_KEY)));
    console.log("Signer: ", keypair.publicKey.toString());
    const wallet = new Anchor.Wallet(keypair);
    const provider = new Anchor.Provider(connection, wallet, {
      commitment: "confirmed",
    });
    const programId = new PublicKey(INCUBATOR_PROGRAM_ID);
    Anchor.setProvider(provider);

    await validateMint(mint);
    const idl = await fetchIdl();
    const program = new Anchor.Program(idl, programId, provider);
    await createDraggosMetadata({ mint, program, signer: keypair });

    return { status: 200, mint };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify(
        { message: error.message || "An unknown error occured" },
        null,
        2
      ),
    };
  }
};

const createDraggosMetadata = async ({ mint, program, signer }) => {
  const mintPubkey = new PublicKey(mint);

  const metadataPda = await Metadata.getPDA(mintPubkey);
  const data = await Metadata.load(program.provider.connection, metadataPda);
  console.log("Data: ", JSON.stringify(data, null, 2));
  const [draggos_metadata_pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from(INCUBATOR_SEED),
      Buffer.from("metadata"),
      mintPubkey.toBuffer(),
    ],
    incubatorProgram.programId
  );
  console.log("Draggos Metadata PDA: ", draggos_metadata_pda.toString());

  const [incubator_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED)],
    incubatorProgram.programId
  );

  const uri = MINT_MAP[mintPubkey.toString()];
  await program.rpc.createDraggosMetadata(uri, {
    accounts: {
      incubator: incubator_pda,
      authority: signer.publicKey,
      draggosMetadataAccount: draggos_metadata_pda,
      mint: mintPubkey,
      systemProgram: SystemProgram.programId,
    },
  });
};

const validateMint = async (mint) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: "idl/mints.json",
  };

  const { Body } = await s3.getObject(params).promise();
  const mints = JSON.parse(Body.toString());

  if (mints.indexOf(mint) === -1) {
    throw { status: 400, message: `Invalid mint: ${mint}` };
  }
};

const fetchIdl = async () => {
  const params = {
    Bucket: S3_BUCKET,
    Key: "idl/incubator.json",
  };

  try {
    const { Body } = await s3.getObject(params).promise();
    const idl = JSON.parse(Body.toString());
    return idl;
  } catch (err) {
    throw { status: 400, message: `No idl found for incubator program` };
  }
};
