# Static server

A minimal HTTP server for static files.

Really, really minimal. In fact there are only two dependencies, [chalk](https://www.npmjs.com/package/chalk) and [mime-types](https://www.npmjs.com/package/mime-types), the rest is handled by a custom file system handler for Node [http](https://nodejs.org/api/http.html).

The server can be used via the CLI or imported as a module.

## Install

```
npm install @liamnewmarch/static-server
```

## CLI usage

```
Usage: static-server [options]

A minimal HTTP server for static files

Options:
  -V, --version           output the version number
  -h, --help              display help for command
  -6, --ipv6              force use of IPv6  (default: false)
  -d, --directory <path>  directory to serve (default: ".")
  -H, --host <name>       host name to use   (default: use OS default)
  -p, --port <port>       port number to use (default: use OS default)
```

## Module

Simple version, serves the current directory (not recommended) on a random port

```js
import { staticServer } from '@liamnewmarch/static-server';

staticServer();
```

More complex version, serves a `static` folder at http://localhost:3000 with a custom handler for http://localhost:3000/hello-world.

```js
import { staticServer } from '@liamnewmarch/static-server';

// All options are optional
const options = {
  directory: 'static',
  host: '127.0.0.1',
  port: 3000,
  ipv6: false,
  handlers: [
    myCustomHandler,
  ],
};

function myCustomHandler(request, response, next) {
  // Custom handlers use request and response from the Node http API
  if (request.url === '/hello-world') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('Hello, world!', 'utf-8');
  }
  // The next() callback tells the request listener to use the next handler
  next();
}

staticServer(options);
```
