"use strict";

process.title = "Dogecoin Scan";

const CoinKey = require('coinkey');
const ci = require('coininfo');
const fs = require('fs');
const crypto = require('crypto');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const send = require('./message');

let addresses;
addresses = new Set(); // Set to store addresses from dogs.txt file

const data = fs.readFileSync('./wallet.txt');
// Splitting the data by new line and adding each address to the Set
data.toString().split("\n").forEach(address => {
    if (address.startsWith('D')) {
        addresses.add(address);
    } else {
        console.error('Error: Addresses are not in correct format. Dogecoin Addresses must start with D');
        process.exit(1);
    }
});
let counts = {}; // Object to store the count of keys generated by each worker process
let recentKeys = []; // Array to store the 10 most recently generated keys
let startTime = Date.now(); // Store the start time of the script
let lastRecentKeysUpdate = Date.now(); // Store the time when recentKeys were last updated

function generate() {
    counts[cluster.worker.id] = (counts[cluster.worker.id] || 0) + 1; // Increment the count of keys generated by this worker process
    process.send({ counts: counts }); // Send the updated counts object to the master process

    let privateKeyHex = crypto.randomBytes(32).toString('hex'); // Generate a random private key in hexadecimal format

    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions); // Create a new CoinKey object for Dogecoin using the generated private key

    ck.compressed = false; // Set false for uncompressed wallet addresses and true for compresed

    recentKeys.push({ address: ck.publicAddress, privateKey: ck.privateWif }); // Add the generated public address and private key in WIF format to recentKeys array
    if (recentKeys.length > 10) {
        recentKeys.shift(); // If recentKeys array has more than 10 elements, remove the first element
    }
    if (Date.now() - lastRecentKeysUpdate > 60000) {
        process.send({ recentKeys: recentKeys }); // If it has been more than a minute since recentKeys were last updated, send the updated recentKeys array to the master process
        lastRecentKeysUpdate = Date.now(); // Update lastRecentKeysUpdate time
    }

    if (addresses.has(ck.publicAddress)) {
        console.log("");
        process.stdout.write('\x07');
        console.log("\x1b[32m%s\x1b[0m", ">> Success: " + ck.publicAddress);

        var successString = "Wallet: " + ck.publicAddress + "\n\nSeed: " + ck.privateWif;

        // save the wallet and its private key (seed) to a Success.txt file in the same folder 
        fs.appendFile('./match.txt', successString + "\n", (err) => {
            if (err) throw err;
        })

        send(successString, 'A Wallet Found Success!!!');
    }
}

if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true
    });

    let box = blessed.text({
        top: `0`,
        left: 0,
        width: '100%',
        height: '20%',
        content: `[${numCPUs} Workers]: Keys generated: 0 Speed: 0 keys/min`,
        style: {
            fg: 'green'
        }
    });

    screen.append(box);
    screen.render();

    cluster.on('message', (worker, message) => {
        if (message.counts) {
            let counts = 0;
            let speed = 0;

            for (let workerId in message.counts) {
                let elapsedTimeInMinutes = (Date.now() - startTime) / 60000;
                let speedPerMinute = message.counts[workerId] / elapsedTimeInMinutes;
                counts += message.counts[workerId];
                speed += speedPerMinute;
            }

            box.setContent(`[${numCPUs} Workers]: Keys generated: ${counts} -- Speed: ${Math.round(speed)} keys/min`);

            screen.render();
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
    setInterval(generate, 0); // Call the generate function repeatedly with no delay
}
