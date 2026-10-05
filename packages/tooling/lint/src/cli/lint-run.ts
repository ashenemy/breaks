import { main } from '../lib/lint-cli.js';

main(process.argv.slice(2), process.cwd()).then(
    (code) => {
        process.exitCode = code;
    },
    (error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 2;
    },
);
