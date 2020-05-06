import chalk from 'chalk';
import { createServer, STATUS_CODES as statusCodes } from 'http';
import { promises as fs } from 'fs';
import mimeTypes from 'mime-types';
import { exit } from 'process';
import { parse, resolve } from 'path';

// Utility to color a HTTP status code for logging
const color = code => (
  // 1xx INFO blue
  code < 200 ? chalk.blue(code) :
  // 2xx SUCCESS
  code < 300 ? chalk.green(code) :
  // 3xx: REDIRECT
  code < 400 ? chalk.yellow(code) :
  // 4xx-5xx: ERROR
  chalk.red(code)
);

// Returns a best-guess file path based on a root-relative URL
const urlToPath = (directory = '.', url) => (
  resolve(directory + (url.endsWith('/') ? url + '/index.html' : url))
);

export class HttpError extends Error {
  constructor(code = 400, ...args) {
    const message = statusCodes[code];
    // Allow only status codes that signify an error, i.e. in the range 400-599
    if (code < 400 || code > 599) {
      throw new Error(`HTTP status code ${code}: ${message} is not an error`);
    }
    super(...args);
    this.statusCode = code;
    this.statusMessage = message;
  }
}

export async function getStaticFile(request, directory) {
  try {
    // Attempt to get a file path from the provided URL
    const filePath = urlToPath(directory, request.url);
    const { ext, name } = parse(filePath);
    // If the file begins with a dot, deny access
    if (name.startsWith('.')) throw new HttpError(403);
    // Otherwise, return the body and Content-Type headers
    return {
      body: await fs.readFile(filePath),
      headers: { 'Content-Type': mimeTypes.contentType(ext) },
      statusCode: 200,
    };
  } catch (error) {
    // Re-throw any HTTP errors so they can be caught later
    if (error instanceof HttpError) throw error;
    switch (error.code) {
      case 'EACCES':
        // File not accessible
        throw new HttpError(403);
      case 'EISDIR':
        // File is a directory, attempt to redirect
        return {
          body: '',
          headers: { 'Location': request.url + '/' },
          statusCode: 302,
        };
      case 'ENOENT':
        throw new HttpError(404);
      default:
        // Some other error occurred
        console.error(error);
        throw new HttpError(500);
    }
  }
}

export function createStaticHandler(directory) {
  return async (request, response, next) => {
    try {
      // Attempt to get the static file and write it
      const { body, headers, statusCode } = await getStaticFile(request, directory);
      response.writeHead(statusCode, { ...headers });
      response.end(body, 'utf-8');
    } catch (error) {
      // Defer to the next handler if we got a 404, otherwise re-throw
      if (error.statusCode === 404) return next();
      throw error;
    }
  };
}

function createRequestListener(handlers) {
  return async (request, response) => {
    try {
      for (const handler of handlers) {
        // All handlers match. next() must be called to defer to the next handler
        let next = false;
        await handler(request, response, () => next = true);
        // Break if next wasn’t called, or if the response was closed
        if (!next || response.writableEnded) break;
      }
      if (response.writableEnded) {
        // Wrote without error, assume success
        console.log(color(response.statusCode), request.url);
      } else {
        // No handler responded, return a 404 (a 501 could work here too)
        throw new HttpError(404);
      }
    } catch (error) {
      try {
        if (error instanceof HttpError) {
          // Expected error, re-throw
          console.log(color(error.statusCode), request.url);
          throw error;
        } else {
          // Unexpected error, log to stderr and return a 500
          console.error(error);
          throw new HttpError(500);
        }
      } catch (error) {
        // Catch all to make sure errors are handled
        response.writeHead(error.statusCode, { 'Content-Type': 'text/plain' });
        response.end(error.statusMessage, 'utf-8');
      }
    }
  };
}

export async function staticServer({ directory = '.', handlers = [], ...options } = {}) {
  try {
    if (directory) {
      // Try to access the directory so we can catch errors in advance
      try {
        const stat = await fs.stat(resolve(directory));
        if (!stat.isDirectory()) throw new Error('not a directory');
      } catch (error) {
        switch (error.code) {
          case 'ENOENT':
            throw new Error(`directory not found ${directory}`);
          case 'EACCES':
            throw new Error(`permission denied ${directory}`);
          default:
            throw error;
        }
      }

      // Create a static handler and add it to the array of handlers
      handlers = [...handlers, createStaticHandler(directory)];
    }

    // Create our server
    const server = createServer(createRequestListener(handlers));

    // Start listening
    server.listen(options, () => {
      // Get actual values
      const { address, family, port } = server.address();
      // Attempt to create a URL from what we know
      const url = 'http://' + (family === 'IPv6' ? `[${address}]` : address) + (port === 80 ? '' : `:${port}`);
      console.log('Serving HTTP on', chalk.white(url), '...');
      console.log('Press ctrl-c to quit');
    });
  } catch ({ message }) {
    console.log(chalk.red('Server error'), message);
    exit(1);
  }
}
