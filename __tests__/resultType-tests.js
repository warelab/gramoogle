'use strict';

jest.dontMock('../scripts/config/resultTypes.js');

describe('resultTypes', function() {
  var resultTypes = require('../scripts/config/resultTypes');

  it('should work for simple case', function() {
    // given
    var type = 'list';

    // when
    var rt = resultTypes.get('list');

    // then
    expect(rt).toBeDefined();
    expect(rt.rows).toEqual(10);
    expect(rt.start).toEqual(0);
  });

  it('should return undefined if unrecognized type', function() {
    // given
    var type = 'artichoke';

    // when
    var rt = resultTypes.get(type);

    // then
    expect(rt).not.toBeDefined();
  });

  it('should incorporate details', function() {
    // given
    var type = 'facet';
    var details = {bar: 'foo'};

    // when
    var rt = resultTypes.get(type, details);

    // then
    expect(rt).toBeDefined();
    expect(rt['facet.limit']).toEqual(10);
    expect(rt.bar).toEqual(details.bar);
  });

  it('should rename facet parameters when "facet.field" passed in as detail', function() {
    // given
    var type = 'facet';
    var details = {'facet.field': 'foo', 'facet.stuff': 'thing'};

    // when
    var rt = resultTypes.get(type, details);

    // then
    expect(rt).toBeDefined();
    expect(rt['facet.limit']).not.toBeDefined();
    expect(rt['facet.stuff']).not.toBeDefined();
    expect(rt['facet.field']).toEqual('foo');
    expect(rt['f.foo.facet.limit']).toEqual(10);
    expect(rt['f.foo.facet.stuff']).toEqual(details['facet.stuff']);
    expect(rt['f.foo.facet.field']).not.toBeDefined();
  });

  it('should have distribution parameters prefixed with facet.field', function() {
    // given
    var type = 'distribution';

    // when
    var rt = resultTypes.get(type);

    // then
    expect(rt).toBeDefined();
    expect(rt['facet.limit']).not.toBeDefined();
    expect(rt['facet.mincount']).not.toBeDefined();
    expect(rt['facet.field']).toEqual('bin_10Mb');
    expect(rt['f.bin_10Mb.facet.limit']).toEqual(-1);
    expect(rt['f.bin_10Mb.facet.mincount']).toEqual(1);
    expect(rt['f.bin_10Mb.facet.field']).not.toBeDefined();
  });
});