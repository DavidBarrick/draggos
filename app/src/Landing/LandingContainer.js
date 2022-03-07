import { useEffect, useMemo, useState, useCallback } from "react";
import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { candymachine as CandyMachineUtils } from "../utils";
import { Box, Stack, Text } from "@chakra-ui/react";
import dayjs from "dayjs";

import Mint from "./Mint";
import FiftyPercent from "./FiftyPercent";
import FAQ from "./FAQ";
import Team from "./Team";

const Landing = ({ connection, candyMachineId, txTimeout }) => {
  const [isUserMinting, setIsUserMinting] = useState(false);
  const [candyMachine, setCandyMachine] = useState(null);
  const [alertState, setAlertState] = useState({
    open: false,
    message: "",
    severity: undefined,
  });

  const wallet = useWallet();

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    };
  }, [wallet]);

  const refreshCandyMachineState = useCallback(async () => {
    /*if (!anchorWallet) {
      console.log("No wallet connected");
      return;
    }*/

    if (candyMachineId) {
      try {
        const cndy = await CandyMachineUtils.getCandyMachineState(
          anchorWallet,
          candyMachineId,
          connection
        );
        console.log(cndy);

        /*if (cndy) {
          console.log(
            "Launch Date: ",
            dayjs.unix(cndy.state.goLiveDate.toNumber()).format()
          );
        }*/

        setCandyMachine(cndy);
      } catch (e) {
        console.log("There was a problem fetching Candy Machine state");
        console.log(e);
      }
    }
  }, [anchorWallet, candyMachineId, connection]);

  const onMint = async () => {
    try {
      setIsUserMinting(true);
      document.getElementById("#identity")?.click();
      console.log(candyMachine);
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        const mintTxId = (
          await CandyMachineUtils.mintOneToken(candyMachine, wallet.publicKey)
        )[0];

        let status = { err: true };
        if (mintTxId) {
          status =
            await CandyMachineUtils.awaitTransactionSignatureConfirmation(
              mintTxId,
              txTimeout,
              connection,
              true
            );
        }

        if (status && !status.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error) {
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction Timeout! Please try again.";
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setIsUserMinting(false);
    }
  };

  useEffect(() => {
    refreshCandyMachineState();
  }, [anchorWallet, candyMachineId, connection, refreshCandyMachineState]);

  return (
    <Stack spacing={0} w="100%">
      <Mint
        onMint={onMint}
        isUserMinting={isUserMinting}
        candyMachine={candyMachine}
        wallet={anchorWallet}
      />
      <FiftyPercent />
      <FAQ />
      <Team />
    </Stack>
  );
};

export default Landing;
