import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Stack,
  Text,
  Image,
  SimpleGrid,
  Button,
  VStack,
} from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import { actions } from "../utils";
import * as anchor from "@project-serum/anchor";

const DRAGGOS_SYMBOL = "DRAGGOS";
const INCUBATOR_PROGRAM = new anchor.web3.PublicKey(
  process.env.REACT_APP_INCUBATOR_PROGRAM_ID
);

const IncubatorContainer = ({ connection, candyMachineId, txTimeout }) => {
  const [draggosNfts, setDraggosNfts] = useState([]);
  const [incubator, setIncubator] = useState(null);

  const wallet = useWallet();

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      console.log("[INCUBATOR] No wallet");
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    };
  }, [wallet]);

  const refreshDraggos = useCallback(async () => {
    if (!anchorWallet) {
      console.log("No wallet connected");
      return;
    }

    const provider = new anchor.Provider(connection, anchorWallet, {
      preflightCommitment: "processed",
    });
    const idl = await anchor.Program.fetchIdl(INCUBATOR_PROGRAM, provider);
    const program = new anchor.Program(idl, INCUBATOR_PROGRAM, provider);

    const metadataItems = await Metadata.findDataByOwner(
      connection,
      anchorWallet.publicKey
    );

    const draggos = metadataItems.filter(
      (m) => m.data.symbol === DRAGGOS_SYMBOL
    );

    for (const draggo of draggos) {
      console.log(draggo);
      const mData = await actions.fetchMetadata(draggo.data.uri);
      try {
        const mint = new anchor.web3.PublicKey(draggo.mint);
        const [draggos_metadata_pda] =
          await anchor.web3.PublicKey.findProgramAddress(
            [
              Buffer.from("incubator_v0"),
              Buffer.from("metadata"),
              mint.toBuffer(),
            ],
            program.programId
          );
        const draggosMetadata = await program.account.draggosMetadata.fetch(
          draggos_metadata_pda
        );
        draggo.hatched = draggosMetadata.hatched;
      } catch (err) {
        console.log("No hatched: ", draggo.mint);
      }
      draggo.image = mData.image;
    }
    setDraggosNfts(draggos.sort());
  }, [anchorWallet, candyMachineId, connection]);

  const refreshIncubatorState = useCallback(async () => {
    if (!anchorWallet) {
      return;
    }

    const provider = new anchor.Provider(connection, anchorWallet, {
      preflightCommitment: "processed",
    });

    const idl = await anchor.Program.fetchIdl(INCUBATOR_PROGRAM, provider);
    const program = new anchor.Program(idl, INCUBATOR_PROGRAM, provider);

    const [incubator_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("incubator_v0")],
      program.programId
    );
    const i = await program.account.incubator.fetch(incubator_pda);
    setIncubator(i);
  }, [anchorWallet, candyMachineId, connection]);

  const depositEgg = useCallback(
    async (egg) => {
      if (!anchorWallet) {
        return;
      }

      await actions.depositEgg(egg, connection, anchorWallet);
    },
    [anchorWallet, candyMachineId, connection]
  );

  useEffect(() => {
    refreshIncubatorState();
    refreshDraggos();
  }, [
    anchorWallet,
    candyMachineId,
    connection,
    refreshIncubatorState,
    refreshDraggos,
  ]);

  const renderDraggo = (draggo = {}) => (
    <VStack p={2} bg="red.200" rounded={"lg"} maxW={"200px"} key={draggo.mint}>
      <Image rounded={"lg"} src={draggo.image} />
      <Text textAlign={"center"} w="100%">
        {draggo.data.name}
      </Text>
      {!draggo.hatched && (
        <Button onClick={() => depositEgg(draggo)}>Deposit</Button>
      )}
    </VStack>
  );

  return (
    <Stack p={5}>
      <Text>Your Draggos</Text>
      <SimpleGrid minChildWidth="300px" spacing="50px" justify="space-between">
        {draggosNfts.map(renderDraggo)}
      </SimpleGrid>
    </Stack>
  );
};

export default IncubatorContainer;
