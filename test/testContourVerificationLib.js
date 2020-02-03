const { contract } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPContourVerificationPublicLib = contract.fromArtifact('PPContourVerificationPublicLib');
const contractPoint = require('@galtproject/utils').contractPoint;

PPContourVerificationPublicLib.numberFormat = 'String';

const INCLUSION_TYPE = {
  A_INSIDE_B: 0,
  B_INSIDE_A: 1
};

describe('PPContourVerificationLib', () => {
  // Contour #1
  // 40.594870, -73.949618 dr5qvnpd300r
  // 40.594843, -73.949866 dr5qvnp655pq
  // 40.594791, -73.949857 dr5qvnp3g3w0
  // 40.594816, -73.949608 dr5qvnp9cnpt

  // Contour #2 (intersects 1)
  // 40.594844, -73.949631 dr5qvnpd0eqs
  // 40.594859, -73.949522 dr5qvnpd5npy
  // 40.594825, -73.949512 dr5qvnp9grz7
  // 40.594827, -73.949617 dr5qvnpd100z

  // Contour #3 (doesn't intersect 1)
  // 40.594803, -73.949607 dr5qvnp9c7b2
  // 40.594777, -73.949852 dr5qvnp3ewcv
  // 40.594727, -73.949838 dr5qvnp37vs4
  // 40.594754, -73.949594 dr5qvnp99ddh

  // Contour #4 (completely included by 1)
  // 40.594840, -73.949792 dr5qvnp6hfwt
  // 40.594838, -73.949829 dr5qvnp6h46c
  // 40.594797, -73.949845 dr5qvnp3gdwu
  // 40.594801, -73.949828 dr5qvnp3u57s

  // Contour #5 (intersects both 1 and 3)
  // 40.594806, -73.949748 dr5qvnp3vur6
  // 40.594813, -73.949713 dr5qvnp3yv97
  // 40.594784, -73.949705 dr5qvnp3ybpq
  // 40.594778, -73.949744 dr5qvnp3wp47

  // Contour #6 (collinear with 7, vertex not real)
  // dr5qvnpdb9g8
  // dr5qvnpdv9g8
  // dr5qvnpdt9g8
  // dr5qvnpd29g8

  // Contour #7 (collinear with 6, vertex not real)
  // dr5qvnpdu9g8
  // dr5qvnpdf9g8
  // dr5qvnpd39g8
  // dr5qvnpd59g8

  const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
  const contour1 = rawContour1.map(contractPoint.encodeFromGeohash);
  const rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
  const contour2 = rawContour2.map(contractPoint.encodeFromGeohash);
  const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
  const contour3 = rawContour3.map(contractPoint.encodeFromGeohash);
  // const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
  // const contour4 = rawContour4.map(contractPoint.encodeFromGeohash);
  const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
  const contour5 = rawContour5.map(contractPoint.encodeFromGeohash);
  const rawContour6 = ['dr5qvnpda9gb', 'dr5qvnpda9gv', 'dr5qvnpda9gt', 'dr5qvnpda9g2'];
  const contour6 = rawContour6.map(contractPoint.encodeFromGeohash);
  const rawContour7 = ['dr5qvnpda9gu', 'dr5qvnpda9gf', 'dr5qvnpda9g3', 'dr5qvnpda9g5'];
  const contour7 = rawContour7.map(contractPoint.encodeFromGeohash);
  // const rawContour8 = ['dr5bvnpda9ga', 'dr5vvnpda9ga', 'dr5tvnpda9ga', 'dr52vnpda9ga'];
  // const contour8 = rawContour8.map(contractPoint.encodeFromGeohash);
  // const rawContour9 = ['dr5uvnpda9ga', 'dr5fvnpda9ga', 'dr53vnpda9ga', 'dr55vnpda9ga'];
  // const contour9 = rawContour9.map(contractPoint.encodeFromGeohash);
  let lib;

  before(async function() {
    lib = await PPContourVerificationPublicLib.new();
  });

  describe('collinear segment detection', () => {
    it('should match when one contour includes another on 9-th geohash precision level', async function() {
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qvnpdb9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdv9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdu9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdf9g8')
        ),
        true
      );
    });

    it('should match when one contour includes another on 12-th geohash precision level', async function() {
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qvnpdd9gb'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gv'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gu'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gf')
        ),
        true
      );
    });

    it('should NOT match when contour intersection degree is extremely low on 12-th degree level', async function() {
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qanpdd9gb'),
          contractPoint.encodeFromGeohash('dr5qanpdd9gz'),
          contractPoint.encodeFromGeohash('dr5qanpdd9gy'),
          contractPoint.encodeFromGeohash('dr5qanpdd9g8')
        ),
        false
      );
    });
  });

  describe('contour intersection', () => {
    it('should return true for intersecting contours', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour1,
          contour2,
          3,
          contractPoint.encodeFromGeohash('dr5qvnp9cnpt'),
          contractPoint.encodeFromGeohash('dr5qvnpd300r'),
          0,
          contractPoint.encodeFromGeohash('dr5qvnpd0eqs'),
          contractPoint.encodeFromGeohash('dr5qvnpd5npy'),
          true
        ),
        true
      );

      assert.equal(
        await lib.contourSegmentsIntersects(
          contour1,
          contour2,
          3,
          contractPoint.encodeFromGeohash('dr5qvnp9cnpt'),
          contractPoint.encodeFromGeohash('dr5qvnpd300r'),
          0,
          contractPoint.encodeFromGeohash('dr5qvnpd0eqs'),
          contractPoint.encodeFromGeohash('dr5qvnpd5npy'),
          false
        ),
        true
      );
    });

    it('should return false for non-intersecting contours', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour1,
          contour3,
          3,
          contractPoint.encodeFromGeohash('dr5qvnp9cnpt'),
          contractPoint.encodeFromGeohash('dr5qvnpd300r'),
          3,
          contractPoint.encodeFromGeohash('dr5qvnp99ddh'),
          contractPoint.encodeFromGeohash('dr5qvnp9c7b2'),
          true
        ),
        false
      );

      assert.equal(
        await lib.contourSegmentsIntersects(
          contour1,
          contour3,
          3,
          contractPoint.encodeFromGeohash('dr5qvnp9cnpt'),
          contractPoint.encodeFromGeohash('dr5qvnpd300r'),
          3,
          contractPoint.encodeFromGeohash('dr5qvnp99ddh'),
          contractPoint.encodeFromGeohash('dr5qvnp9c7b2'),
          false
        ),
        false
      );
    });

    it('should match collinear contours if specified', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour6,
          contour7,
          0,
          contractPoint.encodeFromGeohash('dr5qvnpda9gb'),
          contractPoint.encodeFromGeohash('dr5qvnpda9gv'),
          0,
          contractPoint.encodeFromGeohash('dr5qvnpda9gu'),
          contractPoint.encodeFromGeohash('dr5qvnpda9gf'),
          // excludeCollinear
          false
        ),
        true
      );
    });

    it('should exclude collinear contours if specified', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour6,
          contour7,
          0,
          contractPoint.encodeFromGeohash('dr5qvnpda9gb'),
          contractPoint.encodeFromGeohash('dr5qvnpda9gv'),
          0,
          contractPoint.encodeFromGeohash('dr5qvnpda9gu'),
          contractPoint.encodeFromGeohash('dr5qvnpda9gf'),
          // excludeCollinear
          true
        ),
        false
      );
    });
  });

  describe('contour inclusion', () => {
    it('should match when a B contour point inside contour A', async function() {
      assert.equal(
        await lib.pointInsideContour(
          contour1,
          contour2,
          INCLUSION_TYPE.B_INSIDE_A,
          3,
          contractPoint.encodeFromGeohash('dr5qvnpd100z')
        ),
        true
      );
    });

    it('should not match when a B point is not inside contour A', async function() {
      assert.equal(
        await lib.pointInsideContour(
          contour1,
          contour2,
          INCLUSION_TYPE.B_INSIDE_A,
          2,
          contractPoint.encodeFromGeohash('dr5qvnp9grz7')
        ),
        false
      );
    });

    it('should match when a A contour point inside contour B', async function() {
      assert.equal(
        await lib.pointInsideContour(
          contour5,
          contour1,
          INCLUSION_TYPE.A_INSIDE_B,
          0,
          contractPoint.encodeFromGeohash('dr5qvnp3vur6')
        ),
        true
      );
    });

    it('should not match when a A point is not inside contour B', async function() {
      assert.equal(
        await lib.pointInsideContour(
          contour5,
          contour1,
          INCLUSION_TYPE.A_INSIDE_B,
          2,
          contractPoint.encodeFromGeohash('dr5qvnp3ybpq')
        ),
        false
      );
    });

    describe('precision', () => {
      // TODO: there could be some inclusion precision tests
    });
  });
});