// Disable Workbox to avoid Chrome extension caching issues
// const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

module.exports = {
  webpack: {
    plugins: [
      // Disabled Workbox to avoid Chrome extension caching issues
      // new InjectManifest({
      //   swSrc: path.resolve(__dirname, 'src/sw.js'),
      //   swDest: 'sw.js',
      //   exclude: [/\.map$/, /manifest$/, /\.htaccess$/],
      //   maximumFileSizeToCacheInBytes: 0,
      // }),
    ],
    configure: (webpackConfig) => {
      // Ensure proper chunking for hash-based versioning
      webpackConfig.output.filename = 'static/js/[name].[contenthash:8].js';
      webpackConfig.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
      
      // CSS files with hash
      const miniCssExtractPlugin = webpackConfig.plugins.find(
        plugin => plugin.constructor.name === 'MiniCssExtractPlugin'
      );
      if (miniCssExtractPlugin) {
        miniCssExtractPlugin.options.filename = 'static/css/[name].[contenthash:8].css';
        miniCssExtractPlugin.options.chunkFilename = 'static/css/[name].[contenthash:8].chunk.css';
      }

      return webpackConfig;
    },
  },
};
