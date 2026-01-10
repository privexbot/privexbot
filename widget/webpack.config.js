const path = require('path');
const pkg = require('./package.json');

// Get version from package.json (e.g., "1.0.0")
const version = pkg.version;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'build'),
      // In production: widget.v1.0.0.js, in development: widget.js
      filename: isProduction ? `widget.v${version}.js` : 'widget.js',
      library: 'PrivexBotWidget',
      libraryTarget: 'umd',
      globalObject: 'this',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'build'),
        },
        {
          directory: __dirname,
          publicPath: '/',
        },
      ],
      compress: true,
      port: 9000,
      hot: true,
      open: '/test.html',
      // Allow connections from Docker network
      host: '0.0.0.0',
      allowedHosts: 'all',
    },
    optimization: {
      minimize: isProduction,
    },
  };
};
