const contractPoint = require('@galtproject/utils').contractPoint;

/**
 *
 * @param {string} geohash
 * @param {number} height
 * @returns {number}
 */
function cPoint(geohash, height = 0) {
  if (height) {
    return addHeightToCPoint(contractPoint.encodeFromGeohash(geohash), height);
  }
  return contractPoint.encodeFromGeohash(geohash);
}

/**
 *
 * @param {number[]} contour
 * @param {number} height
 * @returns {number[]}
 */
function addHeightToContour(contour, height) {
  const resultingContour = [];
  for (let i = 0; i < contour.length; i++) {
    resultingContour[i] = addHeightToCPoint(contour[i], height);
  }
  return resultingContour;
}

/**
 *
 * @param {number} _cPoint
 * @param {number} height
 */
function addHeightToCPoint(_cPoint, height) {
  const parsed = contractPoint.decodeToLatLon(_cPoint);
  return contractPoint.encodeFromLatLngHeight(parsed.lat, parsed.lon, height);
}

module.exports = {
  cPoint,
  addHeightToContour,
  addHeightToCPoint
};
