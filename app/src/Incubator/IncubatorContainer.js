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
  const [depositingMint, setDepositingMint] = useState(null);

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
    setDraggosNfts(
      draggos.sort(
        (a, b) =>
          parseInt(a.data.name.split("#").pop()) -
          parseInt(b.data.name.split("#").pop())
      )
    );
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

      setDepositingMint(egg.mint);

      try {
        await actions.depositEgg(egg, connection, anchorWallet);
        await refreshIncubatorState();
      } catch (err) {
        console.log(err);
      }

      setDepositingMint(null);
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

  const renderDraggo = (draggo = {}) => {
    const in_incubator = incubator.mints.find(
      (m) => m.toString() == draggo.mint
    );
    const can_hatch = !in_incubator && !draggo.hatched;
    return (
      <VStack w="100%" key={draggo.mint}>
        <VStack shadow={"md"} p={2} bg="gray.100" rounded={"lg"} maxW={"250px"}>
          <Image rounded={"lg"} src={draggo.image} />
          <Text textAlign={"center"} w="100%">
            {draggo.data.name}
          </Text>
          {can_hatch && (
            <Button
              isLoading={depositingMint == draggo.mint}
              isDisabled={depositingMint}
              w="100%"
              bg="purple.500"
              color="white"
              fontWeight={"bold"}
              onClick={() => depositEgg(draggo)}
            >
              Deposit
            </Button>
          )}
          {in_incubator && <Text>In Incubator</Text>}
        </VStack>
      </VStack>
    );
  };

  return (
    <Stack p={5}>
      {incubator && (
        <Box>
          <Text>Incubator Stats</Text>
          <Text>
            {incubator.mints.length} / {incubator.slots.length} slots filled
          </Text>
          <Text>Current Batch: {incubator.currentBatch}</Text>
          <Text>Draggos Hatched: {incubator.hatchedTotal}</Text>
        </Box>
      )}
      <VStack>
        <Text fontSize={"2xl"} fontWeight="bold">
          Your Draggos
        </Text>
        <SimpleGrid w="100%" minChildWidth="300px" spacing="20px">
          {draggosNfts.map(renderDraggo)}
        </SimpleGrid>
      </VStack>
    </Stack>
  );
};

export default IncubatorContainer;
