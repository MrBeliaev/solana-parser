/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    // `rpc-websockets` (a transitive dependency of `@solana/web3.js`, itself pulled in by
    // `@coral-xyz/anchor`) bundles its own nested `uuid@14`, which ships ESM-only and can't be
    // `require()`-d under Jest's CJS runtime (plain Node 22's `require(esm)` support handles this
    // fine outside Jest). Force every `require('uuid')` — including the one inside
    // `rpc-websockets` — to resolve to the hoisted, CJS-compatible `uuid@11` instead.
    '^uuid$': '<rootDir>/node_modules/uuid',
    '^@app/common$': '<rootDir>/libs/common/src',
    '^@app/common/(.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/solana-parsers$': '<rootDir>/libs/solana-parsers/src',
    '^@app/solana-parsers/(.*)$': '<rootDir>/libs/solana-parsers/src/$1',
    '^@app/clickhouse-client$': '<rootDir>/libs/clickhouse-client/src',
    '^@app/clickhouse-client/(.*)$': '<rootDir>/libs/clickhouse-client/src/$1',
    '^@app/kafka-client$': '<rootDir>/libs/kafka-client/src',
    '^@app/kafka-client/(.*)$': '<rootDir>/libs/kafka-client/src/$1',
  },
  passWithNoTests: true,
  collectCoverageFrom: ['apps/**/*.(t|j)s', 'libs/**/*.(t|j)s'],
};
