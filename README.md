# mainc

A simple, small benchmarking library for Node

Looks in tsconfig.include for files ending with `bench`. Look in those files for functions starting with `bench`, and run them. Async functions are run with `await`. The return result is ignored.

Part of the [Hiraeth](https://github.com/eeue56/hiraeth) collection.

## Installation

Requires ts-node to be installed.

```
npm install --save-dev @eeue56/mainc
```

## Usage

Make sure your tsconfig has `include` set up correctly. Then you can run bach via `npx @eeue56/mainc` from the project root.

See [mainc_bench.ts](src/mainc_bench.ts) for example usage.

You can also specify specific files or functions to run via flags:

```
  --function [string...]:   Run a specific function
  --file [string...]:       Run a specific file
  -n number:                Number of times to run each benchmark
  --json :                  Output results as json
  --compare :               Run comparisons
  --fixed number :          Number of decimal places to go to. Defaults to 3
  -h, --help :              Displays help message

```

## Name

Mainc means "bench" in Welsh. You'd pronounce it as "main-cuh"
