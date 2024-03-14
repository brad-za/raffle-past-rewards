const { ethers, formatEther, formatUnits } = require("ethers");
const abi = require("./abi.json");
const erc20Abi = require("./ercAbi.json");

const GRAPHQL_ENDPOINT =
	"https://api.thegraph.com/subgraphs/name/top-comengineer/raffle/";

const polygonRpcUrl = "https://polygon-rpc.com";
const provider = new ethers.JsonRpcProvider(polygonRpcUrl);

async function fetchLastMintForEachRaffle() {
	const GRAPHQL_ENDPOINT =
		"https://api.thegraph.com/subgraphs/name/top-comengineer/raffle/";

	const query = `
    query MyQuery {
        raffles {
            mint(first: 1, orderBy: blockNumber, orderDirection: asc) {
                blockNumber
            }
            id
            address
        }
    }`;

	try {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
			}),
		});

		const { data } = await response.json();

		if (!data || !data.raffles) {
			console.error("No data received from the GraphQL endpoint.");
			return [];
		}

		// Transform the data into an array of objects each containing a raffle address and its last mint block number
		const formattedData = data.raffles.reduce((acc, raffle) => {
			if (raffle.mint.length > 0) {
				acc.push({
					raffleAddress: raffle.address,
					blockNumber: parseInt(raffle.mint[0].blockNumber, 10),
				});
			}
			return acc;
		}, []);

		return formattedData;
	} catch (error) {
		console.error("Error fetching data:", error);
		return []; // Return an empty array in case of error
	}
}

async function getWinnerChosenEvents(blockNumber, raffleId) {
	const fromBlock = blockNumber;
	const toBlock = blockNumber + 100000;
	const contractAddress = raffleId;
	const contract = new ethers.Contract(contractAddress, abi, provider);

	const winnerChosenEvents = await contract.queryFilter(
		"WinnerChosen",
		fromBlock,
		toBlock,
	);
	return winnerChosenEvents;
}

async function getTokenDetails(tokenAddress) {
	const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);

	try {
		const [decimals, symbol, name] = await Promise.all([
			tokenContract.decimals(),
			tokenContract.symbol(),
			tokenContract.name(),
		]);

		return { decimals, symbol, name };
	} catch (error) {
		// console.error(
		// 	`Failed to fetch token details for address: ${tokenAddress}`,
		// 	error,
		// );
		throw error; // Rethrow the error for further handling
	}
}

// fetchLastMintForEachRaffle().then(data => console.log("Formatted Data:", data));

const parseEvents = async (events, raffleID) => {
	for (let event of events) {
		const txHash = event.transactionHash;
		console.log(`Transaction Hash: ${txHash}`);

		const receipt = await provider.getTransactionReceipt(txHash);

		if (receipt.logs.length) {
			console.log(`Number of logs: ${receipt.logs.length} \n`);
			for (let log of receipt.logs) {
				// Process all logs
				try {
					const details = await getTokenDetails(log.address);
					const tokenAmount = BigInt(log.data); // Convert log data to BigInt

					if (tokenAmount === BigInt(0)) {
						continue; // Skip logs with zero amount
					}

					const formattedAmount = formatUnits(
						tokenAmount,
						details.decimals,
					);

					console.log(
						`${details.name} (${details.symbol}): ${formattedAmount}`,
					);
				} catch (error) {
					// Handle or log the error
				}
			}
		} else {
			console.log("No logs in this transaction.");
		}
	}
	console.log("\n \n");
};

async function main() {
	const raffles = await fetchLastMintForEachRaffle();
	// console.log(raffles);

	for (const raffle of raffles) {
		console.log(
			`\nFetching events for: ${raffle.raffleAddress}, Block: ${raffle.blockNumber}`,
		);
		const events = await getWinnerChosenEvents(
			raffle.blockNumber,
			raffle.raffleAddress,
		);
		console.log(`Events fetched: ${events.length}`);
		// Temporarily bypass parseEvents to isolate issues.
		await parseEvents(events, raffle.raffleAddress);
	}

	// console.log(
	// 	`\nFetching events for: ${"0x1966D8468362157D0BD5E0D81Fd6C9E9BC282b36"}, Block: ${53272224}`,
	// );

	// const events = await getWinnerChosenEvents(
	// 	53272224,
	// 	"0x1966D8468362157D0BD5E0D81Fd6C9E9BC282b36",
	// );

	// await parseEvents(events, "0x9035a4fbccc3a7253a551df7f8518a30ac029cc7");
}

main();
