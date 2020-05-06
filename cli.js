#!/usr/bin/env node

import { argv, env, exit } from 'process';
import { staticServer } from './index.js';

const [,, ...args] = argv;

// TODO read from package.json
const bin = 'static-server';
const version = '0.1.0';

const usage = `
Usage: ${bin} [options]

A minimal HTTP server for static files

Options:
  -V, --version           output the version number
  -h, --help              display help for command
  -6, --ipv6              force use of IPv6  (default: false)
  -d, --directory <path>  directory to serve (default: ".")
  -H, --host <name>       host name to use   (default: use OS default)
  -p, --port <port>       port number to use (default: use OS default)
`;

// Get any initial options from env
const options = {
  directory: env.STATIC_DIR,
  host: env.STATIC_HOST,
  port: env.STATIC_PORT || env.PORT,
};

// Override any argument options
try {
  while (args.length) {
    const flag = args.shift();
    switch (flag) {
      // Version
      case '-V':
      case '--version':
        console.log(version);
        exit(0);
        break; // for eslint
      // Help
      case '-h':
      case '--help':
        console.log(usage);
        exit(0);
        break; // for eslint
      // Force IPv6
      case '-6':
      case '--ipv6':
        options.ipv6Only = true;
        break;
      // Directory
      case '-d':
      case '--directory':
        options.directory = args.shift();
        break;
      // Host
      case '-H':
      case '--host':
        options.host = args.shift();
        break;
      // Port
      case '-p':
      case '--port':
        options.port = args.shift();
        break;
      default:
        throw new Error(`Unknown argument ${flag}`);
    }
  }
} catch (error) {
  console.log(error);
  exit(1);
}

staticServer(options);
