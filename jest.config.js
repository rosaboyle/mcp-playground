module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*(?<!\.d)|(\\.|/)(test|spec))\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^react-markdown$': '<rootDir>/src/__tests__/mocks/react-markdown.js',
        '^remark-gfm$': '<rootDir>/src/__tests__/mocks/remark-gfm.js',
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(react-markdown|remark-gfm)/)',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/src/__tests__/setup.ts'
    ],
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/__tests__/**',
        '!src/**/index.{ts,tsx,js,jsx}',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        }
    },
    testTimeout: 30000
}; 