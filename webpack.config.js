const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const os = require('os');

// Get the number of CPU cores for thread-loader
const threadLoader = {
    loader: 'thread-loader',
    options: {
        // there should be 1 cpu for the fork-ts-checker-webpack-plugin
        workers: Math.max(1, os.cpus().length - 1),
    },
};

// Common configuration for all targets
const commonConfig = {
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    threadLoader,
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true, // Skip type checking
                            configFile: 'tsconfig.prod.json', // Use our production tsconfig
                            happyPackMode: true, // Required for thread-loader
                        }
                    }
                ],
                exclude: [
                    /node_modules/,
                    /__tests__/,
                    /\.test\.(ts|tsx)$/,
                    /\.spec\.(ts|tsx)$/
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            // Provide polyfills for Node.js core modules
            "crypto": false,
            "fs": false,
            "path": false,
            "os": false,
            "readline": false,
            "stream": false,
            "buffer": false,
            "util": false,
            "assert": false,
            "http": false,
            "https": false,
            "url": false,
            "zlib": false,
        },
    },
};

// Main process configuration
const mainConfig = {
    ...commonConfig,
    target: 'electron-main',
    entry: './src/main/index.ts',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist/main'),
    },
};

// Preload script configuration
const preloadConfig = {
    ...commonConfig,
    target: 'electron-preload',
    entry: './src/main/preload.ts',
    output: {
        filename: 'preload.js',
        path: path.resolve(__dirname, 'dist/main'),
    },
};

// Renderer process configuration
const rendererConfig = {
    ...commonConfig,
    target: 'web',
    entry: './src/renderer/index.tsx',
    output: {
        filename: 'renderer.[contenthash].js',
        path: path.resolve(__dirname, 'dist/renderer'),
        // Set public path for dynamic imports
        publicPath: './',
        // Add chunking configuration
        chunkFilename: '[name].[contenthash].chunk.js',
    },
    optimization: {
        // Enable code splitting
        splitChunks: {
            chunks: 'all',
            maxInitialRequests: Infinity,
            minSize: 20000,
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name(module) {
                        // Get the package name
                        const packageName = module.context.match(
                            /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                        )[1];
                        // Return a chunk name based on the package name
                        return `vendor.${packageName.replace('@', '')}`;
                    },
                },
                // Group React and related packages together
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                    name: 'vendor.react',
                    priority: 10, // Higher priority than vendor
                },
                // Group UI components together
                uiComponents: {
                    test: /[\\/]node_modules[\\/](react-icons|react-markdown|react-syntax-highlighter)[\\/]/,
                    name: 'vendor.ui-components',
                    priority: 9,
                },
            },
        },
        // Prevent duplicate code
        runtimeChunk: 'single',
    },
    module: {
        rules: [
            ...commonConfig.module.rules,
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            // Handle node: protocol
            {
                test: /node:.*$/,
                loader: 'null-loader',
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'public/index.html'),
            // Add hash to HTML file for cache busting
            hash: true,
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
            'process.type': JSON.stringify('renderer'),
        }),
        // Provide empty objects for Node.js modules
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        // Ignore all Node.js dependencies in the renderer
        new webpack.IgnorePlugin({
            resourceRegExp: /^(fs|path|os|crypto|readline|stream|buffer|util|assert|http|https|url|zlib)$/,
        }),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            fs: false,
            path: false,
            os: false,
            crypto: false,
            readline: false,
            stream: false,
            buffer: false,
            util: false,
            assert: false,
            http: false,
            https: false,
            url: false,
            zlib: false,
            process: 'process/browser',
        },
        alias: {
            process: 'process/browser',
        },
    },
};

module.exports = [mainConfig, preloadConfig, rendererConfig]; 