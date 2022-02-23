import {
  Box,
  HStack,
  Button,
  Text,
  VStack,
  Image,
  SimpleGrid,
} from "@chakra-ui/react";
import draggosGif from "./9CgA.gif";
import logo from "../dl_logo.svg";

const Mint = ({ onMint, isUserMinting, candyMachine }) => {
  return (
    <Box h="90vh" w="100%" bg="red.400" p={5}>
      <SimpleGrid minChildWidth="300px" spacing="50px" justify="space-between">
        <VStack maxW="80%" p={10}>
          <Image src={logo} />
          <Image src={draggosGif} />
        </VStack>
        {candyMachine && (
          <VStack maxW="80%">
            <Text>
              {candyMachine.state.itemsRemaining}/
              {candyMachine.state.itemsAvailable} remaining
            </Text>
            <Button
              isDisabled={candyMachine.state.isSoldOut}
              isLoading={isUserMinting}
              onClick={onMint}
            >
              {candyMachine.state.isSoldOut ? "Sold Out!" : "Mint"}
            </Button>
          </VStack>
        )}
      </SimpleGrid>
    </Box>
  );
};

export default Mint;
