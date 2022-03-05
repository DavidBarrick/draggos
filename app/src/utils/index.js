import {
  CANDY_MACHINE_PROGRAM,
  awaitTransactionSignatureConfirmation,
  getCandyMachineCreator,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candymachine";

import actions from "./actions";

const candymachine = {
  CANDY_MACHINE_PROGRAM,
  awaitTransactionSignatureConfirmation,
  getCandyMachineCreator,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
};

export { candymachine, actions };
