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
