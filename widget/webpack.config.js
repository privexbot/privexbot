const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
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
  },
  optimization: {
    minimize: true,
  },
};
