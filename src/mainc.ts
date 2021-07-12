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
    number,
    parse,
    parser,
    shortFlag,
    string,
    variableList,
} from "@eeue56/baner";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function isAsyncFunction(func: any): boolean {
    return Object.getPrototypeOf(func).constructor === AsyncFunction;
}

type OutputFormat = "console" | "json";

async function runFunction(
    outputFormat: OutputFormat,
    timesToRun: number,
    func: Function
): Promise<number> {
    const isAsync = isAsyncFunction(func);

    if (outputFormat === "console") {
        console.log(`Running ${func.name}`);
    }

    // warm up the cache
    for (var i = 0; i < 3; i++) {
        if (isAsync) {
            await func();
        } else {
            func();
        }
    }

    const latencies = [ ];

    for (var i = 0; i < timesToRun; i++) {
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

        const latency = (endTime[0] * 1000000000 + endTime[1]) / 1000000;
        latencies.push(latency);
    }
    const sum = latencies.reduce((prev, current) => prev + current);

    return sum;
}

export async function runner(): Promise<any> {
    const cliParser = parser([
        longFlag("function", "Run a specific function", variableList(string())),
        longFlag("file", "Run a specific file", variableList(string())),
        shortFlag("n", "Number of times to run each benchmark", number()),
        longFlag("json", "Output results as json", empty()),
        longFlag("compare", "Run comparisons", empty()),
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

    const timesToRun =
        program.flags.n.arguments.kind === "ok"
            ? (program.flags.n.arguments.value as number)
            : 3;

    const outputFormat: OutputFormat = program.flags.json.isPresent
        ? "json"
        : "console";

    const runCompares = program.flags.compare.isPresent;

    if (runCompares && outputFormat === "json") {
        console.log("Json format for compares not supported!");
        process.exit();
    }

    if (outputFormat === "console") {
        console.log("Looking for tsconfig...");
    }
    const strConfig = (await fsPromises.readFile("./tsconfig.json")).toString();
    const config = JSON5.parse(strConfig);
    if (outputFormat === "console") {
        console.log(`Looking for benchmarks in ${config.include}...`);
    }

    const files = fileNamesToRun
        ? fileNamesToRun
        : await glob(config.include, { absolute: true });

    let totalBenchmarks = 0;

    const results = await Promise.all(
        files.map(async (fileName) => {
            return new Promise<{
                fileName: string;
                fileScores: Record<string, number>;
            } | null>(async (resolve, reject) => {
                fileName =
                    program.flags.file.arguments.kind === "ok"
                        ? path.join(process.cwd(), fileName)
                        : fileName;
                const splitName = fileName.split(".");

                if (!splitName[0].endsWith("bench")) {
                    return resolve(null);
                }

                if (outputFormat === "console") {
                    console.log(`Found ${fileName}`);
                }

                const imported = await import(fileName);

                if (runCompares) {
                    for (const functionName of Object.keys(imported)) {
                        if (!functionName.startsWith("compare")) continue;
                        if (
                            functionNamesToRun &&
                            functionNamesToRun.indexOf(functionName) === -1
                        )
                            continue;

                        const compareFunc = imported[functionName];

                        const innerFunctions = compareFunc();
                        const sums: Record<string, number> = {};

                        for (const innerFunction of innerFunctions) {
                            const sum = await runFunction(
                                outputFormat,
                                timesToRun,
                                innerFunction
                            );
                            sums[innerFunction.name] = sum;
                            totalBenchmarks += 1;
                        }

                        if (outputFormat === "console") {
                            const namesSortedBySum = Object.entries(sums)
                                .sort(([ _a, a ], [ _b, b ]) => a - b)
                                .map(([ name, runtime ]): [string, number] => {
                                    return [ name, runtime / timesToRun ];
                                });

                            const baseSpeed: number = namesSortedBySum[0][1];

                            console.table(
                                namesSortedBySum.map(([ name, runtime ]) => {
                                    return {
                                        name,
                                        runtime,
                                        timesSlower: runtime / baseSpeed,
                                    };
                                })
                            );
                        }
                    }

                    return resolve(null);
                } else {
                    const fileScores: Record<string, number> = {};

                    for (const functionName of Object.keys(imported)) {
                        if (!functionName.startsWith("bench")) continue;
                        if (
                            functionNamesToRun &&
                            functionNamesToRun.indexOf(functionName) === -1
                        )
                            continue;

                        const func = imported[functionName];

                        totalBenchmarks += 1;

                        const sum = await runFunction(
                            outputFormat,
                            timesToRun,
                            func
                        );

                        if (outputFormat === "console") {
                            console.log(
                                `Took ${sum / timesToRun}ms on average`
                            );
                        }

                        fileScores[functionName] = sum / timesToRun;
                    }

                    return resolve({
                        fileName,
                        fileScores,
                    });
                }
            });
        })
    );

    if (outputFormat === "console") {
        console.log(`Ran ${totalBenchmarks} benchmarks.`);
    } else {
        const filteredResults = results.filter((res) => res !== null);
        console.log(JSON.stringify(filteredResults, null, 4));
    }
}

if (require.main === module) {
    runner();
}
