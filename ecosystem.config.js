module.exports = {
    apps : [
      // {
      //   name: 'node-scan', // application name 
      //   script: 'app.js', // script path to pm2 start
      //   instances: 10, // number process of application
      //   autorestart: true, //auto restart if app crashes
      //   watch: false,
      //   max_memory_restart: '4G', // restart if it exceeds the amount of memory specified
      // },
      {
        name: 'rvn-scan', // application name 
        script: 'rvn.js', // script path to pm2 start
        instances: 20, // number process of application
        autorestart: true, //auto restart if app crashes
        watch: false,
        max_memory_restart: '4G', // restart if it exceeds the amount of memory specified
      }
    ],
  };
  