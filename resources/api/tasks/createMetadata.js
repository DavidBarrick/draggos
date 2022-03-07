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
const SECRET_KEY = process.env.SECRET_KEY;

const INCUBATOR_SEED = "incubator_v0";

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
    const idl = await Anchor.Program.fetchIdl(programId, provider);

    await validateMint(mint);
    const program = new Anchor.Program(idl, programId, provider);
    const pda = await createDraggosMetadata({ mint, program, signer: keypair });

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          success: true,
          result: {
            pda,
          },
        },
        null,
        2
      ),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify(
        { message: error.message || "An unknown error occured" },
        null,
        2
      ),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
};

const checkForExistingMetdata = async ({ draggos_metadata_pda, program }) => {
  try {
    await program.account.draggosMetadata.fetch(draggos_metadata_pda);
    return true;
  } catch (err) {
    return false;
  }
};

const createDraggosMetadata = async ({ mint, program, signer }) => {
  const mintPubkey = new PublicKey(mint);
  const [draggos_metadata_pda, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(INCUBATOR_SEED),
      Buffer.from("metadata"),
      mintPubkey.toBuffer(),
    ],
    program.programId
  );

  const exists = await checkForExistingMetdata({
    draggos_metadata_pda,
    program,
  });

  if (exists) {
    console.log(`Draggos Metadata Already Exists For Mint: ${mint}`);
    return draggos_metadata_pda.toString();
  }
  const metadataPda = await Metadata.getPDA(mintPubkey);
  const { data } = await Metadata.load(
    program.provider.connection,
    metadataPda
  );
  console.log("Data: ", JSON.stringify(data, null, 2));

  const index = data.data.name.split("#").pop();
  const uri = await fetchUri(parseInt(index));

  console.log("Draggos Metadata PDA: ", draggos_metadata_pda.toString());

  const [incubator_pda] = await PublicKey.findProgramAddress(
    [Buffer.from(INCUBATOR_SEED)],
    program.programId
  );

  console.log("URI: ", uri);
  const tx = await program.rpc.createDraggosMetadata(bump, uri, {
    accounts: {
      incubator: incubator_pda,
      authority: signer.publicKey,
      draggosMetadataAccount: draggos_metadata_pda,
      mint: mintPubkey,
      systemProgram: SystemProgram.programId,
    },
  });
  console.log("TX: ", tx);
  return draggos_metadata_pda.toString();
};

const validateMint = async (mint) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: "metadata/mints.json",
  };

  const { Body } = await s3.getObject(params).promise();
  const mints = JSON.parse(Body.toString());

  if (mints.indexOf(mint) === -1) {
    throw { status: 400, message: `Invalid mint: ${mint}` };
  }
};

const fetchUri = async (index) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: "metadata/hatched.json",
  };

  const { Body } = await s3.getObject(params).promise();
  const hatched_uris = JSON.parse(Body.toString());

  if (index > hatched_uris.length) {
    throw { status: 400, message: `Invalid uri index: ${index}` };
  }

  return hatched_uris[index];
};
