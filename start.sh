#!/bin/bash

# install pm2
if which pm2 >/dev/null; then
    echo "pm2 is installed"
else
    npm i -g pm2
fi

# Loop to start 4 processes
for i in $(seq 1 4); do
    # Generate a random name with "backup" prefix and iteration index
    random_name="scan_process_${i}"
    pm2 start app.js --name "$random_name"
done