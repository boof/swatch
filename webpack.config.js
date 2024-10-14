// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const isProduction = process.env.NODE_ENV == 'production';

const stylesHandler = 'style-loader';

const config = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'index.html',
        }),

        // Add your plugins here
        // Learn more about plugins from https://webpack.js.org/configuration/plugins/
    ],
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [stylesHandler, 'css-loader'],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },

            // Add your rules for custom modules here
            // Learn more about loaders from https://webpack.js.org/loaders/
        ],
    },
};

module.exports = () => {
  if (isProduction) {
      config.mode = 'production';
      config.devtool = 'nosources-source-map';
      config.plugins.push(new WorkboxWebpackPlugin.GenerateSW());
      config.plugins.push(new CopyPlugin({
        patterns: [
          { from: 'img', to: 'img' },
          { from: 'css', to: 'css' },
          // { from: 'js/vendor', to: 'js/vendor' },
          { from: 'icon.svg', to: 'icon.svg' },
          // { from: 'favicon.ico', to: 'favicon.ico' },
          { from: 'robots.txt', to: 'robots.txt' },
          // { from: 'icon.png', to: 'icon.png' },
          { from: '404.html', to: '404.html' },
          { from: 'site.webmanifest', to: 'site.webmanifest' },
        ]
      }));
  } else {
      config.mode = 'development';
      config.devtool = 'inline-source-map';
      // config.devServer = {
      //   liveReload: true,
      //   hot: true,
      //   open: true,
      //   static: ['./'],
      // }
  }
  return config;
};
