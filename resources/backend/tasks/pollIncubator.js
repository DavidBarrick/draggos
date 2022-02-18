/* eslint-disable import/no-unresolved */
/* eslint-disable no-throw-literal */
/* eslint-disable no-console */
/* eslint-disable strict */
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const Solana = require('@solana/web3.js');
const Anchor = require('@project-serum/anchor');

const RPC_URL = process.env.RPC_URL;
const INCUBATOR_PROGRAM_ID = process.env.INCUBATOR_PROGRAM_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET;

const TOKEN_METADATA_PROGRAM_ID = new Solana.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

module.exports.handler = async (event = {}) => {
    console.log('Event: ', JSON.stringify(event, null, 2));
    const connection = new Solana.Connection(RPC_URL);
    const keypair = Solana.Keypair.fromSecretKey(Buffer.from(JSON.parse(SECRET_KEY)));
    console.log("Signer: ", keypair.publicKey.toString());
    const wallet = new Anchor.Wallet(keypair);
    const provider = new Anchor.Provider(connection, wallet, { commitment: "confirmed" });
    const programId = new Solana.PublicKey(INCUBATOR_PROGRAM_ID);
    Anchor.setProvider(provider);

    try {
        const idl = await fetchIdl();
        const program = new Anchor.Program(idl, programId, provider);
        await pollIncubator({ program, signer: keypair });

        return { status: 200 };
    } catch (error) {
        console.error(error);
        return {
            statusCode: error.statusCode || 500,
            body: JSON.stringify({ message: error.message || 'An unknown error occured' }, null, 2),
        };
    }
};

const fetchIdl = async () => {
    const params = {
        Bucket: S3_BUCKET,
        Key: 'idl/incubator.json'
    }

    try {
        const { Body } = await s3.getObject(params).promise();
        const idl = JSON.parse(Body.toString());
        return idl;
    } catch(err) {
        throw { status: 400, message: `No idl found for incubator program` };
    }
}

const pollIncubator = async ({ program, signer }) => {
    const [incubator_pda] = await Solana.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0")
      ], program.programId);
      
    const incubator = await program.account.incubator.fetch(incubator_pda);
    console.log("Incubator Authority: ", incubator.authority.toString());

    //Would like to check .state here instead of math, but comparing enums are hard with anchor
    if (incubator.mints.length == incubator.slots.length) {
        let slots_hatched_count = 0;
        for(const slot_address of incubator.slots) {
            console.log("Check Slot: ", slot_address.toString());
            const slot = await program.account.slot.fetch(slot_address);
            console.log("Found Slot: ", JSON.stringify(slot, null, 2));
            if(slot.mint) {
                await hatchSlot({ program, incubator_pda, slot_address, slot, signer });
            }

            slots_hatched_count += 1;
        }

        if(slots_hatched_count === incubator.slots.length) {
            await resetIncubator({ program, incubator_pda, signer, slots: incubator.slots });
        }
    } else {
        console.log("Not ready to hatch: ", incubator.state);
    }
}

const hatchSlot = async ({ program, incubator_pda, slot_address, slot, signer} ) => {
    const [draggos_metadata_pda] = await Solana.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0"),
        Buffer.from("metadata"),
        slot.mint.toBuffer()
    ], program.programId);

    const [update_authority_pda] = await Solana.PublicKey.findProgramAddress([
        Buffer.from("incubator_v0"),
        Buffer.from("update_authority")
    ], program.programId);

    const [token_metadata_pda] = await Solana.PublicKey.findProgramAddress([
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        slot.mint.toBuffer(),
    ], TOKEN_METADATA_PROGRAM_ID);

    console.log("Hatch Slot          : ", slot_address.toString());
    console.log("Draggos Metadata PDA: ", draggos_metadata_pda.toString());
    console.log("Token Metadata PDA  : ", token_metadata_pda.toString());

    const tx = await program.rpc.hatchIncubator({
        accounts: {
            authority: signer.publicKey,
            incubator: incubator_pda,
            draggosMetadata: draggos_metadata_pda,
            tokenMetadata: token_metadata_pda,
            updateAuthority: update_authority_pda,
            slot: slot_address,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID
        }
    });
    
    console.log("Hatch TX: ", tx);

    try {
        const tx_details = await program.provider.connection.getTransaction(tx, { commitment: 'confirmed' });
        console.log(JSON.stringify(tx_details.meta.logMessages,null,2));
    } catch (err) {
        console.error("Failed to fetch program logs");
    }

}

const resetIncubator = async ({ program, incubator_pda, signer, slots }) => {
    const tx = await program.rpc.resetIncubator({
        accounts: {
            authority: signer.publicKey,
            incubator: incubator_pda
        },
        remainingAccounts: slots.map(s => ({ pubkey: s, isMutable: false, isSigner: false }))
    });

    console.log("Reset TX: ", tx);

    try {
        const tx_details = await program.provider.connection.getTransaction(tx, { commitment: 'confirmed' });
        console.log(JSON.stringify(tx_details.meta.logMessages,null,2));
    } catch (err) {
        console.error("Failed to fetch program logs");
    }
}