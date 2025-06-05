const { override, addWebpackAlias } = require('customize-cra');
const path = require('path');
const webpack = require('webpack');

module.exports = override(
  addWebpackAlias({
    '@': path.resolve(__dirname, 'src'),
  }),
  (config) => {
    // Add fallbacks for node core modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert/'),
      util: require.resolve('util/'),
      process: require.resolve('process/browser.js'),
      path: require.resolve('path-browserify'),
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
    };

    // Add plugins
    config.plugins = [
      ...(config.plugins || []),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: ['process/browser.js'],
      }),
      // Define process.env
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env),
      }),
    ];

    // Ignore warnings about the process module
    config.ignoreWarnings = [
      {
        module: /node_modules\/axios/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  }
);