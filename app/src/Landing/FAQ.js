import { Box, SimpleGrid, Text, Stack, VStack } from "@chakra-ui/react";

const FAQ_ITEMS = [
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
  {
    title: "Will there be a DAO?",
    answer:
      "Sure will! We'll be launching the DAO at the end of Q2 '22 in time for our next charity vote",
  },
];
const FAQ = () => {
  return (
    <Box h="100vh" w="100%" bg="purple.400" p={5}>
      <Text textAlign={"center"}>FAQ</Text>

      <SimpleGrid mt={5} spacing="50px" minChildWidth={"400px"}>
        {FAQ_ITEMS.map((i) => (
          <VStack w="100%">
            <Stack
              maxW="400px"
              bg="purple.200"
              border="1px"
              rounded={"lg"}
              p={5}
            >
              <Text fontWeight={"bold"}>{i.title}</Text>
              <Text>{i.answer}</Text>
            </Stack>
          </VStack>
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default FAQ;
