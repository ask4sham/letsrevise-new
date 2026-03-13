/**
 * GCSE Video Generator — isolated scaffold for future pipeline.
 * No integration yet. No routes. No frontend.
 */

const buildScript = require("./buildScript");
const buildStoryboard = require("./buildStoryboard");
const renderManim = require("./renderManim");
const mapMicroscopyMagnificationStoryboard = require("./templates/microscopyMagnification");
const saveRenderPackage = require("./saveRenderPackage");
const generateManimScene = require("./generateManimScene");
const generateAssetPrompts = require("./generateAssetPrompts");
const saveAssetPrompts = require("./saveAssetPrompts");
const buildAssetManifest = require("./buildAssetManifest");
const saveAssetManifest = require("./saveAssetManifest");

module.exports = {
  buildScript,
  buildStoryboard,
  renderManim,
  mapMicroscopyMagnificationStoryboard,
  saveRenderPackage,
  generateManimScene,
  generateAssetPrompts,
  saveAssetPrompts,
  buildAssetManifest,
  saveAssetManifest,
};
