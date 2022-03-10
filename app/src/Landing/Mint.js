import {
  Box,
  HStack,
  Button,
  Text,
  VStack,
  Image,
  SimpleGrid,
  Spinner,
} from "@chakra-ui/react";
import draggosGif from "./9CgA.gif";
import logo from "../dl_logo.svg";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const Mint = ({ onMint, isUserMinting, candyMachine, wallet }) => {
  return (
    <Box h="90vh" w="100%" bg="red.400" p={5}>
      <SimpleGrid minChildWidth="300px" spacing="0px" justify="space-between">
        <VStack p={10}>
          <Image src={logo} />
          <Image
            border="4px"
            rounded={"lg"}
            src={"https://staging.draggos.xyz/assets/preview.gif"}
          />
        </VStack>
        {candyMachine && (
          <VStack justifyContent={"center"} p={10}>
            <Text>
              {candyMachine.state.itemsRemaining}/
              {candyMachine.state.itemsAvailable} remaining
            </Text>
            {console.log(candyMachine.state.price.toString())}
            <Text>
              Price:{" "}
              {(
                candyMachine.state.price.toNumber() / LAMPORTS_PER_SOL
              ).toString()}
              SOL
            </Text>
            {wallet && (
              <Button
                w="75%"
                h="50px"
                isDisabled={candyMachine.state.isSoldOut}
                isLoading={isUserMinting}
                onClick={onMint}
              >
                {candyMachine.state.isSoldOut ? "Sold Out!" : "Mint"}
              </Button>
            )}
          </VStack>
        )}
        {!candyMachine && (
          <VStack justifyContent={"center"} p={10}>
            <Spinner />
          </VStack>
        )}
      </SimpleGrid>
    </Box>
  );
};

export default Mint;
