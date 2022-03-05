/* eslint-disable import/no-unresolved */
/* eslint-disable no-throw-literal */
/* eslint-disable no-console */
/* eslint-disable strict */
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const { PublicKey, Connection } = require("@solana/web3.js");
const bs58 = require("bs58");

const RPC_URL = process.env.RPC_URL;
const CANDY_MACHINE_ID = process.env.CANDY_MACHINE_ID;
const S3_BUCKET = process.env.S3_BUCKET;

const TOKEN_METADATA_PROGRAM = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const CANDY_MACHINE_V2_PROGRAM = new PublicKey(
  "cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ"
);

const CANDY_MACHINE_PUBKEY = new PublicKey(CANDY_MACHINE_ID);

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

module.exports.handler = async (event = {}) => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  const connection = new Connection(RPC_URL);

  try {
    const mints = await fetchMints(connection);
    await updateMints(mints);

    return { status: 200, mints: mints.length };
  } catch (error) {
    console.error(error);
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

const updateMints = async (mints = []) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: "idl/mints.json",
    Body: JSON.stringify(mints),
  };

  await s3.putObject(params).promise();
};

const fetchMints = async (connection) => {
  const [creatorAddress] = await PublicKey.findProgramAddress(
    [Buffer.from("candy_machine"), CANDY_MACHINE_PUBKEY.toBuffer()],
    CANDY_MACHINE_V2_PROGRAM
  );

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
            bytes: creatorAddress.toBase58(),
          },
        },
      ],
    }
  );

  return metadataAccounts.map((metadataAccountInfo) =>
    bs58.encode(metadataAccountInfo.account.data)
  );
};
