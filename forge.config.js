const path = require('path');
const { MakerDeb } = require('@electron-forge/maker-deb');
const { MakerRpm } = require('@electron-forge/maker-rpm');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');

module.exports = {
  packagerConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({ platforms: ['darwin'] }),
    new MakerDeb({}),
    new MakerRpm({})
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: path.join(__dirname, 'webpack.main.config.js'),
        renderer: {
          config: path.join(__dirname, 'webpack.renderer.config.js'),
          entryPoints: [
            {
              html: path.join(__dirname, 'src/index.html'),
              js: path.join(__dirname, 'src/renderer.ts'),
              name: 'main_window',
              preload: {
                js: path.join(__dirname, 'src/preload.ts')
              }
            }
          ]
        }
      }
    }
  ]
};
