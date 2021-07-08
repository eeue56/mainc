#!/usr/bin/env ts-node
import * as path from "path";

import * as fs from "fs";
import { promises as fsPromises } from "fs";

import glob from "fast-glob";
import JSON5 from "json5";
import {
    bothFlag,
    empty,
    help,
    longFlag,
    parse,
    parser,
    string,
    variableList,
} from "@eeue56/baner";

async function getFiles(dir: string): Promise<string[]> {
    const dirents: fs.Dirent[] = await fsPromises.readdir(dir, {
        withFileTypes: true,
    });
    const files = await Promise.all(
        dirents.map(async (dirent: fs.Dirent) => {
            const res: string = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                return await getFiles(res);
            } else {
                return res;
            }
        })
    );
    return Array.prototype.concat(...files);
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function isAsyncFunction(func: any): boolean {
    return Object.getPrototypeOf(func).constructor === AsyncFunction;
}

export async function runner(): Promise<any> {
    const cliParser = parser([
        longFlag("function", "Run a specific function", variableList(string())),
        longFlag("file", "Run a specific file", variableList(string())),
        bothFlag("h", "help", "Displays help message", empty()),
    ]);

    const program = parse(cliParser, process.argv);

    if (program.flags["h/help"].isPresent) {
        console.log(help(cliParser));
        return;
    }

    const functionNamesToRun: string[] | null =
        program.flags.function.arguments.kind === "ok"
            ? (program.flags.function.arguments.value as string[])
            : null;

    const fileNamesToRun: string[] | null =
        program.flags.file.arguments.kind === "ok"
            ? (program.flags.file.arguments.value as string[])
            : null;

    console.log("Looking for tsconfig...");
    const strConfig = (await fsPromises.readFile("./tsconfig.json")).toString();
    const config = JSON5.parse(strConfig);
    console.log(`Looking for benchmarks in ${config.include}...`);

    const files = fileNamesToRun
        ? fileNamesToRun
        : await glob(config.include, { absolute: true });

    let totalBenchmarks = 0;

    await Promise.all(
        files.map(async (fileName) => {
            return new Promise(async (resolve, reject) => {
                fileName =
                    program.flags.file.arguments.kind === "ok"
                        ? path.join(process.cwd(), fileName)
                        : fileName;
                const splitName = fileName.split(".");

                if (!splitName[0].endsWith("bench")) {
                    return resolve(null);
                }

                console.log(`Found ${fileName}`);
                const imported = await import(fileName);
                for (const functionName of Object.keys(imported)) {
                    if (!functionName.startsWith("bench")) continue;
                    if (
                        functionNamesToRun &&
                        functionNamesToRun.indexOf(functionName) === -1
                    )
                        continue;

                    const func = imported[functionName];
                    const isAsync = isAsyncFunction(func);

                    totalBenchmarks += 1;
                    console.log(`Running ${functionName}`);

                    // warm up the cache
                    for (var i = 0; i < 3; i++) {
                        if (isAsync) {
                            await func();
                        } else {
                            func();
                        }
                    }

                    const latencies = [ ];

                    for (var i = 0; i < 3; i++) {
                        let startTime = null;
                        let endTime = null;
                        if (isAsync) {
                            startTime = process.hrtime();
                            await func();
                            endTime = process.hrtime(startTime);
                        } else {
                            startTime = process.hrtime();
                            func();
                            endTime = process.hrtime(startTime);
                        }

                        const latency =
                            (endTime[0] * 1000000000 + endTime[1]) / 1000000;

                        latencies.push(latency);
                    }

                    const sum = latencies.reduce(
                        (prev, current) => prev + current
                    );

                    console.log(`Took ${sum / 3}ms on average`);
                }

                resolve(null);
            });
        })
    );

    console.log(`Ran ${totalBenchmarks} benchmarks.`);
}

if (require.main === module) {
    runner();
}
