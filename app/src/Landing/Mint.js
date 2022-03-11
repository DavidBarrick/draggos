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
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone"; // dependent on utc plugin

dayjs.extend(utc);
dayjs.extend(timezone);

const Mint = ({ onMint, isUserMinting, candyMachine, wallet }) => {
  const renderMint = () => {
    const { state = {} } = candyMachine;
    const { goLiveDate, isActive } = state;
    if (isActive) {
      return (
        <VStack justifyContent={"center"} p={10}>
          <Text>
            {candyMachine.state.itemsRemaining}/
            {candyMachine.state.itemsAvailable} remaining
          </Text>
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
      );
    } else {
      const date = dayjs(goLiveDate).tz("America/New_York").format("MMMM M");
      const time = dayjs(goLiveDate).tz("America/New_York").format("h:mm A");

      const year = goLiveDate.getFullYear();
      const month = (goLiveDate.getMonth() + 1).toString().padStart(2, "0");
      const day = goLiveDate.getDate();
      const hourStart = goLiveDate.getHours().toString().padStart(2, "0");
      const hourEnd = (goLiveDate.getHours() + 1).toString().padStart(2, "0");

      const link = `https://www.google.com/calendar/render?action=TEMPLATE&text=Draggos+Mint&details=https%3A%2F%2Fdraggos.xyz&dates=${year}${month}${day}T${hourStart}0000Z%2F${year}${month}${day}T${hourEnd}0000Z`;
      return (
        <VStack justifyContent={"center"} p={10}>
          <Text>
            Launching {date} at {time} Eastern
          </Text>
          <Button onClick={() => window.open(link)}>Add To Calendar</Button>
        </VStack>
      );
    }
  };
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
        {candyMachine && renderMint()}
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
