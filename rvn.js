"use strict";

const fs = require("fs");
const cluster = require("cluster");
const numCPUs = 8;
const send = require("./message");
const axios = require("axios");
const blessed = require("blessed");
const { Mnemonic } = require("@ravenite/ravencoin-mnemonic");

let counts = 0;
let found = 0;
let errors = 0;
let recentKeys = []; // Array to store the 10 most recently generated keys
let lastRecentKeysUpdate = Date.now(); // Store the time when recentKeys were last updated

function generateWallet() {
  const code = new Mnemonic({ network: "mainnet" });
  const addresses = code.generateAddresses();
  const seed = code.toString();
  const address = addresses.recieveAddress.address;
  const privateKey = addresses.recieveAddress.privateKey;

  return { address, privateKey, seed };
}

async function CheckBalanceDogecoin(address) {
  try {
    const response = await axios.get(`https://ravencoin.atomicwallet.io/api/v2/address/${address}`);
    // const response = await axios.get(
    //   `https://rvn.cryptoscope.io/api/getbalance/?address=${address}`,
    // );

    if (response.status === 200) {
      return Number(response?.data?.balance) || 0;
    } else {
      return 0;
    }
  } catch (er) {
    return -1;
  }
}

async function generate() {
  const wallet = generateWallet();

  recentKeys.push({
    address: wallet.address,
    privateKey: wallet.privateKey,
    seed: wallet.seed,
  }); // Add the generated public address and private key in WIF format to recentKeys array

  if (recentKeys.length > 50) {
    recentKeys.shift(); // If recentKeys array has more than 10 elements, remove the first element
  }

  const balance = await CheckBalanceDogecoin(wallet.address);

  process.send({
    address: wallet.address,
    seed: wallet.seed,
    balance: balance,
    error: balance == -1
  });

  if (balance > 0) {
    console.log("");
    process.stdout.write("\x07");
    console.log("\x1b[32m%s\x1b[0m", ">> Success: " + wallet.address);

    var successString =
      "Wallet: [" +
      wallet.address +
      "] - Private: [" +
      wallet.privateKey +
      "] - Seed: [" +
      wallet.seed +
      "] - Balance: " +
      balance +
      " RVN";

    // save the wallet and its private key (seed) to a Success.txt file in the same folder
    fs.writeFileSync("./match-rvn.txt", successString, (err) => {
      if (err) throw err;
    });

    send(successString, "A Wallet Found Success!!!");
  }
}

if (cluster.isMaster) {
  let screen = blessed.screen({
    smartCSR: true,
  });

  var box = blessed.box({
    top: 2,
    left: 0,
    width: "100%",
    height: "shrink",
    content: "",
    alwaysScroll: true,
    scrollable: true,
    border: {
      type: "line",
    },
    style: {
      fg: "green",
      border: {
        fg: "green",
      },
    },
  });

  let title = blessed.text({
    top: 1,
    left: 0,
    width: "100%",
    height: "shrink",
    content: `[RVN][${numCPUs} Workers]: Generated: 0 - Found: 0 - Errors: 0`,
    style: {
      fg: "green",
      // bg: 'white',
    },
  });

  screen.append(title);
  screen.append(box);
  screen.render();

  cluster.on("message", (worker, message) => {
    counts++;

    if (message.balance > 0) {
      found++;
    }

    if (message.error) {
      errors++;
    }

    if (message.address) {
      const lines = box.getLines();
      if (lines.length >= 100) {
        box.deleteBottom();
      }
      title.setContent(
        `[RVN][${numCPUs} Workers]: Generated: ${counts} - Found: ${found} - Errors: ${errors}`,
      );
      box.insertLine(
        0,
        `Wallet Check: ${message.address} (${message.balance} RVN)`,
      );
      screen.render();
    }
  });

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork(); // Create a new worker process
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`); // Log when a worker process exits
  });
} else {
  setInterval(generate, 50); // Call the generate function repeatedly with no delay
}
