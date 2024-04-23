"use strict";

const fs = require('fs');
const cluster = require('cluster');
const numCPUs = 4;
const send = require('./message');
const axios = require('axios');
const { Mnemonic } = require('@ravenite/ravencoin-mnemonic');

let counts = 0;
let recentKeys = []; // Array to store the 10 most recently generated keys
let lastRecentKeysUpdate = Date.now(); // Store the time when recentKeys were last updated

function generateWallet() {
    const code = new Mnemonic({ network: 'mainnet' });
    const addresses = code.generateAddresses();
    const seed = code.toString();
    const address = addresses.recieveAddress.address;
    const privateKey = addresses.recieveAddress.privateKey;

    return { address, privateKey, seed }
}

async function CheckBalanceDogecoin(address) {
    try {
        const response = await axios.get(`https://ravencoin.atomicwallet.io/api/v2/address/${address}`);
        if (response.status === 200) {
            return response.data.balance;
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error:", error);
        return 0;
    }
}

async function generate() {
    const wallet = generateWallet();

    recentKeys.push({ address: wallet.address, privateKey: wallet.privateKey }); // Add the generated public address and private key in WIF format to recentKeys array
    
    if (recentKeys.length > 10) {
        recentKeys.shift(); // If recentKeys array has more than 10 elements, remove the first element
    }
    
    if (Date.now() - lastRecentKeysUpdate > 60000) {
        process.send({ recentKeys: recentKeys }); // If it has been more than a minute since recentKeys were last updated, send the updated recentKeys array to the master process
        lastRecentKeysUpdate = Date.now(); // Update lastRecentKeysUpdate time
    }

    const balance = await CheckBalanceDogecoin(wallet.address);

    process.send({ address: wallet.address, seed: wallet.seed, balance: `${balance} RVN`});

    if (balance > 0) {
        console.log("");
        process.stdout.write('\x07');
        console.log("\x1b[32m%s\x1b[0m", ">> Success: " + wallet.address);

        var successString = "Wallet: [" + wallet.address + "] - Private: [" + wallet.privateKey + "] - Seed: [" + wallet.seed + "] - Balance: " + balance + " RVN";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder 
        fs.writeFileSync('./match-rvn.txt', successString, (err) => {
            if (err) throw err;
        })

        send(successString, 'A Wallet Found Success!!!');
    }
}

if (cluster.isMaster) {
    cluster.on('message', (worker, message) => {
        counts++;
        if (message.address) {
            console.clear();
            console.log(`[${counts}] ${message.seed}`);
        }
    });

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork(); // Create a new worker process
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`); // Log when a worker process exits
    });
} else {
    setInterval(generate, 30); // Call the generate function repeatedly with no delay
}
