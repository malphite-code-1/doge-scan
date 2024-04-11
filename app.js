const { spawn } = require('child_process');
spawn('node', ['./index.js'], { stdio: 'inherit' });