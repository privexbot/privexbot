const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'build'),
      // Always output widget.js for CDN deployment
      filename: 'widget.js',
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
