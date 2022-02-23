import "./App.css";
import { useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import * as anchor from "@project-serum/anchor";

import Header from "./Header";
import Footer from "./Footer";
import Landing from "./Landing";
import Incubator from "./Incubator";

import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

// Default styles that can be overridden by your app
require("@solana/wallet-adapter-react-ui/styles.css");

const getCandyMachineId = () => {
  try {
    const candyMachineId = new anchor.web3.PublicKey(
      process.env.REACT_APP_CANDY_MACHINE_ID
    );

    return candyMachineId;
  } catch (e) {
    console.log("Failed to construct CandyMachineId", e);
    return undefined;
  }
};

const candyMachineId = getCandyMachineId();
const network = process.env.REACT_APP_SOLANA_NETWORK;
const rpcHost = process.env.REACT_APP_SOLANA_RPC_HOST;
const connection = new anchor.web3.Connection(
  rpcHost ? rpcHost : anchor.web3.clusterApiUrl("devnet")
);

const startDateSeed = parseInt(process.env.REACT_APP_CANDY_START_DATE, 10);
const txTimeoutInMilliseconds = 30000;

function App() {
  const endpoint = useMemo(() => clusterApiUrl(network), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Header />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <Landing
                    candyMachineId={candyMachineId}
                    connection={connection}
                    txTimeout={txTimeoutInMilliseconds}
                  />
                }
              ></Route>
              <Route path="/incubator" element={<Incubator />}></Route>
            </Routes>
          </BrowserRouter>
          <Footer />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
