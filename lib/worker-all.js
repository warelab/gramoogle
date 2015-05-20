(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bam.js: indexed binary alignments
//

"use strict";

if (typeof(require) !== 'undefined') {
    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;
    var intersection = spans.intersection;

    var bin = require('./bin');
    var readInt = bin.readInt;
    var readShort = bin.readShort;
    var readByte = bin.readByte;
    var readInt64 = bin.readInt64;
    var readFloat = bin.readFloat;

    var lh3utils = require('./lh3utils');
    var readVob = lh3utils.readVob;
    var unbgzf = lh3utils.unbgzf;
    var reg2bins = lh3utils.reg2bins;
    var Chunk = lh3utils.Chunk;
}


var BAM_MAGIC = 0x14d4142;
var BAI_MAGIC = 0x1494142;

var BamFlags = {
    MULTIPLE_SEGMENTS:       0x1,
    ALL_SEGMENTS_ALIGN:      0x2,
    SEGMENT_UNMAPPED:        0x4,
    NEXT_SEGMENT_UNMAPPED:   0x8,
    REVERSE_COMPLEMENT:      0x10,
    NEXT_REVERSE_COMPLEMENT: 0x20,
    FIRST_SEGMENT:           0x40,
    LAST_SEGMENT:            0x80,
    SECONDARY_ALIGNMENT:     0x100,
    QC_FAIL:                 0x200,
    DUPLICATE:               0x400,
    SUPPLEMENTARY:           0x800
};

function BamFile() {
}


// Calculate the length (in bytes) of the BAI ref starting at offset.
// Returns {nbin, length, minBlockIndex}
function _getBaiRefLength(uncba, offset) {
    var p = offset;
    var nbin = readInt(uncba, p); p += 4;
    for (var b = 0; b < nbin; ++b) {
        var bin = readInt(uncba, p);
        var nchnk = readInt(uncba, p+4);
        p += 8 + (nchnk * 16);
    }
    var nintv = readInt(uncba, p); p += 4;

    var minBlockIndex = 1000000000;
    var q = p;
    for (var i = 0; i < nintv; ++i) {
        var v = readVob(uncba, q); q += 8;
        if (v) {
            var bi = v.block;
            if (v.offset > 0)
                bi += 65536;

            if (bi < minBlockIndex)
                minBlockIndex = bi;
            break;
        }
    }
    p += (nintv * 8);

    return {
        minBlockIndex: minBlockIndex,
        nbin: nbin,
        length: p - offset
    };
}


function makeBam(data, bai, indexChunks, callback, attempted) {
    var bam = new BamFile();
    bam.data = data;
    bam.bai = bai;
    bam.indexChunks = indexChunks;

    var minBlockIndex = bam.indexChunks ? bam.indexChunks.minBlockIndex : 1000000000;

    // Fills out bam.chrToIndex and bam.indexToChr based on the first few bytes of the BAM.
    function parseBamHeader(r) {
        if (!r) {
            return callback(null, "Couldn't access BAM");
        }

        var unc = unbgzf(r, r.byteLength);
        var uncba = new Uint8Array(unc);

        var magic = readInt(uncba, 0);
        if (magic != BAM_MAGIC) {
            return callback(null, "Not a BAM file, magic=0x" + magic.toString(16));
        }
        var headLen = readInt(uncba, 4);
        var header = '';
        for (var i = 0; i < headLen; ++i) {
            header += String.fromCharCode(uncba[i + 8]);
        }

        var nRef = readInt(uncba, headLen + 8);
        var p = headLen + 12;

        bam.chrToIndex = {};
        bam.indexToChr = [];
        for (var i = 0; i < nRef; ++i) {
            var lName = readInt(uncba, p);
            var name = '';
            for (var j = 0; j < lName-1; ++j) {
                name += String.fromCharCode(uncba[p + 4 + j]);
            }
            var lRef = readInt(uncba, p + lName + 4);
            bam.chrToIndex[name] = i;
            if (name.indexOf('chr') == 0) {
                bam.chrToIndex[name.substring(3)] = i;
            } else {
                bam.chrToIndex['chr' + name] = i;
            }
            bam.indexToChr.push(name);

            p = p + 8 + lName;
        }

        if (bam.indices) {
            return callback(bam);
        }
    }

    function parseBai(header) {
        if (!header) {
            return "Couldn't access BAI";
        }

        var uncba = new Uint8Array(header);
        var baiMagic = readInt(uncba, 0);
        if (baiMagic != BAI_MAGIC) {
            return callback(null, 'Not a BAI file, magic=0x' + baiMagic.toString(16));
        }

        var nref = readInt(uncba, 4);

        bam.indices = [];

        var p = 8;
        for (var ref = 0; ref < nref; ++ref) {
            var blockStart = p;
            var o = _getBaiRefLength(uncba, blockStart);
            p += o.length;

            minBlockIndex = Math.min(o.minBlockIndex, minBlockIndex);

            var nbin = o.nbin;

            if (nbin > 0) {
                bam.indices[ref] = new Uint8Array(header, blockStart, p - blockStart);
            }
        }

        return true;
    }

    if (!bam.indexChunks) {
        bam.bai.fetch(function(header) {   // Do we really need to fetch the whole thing? :-(
            var result = parseBai(header);
            if (result !== true) {
                if (bam.bai.url && typeof(attempted) === "undefined") {
                    // Already attempted x.bam.bai not there so now trying x.bai
                    bam.bai.url = bam.data.url.replace(new RegExp('.bam$'), '.bai');
                    
                     // True lets us know we are making a second attempt
                    makeBam(data, bam.bai, indexChunks, callback, true);
                }
                else {
                    // We've attempted x.bam.bai & x.bai and nothing worked
                    callback(null, result);
                }
            } else {
              bam.data.slice(0, minBlockIndex).fetch(parseBamHeader, {timeout: 5000});
            }
        }, {timeout: 5000});   // Timeout on first request to catch Chrome mixed-content error.
    } else {
        var chunks = bam.indexChunks.chunks;
        bam.indices = []
        for (var i = 0; i < chunks.length; i++) {
           bam.indices[i] = null;  // To be filled out lazily as needed
        }
        bam.data.slice(0, minBlockIndex).fetch(parseBamHeader);
    }
}



BamFile.prototype.blocksForRange = function(refId, min, max) {
    var index = this.indices[refId];
    if (!index) {
        return [];
    }

    var intBinsL = reg2bins(min, max);
    var intBins = [];
    for (var i = 0; i < intBinsL.length; ++i) {
        intBins[intBinsL[i]] = true;
    }
    var leafChunks = [], otherChunks = [];

    var nbin = readInt(index, 0);
    var p = 4;
    for (var b = 0; b < nbin; ++b) {
        var bin = readInt(index, p);
        var nchnk = readInt(index, p+4);
//        dlog('bin=' + bin + '; nchnk=' + nchnk);
        p += 8;
        if (intBins[bin]) {
            for (var c = 0; c < nchnk; ++c) {
                var cs = readVob(index, p);
                var ce = readVob(index, p + 8);
                (bin < 4681 ? otherChunks : leafChunks).push(new Chunk(cs, ce));
                p += 16;
            }
        } else {
            p +=  (nchnk * 16);
        }
    }
    // console.log('leafChunks = ' + miniJSONify(leafChunks));
    // console.log('otherChunks = ' + miniJSONify(otherChunks));

    var nintv = readInt(index, p);
    var lowest = null;
    var minLin = Math.min(min>>14, nintv - 1), maxLin = Math.min(max>>14, nintv - 1);
    for (var i = minLin; i <= maxLin; ++i) {
        var lb =  readVob(index, p + 4 + (i * 8));
        if (!lb) {
            continue;
        }
        if (!lowest || lb.block < lowest.block || lb.offset < lowest.offset) {
            lowest = lb;
        }
    }
    // console.log('Lowest LB = ' + lowest);
    
    var prunedOtherChunks = [];
    if (lowest != null) {
        for (var i = 0; i < otherChunks.length; ++i) {
            var chnk = otherChunks[i];
            if (chnk.maxv.block >= lowest.block && chnk.maxv.offset >= lowest.offset) {
                prunedOtherChunks.push(chnk);
            }
        }
    }
    // console.log('prunedOtherChunks = ' + miniJSONify(prunedOtherChunks));
    otherChunks = prunedOtherChunks;

    var intChunks = [];
    for (var i = 0; i < otherChunks.length; ++i) {
        intChunks.push(otherChunks[i]);
    }
    for (var i = 0; i < leafChunks.length; ++i) {
        intChunks.push(leafChunks[i]);
    }

    intChunks.sort(function(c0, c1) {
        var dif = c0.minv.block - c1.minv.block;
        if (dif != 0) {
            return dif;
        } else {
            return c0.minv.offset - c1.minv.offset;
        }
    });
    var mergedChunks = [];
    if (intChunks.length > 0) {
        var cur = intChunks[0];
        for (var i = 1; i < intChunks.length; ++i) {
            var nc = intChunks[i];
            if (nc.minv.block == cur.maxv.block /* && nc.minv.offset == cur.maxv.offset */) { // no point splitting mid-block
                cur = new Chunk(cur.minv, nc.maxv);
            } else {
                mergedChunks.push(cur);
                cur = nc;
            }
        }
        mergedChunks.push(cur);
    }
    // console.log('mergedChunks = ' + miniJSONify(mergedChunks));

    return mergedChunks;
}

BamFile.prototype.fetch = function(chr, min, max, callback, opts) {
    var thisB = this;
    opts = opts || {};

    var chrId = this.chrToIndex[chr];
    var chunks;
    if (chrId === undefined) {
        chunks = [];
    } else {
        // Fetch this portion of the BAI if it hasn't been loaded yet.
        if (this.indices[chrId] === null && this.indexChunks.chunks[chrId]) {
            var start_stop = this.indexChunks.chunks[chrId];
            return this.bai.slice(start_stop[0], start_stop[1]).fetch(function(data) {
                var buffer = new Uint8Array(data);
                this.indices[chrId] = buffer;
                return this.fetch(chr, min, max, callback, opts);
            }.bind(this));
        }

        chunks = this.blocksForRange(chrId, min, max);
        if (!chunks) {
            callback(null, 'Error in index fetch');
        }
    }
    
    var records = [];
    var index = 0;
    var data;

    function tramp() {
        if (index >= chunks.length) {
            return callback(records);
        } else if (!data) {
            var c = chunks[index];
            var fetchMin = c.minv.block;
            var fetchMax = c.maxv.block + (1<<16); // *sigh*
            // console.log('fetching ' + fetchMin + ':' + fetchMax);
            thisB.data.slice(fetchMin, fetchMax - fetchMin).fetch(function(r) {
                data = unbgzf(r, c.maxv.block - c.minv.block + 1);
                return tramp();
            });
        } else {
            var ba = new Uint8Array(data);
            var finished = thisB.readBamRecords(ba, chunks[index].minv.offset, records, min, max, chrId, opts);
            data = null;
            ++index;
            if (finished)
                return callback(records);
            else
                return tramp();
        }
    }
    tramp();
}

var SEQRET_DECODER = ['=', 'A', 'C', 'x', 'G', 'x', 'x', 'x', 'T', 'x', 'x', 'x', 'x', 'x', 'x', 'N'];
var CIGAR_DECODER = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X', '?', '?', '?', '?', '?', '?', '?'];

function BamRecord() {
}

BamFile.prototype.readBamRecords = function(ba, offset, sink, min, max, chrId, opts) {
    while (true) {
        var blockSize = readInt(ba, offset);
        var blockEnd = offset + blockSize + 4;
        if (blockEnd >= ba.length) {
            return false;
        }

        var record = new BamRecord();

        var refID = readInt(ba, offset + 4);
        var pos = readInt(ba, offset + 8);
        
        var bmn = readInt(ba, offset + 12);
        var bin = (bmn & 0xffff0000) >> 16;
        var mq = (bmn & 0xff00) >> 8;
        var nl = bmn & 0xff;

        var flag_nc = readInt(ba, offset + 16);
        var flag = (flag_nc & 0xffff0000) >> 16;
        var nc = flag_nc & 0xffff;
    
        var lseq = readInt(ba, offset + 20);
        
        var nextRef  = readInt(ba, offset + 24);
        var nextPos = readInt(ba, offset + 28);
        
        var tlen = readInt(ba, offset + 32);
    
        record.segment = this.indexToChr[refID];
        record.flag = flag;
        record.pos = pos;
        record.mq = mq;
        if (opts.light)
            record.seqLength = lseq;

        if (!opts.light) {
            if (nextRef >= 0) {
                record.nextSegment = this.indexToChr[nextRef];
                record.nextPos = nextPos;
            }

            var readName = '';
            for (var j = 0; j < nl-1; ++j) {
                readName += String.fromCharCode(ba[offset + 36 + j]);
            }
            record.readName = readName;
        
            var p = offset + 36 + nl;

            var cigar = '';
            for (var c = 0; c < nc; ++c) {
                var cigop = readInt(ba, p);
                cigar = cigar + (cigop>>4) + CIGAR_DECODER[cigop & 0xf];
                p += 4;
            }
            record.cigar = cigar;
        
            var seq = '';
            var seqBytes = (lseq + 1) >> 1;
            for (var j = 0; j < seqBytes; ++j) {
                var sb = ba[p + j];
                seq += SEQRET_DECODER[(sb & 0xf0) >> 4];
                if (seq.length < lseq)
                    seq += SEQRET_DECODER[(sb & 0x0f)];
            }
            p += seqBytes;
            record.seq = seq;

            var qseq = '';
            for (var j = 0; j < lseq; ++j) {
                qseq += String.fromCharCode(ba[p + j] + 33);
            }
            p += lseq;
            record.quals = qseq;

            while (p < blockEnd) {
                var tag = String.fromCharCode(ba[p], ba[p + 1]);
                var type = String.fromCharCode(ba[p + 2]);
                var value;

                if (type == 'A') {
                    value = String.fromCharCode(ba[p + 3]);
                    p += 4;
                } else if (type == 'i' || type == 'I') {
                    value = readInt(ba, p + 3);
                    p += 7;
                } else if (type == 'c' || type == 'C') {
                    value = ba[p + 3];
                    p += 4;
                } else if (type == 's' || type == 'S') {
                    value = readShort(ba, p + 3);
                    p += 5;
                } else if (type == 'f') {
                    value = readFloat(ba, p + 3);
                    p += 7;
                } else if (type == 'Z' || type == 'H') {
                    p += 3;
                    value = '';
                    for (;;) {
                        var cc = ba[p++];
                        if (cc == 0) {
                            break;
                        } else {
                            value += String.fromCharCode(cc);
                        }
                    }
                } else if (type == 'B') {
                    var atype = String.fromCharCode(ba[p + 3]);
                    var alen = readInt(ba, p + 4);
                    var elen;
                    var reader;
                    if (atype == 'i' || atype == 'I' || atype == 'f') {
                        elen = 4;
                        if (atype == 'f')
                            reader = readFloat;
                        else
                            reader = readInt;
                    } else if (atype == 's' || atype == 'S') {
                        elen = 2;
                        reader = readShort;
                    } else if (atype == 'c' || atype == 'C') {
                        elen = 1;
                        reader = readByte;
                    } else {
                        throw 'Unknown array type ' + atype;
                    }

                    p += 8;
                    value = [];
                    for (var i = 0; i < alen; ++i) {
                        value.push(reader(ba, p));
                        p += elen;
                    }
                } else {
                    throw 'Unknown type '+ type;
                }
                record[tag] = value;
            }
        }

        if (!min || record.pos <= max && record.pos + lseq >= min) {
            if (chrId === undefined || refID == chrId) {
                sink.push(record);
            }
        }
        if (record.pos > max) {
            return true;
        }
        offset = blockEnd;
    }

    // Exits via top of loop.
};

if (typeof(module) !== 'undefined') {
    module.exports = {
        makeBam: makeBam,
        BAM_MAGIC: BAM_MAGIC,
        BAI_MAGIC: BAI_MAGIC,
        BamFlags: BamFlags
    };
}

},{"./bin":3,"./lh3utils":8,"./spans":10}],2:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// bigwig.js: indexed binary WIG (and BED) files
//

"use strict";


if (typeof(require) !== 'undefined') {
    var spans = require('./spans');
    var Range = spans.Range;
    var union = spans.union;
    var intersection = spans.intersection;

    var das = require('./das');
    var DASFeature = das.DASFeature;
    var DASGroup = das.DASGroup;

    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;

    var bin = require('./bin');
    var readInt = bin.readInt;

    var jszlib = require('jszlib');
    var jszlib_inflate_buffer = jszlib.inflateBuffer;
    var arrayCopy = jszlib.arrayCopy;
}

var BIG_WIG_MAGIC = 0x888FFC26;
var BIG_WIG_MAGIC_BE = 0x26FC8F88;
var BIG_BED_MAGIC = 0x8789F2EB;
var BIG_BED_MAGIC_BE = 0xEBF28987;


var BIG_WIG_TYPE_GRAPH = 1;
var BIG_WIG_TYPE_VSTEP = 2;
var BIG_WIG_TYPE_FSTEP = 3;
  
var M1 = 256;
var M2 = 256*256;
var M3 = 256*256*256;
var M4 = 256*256*256*256;

var BED_COLOR_REGEXP = new RegExp("^[0-9]+,[0-9]+,[0-9]+");

function bwg_readOffset(ba, o) {
    var offset = ba[o] + ba[o+1]*M1 + ba[o+2]*M2 + ba[o+3]*M3 + ba[o+4]*M4;
    return offset;
}

function BigWig() {
}

BigWig.prototype.readChromTree = function(callback) {
    var thisB = this;
    this.chromsToIDs = {};
    this.idsToChroms = {};
    this.maxID = 0;

    var udo = this.unzoomedDataOffset;
    var eb = (udo - this.chromTreeOffset) & 3;
    udo = udo + 4 - eb;

    this.data.slice(this.chromTreeOffset, udo - this.chromTreeOffset).fetch(function(bpt) {
        var ba = new Uint8Array(bpt);
        var sa = new Int16Array(bpt);
        var la = new Int32Array(bpt);
        var bptMagic = la[0];
        var blockSize = la[1];
        var keySize = la[2];
        var valSize = la[3];
        var itemCount = bwg_readOffset(ba, 16);
        var rootNodeOffset = 32;

        var bptReadNode = function(offset) {
            var nodeType = ba[offset];
            var cnt = sa[(offset/2) + 1];
            offset += 4;
            for (var n = 0; n < cnt; ++n) {
                if (nodeType == 0) {
                    offset += keySize;
                    var childOffset = bwg_readOffset(ba, offset);
                    offset += 8;
                    childOffset -= thisB.chromTreeOffset;
                    bptReadNode(childOffset);
                } else {
                    var key = '';
                    for (var ki = 0; ki < keySize; ++ki) {
                        var charCode = ba[offset++];
                        if (charCode != 0) {
                            key += String.fromCharCode(charCode);
                        }
                    }
                    var chromId = (ba[offset+3]<<24) | (ba[offset+2]<<16) | (ba[offset+1]<<8) | (ba[offset+0]);
                    var chromSize = (ba[offset + 7]<<24) | (ba[offset+6]<<16) | (ba[offset+5]<<8) | (ba[offset+4]);
                    offset += 8;

                    thisB.chromsToIDs[key] = chromId;
                    if (key.indexOf('chr') == 0) {
                        thisB.chromsToIDs[key.substr(3)] = chromId;
                    }
                    thisB.idsToChroms[chromId] = key;
                    thisB.maxID = Math.max(thisB.maxID, chromId);
                }
            }
        };
        bptReadNode(rootNodeOffset);

        callback(thisB);
    });
}

function BigWigView(bwg, cirTreeOffset, cirTreeLength, isSummary) {
    this.bwg = bwg;
    this.cirTreeOffset = cirTreeOffset;
    this.cirTreeLength = cirTreeLength;
    this.isSummary = isSummary;
}



BigWigView.prototype.readWigData = function(chrName, min, max, callback) {
    var chr = this.bwg.chromsToIDs[chrName];
    if (chr === undefined) {
        // Not an error because some .bwgs won't have data for all chromosomes.
        return callback([]);
    } else {
        this.readWigDataById(chr, min, max, callback);
    }
}

BigWigView.prototype.readWigDataById = function(chr, min, max, callback) {
    var thisB = this;
    if (!this.cirHeader) {
        this.bwg.data.slice(this.cirTreeOffset, 48).fetch(function(result) {
            thisB.cirHeader = result;
            var la = new Int32Array(thisB.cirHeader);
            thisB.cirBlockSize = la[1];
            thisB.readWigDataById(chr, min, max, callback);
        });
        return;
    }

    var blocksToFetch = [];
    var outstanding = 0;

    var beforeBWG = Date.now();

    var filter = function(chromId, fmin, fmax, toks) {
        return ((chr < 0 || chromId == chr) && fmin <= max && fmax >= min);
    }

    var cirFobRecur = function(offset, level) {
        if (thisB.bwg.instrument)
            console.log('level=' + level + '; offset=' + offset + '; time=' + (Date.now()|0));

        outstanding += offset.length;

        if (offset.length == 1 && offset[0] - thisB.cirTreeOffset == 48 && thisB.cachedCirRoot) {
            cirFobRecur2(thisB.cachedCirRoot, 0, level);
            --outstanding;
            if (outstanding == 0) {
                thisB.fetchFeatures(filter, blocksToFetch, callback);
            }
            return;
        }

        var maxCirBlockSpan = 4 +  (thisB.cirBlockSize * 32);   // Upper bound on size, based on a completely full leaf node.
        var spans;
        for (var i = 0; i < offset.length; ++i) {
            var blockSpan = new Range(offset[i], offset[i] + maxCirBlockSpan);
            spans = spans ? union(spans, blockSpan) : blockSpan;
        }
        
        var fetchRanges = spans.ranges();
        for (var r = 0; r < fetchRanges.length; ++r) {
            var fr = fetchRanges[r];
            cirFobStartFetch(offset, fr, level);
        }
    }

    var cirFobStartFetch = function(offset, fr, level, attempts) {
        var length = fr.max() - fr.min();
        thisB.bwg.data.slice(fr.min(), fr.max() - fr.min()).fetch(function(resultBuffer) {
            for (var i = 0; i < offset.length; ++i) {
                if (fr.contains(offset[i])) {
                    cirFobRecur2(resultBuffer, offset[i] - fr.min(), level);

                    if (offset[i] - thisB.cirTreeOffset == 48 && offset[i] - fr.min() == 0)
                        thisB.cachedCirRoot = resultBuffer;

                    --outstanding;
                    if (outstanding == 0) {
                        thisB.fetchFeatures(filter, blocksToFetch, callback);
                    }
                }
            }
        });
    }

    var cirFobRecur2 = function(cirBlockData, offset, level) {
        var ba = new Uint8Array(cirBlockData);
        var sa = new Int16Array(cirBlockData);
        var la = new Int32Array(cirBlockData);

        var isLeaf = ba[offset];
        var cnt = sa[offset/2 + 1];
        offset += 4;

        if (isLeaf != 0) {
            for (var i = 0; i < cnt; ++i) {
                var lo = offset/4;
                var startChrom = la[lo];
                var startBase = la[lo + 1];
                var endChrom = la[lo + 2];
                var endBase = la[lo + 3];
                var blockOffset = bwg_readOffset(ba, offset+16);
                var blockSize = bwg_readOffset(ba, offset+24);
                if (((chr < 0 || startChrom < chr) || (startChrom == chr && startBase <= max)) &&
                    ((chr < 0 || endChrom   > chr) || (endChrom == chr && endBase >= min)))
                {
                    blocksToFetch.push({offset: blockOffset, size: blockSize});
                }
                offset += 32;
            }
        } else {
            var recurOffsets = [];
            for (var i = 0; i < cnt; ++i) {
                var lo = offset/4;
                var startChrom = la[lo];
                var startBase = la[lo + 1];
                var endChrom = la[lo + 2];
                var endBase = la[lo + 3];
                var blockOffset = bwg_readOffset(ba, offset+16);
                if ((chr < 0 || startChrom < chr || (startChrom == chr && startBase <= max)) &&
                    (chr < 0 || endChrom   > chr || (endChrom == chr && endBase >= min)))
                {
                    recurOffsets.push(blockOffset);
                }
                offset += 24;
            }
            if (recurOffsets.length > 0) {
                cirFobRecur(recurOffsets, level + 1);
            }
        }
    };

    cirFobRecur([thisB.cirTreeOffset + 48], 1);
}


BigWigView.prototype.fetchFeatures = function(filter, blocksToFetch, callback) {
    var thisB = this;

    blocksToFetch.sort(function(b0, b1) {
        return (b0.offset|0) - (b1.offset|0);
    });

    if (blocksToFetch.length == 0) {
        callback([]);
    } else {
        var features = [];
        var createFeature = function(chr, fmin, fmax, opts) {
            if (!opts) {
                opts = {};
            }
        
            var f = new DASFeature();
            f._chromId = chr;
            f.segment = thisB.bwg.idsToChroms[chr];
            f.min = fmin;
            f.max = fmax;
            f.type = 'bigwig';
            
            for (var k in opts) {
                f[k] = opts[k];
            }
            
            features.push(f);
        };

        var tramp = function() {
            if (blocksToFetch.length == 0) {
                var afterBWG = Date.now();
                // dlog('BWG fetch took ' + (afterBWG - beforeBWG) + 'ms');
                callback(features);
                return;  // just in case...
            } else {
                var block = blocksToFetch[0];
                if (block.data) {
                    thisB.parseFeatures(block.data, createFeature, filter);
                    blocksToFetch.splice(0, 1);
                    tramp();
                } else {
                    var fetchStart = block.offset;
                    var fetchSize = block.size;
                    var bi = 1;
                    while (bi < blocksToFetch.length && blocksToFetch[bi].offset == (fetchStart + fetchSize)) {
                        fetchSize += blocksToFetch[bi].size;
                        ++bi;
                    }

                    thisB.bwg.data.slice(fetchStart, fetchSize).fetch(function(result) {
                        var offset = 0;
                        var bi = 0;
                        while (offset < fetchSize) {
                            var fb = blocksToFetch[bi];
                        
                            var data;
                            if (thisB.bwg.uncompressBufSize > 0) {
                                data = jszlib_inflate_buffer(result, offset + 2, fb.size - 2);
                            } else {
                                var tmp = new Uint8Array(fb.size);    // FIXME is this really the best we can do?
                                arrayCopy(new Uint8Array(result, offset, fb.size), 0, tmp, 0, fb.size);
                                data = tmp.buffer;
                            }
                            fb.data = data;
                            
                            offset += fb.size;
                            ++bi;
                        }
                        tramp();
                    });
                }
            }
        }
        tramp();
    }
}

BigWigView.prototype.parseFeatures = function(data, createFeature, filter) {
    var ba = new Uint8Array(data);

    if (this.isSummary) {
        var sa = new Int16Array(data);
        var la = new Int32Array(data);
        var fa = new Float32Array(data);

        var itemCount = data.byteLength/32;
        for (var i = 0; i < itemCount; ++i) {
            var chromId =   la[(i*8)];
            var start =     la[(i*8)+1];
            var end =       la[(i*8)+2];
            var validCnt =  la[(i*8)+3];
            var minVal    = fa[(i*8)+4];
            var maxVal    = fa[(i*8)+5];
            var sumData   = fa[(i*8)+6];
            var sumSqData = fa[(i*8)+7];
            
            if (filter(chromId, start + 1, end)) {
                var summaryOpts = {type: 'bigwig', score: sumData/validCnt, maxScore: maxVal};
                if (this.bwg.type == 'bigbed') {
                    summaryOpts.type = 'density';
                }
                createFeature(chromId, start + 1, end, summaryOpts);
            }
        }
    } else if (this.bwg.type == 'bigwig') {
        var sa = new Int16Array(data);
        var la = new Int32Array(data);
        var fa = new Float32Array(data);

        var chromId = la[0];
        var blockStart = la[1];
        var blockEnd = la[2];
        var itemStep = la[3];
        var itemSpan = la[4];
        var blockType = ba[20];
        var itemCount = sa[11];
        
        if (blockType == BIG_WIG_TYPE_FSTEP) {
            for (var i = 0; i < itemCount; ++i) {
                var score = fa[i + 6];
                var fmin = blockStart + (i*itemStep) + 1, fmax = blockStart + (i*itemStep) + itemSpan;
                if (filter(chromId, fmin, fmax))
                    createFeature(chromId, fmin, fmax, {score: score});
            }
        } else if (blockType == BIG_WIG_TYPE_VSTEP) {
            for (var i = 0; i < itemCount; ++i) {
                var start = la[(i*2) + 6] + 1;
                var end = start + itemSpan - 1;
                var score = fa[(i*2) + 7];
                if (filter(chromId, start, end))
                    createFeature(chromId, start, end, {score: score});
            }
        } else if (blockType == BIG_WIG_TYPE_GRAPH) {
            for (var i = 0; i < itemCount; ++i) {
                var start = la[(i*3) + 6] + 1;
                var end   = la[(i*3) + 7];
                var score = fa[(i*3) + 8];
                if (start > end) {
                    start = end;
                }
                if (filter(chromId, start, end))
                    createFeature(chromId, start, end, {score: score});
            }
        } else {
            console.log('Currently not handling bwgType=' + blockType);
        }
    } else if (this.bwg.type == 'bigbed') {
        var offset = 0;
        var dfc = this.bwg.definedFieldCount;
        var schema = this.bwg.schema;

        while (offset < ba.length) {
            var chromId = (ba[offset+3]<<24) | (ba[offset+2]<<16) | (ba[offset+1]<<8) | (ba[offset+0]);
            var start = (ba[offset+7]<<24) | (ba[offset+6]<<16) | (ba[offset+5]<<8) | (ba[offset+4]);
            var end = (ba[offset+11]<<24) | (ba[offset+10]<<16) | (ba[offset+9]<<8) | (ba[offset+8]);
            offset += 12;
            var rest = '';
            while (true) {
                var ch = ba[offset++];
                if (ch != 0) {
                    rest += String.fromCharCode(ch);
                } else {
                    break;
                }
            }

            var featureOpts = {};
            
            var bedColumns;
            if (rest.length > 0) {
                bedColumns = rest.split('\t');
            } else {
                bedColumns = [];
            }
            if (bedColumns.length > 0 && dfc > 3) {
                featureOpts.label = bedColumns[0];
            }
            if (bedColumns.length > 1 && dfc > 4) {
                var score = parseInt(bedColumns[1]);
                if (!isNaN(score))
                    featureOpts.score = score;
            }
            if (bedColumns.length > 2 && dfc > 5) {
                featureOpts.orientation = bedColumns[2];
            }
            if (bedColumns.length > 5 && dfc > 8) {
                var color = bedColumns[5];
                if (BED_COLOR_REGEXP.test(color)) {
                    featureOpts.itemRgb = 'rgb(' + color + ')';
                }
            }

            if (bedColumns.length > dfc-3 && schema) {
                for (var col = dfc - 3; col < bedColumns.length; ++col) {
                    featureOpts[schema.fields[col+3].name] = bedColumns[col];
                }
            }

            if (filter(chromId, start + 1, end, bedColumns)) {
                if (dfc < 12) {
                    createFeature(chromId, start + 1, end, featureOpts);
                } else {
                    var thickStart = bedColumns[3]|0;
                    var thickEnd   = bedColumns[4]|0;
                    var blockCount = bedColumns[6]|0;
                    var blockSizes = bedColumns[7].split(',');
                    var blockStarts = bedColumns[8].split(',');

                    if (featureOpts.exonFrames) {
                        var exonFrames = featureOpts.exonFrames.split(',');
                        featureOpts.exonFrames = undefined;
                    }
                    
                    featureOpts.type = 'transcript'
                    var grp = new DASGroup();
                    for (var k in featureOpts) {
                        grp[k] = featureOpts[k];
                    }
                    grp.id = bedColumns[0];
                    grp.segment = this.bwg.idsToChroms[chromId];
                    grp.min = start + 1;
                    grp.max = end;
                    grp.notes = [];
                    featureOpts.groups = [grp];

                    // Moving towards using bigGenePred model, but will
                    // still support old Dalliance-style BED12+gene-name for the
                    // foreseeable future.
                    if (bedColumns.length > 9) {
                        var geneId = featureOpts.geneName || bedColumns[9];
                        var geneName = geneId;
                        if (bedColumns.length > 10) {
                            geneName = bedColumns[10];
                        }
                        if (featureOpts.geneName2)
                            geneName = featureOpts.geneName2;

                        var gg = shallowCopy(grp);
                        gg.id = geneId;
                        gg.label = geneName;
                        gg.type = 'gene';
                        featureOpts.groups.push(gg);
                    }

                    var spanList = [];
                    for (var b = 0; b < blockCount; ++b) {
                        var bmin = (blockStarts[b]|0) + start;
                        var bmax = bmin + (blockSizes[b]|0);
                        var span = new Range(bmin, bmax);
                        spanList.push(span);
                    }
                    var spans = union(spanList);
                    
                    var tsList = spans.ranges();
                    for (var s = 0; s < tsList.length; ++s) {
                        var ts = tsList[s];
                        createFeature(chromId, ts.min() + 1, ts.max(), featureOpts);
                    }

                    if (thickEnd > thickStart) {
                        var codingRegion = (featureOpts.orientation == '+') ?
                            new Range(thickStart, thickEnd + 3) :
                            new Range(thickStart - 3, thickEnd);
                            // +/- 3 to account for stop codon

                        var tl = intersection(spans, codingRegion);
                        if (tl) {
                            featureOpts.type = 'translation';
                            var tlList = tl.ranges();
                            var readingFrame = 0;

                            var tlOffset = 0;
                            while (tlList[0].min() > tsList[tlOffset].max())
                                tlOffset++;

                            for (var s = 0; s < tlList.length; ++s) {
                                // Record reading frame for every exon
                                var index = s;
                                if (featureOpts.orientation == '-')
                                    index = tlList.length - s - 1;
                                var ts = tlList[index];
                                featureOpts.readframe = readingFrame;
                                if (exonFrames) {
                                    var brf = parseInt(exonFrames[index + tlOffset]);
                                    if (typeof(brf) === 'number' && brf >= 0 && brf <= 2) {
                                        featureOpts.readframe = brf;
                                        featureOpts.readframeExplicit = true;
                                    }
                                }
                                var length = ts.max() - ts.min();
                                readingFrame = (readingFrame + length) % 3;
                                createFeature(chromId, ts.min() + 1, ts.max(), featureOpts);
                            }
                        }
                    }
                }
            }
        }
    } else {
        throw Error("Don't know what to do with " + this.bwg.type);
    }
}

//
// nasty cut/paste, should roll back in!
//

BigWigView.prototype.getFirstAdjacent = function(chrName, pos, dir, callback) {
    var chr = this.bwg.chromsToIDs[chrName];
    if (chr === undefined) {
        // Not an error because some .bwgs won't have data for all chromosomes.
        return callback([]);
    } else {
        this.getFirstAdjacentById(chr, pos, dir, callback);
    }
}

BigWigView.prototype.getFirstAdjacentById = function(chr, pos, dir, callback) {
    var thisB = this;
    if (!this.cirHeader) {
        this.bwg.data.slice(this.cirTreeOffset, 48).fetch(function(result) {
            thisB.cirHeader = result;
            var la = new Int32Array(thisB.cirHeader);
            thisB.cirBlockSize = la[1];
            thisB.getFirstAdjacentById(chr, pos, dir, callback);
        });
        return;
    }

    var blockToFetch = null;
    var bestBlockChr = -1;
    var bestBlockOffset = -1;

    var outstanding = 0;

    var beforeBWG = Date.now();

    var cirFobRecur = function(offset, level) {
        outstanding += offset.length;

        var maxCirBlockSpan = 4 +  (thisB.cirBlockSize * 32);   // Upper bound on size, based on a completely full leaf node.
        var spans;
        for (var i = 0; i < offset.length; ++i) {
            var blockSpan = new Range(offset[i], offset[i] + maxCirBlockSpan);
            spans = spans ? union(spans, blockSpan) : blockSpan;
        }
        
        var fetchRanges = spans.ranges();
        for (var r = 0; r < fetchRanges.length; ++r) {
            var fr = fetchRanges[r];
            cirFobStartFetch(offset, fr, level);
        }
    }

    var cirFobStartFetch = function(offset, fr, level, attempts) {
        var length = fr.max() - fr.min();
        thisB.bwg.data.slice(fr.min(), fr.max() - fr.min()).fetch(function(resultBuffer) {
            for (var i = 0; i < offset.length; ++i) {
                if (fr.contains(offset[i])) {
                    cirFobRecur2(resultBuffer, offset[i] - fr.min(), level);
                    --outstanding;
                    if (outstanding == 0) {
                        if (!blockToFetch) {
                            if (dir > 0 && (chr != 0 || pos > 0)) {
                                return thisB.getFirstAdjacentById(0, 0, dir, callback);
                            } else if (dir < 0 && (chr != thisB.bwg.maxID || pos < 1000000000)) {
                                return thisB.getFirstAdjacentById(thisB.bwg.maxID, 1000000000, dir, callback);
                            }
                            return callback([]);
                        }

                        thisB.fetchFeatures(function(chrx, fmin, fmax, toks) {
                            return (dir < 0 && (chrx < chr || fmax < pos)) || (dir > 0 && (chrx > chr || fmin > pos));
                        }, [blockToFetch], function(features) {
                            var bestFeature = null;
                            var bestChr = -1;
                            var bestPos = -1;
                            for (var fi = 0; fi < features.length; ++fi) {
                                var f = features[fi];
                                var chrx = f._chromId, fmin = f.min, fmax = f.max;
                                if (bestFeature == null || ((dir < 0) && (chrx > bestChr || fmax > bestPos)) || ((dir > 0) && (chrx < bestChr || fmin < bestPos))) {
                                    bestFeature = f;
                                    bestPos = (dir < 0) ? fmax : fmin;
                                    bestChr = chrx;
                                }
                            }

                            if (bestFeature != null) 
                                return callback([bestFeature]);
                            else
                                return callback([]);
                        });
                    }
                }
            }
        });
    }

    var cirFobRecur2 = function(cirBlockData, offset, level) {
        var ba = new Uint8Array(cirBlockData);
        var sa = new Int16Array(cirBlockData);
        var la = new Int32Array(cirBlockData);

        var isLeaf = ba[offset];
        var cnt = sa[offset/2 + 1];
        offset += 4;

        if (isLeaf != 0) {
            for (var i = 0; i < cnt; ++i) {
                var lo = offset/4;
                var startChrom = la[lo];
                var startBase = la[lo + 1];
                var endChrom = la[lo + 2];
                var endBase = la[lo + 3];
                var blockOffset = bwg_readOffset(ba, offset+16);
                var blockSize = bwg_readOffset(ba, offset+24);
                if ((dir < 0 && ((startChrom < chr || (startChrom == chr && startBase <= pos)))) ||
                    (dir > 0 && ((endChrom > chr || (endChrom == chr && endBase >= pos)))))
                {
                    // console.log('Got an interesting block: startBase=' + startChrom + ':' + startBase + '; endBase=' + endChrom + ':' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
                    if (/_random/.exec(thisB.bwg.idsToChroms[startChrom])) {
                        // dlog('skipping random: ' + thisB.bwg.idsToChroms[startChrom]);
                    } else if (blockToFetch == null || ((dir < 0) && (endChrom > bestBlockChr || (endChrom == bestBlockChr && endBase > bestBlockOffset)) ||
                                                 (dir > 0) && (startChrom < bestBlockChr || (startChrom == bestBlockChr && startBase < bestBlockOffset))))
                    {
                        //                        dlog('best is: startBase=' + startChrom + ':' + startBase + '; endBase=' + endChrom + ':' + endBase + '; offset=' + blockOffset + '; size=' + blockSize);
                        blockToFetch = {offset: blockOffset, size: blockSize};
                        bestBlockOffset = (dir < 0) ? endBase : startBase;
                        bestBlockChr = (dir < 0) ? endChrom : startChrom;
                    }
                }
                offset += 32;
            }
        } else {
            var bestRecur = -1;
            var bestPos = -1;
            var bestChr = -1;
            for (var i = 0; i < cnt; ++i) {
                var lo = offset/4;
                var startChrom = la[lo];
                var startBase = la[lo + 1];
                var endChrom = la[lo + 2];
                var endBase = la[lo + 3];
                var blockOffset = (la[lo + 4]<<32) | (la[lo + 5]);
                if ((dir < 0 && ((startChrom < chr || (startChrom == chr && startBase <= pos)) &&
                                 (endChrom   >= chr))) ||
                     (dir > 0 && ((endChrom > chr || (endChrom == chr && endBase >= pos)) &&
                                  (startChrom <= chr))))
                {
                    if (bestRecur < 0 || endBase > bestPos) {
                        bestRecur = blockOffset;
                        bestPos = (dir < 0) ? endBase : startBase;
                        bestChr = (dir < 0) ? endChrom : startChrom;
                    }
                }
                offset += 24;
            }
            if (bestRecur >= 0) {
                cirFobRecur([bestRecur], level + 1);
            }
        }
    };
    

    cirFobRecur([thisB.cirTreeOffset + 48], 1);
}

BigWig.prototype.readWigData = function(chrName, min, max, callback) {
    this.getUnzoomedView().readWigData(chrName, min, max, callback);
}

BigWig.prototype.getUnzoomedView = function() {
    if (!this.unzoomedView) {
        var cirLen = 4000;
        var nzl = this.zoomLevels[0];
        if (nzl) {
            cirLen = this.zoomLevels[0].dataOffset - this.unzoomedIndexOffset;
        }
        this.unzoomedView = new BigWigView(this, this.unzoomedIndexOffset, cirLen, false);
    }
    return this.unzoomedView;
}

BigWig.prototype.getZoomedView = function(z) {
    var zh = this.zoomLevels[z];
    if (!zh.view) {
        zh.view = new BigWigView(this, zh.indexOffset, /* this.zoomLevels[z + 1].dataOffset - zh.indexOffset */ 4000, true);
    }
    return zh.view;
}

function makeBwg(data, callback, name) {
    var bwg = new BigWig();
    bwg.data = data;
    bwg.name = name;
    bwg.data.slice(0, 512).salted().fetch(function(result) {
        if (!result) {
            return callback(null, "Couldn't fetch file");
        }

        var header = result;
        var ba = new Uint8Array(header);
        var sa = new Int16Array(header);
        var la = new Int32Array(header);
        var magic = ba[0] + (M1 * ba[1]) + (M2 * ba[2]) + (M3 * ba[3]);
        if (magic == BIG_WIG_MAGIC) {
            bwg.type = 'bigwig';
        } else if (magic == BIG_BED_MAGIC) {
            bwg.type = 'bigbed';
        } else if (magic == BIG_WIG_MAGIC_BE || magic == BIG_BED_MAGIC_BE) {
            return callback(null, "Currently don't support big-endian BBI files");
            
        } else {
            return callback(null, "Not a supported format, magic=0x" + magic.toString(16));
            
        }

        bwg.version = sa[2];             // 4
        bwg.numZoomLevels = sa[3];       // 6
        bwg.chromTreeOffset = bwg_readOffset(ba, 8);
        bwg.unzoomedDataOffset = bwg_readOffset(ba, 16);
        bwg.unzoomedIndexOffset = bwg_readOffset(ba, 24);
        bwg.fieldCount = sa[16];         // 32
        bwg.definedFieldCount = sa[17];  // 34
        bwg.asOffset = bwg_readOffset(ba, 36);
        bwg.totalSummaryOffset = bwg_readOffset(ba, 44);
        bwg.uncompressBufSize = la[13];  // 52
        bwg.extHeaderOffset = bwg_readOffset(ba, 56);

        bwg.zoomLevels = [];
        for (var zl = 0; zl < bwg.numZoomLevels; ++zl) {
            var zlReduction = la[zl*6 + 16]
            var zlData = bwg_readOffset(ba, zl*24 + 72);
            var zlIndex = bwg_readOffset(ba, zl*24 + 80);
            bwg.zoomLevels.push({reduction: zlReduction, dataOffset: zlData, indexOffset: zlIndex});
        }

        bwg.readChromTree(function() {
            bwg.getAutoSQL(function(as) {
                bwg.schema = as;
                return callback(bwg);
            });
        });
    }, {timeout: 5000});    // Potential timeout on first request to catch mixed-content errors on
                            // Chromium.
}


BigWig.prototype._tsFetch = function(zoom, chr, min, max, callback) {
    var bwg = this;
    if (zoom >= this.zoomLevels.length - 1) {
        if (!this.topLevelReductionCache) {
            this.getZoomedView(this.zoomLevels.length - 1).readWigDataById(-1, 0, 300000000, function(feats) {
                bwg.topLevelReductionCache = feats;
                return bwg._tsFetch(zoom, chr, min, max, callback);
            });
        } else {
            var f = [];
            var c = this.topLevelReductionCache;
            for (var fi = 0; fi < c.length; ++fi) {
                if (c[fi]._chromId == chr) {
                    f.push(c[fi]);
                }
            }
            return callback(f);
        }
    } else {
        var view;
        if (zoom < 0) {
            view = this.getUnzoomedView();
        } else {
            view = this.getZoomedView(zoom);
        }
        return view.readWigDataById(chr, min, max, callback);
    }
}

BigWig.prototype.thresholdSearch = function(chrName, referencePoint, dir, threshold, callback) {
    dir = (dir<0) ? -1 : 1;
    var bwg = this;
    var initialChr = this.chromsToIDs[chrName];
    var candidates = [{chrOrd: 0, chr: initialChr, zoom: bwg.zoomLevels.length - 4, min: 0, max: 300000000, fromRef: true}]
    for (var i = 1; i <= this.maxID + 1; ++i) {
        var chrId = (initialChr + (dir*i)) % (this.maxID + 1);
        if (chrId < 0) 
            chrId += (this.maxID + 1);
        candidates.push({chrOrd: i, chr: chrId, zoom: bwg.zoomLevels.length - 1, min: 0, max: 300000000})
    }
       
    function fbThresholdSearchRecur() {
    	if (candidates.length == 0) {
    	    return callback(null);
    	}
    	candidates.sort(function(c1, c2) {
    	    var d = c1.zoom - c2.zoom;
    	    if (d != 0)
    		    return d;

            d = c1.chrOrd - c2.chrOrd;
            if (d != 0)
                return d;
    	    else
    		    return c1.min - c2.min * dir;
    	});

	    var candidate = candidates.splice(0, 1)[0];
        bwg._tsFetch(candidate.zoom, candidate.chr, candidate.min, candidate.max, function(feats) {
            var rp = dir > 0 ? 0 : 300000000;
            if (candidate.fromRef)
                rp = referencePoint;
            
            for (var fi = 0; fi < feats.length; ++fi) {
    	        var f = feats[fi];
                var score;
                if (f.maxScore != undefined)
                    score = f.maxScore;
                else
                    score = f.score;

                if (dir > 0) {
    	            if (score > threshold) {
        		        if (candidate.zoom < 0) {
        		            if (f.min > rp)
                                return callback(f);
        		        } else if (f.max > rp) {
        		            candidates.push({chr: candidate.chr, chrOrd: candidate.chrOrd, zoom: candidate.zoom - 2, min: f.min, max: f.max, fromRef: candidate.fromRef});
        		        }
                    }
                } else {
                    if (score > threshold) {
            		    if (candidate.zoom < 0) {
                	        if (f.max < rp)
                			    return callback(f);
                        } else if (f.min < rp) {
                            candidates.push({chr: candidate.chr, chrOrd: candidate.chrOrd, zoom: candidate.zoom - 2, min: f.min, max: f.max, fromRef: candidate.fromRef});
                        }
    	            }
                }
    	    }
            fbThresholdSearchRecur();
        });
    }
    
    fbThresholdSearchRecur();
}

BigWig.prototype.getAutoSQL = function(callback) {
    var thisB = this;
    if (!this.asOffset)
        return callback(null);


    this.data.slice(this.asOffset, 2048).fetch(function(result) {
        var ba = new Uint8Array(result);
        var s = '';
        for (var i = 0; i < ba.length; ++i) {
            if (ba[i] == 0)
                break;
            s += String.fromCharCode(ba[i]);
        }
        
        /* 
         * Quick'n'dirty attempt to parse autoSql format.
         * See: http://www.linuxjournal.com/files/linuxjournal.com/linuxjournal/articles/059/5949/5949l2.html
         */

        var header_re = /(\w+)\s+(\w+)\s+("([^"]+)")?\s+\(\s*/;
        var field_re = /([\w\[\]]+)\s+(\w+)\s*;\s*("([^"]+)")?\s*/g;

        var headerMatch = header_re.exec(s);
        if (headerMatch) {
            var as = {
                declType: headerMatch[1],
                name: headerMatch[2],
                comment: headerMatch[4],

                fields: []
            };

            s = s.substring(headerMatch[0]);
            for (var m = field_re.exec(s); m != null; m = field_re.exec(s)) {
                as.fields.push({type: m[1],
                             name: m[2],
                             comment: m[4]});
            }

            return callback(as);
        }
    });
}

BigWig.prototype.getExtraIndices = function(callback) {
    var thisB = this;
    if (this.version < 4 || this.extHeaderOffset == 0 || this.type != 'bigbed') {
        return callback(null);
    } else {
        this.data.slice(this.extHeaderOffset, 64).fetch(function(result) {
            if (!result) {
                return callback(null, "Couldn't fetch extension header");
            }

            var ba = new Uint8Array(result);
            var sa = new Int16Array(result);
            var la = new Int32Array(result);
            
            var extHeaderSize = sa[0];
            var extraIndexCount = sa[1];
            var extraIndexListOffset = bwg_readOffset(ba, 4);

            if (extraIndexCount == 0) {
                return callback(null);
            }

            // FIXME 20byte records only make sense for single-field indices.
            // Right now, these seem to be the only things around, but the format
            // is actually more general.
            thisB.data.slice(extraIndexListOffset, extraIndexCount * 20).fetch(function(eil) {
                if (!eil) {
                    return callback(null, "Couldn't fetch index info");
                }

                var ba = new Uint8Array(eil);
                var sa = new Int16Array(eil);
                var la = new Int32Array(eil);

                var indices = [];
                for (var ii = 0; ii < extraIndexCount; ++ii) {
                    var eiType = sa[ii*10];
                    var eiFieldCount = sa[ii*10 + 1];
                    var eiOffset = bwg_readOffset(ba, ii*20 + 4);
                    var eiField = sa[ii*10 + 8]
                    var index = new BBIExtraIndex(thisB, eiType, eiFieldCount, eiOffset, eiField);
                    indices.push(index);
                }
                callback(indices);
            });
        });
    }
}

function BBIExtraIndex(bbi, type, fieldCount, offset, field) {
    this.bbi = bbi;
    this.type = type;
    this.fieldCount = fieldCount;
    this.offset = offset;
    this.field = field;
}

BBIExtraIndex.prototype.lookup = function(name, callback) {
    var thisB = this;

    this.bbi.data.slice(this.offset, 32).fetch(function(bpt) {
        var ba = new Uint8Array(bpt);
        var sa = new Int16Array(bpt);
        var la = new Int32Array(bpt);
        var bptMagic = la[0];
        var blockSize = la[1];
        var keySize = la[2];
        var valSize = la[3];
        var itemCount = bwg_readOffset(ba, 16);
        var rootNodeOffset = 32;

        function bptReadNode(nodeOffset) {
            thisB.bbi.data.slice(nodeOffset, 4 + (blockSize * (keySize + valSize))).fetch(function(node) {
                var ba = new Uint8Array(node);
                var sa = new Uint16Array(node);
                var la = new Uint32Array(node);

                var nodeType = ba[0];
                var cnt = sa[1];

                var offset = 4;
                if (nodeType == 0) {
                    var lastChildOffset = null;
                    for (var n = 0; n < cnt; ++n) {
                        var key = '';
                        for (var ki = 0; ki < keySize; ++ki) {
                            var charCode = ba[offset++];
                            if (charCode != 0) {
                                key += String.fromCharCode(charCode);
                            }
                        }

                        var childOffset = bwg_readOffset(ba, offset);
                        offset += 8;
                        
                        if (name.localeCompare(key) < 0 && lastChildOffset) {
                            bptReadNode(lastChildOffset);
                            return;
                        }
                        lastChildOffset = childOffset;
                    }
                    bptReadNode(lastChildOffset);
                } else {
                    for (var n = 0; n < cnt; ++n) {
                        var key = '';
                        for (var ki = 0; ki < keySize; ++ki) {
                            var charCode = ba[offset++];
                            if (charCode != 0) {
                                key += String.fromCharCode(charCode);
                            }
                        }
                        
                        // Specific for EI case.
                        if (key == name) {
                            var start = bwg_readOffset(ba, offset);
                            var length = readInt(ba, offset + 8);

                            return thisB.bbi.getUnzoomedView().fetchFeatures(
                                function(chr, min, max, toks) {
                                    if (toks && toks.length > thisB.field - 3)
                                        return toks[thisB.field - 3] == name;
                                }, 
                                [{offset: start, size: length}], 
                                callback);
                        }
                        offset += valSize;
                    }
                    return callback([]);
                }
            });
        }

        bptReadNode(thisB.offset + rootNodeOffset);
    });
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        makeBwg: makeBwg,
        BIG_BED_MAGIC: BIG_BED_MAGIC,
        BIG_WIG_MAGIC: BIG_WIG_MAGIC
    }
}

},{"./bin":3,"./das":5,"./spans":10,"./utils":11,"jszlib":24}],3:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bin.js general binary data support
//

"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;

    var sha1 = require('./sha1');
    var b64_sha1 = sha1.b64_sha1;
}

function BlobFetchable(b) {
    this.blob = b;
}

BlobFetchable.prototype.slice = function(start, length) {
    var b;

    if (this.blob.slice) {
        if (length) {
            b = this.blob.slice(start, start + length);
        } else {
            b = this.blob.slice(start);
        }
    } else {
        if (length) {
            b = this.blob.webkitSlice(start, start + length);
        } else {
            b = this.blob.webkitSlice(start);
        }
    }
    return new BlobFetchable(b);
}

BlobFetchable.prototype.salted = function() {return this;}

if (typeof(FileReader) !== 'undefined') {
    // console.log('defining async BlobFetchable.fetch');

    BlobFetchable.prototype.fetch = function(callback) {
        var reader = new FileReader();
        reader.onloadend = function(ev) {
            callback(bstringToBuffer(reader.result));
        };
        reader.readAsBinaryString(this.blob);
    }

} else {
    // if (console && console.log)
    //    console.log('defining sync BlobFetchable.fetch');

    BlobFetchable.prototype.fetch = function(callback) {
        var reader = new FileReaderSync();
        try {
            var res = reader.readAsArrayBuffer(this.blob);
            callback(res);
        } catch (e) {
            callback(null, e);
        }
    }
}

function URLFetchable(url, start, end, opts) {
    if (!opts) {
        if (typeof start === 'object') {
            opts = start;
            start = undefined;
        } else {
            opts = {};
        }
    }

    this.url = url;
    this.start = start || 0;
    if (end) {
        this.end = end;
    }
    this.opts = opts;
}

URLFetchable.prototype.slice = function(s, l) {
    if (s < 0) {
        throw 'Bad slice ' + s;
    }

    var ns = this.start, ne = this.end;
    if (ns && s) {
        ns = ns + s;
    } else {
        ns = s || ns;
    }
    if (l && ns) {
        ne = ns + l - 1;
    } else {
        ne = ne || l - 1;
    }
    return new URLFetchable(this.url, ns, ne, this.opts);
}

var seed=0;
var isSafari = navigator.userAgent.indexOf('Safari') >= 0 && navigator.userAgent.indexOf('Chrome') < 0 ;

URLFetchable.prototype.fetchAsText = function(callback) {
    try {
        var req = new XMLHttpRequest();
        var length;
        var url = this.url;
        if ((isSafari || this.opts.salt) && url.indexOf('?') < 0) {
            url = url + '?salt=' + b64_sha1('' + Date.now() + ',' + (++seed));
        }
        req.open('GET', url, true);

        if (this.end) {
            if (this.end - this.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
            length = this.end - this.start + 1;
        }

        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {
                    return callback(req.responseText);
                } else {
                    return callback(null);
                }
            }
        };
        if (this.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    } catch (e) {
        return callback(null);
    }
}

URLFetchable.prototype.salted = function() {
    var o = shallowCopy(this.opts);
    o.salt = true;
    return new URLFetchable(this.url, this.start, this.end, o);
}

URLFetchable.prototype.fetch = function(callback, opts) {
    var thisB = this;
 
    opts = opts || {};
    var attempt = opts.attempt || 1;
    var truncatedLength = opts.truncatedLength;
    if (attempt > 3) {
        return callback(null);
    }

    try {
        var timeout;
        if (opts.timeout && !this.opts.credentials) {
            timeout = setTimeout(
                function() {
                    console.log('timing out ' + url);
                    req.abort();
                    return callback(null, 'Timeout');
                },
                opts.timeout
            );
        }

        var req = new XMLHttpRequest();
        var length;
        var url = this.url;
        if ((isSafari || this.opts.salt) && url.indexOf('?') < 0) {
            url = url + '?salt=' + b64_sha1('' + Date.now() + ',' + (++seed));
        }
        req.open('GET', url, true);
        req.overrideMimeType('text/plain; charset=x-user-defined');
        if (this.end) {
            if (this.end - this.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + this.start + '-' + this.end);
            length = this.end - this.start + 1;
        }
        req.responseType = 'arraybuffer';
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (timeout)
                    clearTimeout(timeout);
                if (req.status == 200 || req.status == 206) {
                    if (req.response) {
                        var bl = req.response.byteLength;
                        if (length && length != bl && (!truncatedLength || bl != truncatedLength)) {
                            return thisB.fetch(callback, {attempt: attempt + 1, truncatedLength: bl});
                        } else {
                            return callback(req.response);
                        }
                    } else if (req.mozResponseArrayBuffer) {
                        return callback(req.mozResponseArrayBuffer);
                    } else {
                        var r = req.responseText;
                        if (length && length != r.length && (!truncatedLength || r.length != truncatedLength)) {
                            return thisB.fetch(callback, {attempt: attempt + 1, truncatedLength: r.length});
                        } else {
                            return callback(bstringToBuffer(req.responseText));
                        }
                    }
                } else {
                    return thisB.fetch(callback, {attempt: attempt + 1});
                }
            }
        };
        if (this.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    } catch (e) {
        return callback(null);
    }
}

function bstringToBuffer(result) {
    if (!result) {
        return null;
    }

    var ba = new Uint8Array(result.length);
    for (var i = 0; i < ba.length; ++i) {
        ba[i] = result.charCodeAt(i);
    }
    return ba.buffer;
}

// Read from Uint8Array

(function(global) {
    var convertBuffer = new ArrayBuffer(8);
    var ba = new Uint8Array(convertBuffer);
    var fa = new Float32Array(convertBuffer);


    global.readFloat = function(buf, offset) {
        ba[0] = buf[offset];
        ba[1] = buf[offset+1];
        ba[2] = buf[offset+2];
        ba[3] = buf[offset+3];
        return fa[0];
    };
 }(this));

function readInt64(ba, offset) {
    return (ba[offset + 7] << 24) | (ba[offset + 6] << 16) | (ba[offset + 5] << 8) | (ba[offset + 4]);
}

function readInt(ba, offset) {
    return (ba[offset + 3] << 24) | (ba[offset + 2] << 16) | (ba[offset + 1] << 8) | (ba[offset]);
}

function readShort(ba, offset) {
    return (ba[offset + 1] << 8) | (ba[offset]);
}

function readByte(ba, offset) {
    return ba[offset];
}

function readIntBE(ba, offset) {
    return (ba[offset] << 24) | (ba[offset + 1] << 16) | (ba[offset + 2] << 8) | (ba[offset + 3]);
}

// Exports if we are being used as a module

if (typeof(module) !== 'undefined') {
    module.exports = {
        BlobFetchable: BlobFetchable,
        URLFetchable: URLFetchable,

        readInt: readInt,
        readIntBE: readIntBE,
        readInt64: readInt64,
        readShort: readShort,
        readByte: readByte,
        readFloat: this.readFloat
    }
}

},{"./sha1":9,"./utils":11}],4:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// color.js
//

"use strict";

function DColour(red, green, blue, name) {
    this.red = red|0;
    this.green = green|0;
    this.blue = blue|0;
    if (name) {
        this.name = name;
    }
}

DColour.prototype.toSvgString = function() {
    if (!this.name) {
        this.name = "rgb(" + this.red + "," + this.green + "," + this.blue + ")";
    }

    return this.name;
}

function hex2(x) {
    var y = '00' + x.toString(16);
    return y.substring(y.length - 2);
}

DColour.prototype.toHexString = function() {
    return '#' + hex2(this.red) + hex2(this.green) + hex2(this.blue);
}

var palette = {
    red: new DColour(255, 0, 0, 'red'),
    green: new DColour(0, 255, 0, 'green'),
    blue: new DColour(0, 0, 255, 'blue'),
    yellow: new DColour(255, 255, 0, 'yellow'),
    white: new DColour(255, 255, 255, 'white'),
    black: new DColour(0, 0, 0, 'black'),
    gray: new DColour(180, 180, 180, 'gray'),
    grey: new DColour(180, 180, 180, 'grey'),
    lightskyblue: new DColour(135, 206, 250, 'lightskyblue'),
    lightsalmon: new DColour(255, 160, 122, 'lightsalmon'),
    hotpink: new DColour(255, 105, 180, 'hotpink')
};

var COLOR_RE = new RegExp('^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$');
var CSS_COLOR_RE = /rgb\(([0-9]+),([0-9]+),([0-9]+)\)/

function dasColourForName(name) {
    var c = palette[name];
    if (!c) {
        var match = COLOR_RE.exec(name);
        if (match) {
            c = new DColour(('0x' + match[1])|0, ('0x' + match[2])|0, ('0x' + match[3])|0, name);
            palette[name] = c;
        } else {
    	    match = CSS_COLOR_RE.exec(name);
    	    if (match) {
        		c = new DColour(match[1]|0, match[2]|0, match[3]|0, name);
        		palette[name] = c;
	       } else {
		      console.log("couldn't handle color: " + name);
		      c = palette.black;
		      palette[name] = c;
	       }
        }
    }
    return c;
}

function makeColourSteps(steps, stops, colours) {
    var dcolours = [];
    for (var ci = 0; ci < colours.length; ++ci) {
        dcolours.push(dasColourForName(colours[ci]));
    }

    var grad = [];
  STEP_LOOP:
    for (var si = 0; si < steps; ++si) {
        var rs = (1.0 * si) / (steps-1);
        var score = stops[0] + (stops[stops.length -1] - stops[0]) * rs;
        for (var i = 0; i < stops.length - 1; ++i) {
            if (score >= stops[i] && score <= stops[i+1]) {
                var frac = (score - stops[i]) / (stops[i+1] - stops[i]);
                var ca = dcolours[i];
                var cb = dcolours[i+1];

                var fill = new DColour(
                    ((ca.red * (1.0 - frac)) + (cb.red * frac))|0,
                    ((ca.green * (1.0 - frac)) + (cb.green * frac))|0,
                    ((ca.blue * (1.0 - frac)) + (cb.blue * frac))|0
                ).toSvgString();
                grad.push(fill);

                continue STEP_LOOP;
            }
        }
        throw 'Bad step';
    }

    return grad;
}

function makeGradient(steps, color1, color2, color3) {
    if (color3) {
        return makeColourSteps(steps, [0, 0.5, 1], [color1, color2, color3]);
    } else {
        return makeColourSteps(steps, [0, 1], [color1, color2]);
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        makeColourSteps: makeColourSteps,
        makeGradient: makeGradient,
        dasColourForName: dasColourForName
    };
}

},{}],5:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// das.js: queries and low-level data model.
//

"use strict";

if (typeof(require) !== 'undefined') {
    var utils = require('./utils');
    var shallowCopy = utils.shallowCopy;
    var pusho = utils.pusho;

    var color = require('./color');
    var makeColourSteps = color.makeColourSteps;
}

var dasLibErrorHandler = function(errMsg) {
    alert(errMsg);
}
var dasLibRequestQueue = new Array();

function DASSegment(name, start, end, description) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.description = description;
}
DASSegment.prototype.toString = function() {
    return this.name + ':' + this.start + '..' + this.end;
};
DASSegment.prototype.isBounded = function() {
    return this.start && this.end;
}
DASSegment.prototype.toDASQuery = function() {
    var q = 'segment=' + this.name;
    if (this.start && this.end) {
        q += (':' + this.start + ',' + this.end);
    }
    return q;
}


function DASSource(a1, a2) {
    var options;
    if (typeof a1 == 'string') {
        this.uri = a1;
        options = a2 || {};
    } else {
        options = a1 || {};
    }
    for (var k in options) {
        if (typeof(options[k]) != 'function') {
            this[k] = options[k];
        }
    }


    if (!this.coords) {
        this.coords = [];
    }
    if (!this.props) {
        this.props = {};
    }

    this.dasBaseURI = this.uri;
    if (this.dasBaseURI && this.dasBaseURI.substr(this.uri.length - 1) != '/') {
        this.dasBaseURI = this.dasBaseURI + '/';
    }
}

function DASCoords() {
}

function coordsMatch(c1, c2) {
    return c1.taxon == c2.taxon && c1.auth == c2.auth && c1.version == c2.version;
}

//
// DAS 1.6 entry_points command
//

DASSource.prototype.entryPoints = function(callback) {
    var dasURI = this.dasBaseURI + 'entry_points';
    this.doCrossDomainRequest(dasURI, function(responseXML) {
            if (!responseXML) {
                return callback([]);
            }

                var entryPoints = new Array();
                
                var segs = responseXML.getElementsByTagName('SEGMENT');
                for (var i = 0; i < segs.length; ++i) {
                    var seg = segs[i];
                    var segId = seg.getAttribute('id');
                    
                    var segSize = seg.getAttribute('size');
                    var segMin, segMax;
                    if (segSize) {
                        segMin = 1; segMax = segSize|0;
                    } else {
                        segMin = seg.getAttribute('start');
                        if (segMin) {
                            segMin |= 0;
                        }
                        segMax = seg.getAttribute('stop');
                        if (segMax) {
                            segMax |= 0;
                        }
                    }
                    var segDesc = null;
                    if (seg.firstChild) {
                        segDesc = seg.firstChild.nodeValue;
                    }
                    entryPoints.push(new DASSegment(segId, segMin, segMax, segDesc));
                }          
               callback(entryPoints);
    });         
}

//
// DAS 1.6 sequence command
// Do we need an option to fall back to the dna command?
//

function DASSequence(name, start, end, alpha, seq) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.alphabet = alpha;
    this.seq = seq;
}

DASSource.prototype.sequence = function(segment, callback) {
    var dasURI = this.dasBaseURI + 'sequence?' + segment.toDASQuery();
    this.doCrossDomainRequest(dasURI, function(responseXML) {
        if (!responseXML) {
            callback([]);
            return;
        } else {
                var seqs = new Array();
                
                var segs = responseXML.getElementsByTagName('SEQUENCE');
                for (var i = 0; i < segs.length; ++i) {
                    var seg = segs[i];
                    var segId = seg.getAttribute('id');
                    var segMin = seg.getAttribute('start');
                    var segMax = seg.getAttribute('stop');
                    var segAlpha = 'DNA';
                    var segSeq = null;
                    if (seg.firstChild) {
                        var rawSeq = seg.firstChild.nodeValue;
                        segSeq = '';
                        var idx = 0;
                        while (true) {
                            var space = rawSeq.indexOf('\n', idx);
                            if (space >= 0) {
                                segSeq += rawSeq.substring(idx, space).toUpperCase();
                                idx = space + 1;
                            } else {
                                segSeq += rawSeq.substring(idx).toUpperCase();
                                break;
                            }
                        }
                    }
                    seqs.push(new DASSequence(segId, segMin, segMax, segAlpha, segSeq));
                }
                
                callback(seqs);
        }
    });
}

//
// DAS 1.6 features command
//

function DASFeature() {
}

function DASGroup(id) {
    if (id)
        this.id = id;
}

function DASLink(desc, uri) {
    this.desc = desc;
    this.uri = uri;
}

DASSource.prototype.features = function(segment, options, callback) {
    options = options || {};
    var thisB = this;

    var dasURI;
    if (this.features_uri) {
        dasURI = this.features_uri;
    } else {
        var filters = [];

        if (segment) {
            filters.push(segment.toDASQuery());
        } else if (options.group) {
            var g = options.group;
            if (typeof g == 'string') {
                filters.push('group_id=' + g);
            } else {
                for (var gi = 0; gi < g.length; ++gi) {
                    filters.push('group_id=' + g[gi]);
                }
            }
        }

        if (options.adjacent) {
            var adj = options.adjacent;
            if (typeof adj == 'string') {
                adj = [adj];
            }
            for (var ai = 0; ai < adj.length; ++ai) {
                filters.push('adjacent=' + adj[ai]);
            }
        }

        if (options.type) {
            if (typeof options.type == 'string') {
                filters.push('type=' + options.type);
            } else {
                for (var ti = 0; ti < options.type.length; ++ti) {
                    filters.push('type=' + options.type[ti]);
                }
            }
        }
        
        if (options.maxbins) {
            filters.push('maxbins=' + options.maxbins);
        }
        
        if (filters.length > 0) {
            dasURI = this.dasBaseURI + 'features?' + filters.join(';');
        } else {
            callback([], 'No filters specified');
        }
    } 
   

    this.doCrossDomainRequest(dasURI, function(responseXML, req) {
        if (!responseXML) {
            var msg;
            if (req.status == 0) {
                msg = 'server may not support CORS';
            } else {
                msg = 'status=' + req.status;
            }
            callback([], 'Failed request: ' + msg);
            return;
        }
/*      if (req) {
            var caps = req.getResponseHeader('X-DAS-Capabilties');
            if (caps) {
                alert(caps);
            }
        } */

        var features = new Array();
        var segmentMap = {};

        var segs = responseXML.getElementsByTagName('SEGMENT');
        for (var si = 0; si < segs.length; ++si) {
            var segmentXML = segs[si];
            var segmentID = segmentXML.getAttribute('id');
            segmentMap[segmentID] = {
                min: segmentXML.getAttribute('start'),
                max: segmentXML.getAttribute('stop')
            };
            
            var featureXMLs = segmentXML.getElementsByTagName('FEATURE');
            for (var i = 0; i < featureXMLs.length; ++i) {
                var feature = featureXMLs[i];
                var dasFeature = new DASFeature();
                
                dasFeature.segment = segmentID;
                dasFeature.id = feature.getAttribute('id');
                dasFeature.label = feature.getAttribute('label');


/*
                var childNodes = feature.childNodes;
                for (var c = 0; c < childNodes.length; ++c) {
                    var cn = childNodes[c];
                    if (cn.nodeType == Node.ELEMENT_NODE) {
                        var key = cn.tagName;
                        //var val = null;
                        //if (cn.firstChild) {
                        //   val = cn.firstChild.nodeValue;
                        //}
                        dasFeature[key] = 'x';
                    }
                } */


                var spos = elementValue(feature, "START");
                var epos = elementValue(feature, "END");
                if ((spos|0) > (epos|0)) {
                    dasFeature.min = epos|0;
                    dasFeature.max = spos|0;
                } else {
                    dasFeature.min = spos|0;
                    dasFeature.max = epos|0;
                }
                {
                    var tec = feature.getElementsByTagName('TYPE');
                    if (tec.length > 0) {
                        var te = tec[0];
                        if (te.firstChild) {
                            dasFeature.type = te.firstChild.nodeValue;
                        }
                        dasFeature.typeId = te.getAttribute('id');
                        dasFeature.typeCv = te.getAttribute('cvId');
                    }
                }
                dasFeature.type = elementValue(feature, "TYPE");
                if (!dasFeature.type && dasFeature.typeId) {
                    dasFeature.type = dasFeature.typeId; // FIXME?
                }
                
                dasFeature.method = elementValue(feature, "METHOD");
                {
                    var ori = elementValue(feature, "ORIENTATION");
                    if (!ori) {
                        ori = '0';
                    }
                    dasFeature.orientation = ori;
                }
                dasFeature.score = elementValue(feature, "SCORE");
                dasFeature.links = dasLinksOf(feature);
                dasFeature.notes = dasNotesOf(feature);
                
                var groups = feature.getElementsByTagName("GROUP");
                for (var gi  = 0; gi < groups.length; ++gi) {
                    var groupXML = groups[gi];
                    var dasGroup = new DASGroup();
                    dasGroup.type = groupXML.getAttribute('type');
                    dasGroup.id = groupXML.getAttribute('id');
                    dasGroup.links = dasLinksOf(groupXML);
                    dasGroup.notes = dasNotesOf(groupXML);
                    if (!dasFeature.groups) {
                        dasFeature.groups = new Array(dasGroup);
                    } else {
                        dasFeature.groups.push(dasGroup);
                    }
                }

                // Magic notes.  Check with TAD before changing this.
                if (dasFeature.notes) {
                    for (var ni = 0; ni < dasFeature.notes.length; ++ni) {
                        var n = dasFeature.notes[ni];
                        if (n.indexOf('Genename=') == 0) {
                            var gg = new DASGroup();
                            gg.type='gene';
                            gg.id = n.substring(9);
                            if (!dasFeature.groups) {
                                dasFeature.groups = new Array(gg);
                            } else {
                                dasFeature.groups.push(gg);
                            }
                        }
                    }
                }
                
                {
                    var pec = feature.getElementsByTagName('PART');
                    if (pec.length > 0) {
                        var parts = [];
                        for (var pi = 0; pi < pec.length; ++pi) {
                            parts.push(pec[pi].getAttribute('id'));
                        }
                        dasFeature.parts = parts;
                    }
                }
                {
                    var pec = feature.getElementsByTagName('PARENT');
                    if (pec.length > 0) {
                        var parents = [];
                        for (var pi = 0; pi < pec.length; ++pi) {
                            parents.push(pec[pi].getAttribute('id'));
                        }
                        dasFeature.parents = parents;
                    }
                }
                
                features.push(dasFeature);
            }
        }
                
        callback(features, undefined, segmentMap);
    },
    function (err) {
        callback([], err);
    });
}

function DASAlignment(type) {
    this.type = type;
    this.objects = {};
    this.blocks = [];
}

DASSource.prototype.alignments = function(segment, options, callback) {
    var dasURI = this.dasBaseURI + 'alignment?query=' + segment;
    this.doCrossDomainRequest(dasURI, function(responseXML) {
        if (!responseXML) {
            callback([], 'Failed request ' + dasURI);
            return;
        }

        var alignments = [];
        var aliXMLs = responseXML.getElementsByTagName('alignment');
        for (var ai = 0; ai < aliXMLs.length; ++ai) {
            var aliXML = aliXMLs[ai];
            var ali = new DASAlignment(aliXML.getAttribute('alignType'));
            var objXMLs = aliXML.getElementsByTagName('alignObject');
            for (var oi = 0; oi < objXMLs.length; ++oi) {
                var objXML = objXMLs[oi];
                var obj = {
                    id:          objXML.getAttribute('intObjectId'),
                    accession:   objXML.getAttribute('dbAccessionId'),
                    version:     objXML.getAttribute('objectVersion'),
                    dbSource:    objXML.getAttribute('dbSource'),
                    dbVersion:   objXML.getAttribute('dbVersion')
                };
                ali.objects[obj.id] = obj;
            }
            
            var blockXMLs = aliXML.getElementsByTagName('block');
            for (var bi = 0; bi < blockXMLs.length; ++bi) {
                var blockXML = blockXMLs[bi];
                var block = {
                    order:      blockXML.getAttribute('blockOrder'),
                    segments:   []
                };
                var segXMLs = blockXML.getElementsByTagName('segment');
                for (var si = 0; si < segXMLs.length; ++si) {
                    var segXML = segXMLs[si];
                    var seg = {
                        object:      segXML.getAttribute('intObjectId'),
                        min:         segXML.getAttribute('start'),
                        max:         segXML.getAttribute('end'),
                        strand:      segXML.getAttribute('strand'),
                        cigar:       elementValue(segXML, 'cigar')
                    };
                    block.segments.push(seg);
                }
                ali.blocks.push(block);
            }       
                    
            alignments.push(ali);
        }
        callback(alignments);
    });
}


function DASStylesheet() {
/*
    this.highZoomStyles = new Object();
    this.mediumZoomStyles = new Object();
    this.lowZoomStyles = new Object();
*/

    this.styles = [];
}

DASStylesheet.prototype.pushStyle = function(filters, zoom, style) {
    /*

    if (!zoom) {
        this.highZoomStyles[type] = style;
        this.mediumZoomStyles[type] = style;
        this.lowZoomStyles[type] = style;
    } else if (zoom == 'high') {
        this.highZoomStyles[type] = style;
    } else if (zoom == 'medium') {
        this.mediumZoomStyles[type] = style;
    } else if (zoom == 'low') {
        this.lowZoomStyles[type] = style;
    }

    */

    if (!filters) {
        filters = {type: 'default'};
    }
    var styleHolder = shallowCopy(filters);
    if (zoom) {
        styleHolder.zoom = zoom;
    }
    styleHolder.style = style;
    this.styles.push(styleHolder);
}

function DASStyle() {
}

function parseGradient(grad) {
    var steps = grad.getAttribute('steps');
    if (steps) {
        steps = steps|0;
    } else {
        steps = 50;
    }


    var stops = [];
    var colors = [];
    var se = grad.getElementsByTagName('STOP');
    for (var si = 0; si < se.length; ++si) {
        var stop = se[si];
        stops.push(1.0 * stop.getAttribute('score'));
        colors.push(stop.firstChild.nodeValue);
    }

    return makeColourSteps(steps, stops, colors);
}

DASSource.prototype.stylesheet = function(successCB, failureCB) {
    var dasURI, creds = this.credentials;
    if (this.stylesheet_uri) {
        dasURI = this.stylesheet_uri;
        creds = false;
    } else {
        dasURI = this.dasBaseURI + 'stylesheet';
    }

    doCrossDomainRequest(dasURI, function(responseXML) {
        if (!responseXML) {
            if (failureCB) {
                failureCB();
            } 
            return;
        }
        var stylesheet = new DASStylesheet();
        var typeXMLs = responseXML.getElementsByTagName('TYPE');
        for (var i = 0; i < typeXMLs.length; ++i) {
            var typeStyle = typeXMLs[i];
            
            var filter = {};
            filter.type = typeStyle.getAttribute('id'); // Am I right in thinking that this makes DASSTYLE XML invalid?  Ugh.
            filter.label = typeStyle.getAttribute('label');
            filter.method = typeStyle.getAttribute('method');
            var glyphXMLs = typeStyle.getElementsByTagName('GLYPH');
            for (var gi = 0; gi < glyphXMLs.length; ++gi) {
                var glyphXML = glyphXMLs[gi];
                var zoom = glyphXML.getAttribute('zoom');
                var glyph = childElementOf(glyphXML);
                var style = new DASStyle();
                style.glyph = glyph.localName;
                var child = glyph.firstChild;
        
                while (child) {
                    if (child.nodeType == Node.ELEMENT_NODE) {
                        // alert(child.localName);
                        if (child.localName == 'BGGRAD') {
                            style[child.localName] = parseGradient(child);
                        } else {      
                            style[child.localName] = child.firstChild.nodeValue;
                        }
                    }
                    child = child.nextSibling;
                }
                stylesheet.pushStyle(filter, zoom, style);
            }
        }
        successCB(stylesheet);
    }, creds);
}

//
// sources command
// 

function DASRegistry(uri, opts)
{
    opts = opts || {};
    this.uri = uri;
    this.opts = opts;   
}

DASRegistry.prototype.sources = function(callback, failure, opts)
{
    if (!opts) {
        opts = {};
    }

    var filters = [];
    if (opts.taxon) {
        filters.push('organism=' + opts.taxon);
    }
    if (opts.auth) {
        filters.push('authority=' + opts.auth);
    }
    if (opts.version) {
        filters.push('version=' + opts.version);
    }
    var quri = this.uri;
    if (filters.length > 0) {
        quri = quri + '?' + filters.join('&');   // '&' as a separator to hack around dasregistry.org bug.
    }

    doCrossDomainRequest(quri, function(responseXML) {
        if (!responseXML && failure) {
            failure();
            return;
        }

        var sources = [];       
        var sourceXMLs = responseXML.getElementsByTagName('SOURCE');
        for (var si = 0; si < sourceXMLs.length; ++si) {
            var sourceXML = sourceXMLs[si];
            var versionXMLs = sourceXML.getElementsByTagName('VERSION');
            if (versionXMLs.length < 1) {
                continue;
            }
            var versionXML = versionXMLs[0];

            var coordXMLs = versionXML.getElementsByTagName('COORDINATES');
            var coords = [];
            for (var ci = 0; ci < coordXMLs.length; ++ci) {
                var coordXML = coordXMLs[ci];
                var coord = new DASCoords();
                coord.auth = coordXML.getAttribute('authority');
                coord.taxon = coordXML.getAttribute('taxid');
                coord.version = coordXML.getAttribute('version');
                coords.push(coord);
            }
            
            var caps = [];
            var capXMLs = versionXML.getElementsByTagName('CAPABILITY');
            var uri;
            for (var ci = 0; ci < capXMLs.length; ++ci) {
                var capXML = capXMLs[ci];
                
                caps.push(capXML.getAttribute('type'));

                if (capXML.getAttribute('type') == 'das1:features') {
                    var fep = capXML.getAttribute('query_uri');
                    uri = fep.substring(0, fep.length - ('features'.length));
                }
            }

            var props = {};
            var propXMLs = versionXML.getElementsByTagName('PROP');
            for (var pi = 0; pi < propXMLs.length; ++pi) {
                pusho(props, propXMLs[pi].getAttribute('name'), propXMLs[pi].getAttribute('value'));
            }
            
            if (uri) {
                var source = new DASSource(uri, {
                    source_uri: sourceXML.getAttribute('uri'),
                    name:  sourceXML.getAttribute('title'),
                    desc:  sourceXML.getAttribute('description'),
                    coords: coords,
                    props: props,
                    capabilities: caps
                });
                sources.push(source);
            }
        }
        
        callback(sources);
    });
}


//
// Utility functions
//

function elementValue(element, tag)
{
    var children = element.getElementsByTagName(tag);
    if (children.length > 0 && children[0].firstChild) {
        var c = children[0];
        if (c.childNodes.length == 1) {
            return c.firstChild.nodeValue;
        } else {
            var s = '';
            for (var ni = 0; ni < c.childNodes.length; ++ni) {
                s += c.childNodes[ni].nodeValue;
            }
            return s;
        }

    } else {
        return null;
    }
}

function childElementOf(element)
{
    if (element.hasChildNodes()) {
        var child = element.firstChild;
        do {
            if (child.nodeType == Node.ELEMENT_NODE) {
                return child;
            } 
            child = child.nextSibling;
        } while (child != null);
    }
    return null;
}


function dasLinksOf(element)
{
    var links = new Array();
    var maybeLinkChilden = element.getElementsByTagName('LINK');
    for (var ci = 0; ci < maybeLinkChilden.length; ++ci) {
        var linkXML = maybeLinkChilden[ci];
        if (linkXML.parentNode == element) {
            links.push(new DASLink(linkXML.firstChild ? linkXML.firstChild.nodeValue : 'Unknown', linkXML.getAttribute('href')));
        }
    }
    
    return links;
}

function dasNotesOf(element)
{
    var notes = [];
    var maybeNotes = element.getElementsByTagName('NOTE');
    for (var ni = 0; ni < maybeNotes.length; ++ni) {
        if (maybeNotes[ni].firstChild) {
            notes.push(maybeNotes[ni].firstChild.nodeValue);
        }
    }
    return notes;
}

function doCrossDomainRequest(url, handler, credentials, custAuth) {
    // TODO: explicit error handlers?

    if (window.XDomainRequest) {
        var req = new XDomainRequest();
        req.onload = function() {
            var dom = new ActiveXObject("Microsoft.XMLDOM");
            dom.async = false;
            dom.loadXML(req.responseText);
            handler(dom);
        }
        req.open("get", url);
        req.send('');
    } else {
        try {
            var req = new XMLHttpRequest();
            var timeout = setTimeout(
                function() {
                    console.log('timing out '  + url);
                    req.abort();
                    handler(null, req);
                },
                5000
            );

            req.timeout = 5000;
            req.ontimeout = function() {
                console.log('timeout on ' + url);
            };

            req.onreadystatechange = function() {
                if (req.readyState == 4) {
                    clearTimeout(timeout);
                    if (req.status >= 200 || req.status == 0) {
                        handler(req.responseXML, req);
                    }
                }
            };
            req.open("get", url, true);
            if (credentials) {
                req.withCredentials = true;
            }
            if (custAuth) {
                req.setRequestHeader('X-DAS-Authorisation', custAuth);
            }
            req.overrideMimeType('text/xml');
            req.setRequestHeader('Accept', 'application/xml,*/*');
            req.send('');
        } catch (e) {
            handler(null, req, e);
        }
    }
}

DASSource.prototype.doCrossDomainRequest = function(url, handler, errHandler) {
    var custAuth;
    if (this.xUser) {
        custAuth = 'Basic ' + btoa(this.xUser + ':' + this.xPass);
    }

    try {
        return doCrossDomainRequest(url, handler, this.credentials, custAuth);
    } catch (err) {
        if (errHandler) {
            errHandler(err);
        } else {
            throw err;
        }
    }
}

function isDasBooleanTrue(s) {
    s = ('' + s).toLowerCase();
    return s==='yes' || s==='true';
}

function isDasBooleanNotFalse(s) {
    if (!s)
        return false;

    s = ('' + s).toLowerCase();
    return s!=='no' || s!=='false';
}

function copyStylesheet(ss) {
    var nss = shallowCopy(ss);
    nss.styles = [];
    for (var si = 0; si < ss.styles.length; ++si) {
        var sh = nss.styles[si] = shallowCopy(ss.styles[si]);
        sh._methodRE = sh._labelRE = sh._typeRE = undefined;
        sh.style = shallowCopy(sh.style);
        sh.style.id = undefined;
        sh.style._gradient = undefined;
    }
    return nss;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        DASGroup: DASGroup,
        DASFeature: DASFeature,
        DASStylesheet: DASStylesheet,
        DASStyle: DASStyle,
        DASSource: DASSource,
        DASSegment: DASSegment,
        DASRegistry: DASRegistry,
        DASSequence: DASSequence,
        DASLink: DASLink,

        isDasBooleanTrue: isDasBooleanTrue,
        isDasBooleanNotFalse: isDasBooleanNotFalse,
        copyStylesheet: copyStylesheet,
        coordsMatch: coordsMatch
    };
}

},{"./color":4,"./utils":11}],6:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// encode.js: interface for ENCODE DCC services
//

"use strict";

if (typeof(require) !== 'undefined') {
    var Promise = require('es6-promise').Promise;
}

function lookupEncodeURI(uri, json) {
    if (uri.indexOf('?') < 0)
        uri = uri + '?soft=true';

    return new Promise(function(accept, reject) {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status >= 300) {
                    reject('Error code ' + req.status);
                } else {
                    var resp = JSON.parse(req.response);
                    accept(json ? resp : resp.location);
                }
            }
        };
    
        req.open('GET', uri, true);
        req.setRequestHeader('Accept', 'application/json');
        req.responseType = 'text';
        req.send('');
    });
}

function EncodeURLHolder(url) {
    this.rawurl = url;
}

EncodeURLHolder.prototype.getURLPromise = function() {
    if (this.urlPromise && this.urlPromiseValidity > Date.now()) {
        return this.urlPromise;
    } else {
        this.urlPromise = lookupEncodeURI(this.rawurl, true).then(function(resp) {
            return resp.location;
        });
        this.urlPromiseValidity = Date.now() + (12 * 3600 * 1000);
        return this.urlPromise;
    }
}

function EncodeFetchable(url, start, end, opts) {
    if (!opts) {
        if (typeof start === 'object') {
            opts = start;
            start = undefined;
        } else {
            opts = {};
        }
    }

    this.url = (typeof url === 'string' ? new EncodeURLHolder(url) : url);
    this.start = start || 0;
    if (end) {
        this.end = end;
    }
    this.opts = opts;
}



EncodeFetchable.prototype.slice = function(s, l) {
    if (s < 0) {
        throw 'Bad slice ' + s;
    }

    var ns = this.start, ne = this.end;
    if (ns && s) {
        ns = ns + s;
    } else {
        ns = s || ns;
    }
    if (l && ns) {
        ne = ns + l - 1;
    } else {
        ne = ne || l - 1;
    }
    return new EncodeFetchable(this.url, ns, ne, this.opts);
}

EncodeFetchable.prototype.fetchAsText = function(callback) {
    var self = this;
    var req = new XMLHttpRequest();
    var length;
    self.url.getURLPromise().then(function(url) {
        req.open('GET', url, true);

        if (self.end) {
            if (self.end - self.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + self.start + '-' + self.end);
            length = self.end - self.start + 1;
        }

        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {
                    return callback(req.responseText);
                } else {
                    return callback(null);
                }
            }
        };
        if (self.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    }).catch(function(err) {
        console.log(err);
        return callback(null);
    });
}

EncodeFetchable.prototype.salted = function() {
    return this;
}

EncodeFetchable.prototype.fetch = function(callback, attempt, truncatedLength) {
    var self = this;

    attempt = attempt || 1;
    if (attempt > 3) {
        return callback(null);
    }

    self.url.getURLPromise().then(function (url) {
        var req = new XMLHttpRequest();
        var length;
        req.open('GET', url, true);
        req.overrideMimeType('text/plain; charset=x-user-defined');
        if (self.end) {
            if (self.end - self.start > 100000000) {
                throw 'Monster fetch!';
            }
            req.setRequestHeader('Range', 'bytes=' + self.start + '-' + self.end);
            length = self.end - self.start + 1;
        }
        req.responseType = 'arraybuffer';
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {
                    if (req.response) {
                        var bl = req.response.byteLength;
                        if (length && length != bl && (!truncatedLength || bl != truncatedLength)) {
                            return self.fetch(callback, attempt + 1, bl);
                        } else {
                            return callback(req.response);
                        }
                    } else if (req.mozResponseArrayBuffer) {
                        return callback(req.mozResponseArrayBuffer);
                    } else {
                        var r = req.responseText;
                        if (length && length != r.length && (!truncatedLength || r.length != truncatedLength)) {
                            return self.fetch(callback, attempt + 1, r.length);
                        } else {
                            return callback(bstringToBuffer(req.responseText));
                        }
                    }
                } else {
                    return self.fetch(callback, attempt + 1);
                }
            }
        };
        if (self.opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    }).catch(function(err) {
        console.log(err);
    });
}

function bstringToBuffer(result) {
    if (!result) {
        return null;
    }

    var ba = new Uint8Array(result.length);
    for (var i = 0; i < ba.length; ++i) {
        ba[i] = result.charCodeAt(i);
    }
    return ba.buffer;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        lookupEncodeURI: lookupEncodeURI,
        EncodeFetchable: EncodeFetchable
    };
}

},{"es6-promise":12}],7:[function(require,module,exports){
(function (global){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2014
//
// fetchworker.js
//

"use strict";

var bin = require('./bin');
var bam = require('./bam');
var bigwig = require('./bigwig');
var encode = require('./encode');
var utils = require('./utils');

var connections = {};

var idSeed = 0;

global.newID = function() {
    return 'cn' + (++idSeed);
}

postMessage({tag: 'init'});

self.onmessage = function(event) {
    var d = event.data;
    var command = event.data.command;
    var tag = event.data.tag;

    if (command === 'connectBAM') {
        var id = newID();

        var bamF, baiF, indexChunks;
        if (d.blob) {
            bamF = new bin.BlobFetchable(d.blob);
            baiF = new bin.BlobFetchable(d.indexBlob);
        } else {
            bamF = new bin.URLFetchable(d.uri, {credentials: d.credentials});
            baiF = new bin.URLFetchable(d.indexUri, {credentials: d.credentials});
            indexChunks = d.indexChunks;
        }

        bam.makeBam(bamF, baiF, indexChunks, function(bamObj, err) {
            if (bamObj) {
                connections[id] = new BAMWorkerFetcher(bamObj);
                postMessage({tag: tag, result: id});
            } else {
                postMessage({tag: tag, error: err || "Couldn't fetch BAM"});
            }
        });
    } else if (command === 'connectBBI') {
        var id = newID();
        var bbi;
        if (d.blob) {
            bbi = new bin.BlobFetchable(d.blob);
        } else if (d.transport == 'encode') {
            bbi = new encode.EncodeFetchable(d.uri, {credentials: d.credentials});
        } else {
            bbi = new bin.URLFetchable(d.uri, {credentials: d.credentials});
        }

        bigwig.makeBwg(bbi, function(bwg, err) {
            if (bwg) {
                connections[id] = new BBIWorkerFetcher(bwg);
                postMessage({tag: tag, result: id});
            } else {
                postMessage({tag: tag, error: err || "Couldn't fetch BBI"});
            }
        }, d.uri);
    } else if (command === 'textxhr') {
        utils.textXHR(d.uri, function(resp, err) {
            if (resp) {
                postMessage({tag: tag, result: resp});
            } else {
                postMessage({tag: tag, err: err || "Couldn't fetch resource"});
            }
        });
    } else if (command === 'fetch') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.fetch(d.tag, d.chr, d.min, d.max, d.zoom, d.opts);
    } else if (command === 'leap') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.leap(d.tag, d.chr, d.pos, d.dir);
    } else if (command === 'quantLeap') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.quantLeap(d.tag, d.chr, d.pos, d.dir, d.threshold, d.under);
    } else if (command === 'meta') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.meta(d.tag);
    } else if (command === 'search') {
        var con = connections[event.data.connection];
        if (!con) {
            return postMessage({tag: tag, error: 'No such connection: ' + event.data.connection});
        }

        con.search(d.tag, d.query, d.index);
    } else if (command === 'date') {
        return postMessage({tag: tag, result: Date.now()|0});
    } else {
        postMessage({tag: tag, error: 'Bad command ' + command});
    }
}

function BAMWorkerFetcher(bam) {
    this.bam = bam;
}

BAMWorkerFetcher.prototype.fetch = function(tag, chr, min, max, zoom, opts) {
    opts = opts || {};
    this.bam.fetch(chr, min, max, function(records, err) {
        if (records) {
            postMessage({tag: tag, result: records, time: Date.now()|0});
        } else {
            postMessage({tag: tag, error: err});
        }
    }, opts);
}

function BBIWorkerFetcher(bbi) {
    this.bbi = bbi;
}

BBIWorkerFetcher.prototype.fetch = function(tag, chr, min, max, zoom) {
    if (typeof(zoom) !== 'number')
        zoom = -1;

    var data;
    if (zoom < 0) {
        data = this.bbi.getUnzoomedView();
    } else {
        data = this.bbi.getZoomedView(zoom);
    }

    data.readWigData(chr, min, max, function(features) {
        postMessage({tag: tag, result: features});
    });
}

BBIWorkerFetcher.prototype.meta = function(tag) {
    var scales = [1];
    for (var z = 0; z < this.bbi.zoomLevels.length; ++z) {
        scales.push(this.bbi.zoomLevels[z].reduction);
    }

    var thisB = this;
    var meta = {type: this.bbi.type,
                zoomLevels: scales,
                fieldCount: this.bbi.fieldCount,
                definedFieldCount: this.bbi.definedFieldCount,
                schema: this.bbi.schema};
    if (this.bbi.type === 'bigbed') {
        this.bbi.getExtraIndices(function(ei) {
            if (ei) {
                thisB.extraIndices = ei;
                meta.extraIndices = ei.map(function(i) {return i.field});
            }
            postMessage({tag: tag, result: meta});
        });
    } else {
        postMessage({tag: tag, result: meta});
    }
}

BBIWorkerFetcher.prototype.leap = function(tag, chr, pos, dir) {
    this.bbi.getUnzoomedView().getFirstAdjacent(chr, pos, dir, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}

BBIWorkerFetcher.prototype.quantLeap = function(tag, chr, pos, dir, threshold, under) {
    this.bbi.thresholdSearch(chr, pos, dir, threshold, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}

BBIWorkerFetcher.prototype.search = function(tag, query, index) {
    var is = this.extraIndices[0];
    is.lookup(query, function(result, err) {
        postMessage({tag: tag, result: result, error: err});
    });
}

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./bam":1,"./bigwig":2,"./bin":3,"./encode":6,"./utils":11}],8:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// lh3utils.js: common support for lh3's file formats
//

if (typeof(require) !== 'undefined') {
    var jszlib = require('jszlib');
    var jszlib_inflate_buffer = jszlib.inflateBuffer;
    var arrayCopy = jszlib.arrayCopy;
}

function Vob(b, o) {
    this.block = b;
    this.offset = o;
}

Vob.prototype.toString = function() {
    return '' + this.block + ':' + this.offset;
}

function readVob(ba, offset) {
    var block = ((ba[offset+6] & 0xff) * 0x100000000) + ((ba[offset+5] & 0xff) * 0x1000000) + ((ba[offset+4] & 0xff) * 0x10000) + ((ba[offset+3] & 0xff) * 0x100) + ((ba[offset+2] & 0xff));
    var bint = (ba[offset+1] << 8) | (ba[offset]);
    if (block == 0 && bint == 0) {
        return null;  // Should only happen in the linear index?
    } else {
        return new Vob(block, bint);
    }
}

function unbgzf(data, lim) {
    lim = Math.min(lim || 1, data.byteLength - 50);
    var oBlockList = [];
    var ptr = [0];
    var totalSize = 0;

    while (ptr[0] < lim) {
        var ba = new Uint8Array(data, ptr[0], 12); // FIXME is this enough for all credible BGZF block headers?
        var xlen = (ba[11] << 8) | (ba[10]);
        // dlog('xlen[' + (ptr[0]) +']=' + xlen);
        var unc = jszlib_inflate_buffer(data, 12 + xlen + ptr[0], Math.min(65536, data.byteLength - 12 - xlen - ptr[0]), ptr);
        ptr[0] += 8;
        totalSize += unc.byteLength;
        oBlockList.push(unc);
    }

    if (oBlockList.length == 1) {
        return oBlockList[0];
    } else {
        var out = new Uint8Array(totalSize);
        var cursor = 0;
        for (var i = 0; i < oBlockList.length; ++i) {
            var b = new Uint8Array(oBlockList[i]);
            arrayCopy(b, 0, out, cursor, b.length);
            cursor += b.length;
        }
        return out.buffer;
    }
}

function Chunk(minv, maxv) {
    this.minv = minv; this.maxv = maxv;
}


//
// Binning (transliterated from SAM1.3 spec)
//

/* calculate bin given an alignment covering [beg,end) (zero-based, half-close-half-open) */
function reg2bin(beg, end)
{
    --end;
    if (beg>>14 == end>>14) return ((1<<15)-1)/7 + (beg>>14);
    if (beg>>17 == end>>17) return ((1<<12)-1)/7 + (beg>>17);
    if (beg>>20 == end>>20) return ((1<<9)-1)/7 + (beg>>20);
    if (beg>>23 == end>>23) return ((1<<6)-1)/7 + (beg>>23);
    if (beg>>26 == end>>26) return ((1<<3)-1)/7 + (beg>>26);
    return 0;
}

/* calculate the list of bins that may overlap with region [beg,end) (zero-based) */
var MAX_BIN = (((1<<18)-1)/7);
function reg2bins(beg, end) 
{
    var i = 0, k, list = [];
    --end;
    list.push(0);
    for (k = 1 + (beg>>26); k <= 1 + (end>>26); ++k) list.push(k);
    for (k = 9 + (beg>>23); k <= 9 + (end>>23); ++k) list.push(k);
    for (k = 73 + (beg>>20); k <= 73 + (end>>20); ++k) list.push(k);
    for (k = 585 + (beg>>17); k <= 585 + (end>>17); ++k) list.push(k);
    for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
    return list;
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        unbgzf: unbgzf,
        readVob: readVob,
        reg2bin: reg2bin,
        reg2bins: reg2bins,
        Chunk: Chunk
    };
}
},{"jszlib":24}],9:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS 180-1
 * Version 2.2 Copyright Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

 "use strict";

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s)    { return rstr2hex(rstr_sha1(str2rstr_utf8(s))); }
function b64_sha1(s)    { return rstr2b64(rstr_sha1(str2rstr_utf8(s))); }
function any_sha1(s, e) { return rstr2any(rstr_sha1(str2rstr_utf8(s)), e); }
function hex_hmac_sha1(k, d)
  { return rstr2hex(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d))); }
function b64_hmac_sha1(k, d)
  { return rstr2b64(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d))); }
function any_hmac_sha1(k, d, e)
  { return rstr2any(rstr_hmac_sha1(str2rstr_utf8(k), str2rstr_utf8(d)), e); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc").toLowerCase() == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA1 of a raw string
 */
function rstr_sha1(s)
{
  return binb2rstr(binb_sha1(rstr2binb(s), s.length * 8));
}

/*
 * Calculate the HMAC-SHA1 of a key and some data (raw strings)
 */
function rstr_hmac_sha1(key, data)
{
  var bkey = rstr2binb(key);
  if(bkey.length > 16) bkey = binb_sha1(bkey, key.length * 8);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = binb_sha1(ipad.concat(rstr2binb(data)), 512 + data.length * 8);
  return binb2rstr(binb_sha1(opad.concat(hash), 512 + 160));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input)
{
  // try { hexcase } catch(e) { hexcase=0; }
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var output = "";
  var x;
  for(var i = 0; i < input.length; i++)
  {
    x = input.charCodeAt(i);
    output += hex_tab.charAt((x >>> 4) & 0x0F)
           +  hex_tab.charAt( x        & 0x0F);
  }
  return output;
}

/*
 * Convert a raw string to a base-64 string
 */
function rstr2b64(input)
{
  // try { b64pad } catch(e) { b64pad=''; }
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var output = "";
  var len = input.length;
  for(var i = 0; i < len; i += 3)
  {
    var triplet = (input.charCodeAt(i) << 16)
                | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
                | (i + 2 < len ? input.charCodeAt(i+2)      : 0);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > input.length * 8) output += b64pad;
      else output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
    }
  }
  return output;
}

/*
 * Convert a raw string to an arbitrary string encoding
 */
function rstr2any(input, encoding)
{
  var divisor = encoding.length;
  var remainders = Array();
  var i, q, x, quotient;

  /* Convert to an array of 16-bit big-endian values, forming the dividend */
  var dividend = Array(Math.ceil(input.length / 2));
  for(i = 0; i < dividend.length; i++)
  {
    dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
  }

  /*
   * Repeatedly perform a long division. The binary array forms the dividend,
   * the length of the encoding is the divisor. Once computed, the quotient
   * forms the dividend for the next step. We stop when the dividend is zero.
   * All remainders are stored for later use.
   */
  while(dividend.length > 0)
  {
    quotient = Array();
    x = 0;
    for(i = 0; i < dividend.length; i++)
    {
      x = (x << 16) + dividend[i];
      q = Math.floor(x / divisor);
      x -= q * divisor;
      if(quotient.length > 0 || q > 0)
        quotient[quotient.length] = q;
    }
    remainders[remainders.length] = x;
    dividend = quotient;
  }

  /* Convert the remainders to the output string */
  var output = "";
  for(i = remainders.length - 1; i >= 0; i--)
    output += encoding.charAt(remainders[i]);

  /* Append leading zero equivalents */
  var full_length = Math.ceil(input.length * 8 /
                                    (Math.log(encoding.length) / Math.log(2)))
  for(i = output.length; i < full_length; i++)
    output = encoding[0] + output;

  return output;
}

/*
 * Encode a string as utf-8.
 * For efficiency, this assumes the input is valid utf-16.
 */
function str2rstr_utf8(input)
{
  var output = "";
  var i = -1;
  var x, y;

  while(++i < input.length)
  {
    /* Decode utf-16 surrogate pairs */
    x = input.charCodeAt(i);
    y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
    if(0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF)
    {
      x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
      i++;
    }

    /* Encode output as utf-8 */
    if(x <= 0x7F)
      output += String.fromCharCode(x);
    else if(x <= 0x7FF)
      output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0xFFFF)
      output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0x1FFFFF)
      output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                                    0x80 | ((x >>> 12) & 0x3F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
  }
  return output;
}

/*
 * Encode a string as utf-16
 */
function str2rstr_utf16le(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode( input.charCodeAt(i)        & 0xFF,
                                  (input.charCodeAt(i) >>> 8) & 0xFF);
  return output;
}

function str2rstr_utf16be(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                                   input.charCodeAt(i)        & 0xFF);
  return output;
}

/*
 * Convert a raw string to an array of big-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binb(input)
{
  var output = Array(input.length >> 2);
  for(var i = 0; i < output.length; i++)
    output[i] = 0;
  for(var i = 0; i < input.length * 8; i += 8)
    output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (24 - i % 32);
  return output;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2rstr(input)
{
  var output = "";
  for(var i = 0; i < input.length * 32; i += 8)
    output += String.fromCharCode((input[i>>5] >>> (24 - i % 32)) & 0xFF);
  return output;
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function binb_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = bit_rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(bit_rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = bit_rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

if (typeof(module) !== 'undefined') {
  module.exports = {
    b64_sha1: b64_sha1,
    hex_sha1: hex_sha1
  }
}

},{}],10:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// spans.js: JavaScript Intset/Location port.
//

"use strict";


function Range(min, max)
{
    if (typeof(min) != 'number' || typeof(max) != 'number')
        throw 'Bad range ' + min + ',' + max;
    this._min = min;
    this._max = max;
}

Range.prototype.min = function() {
    return this._min;
}

Range.prototype.max = function() {
    return this._max;
}

Range.prototype.contains = function(pos) {
    return pos >= this._min && pos <= this._max;
}

Range.prototype.isContiguous = function() {
    return true;
}

Range.prototype.ranges = function() {
    return [this];
}

Range.prototype._pushRanges = function(ranges) {
    ranges.push(this);
}

Range.prototype.toString = function() {
    return '[' + this._min + '-' + this._max + ']';
}

function _Compound(ranges) {
    // given: a set of unsorted possibly overlapping ranges
    // sort the input ranges
    var sorted = ranges.sort(_rangeOrder);
    // merge overlaps between adjacent ranges
    var merged = [];
    var current = sorted.shift();
    sorted.forEach(function(range) {
        if (range._min <= current._max) {
            if (range._max > current._max) {
                current._max = range._max;
            }
        }
        else {
            merged.push(current);
            current = range;
        }
    });
    merged.push(current);
    this._ranges = merged;
}

_Compound.prototype.min = function() {
    return this._ranges[0].min();
}

_Compound.prototype.max = function() {
    return this._ranges[this._ranges.length - 1].max();
}

// returns the index of the first range that is not less than pos
_Compound.prototype.lower_bound = function(pos) {
    // first check if pos is out of range
    var r = this.ranges();
    if (pos > this.max()) return r.length;
    if (pos < this.min()) return 0;
    // do a binary search
    var a=0, b=r.length - 1;
    while (a <= b) {
        var m = Math.floor((a+b)/2);
        if (pos > r[m]._max) {
            a = m+1;
        }
        else if (pos < r[m]._min) {
            b = m-1;
        }
        else {
            return m;
        }
    }
    return a;
}

_Compound.prototype.contains = function(pos) {
    var lb = this.lower_bound(pos);
    if (lb < this._ranges.length && this._ranges[lb].contains(pos)) {
        return true;
    }
    return false;
}

_Compound.prototype.insertRange = function(range) {
    var lb = this.lower_bound(range._min);
    if (lb === this._ranges.length) { // range follows this
        this._ranges.push(range);
        return;
    }
    
    var r = this.ranges();
    if (range._max < r[lb]._min) { // range preceeds lb
        this._ranges.splice(lb,0,range);
        return;
    }

    // range overlaps lb (at least)
    if (r[lb]._min < range._min) range._min = r[lb]._min;
    var ub = lb+1;
    while (ub < r.length && r[ub]._min <= range._max) {
        ub++;
    }
    ub--;
    // ub is the upper bound of the new range
    if (r[ub]._max > range._max) range._max = r[ub]._max;
    
    // splice range into this._ranges
    this._ranges.splice(lb,ub-lb+1,range);
    return;
}

_Compound.prototype.isContiguous = function() {
    return this._ranges.length > 1;
}

_Compound.prototype.ranges = function() {
    return this._ranges;
}

_Compound.prototype._pushRanges = function(ranges) {
    for (var ri = 0; ri < this._ranges.length; ++ri)
        ranges.push(this._ranges[ri]);
}

_Compound.prototype.toString = function() {
    var s = '';
    for (var r = 0; r < this._ranges.length; ++r) {
        if (r>0) {
            s = s + ',';
        }
        s = s + this._ranges[r].toString();
    }
    return s;
}

function union(s0, s1) {
    if (! (s0 instanceof _Compound)) {
        if (! (s0 instanceof Array))
            s0 = [s0];
        s0 = new _Compound(s0);
    }
    
    if (s1)
        s0.insertRange(s1);

    return s0;
}

function intersection(s0, s1) {
    var r0 = s0.ranges();
    var r1 = s1.ranges();
    var l0 = r0.length, l1 = r1.length;
    var i0 = 0, i1 = 0;
    var or = [];

    while (i0 < l0 && i1 < l1) {
        var s0 = r0[i0], s1 = r1[i1];
        var lapMin = Math.max(s0.min(), s1.min());
        var lapMax = Math.min(s0.max(), s1.max());
        if (lapMax >= lapMin) {
            or.push(new Range(lapMin, lapMax));
        }
        if (s0.max() > s1.max()) {
            ++i1;
        } else {
            ++i0;
        }
    }
    
    if (or.length == 0) {
        return null; // FIXME
    } else if (or.length == 1) {
        return or[0];
    } else {
        return new _Compound(or);
    }
}

function coverage(s) {
    var tot = 0;
    var rl = s.ranges();
    for (var ri = 0; ri < rl.length; ++ri) {
        var r = rl[ri];
        tot += (r.max() - r.min() + 1);
    }
    return tot;
}



function rangeOrder(a, b)
{
    if (a.min() < b.min()) {
        return -1;
    } else if (a.min() > b.min()) {
        return 1;
    } else if (a.max() < b.max()) {
        return -1;
    } else if (b.max() > a.max()) {
        return 1;
    } else {
        return 0;
    }
}

function _rangeOrder(a, b)
{
    if (a._min < b._min) {
        return -1;
    } else if (a._min > b._min) {
        return 1;
    } else if (a._max < b._max) {
        return -1;
    } else if (b._max > a._max) {
        return 1;
    } else {
        return 0;
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        Range: Range,
        union: union,
        intersection: intersection,
        coverage: coverage,
        rangeOver: rangeOrder,
        _rangeOrder: _rangeOrder
    }
}
},{}],11:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2010
//
// utils.js: odds, sods, and ends.
//

"use strict";

if (typeof(require) !== 'undefined') {
    var sha1 = require('./sha1');
    var b64_sha1 = sha1.b64_sha1;
}

var NUM_REGEXP = new RegExp('[0-9]+');

function stringToNumbersArray(str) {
    var nums = new Array();
    var m;
    while (m = NUM_REGEXP.exec(str)) {
        nums.push(m[0]);
        str=str.substring(m.index + (m[0].length));
    }
    return nums;
}

var STRICT_NUM_REGEXP = new RegExp('^[0-9]+$');

function stringToInt(str) {
    str = str.replace(new RegExp(',', 'g'), '');
    if (!STRICT_NUM_REGEXP.test(str)) {
        return null;
    }
    return str|0;
}

function pushnew(a, v) {
    for (var i = 0; i < a.length; ++i) {
        if (a[i] == v) {
            return;
        }
    }
    a.push(v);
}

function pusho(obj, k, v) {
    if (obj[k]) {
        obj[k].push(v);
    } else {
        obj[k] = [v];
    }
}

function pushnewo(obj, k, v) {
    var a = obj[k];
    if (a) {
        for (var i = 0; i < a.length; ++i) {    // indexOf requires JS16 :-(.
            if (a[i] == v) {
                return;
            }
        }
        a.push(v);
    } else {
        obj[k] = [v];
    }
}


function pick(a, b, c, d)
{
    if (a) {
        return a;
    } else if (b) {
        return b;
    } else if (c) {
        return c;
    } else if (d) {
        return d;
    }
}

function pushnew(l, o)
{
    for (var i = 0; i < l.length; ++i) {
        if (l[i] == o) {
            return;
        }
    }
    l.push(o);
}



function arrayIndexOf(a, x) {
    if (!a) {
        return -1;
    }

    for (var i = 0; i < a.length; ++i) {
        if (a[i] === x) {
            return i;
        }
    }
    return -1;
}

function arrayRemove(a, x) {
    var i = arrayIndexOf(a, x);
    if (i >= 0) {
        a.splice(i, 1);
        return true;
    }
    return false;
}

//
// DOM utilities
//


function makeElement(tag, children, attribs, styles)
{
    var ele = document.createElement(tag);
    if (children) {
        if (! (children instanceof Array)) {
            children = [children];
        }
        for (var i = 0; i < children.length; ++i) {
            var c = children[i];
            if (c) {
                if (typeof c == 'string') {
                    c = document.createTextNode(c);
                } else if (typeof c == 'number') {
                    c = document.createTextNode('' + c);
                }
                ele.appendChild(c);
            }
        }
    }
    
    if (attribs) {
        for (var l in attribs) {
            try {
                ele[l] = attribs[l];
            } catch (e) {
                console.log('error setting ' + l);
                throw(e);
            }
        }
    }
    if (styles) {
        for (var l in styles) {
            ele.style[l] = styles[l];
        }
    }
    return ele;
}

function makeElementNS(namespace, tag, children, attribs)
{
    var ele = document.createElementNS(namespace, tag);
    if (children) {
        if (! (children instanceof Array)) {
            children = [children];
        }
        for (var i = 0; i < children.length; ++i) {
            var c = children[i];
            if (typeof c == 'string') {
                c = document.createTextNode(c);
            }
            ele.appendChild(c);
        }
    }
    
    setAttrs(ele, attribs);
    return ele;
}

var attr_name_cache = {};

function setAttr(node, key, value)
{
    var attr = attr_name_cache[key];
    if (!attr) {
        var _attr = '';
        for (var c = 0; c < key.length; ++c) {
            var cc = key.substring(c, c+1);
            var lcc = cc.toLowerCase();
            if (lcc != cc) {
                _attr = _attr + '-' + lcc;
            } else {
                _attr = _attr + cc;
            }
        }
        attr_name_cache[key] = _attr;
        attr = _attr;
    }
    node.setAttribute(attr, value);
}

function setAttrs(node, attribs)
{
    if (attribs) {
        for (var l in attribs) {
            setAttr(node, l, attribs[l]);
        }
    }
}



function removeChildren(node)
{
    if (!node || !node.childNodes) {
        return;
    }

    while (node.childNodes.length > 0) {
        node.removeChild(node.firstChild);
    }
}



//
// WARNING: not for general use!
//

function miniJSONify(o, exc) {
    if (typeof o === 'undefined') {
        return 'undefined';
    } else if (o == null) {
        return 'null';
    } else if (typeof o == 'string') {
        return "'" + o + "'";
    } else if (typeof o == 'number') {
        return "" + o;
    } else if (typeof o == 'boolean') {
        return "" + o;
    } else if (typeof o == 'object') {
        if (o instanceof Array) {
            var s = null;
            for (var i = 0; i < o.length; ++i) {
                s = (s == null ? '' : (s + ', ')) + miniJSONify(o[i], exc);
            }
            return '[' + (s?s:'') + ']';
        } else {
            exc = exc || {};
            var s = null;
            for (var k in o) {
                if (exc[k])
                    continue;
                if (k != undefined && typeof(o[k]) != 'function') {
                    s = (s == null ? '' : (s + ', ')) + k + ': ' + miniJSONify(o[k], exc);
                }
            }
            return '{' + (s?s:'') + '}';
        }
    } else {
        return (typeof o);
    }
}

function shallowCopy(o) {
    var n = {};
    for (var k in o) {
        n[k] = o[k];
    }
    return n;
}

function Observed(x) {
    this.value = x;
    this.listeners = [];
}

Observed.prototype.addListener = function(f) {
    this.listeners.push(f);
}

Observed.prototype.addListenerAndFire = function(f) {
    this.listeners.push(f);
    f(this.value);
}

Observed.prototype.removeListener = function(f) {
    arrayRemove(this.listeners, f);
}

Observed.prototype.get = function() {
    return this.value;
}

Observed.prototype.set = function(x) {
    this.value = x;
    for (var i = 0; i < this.listeners.length; ++i) {
        this.listeners[i](x);
    }
}

function Awaited() {
    this.queue = [];
}

Awaited.prototype.provide = function(x) {
    if (this.res !== undefined) {
        throw "Resource has already been provided.";
    }

    this.res = x;
    for (var i = 0; i < this.queue.length; ++i) {
        this.queue[i](x);
    }
    this.queue = null;   // avoid leaking closures.
}

Awaited.prototype.await = function(f) {
    if (this.res !== undefined) {
        f(this.res);
        return this.res;
    } else {
        this.queue.push(f);
    }
}

var __dalliance_saltSeed = 0;

function saltURL(url) {
    return url + '?salt=' + b64_sha1('' + Date.now() + ',' + (++__dalliance_saltSeed));
}

function textXHR(url, callback, opts) {
    if (opts && opts.salt) 
        url = saltURL(url);

    try {
        var timeout;
        if (opts.timeout) {
            timeout = setTimeout(
                function() {
                    console.log('timing out ' + url);
                    req.abort();
                    return callback(null, 'Timeout');
                },
                opts.timeout
            );
        }

        var req = new XMLHttpRequest();
        req.onreadystatechange = function() {
    	    if (req.readyState == 4) {
                if (timeout)
                    clearTimeout(timeout);
    	        if (req.status < 200 || req.status >= 300) {
    		    callback(null, 'Error code ' + req.status);
    	        } else {
    		    callback(req.responseText);
    	        }
    	    }
        };
        
        req.open('GET', url, true);
        req.responseType = 'text';

        if (opts && opts.credentials) {
            req.withCredentials = true;
        }
        req.send('');
    } catch (e) {
        callback(null, 'Exception ' + e);
    }
}

function relativeURL(base, rel) {
    // FIXME quite naive -- good enough for trackhubs?

    if (rel.indexOf('http:') == 0 || rel.indexOf('https:') == 0) {
        return rel;
    }

    var li = base.lastIndexOf('/');
    if (li >= 0) {
        return base.substr(0, li + 1) + rel;
    } else {
        return rel;
    }
}

var AMINO_ACID_TRANSLATION = {
    'TTT': 'F',
    'TTC': 'F',
    'TTA': 'L',
    'TTG': 'L',
    'CTT': 'L',
    'CTC': 'L',
    'CTA': 'L',
    'CTG': 'L',
    'ATT': 'I',
    'ATC': 'I',
    'ATA': 'I',
    'ATG': 'M',
    'GTT': 'V',
    'GTC': 'V',
    'GTA': 'V',
    'GTG': 'V',
    'TCT': 'S',
    'TCC': 'S',
    'TCA': 'S',
    'TCG': 'S',
    'CCT': 'P',
    'CCC': 'P',
    'CCA': 'P',
    'CCG': 'P',
    'ACT': 'T',
    'ACC': 'T',
    'ACA': 'T',
    'ACG': 'T',
    'GCT': 'A',
    'GCC': 'A',
    'GCA': 'A',
    'GCG': 'A',
    'TAT': 'Y',
    'TAC': 'Y',
    'TAA': '*',  // stop
    'TAG': '*',  // stop
    'CAT': 'H',
    'CAC': 'H',
    'CAA': 'Q',
    'CAG': 'Q',
    'AAT': 'N',
    'AAC': 'N',
    'AAA': 'K',
    'AAG': 'K',
    'GAT': 'D',
    'GAC': 'D',
    'GAA': 'E',
    'GAG': 'E',
    'TGT': 'C',
    'TGC': 'C',
    'TGA': '*',  // stop
    'TGG': 'W',
    'CGT': 'R',
    'CGC': 'R',
    'CGA': 'R',
    'CGG': 'R',
    'AGT': 'S',
    'AGC': 'S',
    'AGA': 'R',
    'AGG': 'R',
    'GGT': 'G',
    'GGC': 'G',
    'GGA': 'G',
    'GGG': 'G'
}

function resolveUrlToPage(rel) {
    return makeElement('a', null, {href: rel}).href;
}

//
// Missing APIs
// 

if (!('trim' in String.prototype)) {
    String.prototype.trim = function() {
        return this.replace(/^\s+/, '').replace(/\s+$/, '');
    };
}

if (typeof(module) !== 'undefined') {
    module.exports = {
        textXHR: textXHR,
        relativeURL: relativeURL,
        resolveUrlToPage: resolveUrlToPage,
        shallowCopy: shallowCopy,
        pusho: pusho,
        pushnew: pushnew,
        pushnewo: pushnewo,
        arrayIndexOf: arrayIndexOf,
        pick: pick,

        makeElement: makeElement,
        makeElementNS: makeElementNS,
        removeChildren: removeChildren,

        miniJSONify: miniJSONify,

        Observed: Observed,
        Awaited: Awaited,

        AMINO_ACID_TRANSLATION: AMINO_ACID_TRANSLATION
    }
}

},{"./sha1":9}],12:[function(require,module,exports){
"use strict";
var Promise = require("./promise/promise").Promise;
var polyfill = require("./promise/polyfill").polyfill;
exports.Promise = Promise;
exports.polyfill = polyfill;
},{"./promise/polyfill":17,"./promise/promise":18}],13:[function(require,module,exports){
"use strict";
/* global toString */

var isArray = require("./utils").isArray;
var isFunction = require("./utils").isFunction;

/**
  Returns a promise that is fulfilled when all the given promises have been
  fulfilled, or rejected if any of them become rejected. The return promise
  is fulfilled with an array that gives all the values in the order they were
  passed in the `promises` array argument.

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `RSVP.all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error("2"));
  var promise3 = RSVP.reject(new Error("3"));
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @for RSVP
  @param {Array} promises
  @param {String} label
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
*/
function all(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to all.');
  }

  return new Promise(function(resolve, reject) {
    var results = [], remaining = promises.length,
    promise;

    if (remaining === 0) {
      resolve([]);
    }

    function resolver(index) {
      return function(value) {
        resolveAll(index, value);
      };
    }

    function resolveAll(index, value) {
      results[index] = value;
      if (--remaining === 0) {
        resolve(results);
      }
    }

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && isFunction(promise.then)) {
        promise.then(resolver(i), reject);
      } else {
        resolveAll(i, promise);
      }
    }
  });
}

exports.all = all;
},{"./utils":22}],14:[function(require,module,exports){
(function (process,global){
"use strict";
var browserGlobal = (typeof window !== 'undefined') ? window : {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var local = (typeof global !== 'undefined') ? global : (this === undefined? window:this);

// node
function useNextTick() {
  return function() {
    process.nextTick(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function() {
    node.data = (iterations = ++iterations % 2);
  };
}

function useSetTimeout() {
  return function() {
    local.setTimeout(flush, 1);
  };
}

var queue = [];
function flush() {
  for (var i = 0; i < queue.length; i++) {
    var tuple = queue[i];
    var callback = tuple[0], arg = tuple[1];
    callback(arg);
  }
  queue = [];
}

var scheduleFlush;

// Decide what async method to use to triggering processing of queued callbacks:
if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else {
  scheduleFlush = useSetTimeout();
}

function asap(callback, arg) {
  var length = queue.push([callback, arg]);
  if (length === 1) {
    // If length is 1, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    scheduleFlush();
  }
}

exports.asap = asap;
}).call(this,require("1YiZ5S"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"1YiZ5S":23}],15:[function(require,module,exports){
"use strict";
/**
  `RSVP.Promise.cast` returns the same promise if that promise shares a constructor
  with the promise being casted.

  Example:

  ```javascript
  var promise = RSVP.resolve(1);
  var casted = RSVP.Promise.cast(promise);

  console.log(promise === casted); // true
  ```

  In the case of a promise whose constructor does not match, it is assimilated.
  The resulting promise will fulfill or reject based on the outcome of the
  promise being casted.

  In the case of a non-promise, a promise which will fulfill with that value is
  returned.

  Example:

  ```javascript
  var value = 1; // could be a number, boolean, string, undefined...
  var casted = RSVP.Promise.cast(value);

  console.log(value === casted); // false
  console.log(casted instanceof RSVP.Promise) // true

  casted.then(function(val) {
    val === value // => true
  });
  ```

  `RSVP.Promise.cast` is similar to `RSVP.resolve`, but `RSVP.Promise.cast` differs in the
  following ways:
  * `RSVP.Promise.cast` serves as a memory-efficient way of getting a promise, when you
  have something that could either be a promise or a value. RSVP.resolve
  will have the same effect but will create a new promise wrapper if the
  argument is a promise.
  * `RSVP.Promise.cast` is a way of casting incoming thenables or promise subclasses to
  promises of the exact class specified, so that the resulting object's `then` is
  ensured to have the behavior of the constructor you are calling cast on (i.e., RSVP.Promise).

  @method cast
  @for RSVP
  @param {Object} object to be casted
  @return {Promise} promise that is fulfilled when all properties of `promises`
  have been fulfilled, or rejected if any of them become rejected.
*/


function cast(object) {
  /*jshint validthis:true */
  if (object && typeof object === 'object' && object.constructor === this) {
    return object;
  }

  var Promise = this;

  return new Promise(function(resolve) {
    resolve(object);
  });
}

exports.cast = cast;
},{}],16:[function(require,module,exports){
"use strict";
var config = {
  instrument: false
};

function configure(name, value) {
  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}

exports.config = config;
exports.configure = configure;
},{}],17:[function(require,module,exports){
(function (global){
"use strict";
/*global self*/
var RSVPPromise = require("./promise").Promise;
var isFunction = require("./utils").isFunction;

function polyfill() {
  var local;

  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof window !== 'undefined' && window.document) {
    local = window;
  } else {
    local = self;
  }

  var es6PromiseSupport = 
    "Promise" in local &&
    // Some of these methods are missing from
    // Firefox/Chrome experimental implementations
    "cast" in local.Promise &&
    "resolve" in local.Promise &&
    "reject" in local.Promise &&
    "all" in local.Promise &&
    "race" in local.Promise &&
    // Older version of the spec had a resolver object
    // as the arg rather than a function
    (function() {
      var resolve;
      new local.Promise(function(r) { resolve = r; });
      return isFunction(resolve);
    }());

  if (!es6PromiseSupport) {
    local.Promise = RSVPPromise;
  }
}

exports.polyfill = polyfill;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./promise":18,"./utils":22}],18:[function(require,module,exports){
"use strict";
var config = require("./config").config;
var configure = require("./config").configure;
var objectOrFunction = require("./utils").objectOrFunction;
var isFunction = require("./utils").isFunction;
var now = require("./utils").now;
var cast = require("./cast").cast;
var all = require("./all").all;
var race = require("./race").race;
var staticResolve = require("./resolve").resolve;
var staticReject = require("./reject").reject;
var asap = require("./asap").asap;

var counter = 0;

config.async = asap; // default async is asap;

function Promise(resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
  }

  if (!(this instanceof Promise)) {
    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
  }

  this._subscribers = [];

  invokeResolver(resolver, this);
}

function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }

  function rejectPromise(reason) {
    reject(promise, reason);
  }

  try {
    resolver(resolvePromise, rejectPromise);
  } catch(e) {
    rejectPromise(e);
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value, error, succeeded, failed;

  if (hasCallback) {
    try {
      value = callback(detail);
      succeeded = true;
    } catch(e) {
      failed = true;
      error = e;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (handleThenable(promise, value)) {
    return;
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    resolve(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

var PENDING   = void 0;
var SEALED    = 0;
var FULFILLED = 1;
var REJECTED  = 2;

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED]  = onRejection;
}

function publish(promise, settled) {
  var child, callback, subscribers = promise._subscribers, detail = promise._detail;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    invokeCallback(settled, child, callback, detail);
  }

  promise._subscribers = null;
}

Promise.prototype = {
  constructor: Promise,

  _state: undefined,
  _detail: undefined,
  _subscribers: undefined,

  then: function(onFulfillment, onRejection) {
    var promise = this;

    var thenPromise = new this.constructor(function() {});

    if (this._state) {
      var callbacks = arguments;
      config.async(function invokePromiseCallback() {
        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
      });
    } else {
      subscribe(this, thenPromise, onFulfillment, onRejection);
    }

    return thenPromise;
  },

  'catch': function(onRejection) {
    return this.then(null, onRejection);
  }
};

Promise.all = all;
Promise.cast = cast;
Promise.race = race;
Promise.resolve = staticResolve;
Promise.reject = staticReject;

function handleThenable(promise, value) {
  var then = null,
  resolved;

  try {
    if (promise === value) {
      throw new TypeError("A promises callback cannot return that same promise.");
    }

    if (objectOrFunction(value)) {
      then = value.then;

      if (isFunction(then)) {
        then.call(value, function(val) {
          if (resolved) { return true; }
          resolved = true;

          if (value !== val) {
            resolve(promise, val);
          } else {
            fulfill(promise, val);
          }
        }, function(val) {
          if (resolved) { return true; }
          resolved = true;

          reject(promise, val);
        });

        return true;
      }
    }
  } catch (error) {
    if (resolved) { return true; }
    reject(promise, error);
    return true;
  }

  return false;
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (!handleThenable(promise, value)) {
    fulfill(promise, value);
  }
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = value;

  config.async(publishFulfillment, promise);
}

function reject(promise, reason) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = reason;

  config.async(publishRejection, promise);
}

function publishFulfillment(promise) {
  publish(promise, promise._state = FULFILLED);
}

function publishRejection(promise) {
  publish(promise, promise._state = REJECTED);
}

exports.Promise = Promise;
},{"./all":13,"./asap":14,"./cast":15,"./config":16,"./race":19,"./reject":20,"./resolve":21,"./utils":22}],19:[function(require,module,exports){
"use strict";
/* global toString */
var isArray = require("./utils").isArray;

/**
  `RSVP.race` allows you to watch a series of promises and act as soon as the
  first promise given to the `promises` argument fulfills or rejects.

  Example:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 2");
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // result === "promise 2" because it was resolved before promise1
    // was resolved.
  });
  ```

  `RSVP.race` is deterministic in that only the state of the first completed
  promise matters. For example, even if other promises given to the `promises`
  array argument are resolved, but the first completed promise has become
  rejected before the other promises became fulfilled, the returned promise
  will become rejected:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error("promise 2"));
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // Code here never runs because there are rejected promises!
  }, function(reason){
    // reason.message === "promise2" because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  @method race
  @for RSVP
  @param {Array} promises array of promises to observe
  @param {String} label optional string for describing the promise returned.
  Useful for tooling.
  @return {Promise} a promise that becomes fulfilled with the value the first
  completed promises is resolved with if the first completed promise was
  fulfilled, or rejected with the reason that the first completed promise
  was rejected with.
*/
function race(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to race.');
  }
  return new Promise(function(resolve, reject) {
    var results = [], promise;

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && typeof promise.then === 'function') {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
  });
}

exports.race = race;
},{"./utils":22}],20:[function(require,module,exports){
"use strict";
/**
  `RSVP.reject` returns a promise that will become rejected with the passed
  `reason`. `RSVP.reject` is essentially shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @for RSVP
  @param {Any} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become rejected with the given
  `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Promise = this;

  return new Promise(function (resolve, reject) {
    reject(reason);
  });
}

exports.reject = reject;
},{}],21:[function(require,module,exports){
"use strict";
/**
  `RSVP.resolve` returns a promise that will become fulfilled with the passed
  `value`. `RSVP.resolve` is essentially shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @for RSVP
  @param {Any} value value that the returned promise will be resolved with
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve(value) {
  /*jshint validthis:true */
  var Promise = this;
  return new Promise(function(resolve, reject) {
    resolve(value);
  });
}

exports.resolve = resolve;
},{}],22:[function(require,module,exports){
"use strict";
function objectOrFunction(x) {
  return isFunction(x) || (typeof x === "object" && x !== null);
}

function isFunction(x) {
  return typeof x === "function";
}

function isArray(x) {
  return Object.prototype.toString.call(x) === "[object Array]";
}

// Date.now is not available in browsers < IE9
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
var now = Date.now || function() { return new Date().getTime(); };


exports.objectOrFunction = objectOrFunction;
exports.isFunction = isFunction;
exports.isArray = isArray;
exports.now = now;
},{}],23:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],24:[function(require,module,exports){
/* -*- mode: javascript; c-basic-offset: 4; indent-tabs-mode: nil -*- */

// 
// Javascript ZLib
// By Thomas Down 2010-2011
//
// Based very heavily on portions of jzlib (by ymnk@jcraft.com), who in
// turn credits Jean-loup Gailly and Mark Adler for the original zlib code.
//
// inflate.js: ZLib inflate code
//

//
// Shared constants
//

var MAX_WBITS=15; // 32K LZ77 window
var DEF_WBITS=MAX_WBITS;
var MAX_MEM_LEVEL=9;
var MANY=1440;
var BMAX = 15;

// preset dictionary flag in zlib header
var PRESET_DICT=0x20;

var Z_NO_FLUSH=0;
var Z_PARTIAL_FLUSH=1;
var Z_SYNC_FLUSH=2;
var Z_FULL_FLUSH=3;
var Z_FINISH=4;

var Z_DEFLATED=8;

var Z_OK=0;
var Z_STREAM_END=1;
var Z_NEED_DICT=2;
var Z_ERRNO=-1;
var Z_STREAM_ERROR=-2;
var Z_DATA_ERROR=-3;
var Z_MEM_ERROR=-4;
var Z_BUF_ERROR=-5;
var Z_VERSION_ERROR=-6;

var METHOD=0;   // waiting for method byte
var FLAG=1;     // waiting for flag byte
var DICT4=2;    // four dictionary check bytes to go
var DICT3=3;    // three dictionary check bytes to go
var DICT2=4;    // two dictionary check bytes to go
var DICT1=5;    // one dictionary check byte to go
var DICT0=6;    // waiting for inflateSetDictionary
var BLOCKS=7;   // decompressing blocks
var CHECK4=8;   // four check bytes to go
var CHECK3=9;   // three check bytes to go
var CHECK2=10;  // two check bytes to go
var CHECK1=11;  // one check byte to go
var DONE=12;    // finished check, done
var BAD=13;     // got an error--stay here

var inflate_mask = [0x00000000, 0x00000001, 0x00000003, 0x00000007, 0x0000000f, 0x0000001f, 0x0000003f, 0x0000007f, 0x000000ff, 0x000001ff, 0x000003ff, 0x000007ff, 0x00000fff, 0x00001fff, 0x00003fff, 0x00007fff, 0x0000ffff];

var IB_TYPE=0;  // get type bits (3, including end bit)
var IB_LENS=1;  // get lengths for stored
var IB_STORED=2;// processing stored block
var IB_TABLE=3; // get table lengths
var IB_BTREE=4; // get bit lengths tree for a dynamic block
var IB_DTREE=5; // get length, distance trees for a dynamic block
var IB_CODES=6; // processing fixed or dynamic block
var IB_DRY=7;   // output remaining window bytes
var IB_DONE=8;  // finished last block, done
var IB_BAD=9;   // ot a data error--stuck here

var fixed_bl = 9;
var fixed_bd = 5;

var fixed_tl = [
    96,7,256, 0,8,80, 0,8,16, 84,8,115,
    82,7,31, 0,8,112, 0,8,48, 0,9,192,
    80,7,10, 0,8,96, 0,8,32, 0,9,160,
    0,8,0, 0,8,128, 0,8,64, 0,9,224,
    80,7,6, 0,8,88, 0,8,24, 0,9,144,
    83,7,59, 0,8,120, 0,8,56, 0,9,208,
    81,7,17, 0,8,104, 0,8,40, 0,9,176,
    0,8,8, 0,8,136, 0,8,72, 0,9,240,
    80,7,4, 0,8,84, 0,8,20, 85,8,227,
    83,7,43, 0,8,116, 0,8,52, 0,9,200,
    81,7,13, 0,8,100, 0,8,36, 0,9,168,
    0,8,4, 0,8,132, 0,8,68, 0,9,232,
    80,7,8, 0,8,92, 0,8,28, 0,9,152,
    84,7,83, 0,8,124, 0,8,60, 0,9,216,
    82,7,23, 0,8,108, 0,8,44, 0,9,184,
    0,8,12, 0,8,140, 0,8,76, 0,9,248,
    80,7,3, 0,8,82, 0,8,18, 85,8,163,
    83,7,35, 0,8,114, 0,8,50, 0,9,196,
    81,7,11, 0,8,98, 0,8,34, 0,9,164,
    0,8,2, 0,8,130, 0,8,66, 0,9,228,
    80,7,7, 0,8,90, 0,8,26, 0,9,148,
    84,7,67, 0,8,122, 0,8,58, 0,9,212,
    82,7,19, 0,8,106, 0,8,42, 0,9,180,
    0,8,10, 0,8,138, 0,8,74, 0,9,244,
    80,7,5, 0,8,86, 0,8,22, 192,8,0,
    83,7,51, 0,8,118, 0,8,54, 0,9,204,
    81,7,15, 0,8,102, 0,8,38, 0,9,172,
    0,8,6, 0,8,134, 0,8,70, 0,9,236,
    80,7,9, 0,8,94, 0,8,30, 0,9,156,
    84,7,99, 0,8,126, 0,8,62, 0,9,220,
    82,7,27, 0,8,110, 0,8,46, 0,9,188,
    0,8,14, 0,8,142, 0,8,78, 0,9,252,
    96,7,256, 0,8,81, 0,8,17, 85,8,131,
    82,7,31, 0,8,113, 0,8,49, 0,9,194,
    80,7,10, 0,8,97, 0,8,33, 0,9,162,
    0,8,1, 0,8,129, 0,8,65, 0,9,226,
    80,7,6, 0,8,89, 0,8,25, 0,9,146,
    83,7,59, 0,8,121, 0,8,57, 0,9,210,
    81,7,17, 0,8,105, 0,8,41, 0,9,178,
    0,8,9, 0,8,137, 0,8,73, 0,9,242,
    80,7,4, 0,8,85, 0,8,21, 80,8,258,
    83,7,43, 0,8,117, 0,8,53, 0,9,202,
    81,7,13, 0,8,101, 0,8,37, 0,9,170,
    0,8,5, 0,8,133, 0,8,69, 0,9,234,
    80,7,8, 0,8,93, 0,8,29, 0,9,154,
    84,7,83, 0,8,125, 0,8,61, 0,9,218,
    82,7,23, 0,8,109, 0,8,45, 0,9,186,
    0,8,13, 0,8,141, 0,8,77, 0,9,250,
    80,7,3, 0,8,83, 0,8,19, 85,8,195,
    83,7,35, 0,8,115, 0,8,51, 0,9,198,
    81,7,11, 0,8,99, 0,8,35, 0,9,166,
    0,8,3, 0,8,131, 0,8,67, 0,9,230,
    80,7,7, 0,8,91, 0,8,27, 0,9,150,
    84,7,67, 0,8,123, 0,8,59, 0,9,214,
    82,7,19, 0,8,107, 0,8,43, 0,9,182,
    0,8,11, 0,8,139, 0,8,75, 0,9,246,
    80,7,5, 0,8,87, 0,8,23, 192,8,0,
    83,7,51, 0,8,119, 0,8,55, 0,9,206,
    81,7,15, 0,8,103, 0,8,39, 0,9,174,
    0,8,7, 0,8,135, 0,8,71, 0,9,238,
    80,7,9, 0,8,95, 0,8,31, 0,9,158,
    84,7,99, 0,8,127, 0,8,63, 0,9,222,
    82,7,27, 0,8,111, 0,8,47, 0,9,190,
    0,8,15, 0,8,143, 0,8,79, 0,9,254,
    96,7,256, 0,8,80, 0,8,16, 84,8,115,
    82,7,31, 0,8,112, 0,8,48, 0,9,193,

    80,7,10, 0,8,96, 0,8,32, 0,9,161,
    0,8,0, 0,8,128, 0,8,64, 0,9,225,
    80,7,6, 0,8,88, 0,8,24, 0,9,145,
    83,7,59, 0,8,120, 0,8,56, 0,9,209,
    81,7,17, 0,8,104, 0,8,40, 0,9,177,
    0,8,8, 0,8,136, 0,8,72, 0,9,241,
    80,7,4, 0,8,84, 0,8,20, 85,8,227,
    83,7,43, 0,8,116, 0,8,52, 0,9,201,
    81,7,13, 0,8,100, 0,8,36, 0,9,169,
    0,8,4, 0,8,132, 0,8,68, 0,9,233,
    80,7,8, 0,8,92, 0,8,28, 0,9,153,
    84,7,83, 0,8,124, 0,8,60, 0,9,217,
    82,7,23, 0,8,108, 0,8,44, 0,9,185,
    0,8,12, 0,8,140, 0,8,76, 0,9,249,
    80,7,3, 0,8,82, 0,8,18, 85,8,163,
    83,7,35, 0,8,114, 0,8,50, 0,9,197,
    81,7,11, 0,8,98, 0,8,34, 0,9,165,
    0,8,2, 0,8,130, 0,8,66, 0,9,229,
    80,7,7, 0,8,90, 0,8,26, 0,9,149,
    84,7,67, 0,8,122, 0,8,58, 0,9,213,
    82,7,19, 0,8,106, 0,8,42, 0,9,181,
    0,8,10, 0,8,138, 0,8,74, 0,9,245,
    80,7,5, 0,8,86, 0,8,22, 192,8,0,
    83,7,51, 0,8,118, 0,8,54, 0,9,205,
    81,7,15, 0,8,102, 0,8,38, 0,9,173,
    0,8,6, 0,8,134, 0,8,70, 0,9,237,
    80,7,9, 0,8,94, 0,8,30, 0,9,157,
    84,7,99, 0,8,126, 0,8,62, 0,9,221,
    82,7,27, 0,8,110, 0,8,46, 0,9,189,
    0,8,14, 0,8,142, 0,8,78, 0,9,253,
    96,7,256, 0,8,81, 0,8,17, 85,8,131,
    82,7,31, 0,8,113, 0,8,49, 0,9,195,
    80,7,10, 0,8,97, 0,8,33, 0,9,163,
    0,8,1, 0,8,129, 0,8,65, 0,9,227,
    80,7,6, 0,8,89, 0,8,25, 0,9,147,
    83,7,59, 0,8,121, 0,8,57, 0,9,211,
    81,7,17, 0,8,105, 0,8,41, 0,9,179,
    0,8,9, 0,8,137, 0,8,73, 0,9,243,
    80,7,4, 0,8,85, 0,8,21, 80,8,258,
    83,7,43, 0,8,117, 0,8,53, 0,9,203,
    81,7,13, 0,8,101, 0,8,37, 0,9,171,
    0,8,5, 0,8,133, 0,8,69, 0,9,235,
    80,7,8, 0,8,93, 0,8,29, 0,9,155,
    84,7,83, 0,8,125, 0,8,61, 0,9,219,
    82,7,23, 0,8,109, 0,8,45, 0,9,187,
    0,8,13, 0,8,141, 0,8,77, 0,9,251,
    80,7,3, 0,8,83, 0,8,19, 85,8,195,
    83,7,35, 0,8,115, 0,8,51, 0,9,199,
    81,7,11, 0,8,99, 0,8,35, 0,9,167,
    0,8,3, 0,8,131, 0,8,67, 0,9,231,
    80,7,7, 0,8,91, 0,8,27, 0,9,151,
    84,7,67, 0,8,123, 0,8,59, 0,9,215,
    82,7,19, 0,8,107, 0,8,43, 0,9,183,
    0,8,11, 0,8,139, 0,8,75, 0,9,247,
    80,7,5, 0,8,87, 0,8,23, 192,8,0,
    83,7,51, 0,8,119, 0,8,55, 0,9,207,
    81,7,15, 0,8,103, 0,8,39, 0,9,175,
    0,8,7, 0,8,135, 0,8,71, 0,9,239,
    80,7,9, 0,8,95, 0,8,31, 0,9,159,
    84,7,99, 0,8,127, 0,8,63, 0,9,223,
    82,7,27, 0,8,111, 0,8,47, 0,9,191,
    0,8,15, 0,8,143, 0,8,79, 0,9,255
];
var fixed_td = [
    80,5,1, 87,5,257, 83,5,17, 91,5,4097,
    81,5,5, 89,5,1025, 85,5,65, 93,5,16385,
    80,5,3, 88,5,513, 84,5,33, 92,5,8193,
    82,5,9, 90,5,2049, 86,5,129, 192,5,24577,
    80,5,2, 87,5,385, 83,5,25, 91,5,6145,
    81,5,7, 89,5,1537, 85,5,97, 93,5,24577,
    80,5,4, 88,5,769, 84,5,49, 92,5,12289,
    82,5,13, 90,5,3073, 86,5,193, 192,5,24577
];

  // Tables for deflate from PKZIP's appnote.txt.
  var cplens = [ // Copy lengths for literal codes 257..285
        3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
        35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
  ];

  // see note #13 above about 258
  var cplext = [ // Extra bits for literal codes 257..285
        0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
        3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 112, 112  // 112==invalid
  ];

 var cpdist = [ // Copy offsets for distance codes 0..29
        1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
        257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
        8193, 12289, 16385, 24577
  ];

  var cpdext = [ // Extra bits for distance codes
        0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
        7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
        12, 12, 13, 13];

//
// ZStream.java
//

function ZStream() {
}


ZStream.prototype.inflateInit = function(w, nowrap) {
    if (!w) {
	w = DEF_WBITS;
    }
    if (nowrap) {
	nowrap = false;
    }
    this.istate = new Inflate();
    return this.istate.inflateInit(this, nowrap?-w:w);
}

ZStream.prototype.inflate = function(f) {
    if(this.istate==null) return Z_STREAM_ERROR;
    return this.istate.inflate(this, f);
}

ZStream.prototype.inflateEnd = function(){
    if(this.istate==null) return Z_STREAM_ERROR;
    var ret=istate.inflateEnd(this);
    this.istate = null;
    return ret;
}
ZStream.prototype.inflateSync = function(){
    // if(istate == null) return Z_STREAM_ERROR;
    return istate.inflateSync(this);
}
ZStream.prototype.inflateSetDictionary = function(dictionary, dictLength){
    // if(istate == null) return Z_STREAM_ERROR;
    return istate.inflateSetDictionary(this, dictionary, dictLength);
}

/*

  public int deflateInit(int level){
    return deflateInit(level, MAX_WBITS);
  }
  public int deflateInit(int level, boolean nowrap){
    return deflateInit(level, MAX_WBITS, nowrap);
  }
  public int deflateInit(int level, int bits){
    return deflateInit(level, bits, false);
  }
  public int deflateInit(int level, int bits, boolean nowrap){
    dstate=new Deflate();
    return dstate.deflateInit(this, level, nowrap?-bits:bits);
  }
  public int deflate(int flush){
    if(dstate==null){
      return Z_STREAM_ERROR;
    }
    return dstate.deflate(this, flush);
  }
  public int deflateEnd(){
    if(dstate==null) return Z_STREAM_ERROR;
    int ret=dstate.deflateEnd();
    dstate=null;
    return ret;
  }
  public int deflateParams(int level, int strategy){
    if(dstate==null) return Z_STREAM_ERROR;
    return dstate.deflateParams(this, level, strategy);
  }
  public int deflateSetDictionary (byte[] dictionary, int dictLength){
    if(dstate == null)
      return Z_STREAM_ERROR;
    return dstate.deflateSetDictionary(this, dictionary, dictLength);
  }

*/

/*
  // Flush as much pending output as possible. All deflate() output goes
  // through this function so some applications may wish to modify it
  // to avoid allocating a large strm->next_out buffer and copying into it.
  // (See also read_buf()).
  void flush_pending(){
    int len=dstate.pending;

    if(len>avail_out) len=avail_out;
    if(len==0) return;

    if(dstate.pending_buf.length<=dstate.pending_out ||
       next_out.length<=next_out_index ||
       dstate.pending_buf.length<(dstate.pending_out+len) ||
       next_out.length<(next_out_index+len)){
      System.out.println(dstate.pending_buf.length+", "+dstate.pending_out+
			 ", "+next_out.length+", "+next_out_index+", "+len);
      System.out.println("avail_out="+avail_out);
    }

    System.arraycopy(dstate.pending_buf, dstate.pending_out,
		     next_out, next_out_index, len);

    next_out_index+=len;
    dstate.pending_out+=len;
    total_out+=len;
    avail_out-=len;
    dstate.pending-=len;
    if(dstate.pending==0){
      dstate.pending_out=0;
    }
  }

  // Read a new buffer from the current input stream, update the adler32
  // and total number of bytes read.  All deflate() input goes through
  // this function so some applications may wish to modify it to avoid
  // allocating a large strm->next_in buffer and copying from it.
  // (See also flush_pending()).
  int read_buf(byte[] buf, int start, int size) {
    int len=avail_in;

    if(len>size) len=size;
    if(len==0) return 0;

    avail_in-=len;

    if(dstate.noheader==0) {
      adler=_adler.adler32(adler, next_in, next_in_index, len);
    }
    System.arraycopy(next_in, next_in_index, buf, start, len);
    next_in_index  += len;
    total_in += len;
    return len;
  }

  public void free(){
    next_in=null;
    next_out=null;
    msg=null;
    _adler=null;
  }
}
*/


//
// Inflate.java
//

function Inflate() {
    this.was = [0];
}

Inflate.prototype.inflateReset = function(z) {
    if(z == null || z.istate == null) return Z_STREAM_ERROR;
    
    z.total_in = z.total_out = 0;
    z.msg = null;
    z.istate.mode = z.istate.nowrap!=0 ? BLOCKS : METHOD;
    z.istate.blocks.reset(z, null);
    return Z_OK;
}

Inflate.prototype.inflateEnd = function(z){
    if(this.blocks != null)
      this.blocks.free(z);
    this.blocks=null;
    return Z_OK;
}

Inflate.prototype.inflateInit = function(z, w){
    z.msg = null;
    this.blocks = null;

    // handle undocumented nowrap option (no zlib header or check)
    nowrap = 0;
    if(w < 0){
      w = - w;
      nowrap = 1;
    }

    // set window size
    if(w<8 ||w>15){
      this.inflateEnd(z);
      return Z_STREAM_ERROR;
    }
    this.wbits=w;

    z.istate.blocks=new InfBlocks(z, 
				  z.istate.nowrap!=0 ? null : this,
				  1<<w);

    // reset state
    this.inflateReset(z);
    return Z_OK;
  }

Inflate.prototype.inflate = function(z, f){
    var r, b;

    if(z == null || z.istate == null || z.next_in == null)
      return Z_STREAM_ERROR;
    f = f == Z_FINISH ? Z_BUF_ERROR : Z_OK;
    r = Z_BUF_ERROR;
    while (true){
      switch (z.istate.mode){
      case METHOD:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        if(((z.istate.method = z.next_in[z.next_in_index++])&0xf)!=Z_DEFLATED){
          z.istate.mode = BAD;
          z.msg="unknown compression method";
          z.istate.marker = 5;       // can't try inflateSync
          break;
        }
        if((z.istate.method>>4)+8>z.istate.wbits){
          z.istate.mode = BAD;
          z.msg="invalid window size";
          z.istate.marker = 5;       // can't try inflateSync
          break;
        }
        z.istate.mode=FLAG;
      case FLAG:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        b = (z.next_in[z.next_in_index++])&0xff;

        if((((z.istate.method << 8)+b) % 31)!=0){
          z.istate.mode = BAD;
          z.msg = "incorrect header check";
          z.istate.marker = 5;       // can't try inflateSync
          break;
        }

        if((b&PRESET_DICT)==0){
          z.istate.mode = BLOCKS;
          break;
        }
        z.istate.mode = DICT4;
      case DICT4:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need=((z.next_in[z.next_in_index++]&0xff)<<24)&0xff000000;
        z.istate.mode=DICT3;
      case DICT3:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need+=((z.next_in[z.next_in_index++]&0xff)<<16)&0xff0000;
        z.istate.mode=DICT2;
      case DICT2:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need+=((z.next_in[z.next_in_index++]&0xff)<<8)&0xff00;
        z.istate.mode=DICT1;
      case DICT1:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need += (z.next_in[z.next_in_index++]&0xff);
        z.adler = z.istate.need;
        z.istate.mode = DICT0;
        return Z_NEED_DICT;
      case DICT0:
        z.istate.mode = BAD;
        z.msg = "need dictionary";
        z.istate.marker = 0;       // can try inflateSync
        return Z_STREAM_ERROR;
      case BLOCKS:

        r = z.istate.blocks.proc(z, r);
        if(r == Z_DATA_ERROR){
          z.istate.mode = BAD;
          z.istate.marker = 0;     // can try inflateSync
          break;
        }
        if(r == Z_OK){
          r = f;
        }
        if(r != Z_STREAM_END){
          return r;
        }
        r = f;
        z.istate.blocks.reset(z, z.istate.was);
        if(z.istate.nowrap!=0){
          z.istate.mode=DONE;
          break;
        }
        z.istate.mode=CHECK4;
      case CHECK4:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need=((z.next_in[z.next_in_index++]&0xff)<<24)&0xff000000;
        z.istate.mode=CHECK3;
      case CHECK3:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need+=((z.next_in[z.next_in_index++]&0xff)<<16)&0xff0000;
        z.istate.mode = CHECK2;
      case CHECK2:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need+=((z.next_in[z.next_in_index++]&0xff)<<8)&0xff00;
        z.istate.mode = CHECK1;
      case CHECK1:

        if(z.avail_in==0)return r;r=f;

        z.avail_in--; z.total_in++;
        z.istate.need+=(z.next_in[z.next_in_index++]&0xff);

        if(((z.istate.was[0])) != ((z.istate.need))){
          z.istate.mode = BAD;
          z.msg = "incorrect data check";
          z.istate.marker = 5;       // can't try inflateSync
          break;
        }

        z.istate.mode = DONE;
      case DONE:
        return Z_STREAM_END;
      case BAD:
        return Z_DATA_ERROR;
      default:
        return Z_STREAM_ERROR;
      }
    }
  }


Inflate.prototype.inflateSetDictionary = function(z,  dictionary, dictLength) {
    var index=0;
    var length = dictLength;
    if(z==null || z.istate == null|| z.istate.mode != DICT0)
      return Z_STREAM_ERROR;

    if(z._adler.adler32(1, dictionary, 0, dictLength)!=z.adler){
      return Z_DATA_ERROR;
    }

    z.adler = z._adler.adler32(0, null, 0, 0);

    if(length >= (1<<z.istate.wbits)){
      length = (1<<z.istate.wbits)-1;
      index=dictLength - length;
    }
    z.istate.blocks.set_dictionary(dictionary, index, length);
    z.istate.mode = BLOCKS;
    return Z_OK;
  }

//  static private byte[] mark = {(byte)0, (byte)0, (byte)0xff, (byte)0xff};
var mark = [0, 0, 255, 255]

Inflate.prototype.inflateSync = function(z){
    var n;       // number of bytes to look at
    var p;       // pointer to bytes
    var m;       // number of marker bytes found in a row
    var r, w;   // temporaries to save total_in and total_out

    // set up
    if(z == null || z.istate == null)
      return Z_STREAM_ERROR;
    if(z.istate.mode != BAD){
      z.istate.mode = BAD;
      z.istate.marker = 0;
    }
    if((n=z.avail_in)==0)
      return Z_BUF_ERROR;
    p=z.next_in_index;
    m=z.istate.marker;

    // search
    while (n!=0 && m < 4){
      if(z.next_in[p] == mark[m]){
        m++;
      }
      else if(z.next_in[p]!=0){
        m = 0;
      }
      else{
        m = 4 - m;
      }
      p++; n--;
    }

    // restore
    z.total_in += p-z.next_in_index;
    z.next_in_index = p;
    z.avail_in = n;
    z.istate.marker = m;

    // return no joy or set up to restart on a new block
    if(m != 4){
      return Z_DATA_ERROR;
    }
    r=z.total_in;  w=z.total_out;
    this.inflateReset(z);
    z.total_in=r;  z.total_out = w;
    z.istate.mode = BLOCKS;
    return Z_OK;
}

  // Returns true if inflate is currently at the end of a block generated
  // by Z_SYNC_FLUSH or Z_FULL_FLUSH. This function is used by one PPP
  // implementation to provide an additional safety check. PPP uses Z_SYNC_FLUSH
  // but removes the length bytes of the resulting empty stored block. When
  // decompressing, PPP checks that at the end of input packet, inflate is
  // waiting for these length bytes.
Inflate.prototype.inflateSyncPoint = function(z){
    if(z == null || z.istate == null || z.istate.blocks == null)
      return Z_STREAM_ERROR;
    return z.istate.blocks.sync_point();
}


//
// InfBlocks.java
//

var INFBLOCKS_BORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function InfBlocks(z, checkfn, w) {
    this.hufts=new Int32Array(MANY*3);
    this.window=new Uint8Array(w);
    this.end=w;
    this.checkfn = checkfn;
    this.mode = IB_TYPE;
    this.reset(z, null);

    this.left = 0;            // if STORED, bytes left to copy 

    this.table = 0;           // table lengths (14 bits) 
    this.index = 0;           // index into blens (or border) 
    this.blens = null;         // bit lengths of codes 
    this.bb=new Int32Array(1); // bit length tree depth 
    this.tb=new Int32Array(1); // bit length decoding tree 

    this.codes = new InfCodes();

    this.last = 0;            // true if this block is the last block 

  // mode independent information 
    this.bitk = 0;            // bits in bit buffer 
    this.bitb = 0;            // bit buffer 
    this.read = 0;            // window read pointer 
    this.write = 0;           // window write pointer 
    this.check = 0;          // check on output 

    this.inftree=new InfTree();
}




InfBlocks.prototype.reset = function(z, c){
    if(c) c[0]=this.check;
    if(this.mode==IB_CODES){
      this.codes.free(z);
    }
    this.mode=IB_TYPE;
    this.bitk=0;
    this.bitb=0;
    this.read=this.write=0;

    if(this.checkfn)
      z.adler=this.check=z._adler.adler32(0, null, 0, 0);
  }

 InfBlocks.prototype.proc = function(z, r){
    var t;              // temporary storage
    var b;              // bit buffer
    var k;              // bits in bit buffer
    var p;              // input data pointer
    var n;              // bytes available there
    var q;              // output window write pointer
    var m;              // bytes to end of window or read pointer

    // copy input/output information to locals (UPDATE macro restores)
    {p=z.next_in_index;n=z.avail_in;b=this.bitb;k=this.bitk;}
    {q=this.write;m=(q<this.read ? this.read-q-1 : this.end-q);}

    // process input based on current state
    while(true){
      switch (this.mode){
      case IB_TYPE:

	while(k<(3)){
	  if(n!=0){
	    r=Z_OK;
	  }
	  else{
	    this.bitb=b; this.bitk=k; 
	    z.avail_in=n;
	    z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    this.write=q;
	    return this.inflate_flush(z,r);
	  };
	  n--;
	  b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}
	t = (b & 7);
	this.last = t & 1;

	switch (t >>> 1){
        case 0:                         // stored 
          {b>>>=(3);k-=(3);}
          t = k & 7;                    // go to byte boundary

          {b>>>=(t);k-=(t);}
          this.mode = IB_LENS;                  // get length of stored block
          break;
        case 1:                         // fixed
          {
              var bl=new Int32Array(1);
	      var bd=new Int32Array(1);
              var tl=[];
	      var td=[];

	      inflate_trees_fixed(bl, bd, tl, td, z);
              this.codes.init(bl[0], bd[0], tl[0], 0, td[0], 0, z);
          }

          {b>>>=(3);k-=(3);}

          this.mode = IB_CODES;
          break;
        case 2:                         // dynamic

          {b>>>=(3);k-=(3);}

          this.mode = IB_TABLE;
          break;
        case 3:                         // illegal

          {b>>>=(3);k-=(3);}
          this.mode = BAD;
          z.msg = "invalid block type";
          r = Z_DATA_ERROR;

	  this.bitb=b; this.bitk=k; 
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  this.write=q;
	  return this.inflate_flush(z,r);
	}
	break;
      case IB_LENS:
	while(k<(32)){
	  if(n!=0){
	    r=Z_OK;
	  }
	  else{
	    this.bitb=b; this.bitk=k; 
	    z.avail_in=n;
	    z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    this.write=q;
	    return this.inflate_flush(z,r);
	  };
	  n--;
	  b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	if ((((~b) >>> 16) & 0xffff) != (b & 0xffff)){
	  this.mode = BAD;
	  z.msg = "invalid stored block lengths";
	  r = Z_DATA_ERROR;

	  this.bitb=b; this.bitk=k; 
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  this.write=q;
	  return this.inflate_flush(z,r);
	}
	this.left = (b & 0xffff);
	b = k = 0;                       // dump bits
	this.mode = this.left!=0 ? IB_STORED : (this.last!=0 ? IB_DRY : IB_TYPE);
	break;
      case IB_STORED:
	if (n == 0){
	  this.bitb=b; this.bitk=k; 
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  write=q;
	  return this.inflate_flush(z,r);
	}

	if(m==0){
	  if(q==end&&read!=0){
	    q=0; m=(q<this.read ? this.read-q-1 : this.end-q);
	  }
	  if(m==0){
	    this.write=q; 
	    r=this.inflate_flush(z,r);
	    q=this.write; m = (q < this.read ? this.read-q-1 : this.end-q);
	    if(q==this.end && this.read != 0){
	      q=0; m = (q < this.read ? this.read-q-1 : this.end-q);
	    }
	    if(m==0){
	      this.bitb=b; this.bitk=k; 
	      z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      this.write=q;
	      return this.inflate_flush(z,r);
	    }
	  }
	}
	r=Z_OK;

	t = this.left;
	if(t>n) t = n;
	if(t>m) t = m;
	arrayCopy(z.next_in, p, this.window, q, t);
	p += t;  n -= t;
	q += t;  m -= t;
	if ((this.left -= t) != 0)
	  break;
	this.mode = (this.last != 0 ? IB_DRY : IB_TYPE);
	break;
      case IB_TABLE:

	while(k<(14)){
	  if(n!=0){
	    r=Z_OK;
	  }
	  else{
	    this.bitb=b; this.bitk=k; 
	    z.avail_in=n;
	    z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    this.write=q;
	    return this.inflate_flush(z,r);
	  };
	  n--;
	  b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	this.table = t = (b & 0x3fff);
	if ((t & 0x1f) > 29 || ((t >> 5) & 0x1f) > 29)
	  {
	    this.mode = IB_BAD;
	    z.msg = "too many length or distance symbols";
	    r = Z_DATA_ERROR;

	    this.bitb=b; this.bitk=k; 
	    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    this.write=q;
	    return this.inflate_flush(z,r);
	  }
	t = 258 + (t & 0x1f) + ((t >> 5) & 0x1f);
	if(this.blens==null || this.blens.length<t){
	    this.blens=new Int32Array(t);
	}
	else{
	  for(var i=0; i<t; i++){
              this.blens[i]=0;
          }
	}

	{b>>>=(14);k-=(14);}

	this.index = 0;
	mode = IB_BTREE;
      case IB_BTREE:
	while (this.index < 4 + (this.table >>> 10)){
	  while(k<(3)){
	    if(n!=0){
	      r=Z_OK;
	    }
	    else{
	      this.bitb=b; this.bitk=k; 
	      z.avail_in=n;
	      z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      this.write=q;
	      return this.inflate_flush(z,r);
	    };
	    n--;
	    b|=(z.next_in[p++]&0xff)<<k;
	    k+=8;
	  }

	  this.blens[INFBLOCKS_BORDER[this.index++]] = b&7;

	  {b>>>=(3);k-=(3);}
	}

	while(this.index < 19){
	  this.blens[INFBLOCKS_BORDER[this.index++]] = 0;
	}

	this.bb[0] = 7;
	t = this.inftree.inflate_trees_bits(this.blens, this.bb, this.tb, this.hufts, z);
	if (t != Z_OK){
	  r = t;
	  if (r == Z_DATA_ERROR){
	    this.blens=null;
	    this.mode = IB_BAD;
	  }

	  this.bitb=b; this.bitk=k; 
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  write=q;
	  return this.inflate_flush(z,r);
	}

	this.index = 0;
	this.mode = IB_DTREE;
      case IB_DTREE:
	while (true){
	  t = this.table;
	  if(!(this.index < 258 + (t & 0x1f) + ((t >> 5) & 0x1f))){
	    break;
	  }

	  var h; //int[]
	  var i, j, c;

	  t = this.bb[0];

	  while(k<(t)){
	    if(n!=0){
	      r=Z_OK;
	    }
	    else{
	      this.bitb=b; this.bitk=k; 
	      z.avail_in=n;
	      z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      this.write=q;
	      return this.inflate_flush(z,r);
	    };
	    n--;
	    b|=(z.next_in[p++]&0xff)<<k;
	    k+=8;
	  }

//	  if (this.tb[0]==-1){
//            dlog("null...");
//	  }

	  t=this.hufts[(this.tb[0]+(b & inflate_mask[t]))*3+1];
	  c=this.hufts[(this.tb[0]+(b & inflate_mask[t]))*3+2];

	  if (c < 16){
	    b>>>=(t);k-=(t);
	    this.blens[this.index++] = c;
	  }
	  else { // c == 16..18
	    i = c == 18 ? 7 : c - 14;
	    j = c == 18 ? 11 : 3;

	    while(k<(t+i)){
	      if(n!=0){
		r=Z_OK;
	      }
	      else{
		this.bitb=b; this.bitk=k; 
		z.avail_in=n;
		z.total_in+=p-z.next_in_index;z.next_in_index=p;
		this.write=q;
		return this.inflate_flush(z,r);
	      };
	      n--;
	      b|=(z.next_in[p++]&0xff)<<k;
	      k+=8;
	    }

	    b>>>=(t);k-=(t);

	    j += (b & inflate_mask[i]);

	    b>>>=(i);k-=(i);

	    i = this.index;
	    t = this.table;
	    if (i + j > 258 + (t & 0x1f) + ((t >> 5) & 0x1f) ||
		(c == 16 && i < 1)){
	      this.blens=null;
	      this.mode = IB_BAD;
	      z.msg = "invalid bit length repeat";
	      r = Z_DATA_ERROR;

	      this.bitb=b; this.bitk=k; 
	      z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      this.write=q;
	      return this.inflate_flush(z,r);
	    }

	    c = c == 16 ? this.blens[i-1] : 0;
	    do{
	      this.blens[i++] = c;
	    }
	    while (--j!=0);
	    this.index = i;
	  }
	}

	this.tb[0]=-1;
	{
	    var bl=new Int32Array(1);
	    var bd=new Int32Array(1);
	    var tl=new Int32Array(1);
	    var td=new Int32Array(1);
	    bl[0] = 9;         // must be <= 9 for lookahead assumptions
	    bd[0] = 6;         // must be <= 9 for lookahead assumptions

	    t = this.table;
	    t = this.inftree.inflate_trees_dynamic(257 + (t & 0x1f), 
					      1 + ((t >> 5) & 0x1f),
					      this.blens, bl, bd, tl, td, this.hufts, z);

	    if (t != Z_OK){
	        if (t == Z_DATA_ERROR){
	            this.blens=null;
	            this.mode = BAD;
	        }
	        r = t;

	        this.bitb=b; this.bitk=k; 
	        z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	        this.write=q;
	        return this.inflate_flush(z,r);
	    }
	    this.codes.init(bl[0], bd[0], this.hufts, tl[0], this.hufts, td[0], z);
	}
	this.mode = IB_CODES;
      case IB_CODES:
	this.bitb=b; this.bitk=k;
	z.avail_in=n; z.total_in+=p-z.next_in_index;z.next_in_index=p;
	this.write=q;

	if ((r = this.codes.proc(this, z, r)) != Z_STREAM_END){
	  return this.inflate_flush(z, r);
	}
	r = Z_OK;
	this.codes.free(z);

	p=z.next_in_index; n=z.avail_in;b=this.bitb;k=this.bitk;
	q=this.write;m = (q < this.read ? this.read-q-1 : this.end-q);

	if (this.last==0){
	  this.mode = IB_TYPE;
	  break;
	}
	this.mode = IB_DRY;
      case IB_DRY:
	this.write=q; 
	r = this.inflate_flush(z, r); 
	q=this.write; m = (q < this.read ? this.read-q-1 : this.end-q);
	if (this.read != this.write){
	  this.bitb=b; this.bitk=k; 
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  this.write=q;
	  return this.inflate_flush(z, r);
	}
	mode = DONE;
      case IB_DONE:
	r = Z_STREAM_END;

	this.bitb=b; this.bitk=k; 
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	this.write=q;
	return this.inflate_flush(z, r);
      case IB_BAD:
	r = Z_DATA_ERROR;

	this.bitb=b; this.bitk=k; 
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	this.write=q;
	return this.inflate_flush(z, r);

      default:
	r = Z_STREAM_ERROR;

	this.bitb=b; this.bitk=k; 
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	this.write=q;
	return this.inflate_flush(z, r);
      }
    }
  }

InfBlocks.prototype.free = function(z){
    this.reset(z, null);
    this.window=null;
    this.hufts=null;
}

InfBlocks.prototype.set_dictionary = function(d, start, n){
    arrayCopy(d, start, window, 0, n);
    this.read = this.write = n;
}

  // Returns true if inflate is currently at the end of a block generated
  // by Z_SYNC_FLUSH or Z_FULL_FLUSH. 
InfBlocks.prototype.sync_point = function(){
    return this.mode == IB_LENS;
}

  // copy as much as possible from the sliding window to the output area
InfBlocks.prototype.inflate_flush = function(z, r){
    var n;
    var p;
    var q;

    // local copies of source and destination pointers
    p = z.next_out_index;
    q = this.read;

    // compute number of bytes to copy as far as end of window
    n = ((q <= this.write ? this.write : this.end) - q);
    if (n > z.avail_out) n = z.avail_out;
    if (n!=0 && r == Z_BUF_ERROR) r = Z_OK;

    // update counters
    z.avail_out -= n;
    z.total_out += n;

    // update check information
    if(this.checkfn != null)
      z.adler=this.check=z._adler.adler32(this.check, this.window, q, n);

    // copy as far as end of window
    arrayCopy(this.window, q, z.next_out, p, n);
    p += n;
    q += n;

    // see if more to copy at beginning of window
    if (q == this.end){
      // wrap pointers
      q = 0;
      if (this.write == this.end)
        this.write = 0;

      // compute bytes to copy
      n = this.write - q;
      if (n > z.avail_out) n = z.avail_out;
      if (n!=0 && r == Z_BUF_ERROR) r = Z_OK;

      // update counters
      z.avail_out -= n;
      z.total_out += n;

      // update check information
      if(this.checkfn != null)
	z.adler=this.check=z._adler.adler32(this.check, this.window, q, n);

      // copy
      arrayCopy(this.window, q, z.next_out, p, n);
      p += n;
      q += n;
    }

    // update pointers
    z.next_out_index = p;
    this.read = q;

    // done
    return r;
  }

//
// InfCodes.java
//

var IC_START=0;  // x: set up for LEN
var IC_LEN=1;    // i: get length/literal/eob next
var IC_LENEXT=2; // i: getting length extra (have base)
var IC_DIST=3;   // i: get distance next
var IC_DISTEXT=4;// i: getting distance extra
var IC_COPY=5;   // o: copying bytes in window, waiting for space
var IC_LIT=6;    // o: got literal, waiting for output space
var IC_WASH=7;   // o: got eob, possibly still output waiting
var IC_END=8;    // x: got eob and all data flushed
var IC_BADCODE=9;// x: got error

function InfCodes() {
}

InfCodes.prototype.init = function(bl, bd, tl, tl_index, td, td_index, z) {
    this.mode=IC_START;
    this.lbits=bl;
    this.dbits=bd;
    this.ltree=tl;
    this.ltree_index=tl_index;
    this.dtree = td;
    this.dtree_index=td_index;
    this.tree=null;
}

InfCodes.prototype.proc = function(s, z, r){ 
    var j;              // temporary storage
    var t;              // temporary pointer (int[])
    var tindex;         // temporary pointer
    var e;              // extra bits or operation
    var b=0;            // bit buffer
    var k=0;            // bits in bit buffer
    var p=0;            // input data pointer
    var n;              // bytes available there
    var q;              // output window write pointer
    var m;              // bytes to end of window or read pointer
    var f;              // pointer to copy strings from

    // copy input/output information to locals (UPDATE macro restores)
    p=z.next_in_index;n=z.avail_in;b=s.bitb;k=s.bitk;
    q=s.write;m=q<s.read?s.read-q-1:s.end-q;

    // process input and output based on current state
    while (true){
      switch (this.mode){
	// waiting for "i:"=input, "o:"=output, "x:"=nothing
      case IC_START:         // x: set up for LEN
	if (m >= 258 && n >= 10){

	  s.bitb=b;s.bitk=k;
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  s.write=q;
	  r = this.inflate_fast(this.lbits, this.dbits, 
			   this.ltree, this.ltree_index, 
			   this.dtree, this.dtree_index,
			   s, z);

	  p=z.next_in_index;n=z.avail_in;b=s.bitb;k=s.bitk;
	  q=s.write;m=q<s.read?s.read-q-1:s.end-q;

	  if (r != Z_OK){
	    this.mode = r == Z_STREAM_END ? IC_WASH : IC_BADCODE;
	    break;
	  }
	}
	this.need = this.lbits;
	this.tree = this.ltree;
	this.tree_index=this.ltree_index;

	this.mode = IC_LEN;
      case IC_LEN:           // i: get length/literal/eob next
	j = this.need;

	while(k<(j)){
	  if(n!=0)r=Z_OK;
	  else{

	    s.bitb=b;s.bitk=k;
	    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    s.write=q;
	    return s.inflate_flush(z,r);
	  }
	  n--;
	  b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	tindex=(this.tree_index+(b&inflate_mask[j]))*3;

	b>>>=(this.tree[tindex+1]);
	k-=(this.tree[tindex+1]);

	e=this.tree[tindex];

	if(e == 0){               // literal
	  this.lit = this.tree[tindex+2];
	  this.mode = IC_LIT;
	  break;
	}
	if((e & 16)!=0 ){          // length
	  this.get = e & 15;
	  this.len = this.tree[tindex+2];
	  this.mode = IC_LENEXT;
	  break;
	}
	if ((e & 64) == 0){        // next table
	  this.need = e;
	  this.tree_index = tindex/3 + this.tree[tindex+2];
	  break;
	}
	if ((e & 32)!=0){               // end of block
	  this.mode = IC_WASH;
	  break;
	}
	this.mode = IC_BADCODE;        // invalid code
	z.msg = "invalid literal/length code";
	r = Z_DATA_ERROR;

	s.bitb=b;s.bitk=k;
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	s.write=q;
	return s.inflate_flush(z,r);

      case IC_LENEXT:        // i: getting length extra (have base)
	j = this.get;

	while(k<(j)){
	  if(n!=0)r=Z_OK;
	  else{

	    s.bitb=b;s.bitk=k;
	    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    s.write=q;
	    return s.inflate_flush(z,r);
	  }
	  n--; b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	this.len += (b & inflate_mask[j]);

	b>>=j;
	k-=j;

	this.need = this.dbits;
	this.tree = this.dtree;
	this.tree_index = this.dtree_index;
	this.mode = IC_DIST;
      case IC_DIST:          // i: get distance next
	j = this.need;

	while(k<(j)){
	  if(n!=0)r=Z_OK;
	  else{

	    s.bitb=b;s.bitk=k;
	    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    s.write=q;
	    return s.inflate_flush(z,r);
	  }
	  n--; b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	tindex=(this.tree_index+(b & inflate_mask[j]))*3;

	b>>=this.tree[tindex+1];
	k-=this.tree[tindex+1];

	e = (this.tree[tindex]);
	if((e & 16)!=0){               // distance
	  this.get = e & 15;
	  this.dist = this.tree[tindex+2];
	  this.mode = IC_DISTEXT;
	  break;
	}
	if ((e & 64) == 0){        // next table
	  this.need = e;
	  this.tree_index = tindex/3 + this.tree[tindex+2];
	  break;
	}
	this.mode = IC_BADCODE;        // invalid code
	z.msg = "invalid distance code";
	r = Z_DATA_ERROR;

	s.bitb=b;s.bitk=k;
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	s.write=q;
	return s.inflate_flush(z,r);

      case IC_DISTEXT:       // i: getting distance extra
	j = this.get;

	while(k<(j)){
	  if(n!=0)r=Z_OK;
	  else{

	    s.bitb=b;s.bitk=k;
	    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	    s.write=q;
	    return s.inflate_flush(z,r);
	  }
	  n--; b|=(z.next_in[p++]&0xff)<<k;
	  k+=8;
	}

	this.dist += (b & inflate_mask[j]);

	b>>=j;
	k-=j;

	this.mode = IC_COPY;
      case IC_COPY:          // o: copying bytes in window, waiting for space
        f = q - this.dist;
        while(f < 0){     // modulo window size-"while" instead
          f += s.end;     // of "if" handles invalid distances
	}
	while (this.len!=0){

	  if(m==0){
	    if(q==s.end&&s.read!=0){q=0;m=q<s.read?s.read-q-1:s.end-q;}
	    if(m==0){
	      s.write=q; r=s.inflate_flush(z,r);
	      q=s.write;m=q<s.read?s.read-q-1:s.end-q;

	      if(q==s.end&&s.read!=0){q=0;m=q<s.read?s.read-q-1:s.end-q;}

	      if(m==0){
		s.bitb=b;s.bitk=k;
		z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
		s.write=q;
		return s.inflate_flush(z,r);
	      }  
	    }
	  }

	  s.window[q++]=s.window[f++]; m--;

	  if (f == s.end)
            f = 0;
	  this.len--;
	}
	this.mode = IC_START;
	break;
      case IC_LIT:           // o: got literal, waiting for output space
	if(m==0){
	  if(q==s.end&&s.read!=0){q=0;m=q<s.read?s.read-q-1:s.end-q;}
	  if(m==0){
	    s.write=q; r=s.inflate_flush(z,r);
	    q=s.write;m=q<s.read?s.read-q-1:s.end-q;

	    if(q==s.end&&s.read!=0){q=0;m=q<s.read?s.read-q-1:s.end-q;}
	    if(m==0){
	      s.bitb=b;s.bitk=k;
	      z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      s.write=q;
	      return s.inflate_flush(z,r);
	    }
	  }
	}
	r=Z_OK;

	s.window[q++]=this.lit; m--;

	this.mode = IC_START;
	break;
      case IC_WASH:           // o: got eob, possibly more output
	if (k > 7){        // return unused byte, if any
	  k -= 8;
	  n++;
	  p--;             // can always return one
	}

	s.write=q; r=s.inflate_flush(z,r);
	q=s.write;m=q<s.read?s.read-q-1:s.end-q;

	if (s.read != s.write){
	  s.bitb=b;s.bitk=k;
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  s.write=q;
	  return s.inflate_flush(z,r);
	}
	this.mode = IC_END;
      case IC_END:
	r = Z_STREAM_END;
	s.bitb=b;s.bitk=k;
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	s.write=q;
	return s.inflate_flush(z,r);

      case IC_BADCODE:       // x: got error

	r = Z_DATA_ERROR;

	s.bitb=b;s.bitk=k;
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	s.write=q;
	return s.inflate_flush(z,r);

      default:
	r = Z_STREAM_ERROR;

	s.bitb=b;s.bitk=k;
	z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	s.write=q;
	return s.inflate_flush(z,r);
      }
    }
  }

InfCodes.prototype.free = function(z){
    //  ZFREE(z, c);
}

  // Called with number of bytes left to write in window at least 258
  // (the maximum string length) and number of input bytes available
  // at least ten.  The ten bytes are six bytes for the longest length/
  // distance pair plus four bytes for overloading the bit buffer.

InfCodes.prototype.inflate_fast = function(bl, bd, tl, tl_index, td, td_index, s, z) {
    var t;                // temporary pointer
    var   tp;             // temporary pointer (int[])
    var tp_index;         // temporary pointer
    var e;                // extra bits or operation
    var b;                // bit buffer
    var k;                // bits in bit buffer
    var p;                // input data pointer
    var n;                // bytes available there
    var q;                // output window write pointer
    var m;                // bytes to end of window or read pointer
    var ml;               // mask for literal/length tree
    var md;               // mask for distance tree
    var c;                // bytes to copy
    var d;                // distance back to copy from
    var r;                // copy source pointer

    var tp_index_t_3;     // (tp_index+t)*3

    // load input, output, bit values
    p=z.next_in_index;n=z.avail_in;b=s.bitb;k=s.bitk;
    q=s.write;m=q<s.read?s.read-q-1:s.end-q;

    // initialize masks
    ml = inflate_mask[bl];
    md = inflate_mask[bd];

    // do until not enough input or output space for fast loop
    do {                          // assume called with m >= 258 && n >= 10
      // get literal/length code
      while(k<(20)){              // max bits for literal/length code
	n--;
	b|=(z.next_in[p++]&0xff)<<k;k+=8;
      }

      t= b&ml;
      tp=tl; 
      tp_index=tl_index;
      tp_index_t_3=(tp_index+t)*3;
      if ((e = tp[tp_index_t_3]) == 0){
	b>>=(tp[tp_index_t_3+1]); k-=(tp[tp_index_t_3+1]);

	s.window[q++] = tp[tp_index_t_3+2];
	m--;
	continue;
      }
      do {

	b>>=(tp[tp_index_t_3+1]); k-=(tp[tp_index_t_3+1]);

	if((e&16)!=0){
	  e &= 15;
	  c = tp[tp_index_t_3+2] + (b & inflate_mask[e]);

	  b>>=e; k-=e;

	  // decode distance base of block to copy
	  while(k<(15)){           // max bits for distance code
	    n--;
	    b|=(z.next_in[p++]&0xff)<<k;k+=8;
	  }

	  t= b&md;
	  tp=td;
	  tp_index=td_index;
          tp_index_t_3=(tp_index+t)*3;
	  e = tp[tp_index_t_3];

	  do {

	    b>>=(tp[tp_index_t_3+1]); k-=(tp[tp_index_t_3+1]);

	    if((e&16)!=0){
	      // get extra bits to add to distance base
	      e &= 15;
	      while(k<(e)){         // get extra bits (up to 13)
		n--;
		b|=(z.next_in[p++]&0xff)<<k;k+=8;
	      }

	      d = tp[tp_index_t_3+2] + (b&inflate_mask[e]);

	      b>>=(e); k-=(e);

	      // do the copy
	      m -= c;
	      if (q >= d){                // offset before dest
		//  just copy
		r=q-d;
		if(q-r>0 && 2>(q-r)){           
		  s.window[q++]=s.window[r++]; // minimum count is three,
		  s.window[q++]=s.window[r++]; // so unroll loop a little
		  c-=2;
		}
		else{
		  s.window[q++]=s.window[r++]; // minimum count is three,
		  s.window[q++]=s.window[r++]; // so unroll loop a little
		  c-=2;
		}
	      }
	      else{                  // else offset after destination
                r=q-d;
                do{
                  r+=s.end;          // force pointer in window
                }while(r<0);         // covers invalid distances
		e=s.end-r;
		if(c>e){             // if source crosses,
		  c-=e;              // wrapped copy
		  if(q-r>0 && e>(q-r)){           
		    do{s.window[q++] = s.window[r++];}
		    while(--e!=0);
		  }
		  else{
		    arrayCopy(s.window, r, s.window, q, e);
		    q+=e; r+=e; e=0;
		  }
		  r = 0;                  // copy rest from start of window
		}

	      }

	      // copy all or what's left
              do{s.window[q++] = s.window[r++];}
		while(--c!=0);
	      break;
	    }
	    else if((e&64)==0){
	      t+=tp[tp_index_t_3+2];
	      t+=(b&inflate_mask[e]);
	      tp_index_t_3=(tp_index+t)*3;
	      e=tp[tp_index_t_3];
	    }
	    else{
	      z.msg = "invalid distance code";

	      c=z.avail_in-n;c=(k>>3)<c?k>>3:c;n+=c;p-=c;k-=c<<3;

	      s.bitb=b;s.bitk=k;
	      z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	      s.write=q;

	      return Z_DATA_ERROR;
	    }
	  }
	  while(true);
	  break;
	}

	if((e&64)==0){
	  t+=tp[tp_index_t_3+2];
	  t+=(b&inflate_mask[e]);
	  tp_index_t_3=(tp_index+t)*3;
	  if((e=tp[tp_index_t_3])==0){

	    b>>=(tp[tp_index_t_3+1]); k-=(tp[tp_index_t_3+1]);

	    s.window[q++]=tp[tp_index_t_3+2];
	    m--;
	    break;
	  }
	}
	else if((e&32)!=0){

	  c=z.avail_in-n;c=(k>>3)<c?k>>3:c;n+=c;p-=c;k-=c<<3;
 
	  s.bitb=b;s.bitk=k;
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  s.write=q;

	  return Z_STREAM_END;
	}
	else{
	  z.msg="invalid literal/length code";

	  c=z.avail_in-n;c=(k>>3)<c?k>>3:c;n+=c;p-=c;k-=c<<3;

	  s.bitb=b;s.bitk=k;
	  z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
	  s.write=q;

	  return Z_DATA_ERROR;
	}
      } 
      while(true);
    } 
    while(m>=258 && n>= 10);

    // not enough input or output--restore pointers and return
    c=z.avail_in-n;c=(k>>3)<c?k>>3:c;n+=c;p-=c;k-=c<<3;

    s.bitb=b;s.bitk=k;
    z.avail_in=n;z.total_in+=p-z.next_in_index;z.next_in_index=p;
    s.write=q;

    return Z_OK;
}

//
// InfTree.java
//

function InfTree() {
}

InfTree.prototype.huft_build = function(b, bindex, n, s, d, e, t, m, hp, hn, v) {

    // Given a list of code lengths and a maximum table size, make a set of
    // tables to decode that set of codes.  Return Z_OK on success, Z_BUF_ERROR
    // if the given code set is incomplete (the tables are still built in this
    // case), Z_DATA_ERROR if the input is invalid (an over-subscribed set of
    // lengths), or Z_MEM_ERROR if not enough memory.

    var a;                       // counter for codes of length k
    var f;                       // i repeats in table every f entries
    var g;                       // maximum code length
    var h;                       // table level
    var i;                       // counter, current code
    var j;                       // counter
    var k;                       // number of bits in current code
    var l;                       // bits per table (returned in m)
    var mask;                    // (1 << w) - 1, to avoid cc -O bug on HP
    var p;                       // pointer into c[], b[], or v[]
    var q;                       // points to current table
    var w;                       // bits before this table == (l * h)
    var xp;                      // pointer into x
    var y;                       // number of dummy codes added
    var z;                       // number of entries in current table

    // Generate counts for each bit length

    p = 0; i = n;
    do {
      this.c[b[bindex+p]]++; p++; i--;   // assume all entries <= BMAX
    }while(i!=0);

    if(this.c[0] == n){                // null input--all zero length codes
      t[0] = -1;
      m[0] = 0;
      return Z_OK;
    }

    // Find minimum and maximum length, bound *m by those
    l = m[0];
    for (j = 1; j <= BMAX; j++)
      if(this.c[j]!=0) break;
    k = j;                        // minimum code length
    if(l < j){
      l = j;
    }
    for (i = BMAX; i!=0; i--){
      if(this.c[i]!=0) break;
    }
    g = i;                        // maximum code length
    if(l > i){
      l = i;
    }
    m[0] = l;

    // Adjust last length count to fill out codes, if needed
    for (y = 1 << j; j < i; j++, y <<= 1){
      if ((y -= this.c[j]) < 0){
        return Z_DATA_ERROR;
      }
    }
    if ((y -= this.c[i]) < 0){
      return Z_DATA_ERROR;
    }
    this.c[i] += y;

    // Generate starting offsets into the value table for each length
    this.x[1] = j = 0;
    p = 1;  xp = 2;
    while (--i!=0) {                 // note that i == g from above
      this.x[xp] = (j += this.c[p]);
      xp++;
      p++;
    }

    // Make a table of values in order of bit lengths
    i = 0; p = 0;
    do {
      if ((j = b[bindex+p]) != 0){
        this.v[this.x[j]++] = i;
      }
      p++;
    }
    while (++i < n);
    n = this.x[g];                     // set n to length of v

    // Generate the Huffman codes and for each, make the table entries
    this.x[0] = i = 0;                 // first Huffman code is zero
    p = 0;                        // grab values in bit order
    h = -1;                       // no tables yet--level -1
    w = -l;                       // bits decoded == (l * h)
    this.u[0] = 0;                     // just to keep compilers happy
    q = 0;                        // ditto
    z = 0;                        // ditto

    // go through the bit lengths (k already is bits in shortest code)
    for (; k <= g; k++){
      a = this.c[k];
      while (a--!=0){
	// here i is the Huffman code of length k bits for value *p
	// make tables up to required level
        while (k > w + l){
          h++;
          w += l;                 // previous table always l bits
	  // compute minimum size table less than or equal to l bits
          z = g - w;
          z = (z > l) ? l : z;        // table size upper limit
          if((f=1<<(j=k-w))>a+1){     // try a k-w bit table
                                      // too few codes for k-w bit table
            f -= a + 1;               // deduct codes from patterns left
            xp = k;
            if(j < z){
              while (++j < z){        // try smaller tables up to z bits
                if((f <<= 1) <= this.c[++xp])
                  break;              // enough codes to use up j bits
                f -= this.c[xp];           // else deduct codes from patterns
              }
	    }
          }
          z = 1 << j;                 // table entries for j-bit table

	  // allocate new table
          if (this.hn[0] + z > MANY){       // (note: doesn't matter for fixed)
            return Z_DATA_ERROR;       // overflow of MANY
          }
          this.u[h] = q = /*hp+*/ this.hn[0];   // DEBUG
          this.hn[0] += z;
 
	  // connect to last table, if there is one
	  if(h!=0){
            this.x[h]=i;           // save pattern for backing up
            this.r[0]=j;     // bits in this table
            this.r[1]=l;     // bits to dump before this table
            j=i>>>(w - l);
            this.r[2] = (q - this.u[h-1] - j);               // offset to this table
            arrayCopy(this.r, 0, hp, (this.u[h-1]+j)*3, 3); // connect to last table
          }
          else{
            t[0] = q;               // first table is returned result
	  }
        }

	// set up table entry in r
        this.r[1] = (k - w);
        if (p >= n){
          this.r[0] = 128 + 64;      // out of values--invalid code
	}
        else if (v[p] < s){
          this.r[0] = (this.v[p] < 256 ? 0 : 32 + 64);  // 256 is end-of-block
          this.r[2] = this.v[p++];          // simple code is just the value
        }
        else{
          this.r[0]=(e[this.v[p]-s]+16+64); // non-simple--look up in lists
          this.r[2]=d[this.v[p++] - s];
        }

        // fill code-like entries with r
        f=1<<(k-w);
        for (j=i>>>w;j<z;j+=f){
          arrayCopy(this.r, 0, hp, (q+j)*3, 3);
	}

	// backwards increment the k-bit code i
        for (j = 1 << (k - 1); (i & j)!=0; j >>>= 1){
          i ^= j;
	}
        i ^= j;

	// backup over finished tables
        mask = (1 << w) - 1;      // needed on HP, cc -O bug
        while ((i & mask) != this.x[h]){
          h--;                    // don't need to update q
          w -= l;
          mask = (1 << w) - 1;
        }
      }
    }
    // Return Z_BUF_ERROR if we were given an incomplete table
    return y != 0 && g != 1 ? Z_BUF_ERROR : Z_OK;
}

InfTree.prototype.inflate_trees_bits = function(c, bb, tb, hp, z) {
    var result;
    this.initWorkArea(19);
    this.hn[0]=0;
    result = this.huft_build(c, 0, 19, 19, null, null, tb, bb, hp, this.hn, this.v);

    if(result == Z_DATA_ERROR){
      z.msg = "oversubscribed dynamic bit lengths tree";
    }
    else if(result == Z_BUF_ERROR || bb[0] == 0){
      z.msg = "incomplete dynamic bit lengths tree";
      result = Z_DATA_ERROR;
    }
    return result;
}

InfTree.prototype.inflate_trees_dynamic = function(nl, nd, c, bl, bd, tl, td, hp, z) {
    var result;

    // build literal/length tree
    this.initWorkArea(288);
    this.hn[0]=0;
    result = this.huft_build(c, 0, nl, 257, cplens, cplext, tl, bl, hp, this.hn, this.v);
    if (result != Z_OK || bl[0] == 0){
      if(result == Z_DATA_ERROR){
        z.msg = "oversubscribed literal/length tree";
      }
      else if (result != Z_MEM_ERROR){
        z.msg = "incomplete literal/length tree";
        result = Z_DATA_ERROR;
      }
      return result;
    }

    // build distance tree
    this.initWorkArea(288);
    result = this.huft_build(c, nl, nd, 0, cpdist, cpdext, td, bd, hp, this.hn, this.v);

    if (result != Z_OK || (bd[0] == 0 && nl > 257)){
      if (result == Z_DATA_ERROR){
        z.msg = "oversubscribed distance tree";
      }
      else if (result == Z_BUF_ERROR) {
        z.msg = "incomplete distance tree";
        result = Z_DATA_ERROR;
      }
      else if (result != Z_MEM_ERROR){
        z.msg = "empty distance tree with lengths";
        result = Z_DATA_ERROR;
      }
      return result;
    }

    return Z_OK;
}
/*
  static int inflate_trees_fixed(int[] bl,  //literal desired/actual bit depth
                                 int[] bd,  //distance desired/actual bit depth
                                 int[][] tl,//literal/length tree result
                                 int[][] td,//distance tree result 
                                 ZStream z  //for memory allocation
				 ){

*/

function inflate_trees_fixed(bl, bd, tl, td, z) {
    bl[0]=fixed_bl;
    bd[0]=fixed_bd;
    tl[0]=fixed_tl;
    td[0]=fixed_td;
    return Z_OK;
}

InfTree.prototype.initWorkArea = function(vsize){
    if(this.hn==null){
        this.hn=new Int32Array(1);
        this.v=new Int32Array(vsize);
        this.c=new Int32Array(BMAX+1);
        this.r=new Int32Array(3);
        this.u=new Int32Array(BMAX);
        this.x=new Int32Array(BMAX+1);
    }
    if(this.v.length<vsize){ 
        this.v=new Int32Array(vsize); 
    }
    for(var i=0; i<vsize; i++){this.v[i]=0;}
    for(var i=0; i<BMAX+1; i++){this.c[i]=0;}
    for(var i=0; i<3; i++){this.r[i]=0;}
//  for(int i=0; i<BMAX; i++){u[i]=0;}
    arrayCopy(this.c, 0, this.u, 0, BMAX);
//  for(int i=0; i<BMAX+1; i++){x[i]=0;}
    arrayCopy(this.c, 0, this.x, 0, BMAX+1);
}

var testArray = new Uint8Array(1);
var hasSubarray = (typeof testArray.subarray === 'function');
var hasSlice = false; /* (typeof testArray.slice === 'function'); */ // Chrome slice performance is so dire that we're currently not using it...

function arrayCopy(src, srcOffset, dest, destOffset, count) {
    if (count == 0) {
        return;
    } 
    if (!src) {
        throw "Undef src";
    } else if (!dest) {
        throw "Undef dest";
    }

    if (srcOffset == 0 && count == src.length) {
        arrayCopy_fast(src, dest, destOffset);
    } else if (hasSubarray) {
        arrayCopy_fast(src.subarray(srcOffset, srcOffset + count), dest, destOffset); 
    } else if (src.BYTES_PER_ELEMENT == 1 && count > 100) {
        arrayCopy_fast(new Uint8Array(src.buffer, src.byteOffset + srcOffset, count), dest, destOffset);
    } else { 
        arrayCopy_slow(src, srcOffset, dest, destOffset, count);
    }

}

function arrayCopy_slow(src, srcOffset, dest, destOffset, count) {

    // dlog('_slow call: srcOffset=' + srcOffset + '; destOffset=' + destOffset + '; count=' + count);

     for (var i = 0; i < count; ++i) {
        dest[destOffset + i] = src[srcOffset + i];
    }
}

function arrayCopy_fast(src, dest, destOffset) {
    dest.set(src, destOffset);
}


  // largest prime smaller than 65536
var ADLER_BASE=65521; 
  // NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1
var ADLER_NMAX=5552;

function adler32(adler, /* byte[] */ buf,  index, len){
    if(buf == null){ return 1; }

    var s1=adler&0xffff;
    var s2=(adler>>16)&0xffff;
    var k;

    while(len > 0) {
      k=len<ADLER_NMAX?len:ADLER_NMAX;
      len-=k;
      while(k>=16){
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        s1+=buf[index++]&0xff; s2+=s1;
        k-=16;
      }
      if(k!=0){
        do{
          s1+=buf[index++]&0xff; s2+=s1;
        }
        while(--k!=0);
      }
      s1%=ADLER_BASE;
      s2%=ADLER_BASE;
    }
    return (s2<<16)|s1;
}



function jszlib_inflate_buffer(buffer, start, length, afterUncOffset) {
    if (!start) {
        buffer = new Uint8Array(buffer);
    } else if (!length) {
        buffer = new Uint8Array(buffer, start, buffer.byteLength - start);
    } else {
        buffer = new Uint8Array(buffer, start, length);
    }

    var z = new ZStream();
    z.inflateInit(DEF_WBITS, true);
    z.next_in = buffer;
    z.next_in_index = 0;
    z.avail_in = buffer.length;

    var oBlockList = [];
    var totalSize = 0;
    while (true) {
        var obuf = new Uint8Array(32000);
        z.next_out = obuf;
        z.next_out_index = 0;
        z.avail_out = obuf.length;
        var status = z.inflate(Z_NO_FLUSH);
        if (status != Z_OK && status != Z_STREAM_END && status != Z_BUF_ERROR) {
            throw z.msg;
        }
        if (z.avail_out != 0) {
            var newob = new Uint8Array(obuf.length - z.avail_out);
            arrayCopy(obuf, 0, newob, 0, (obuf.length - z.avail_out));
            obuf = newob;
        }
        oBlockList.push(obuf);
        totalSize += obuf.length;
        if (status == Z_STREAM_END || status == Z_BUF_ERROR) {
            break;
        }
    }

    if (afterUncOffset) {
        afterUncOffset[0] = (start || 0) + z.next_in_index;
    }

    if (oBlockList.length == 1) {
        return oBlockList[0].buffer;
    } else {
        var out = new Uint8Array(totalSize);
        var cursor = 0;
        for (var i = 0; i < oBlockList.length; ++i) {
            var b = oBlockList[i];
            arrayCopy(b, 0, out, cursor, b.length);
            cursor += b.length;
        }
        return out.buffer;
    }
}

if (typeof(module) !== 'undefined') {
  module.exports = {
    inflateBuffer: jszlib_inflate_buffer,
    arrayCopy: arrayCopy
  };
}

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL2JhbS5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL2JpZ3dpZy5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL2Jpbi5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL2NvbG9yLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2UvanMvZGFzLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2UvanMvZW5jb2RlLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2UvanMvZmFrZV9kMGU3MDYyOC5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL2xoM3V0aWxzLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2UvanMvc2hhMS5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL2pzL3NwYW5zLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2UvanMvdXRpbHMuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9tYWluLmpzIiwiL1VzZXJzL29sc29uL3NyYy9kYWxsaWFuY2Uvbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hbGwuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2FzYXAuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2Nhc3QuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL2NvbmZpZy5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcG9seWZpbGwuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3Byb21pc2UuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3JhY2UuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3JlamVjdC5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmVzb2x2ZS5qcyIsIi9Vc2Vycy9vbHNvbi9zcmMvZGFsbGlhbmNlL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvdXRpbHMuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvb2xzb24vc3JjL2RhbGxpYW5jZS9ub2RlX21vZHVsZXMvanN6bGliL2pzL2luZmxhdGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeDFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvZUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogLSotIG1vZGU6IGphdmFzY3JpcHQ7IGMtYmFzaWMtb2Zmc2V0OiA0OyBpbmRlbnQtdGFicy1tb2RlOiBuaWwgLSotICovXG5cbi8vIFxuLy8gRGFsbGlhbmNlIEdlbm9tZSBFeHBsb3JlclxuLy8gKGMpIFRob21hcyBEb3duIDIwMDYtMjAxMVxuLy9cbi8vIGJhbS5qczogaW5kZXhlZCBiaW5hcnkgYWxpZ25tZW50c1xuLy9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbmlmICh0eXBlb2YocmVxdWlyZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIHNwYW5zID0gcmVxdWlyZSgnLi9zcGFucycpO1xuICAgIHZhciBSYW5nZSA9IHNwYW5zLlJhbmdlO1xuICAgIHZhciB1bmlvbiA9IHNwYW5zLnVuaW9uO1xuICAgIHZhciBpbnRlcnNlY3Rpb24gPSBzcGFucy5pbnRlcnNlY3Rpb247XG5cbiAgICB2YXIgYmluID0gcmVxdWlyZSgnLi9iaW4nKTtcbiAgICB2YXIgcmVhZEludCA9IGJpbi5yZWFkSW50O1xuICAgIHZhciByZWFkU2hvcnQgPSBiaW4ucmVhZFNob3J0O1xuICAgIHZhciByZWFkQnl0ZSA9IGJpbi5yZWFkQnl0ZTtcbiAgICB2YXIgcmVhZEludDY0ID0gYmluLnJlYWRJbnQ2NDtcbiAgICB2YXIgcmVhZEZsb2F0ID0gYmluLnJlYWRGbG9hdDtcblxuICAgIHZhciBsaDN1dGlscyA9IHJlcXVpcmUoJy4vbGgzdXRpbHMnKTtcbiAgICB2YXIgcmVhZFZvYiA9IGxoM3V0aWxzLnJlYWRWb2I7XG4gICAgdmFyIHVuYmd6ZiA9IGxoM3V0aWxzLnVuYmd6ZjtcbiAgICB2YXIgcmVnMmJpbnMgPSBsaDN1dGlscy5yZWcyYmlucztcbiAgICB2YXIgQ2h1bmsgPSBsaDN1dGlscy5DaHVuaztcbn1cblxuXG52YXIgQkFNX01BR0lDID0gMHgxNGQ0MTQyO1xudmFyIEJBSV9NQUdJQyA9IDB4MTQ5NDE0MjtcblxudmFyIEJhbUZsYWdzID0ge1xuICAgIE1VTFRJUExFX1NFR01FTlRTOiAgICAgICAweDEsXG4gICAgQUxMX1NFR01FTlRTX0FMSUdOOiAgICAgIDB4MixcbiAgICBTRUdNRU5UX1VOTUFQUEVEOiAgICAgICAgMHg0LFxuICAgIE5FWFRfU0VHTUVOVF9VTk1BUFBFRDogICAweDgsXG4gICAgUkVWRVJTRV9DT01QTEVNRU5UOiAgICAgIDB4MTAsXG4gICAgTkVYVF9SRVZFUlNFX0NPTVBMRU1FTlQ6IDB4MjAsXG4gICAgRklSU1RfU0VHTUVOVDogICAgICAgICAgIDB4NDAsXG4gICAgTEFTVF9TRUdNRU5UOiAgICAgICAgICAgIDB4ODAsXG4gICAgU0VDT05EQVJZX0FMSUdOTUVOVDogICAgIDB4MTAwLFxuICAgIFFDX0ZBSUw6ICAgICAgICAgICAgICAgICAweDIwMCxcbiAgICBEVVBMSUNBVEU6ICAgICAgICAgICAgICAgMHg0MDAsXG4gICAgU1VQUExFTUVOVEFSWTogICAgICAgICAgIDB4ODAwXG59O1xuXG5mdW5jdGlvbiBCYW1GaWxlKCkge1xufVxuXG5cbi8vIENhbGN1bGF0ZSB0aGUgbGVuZ3RoIChpbiBieXRlcykgb2YgdGhlIEJBSSByZWYgc3RhcnRpbmcgYXQgb2Zmc2V0LlxuLy8gUmV0dXJucyB7bmJpbiwgbGVuZ3RoLCBtaW5CbG9ja0luZGV4fVxuZnVuY3Rpb24gX2dldEJhaVJlZkxlbmd0aCh1bmNiYSwgb2Zmc2V0KSB7XG4gICAgdmFyIHAgPSBvZmZzZXQ7XG4gICAgdmFyIG5iaW4gPSByZWFkSW50KHVuY2JhLCBwKTsgcCArPSA0O1xuICAgIGZvciAodmFyIGIgPSAwOyBiIDwgbmJpbjsgKytiKSB7XG4gICAgICAgIHZhciBiaW4gPSByZWFkSW50KHVuY2JhLCBwKTtcbiAgICAgICAgdmFyIG5jaG5rID0gcmVhZEludCh1bmNiYSwgcCs0KTtcbiAgICAgICAgcCArPSA4ICsgKG5jaG5rICogMTYpO1xuICAgIH1cbiAgICB2YXIgbmludHYgPSByZWFkSW50KHVuY2JhLCBwKTsgcCArPSA0O1xuXG4gICAgdmFyIG1pbkJsb2NrSW5kZXggPSAxMDAwMDAwMDAwO1xuICAgIHZhciBxID0gcDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5pbnR2OyArK2kpIHtcbiAgICAgICAgdmFyIHYgPSByZWFkVm9iKHVuY2JhLCBxKTsgcSArPSA4O1xuICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgdmFyIGJpID0gdi5ibG9jaztcbiAgICAgICAgICAgIGlmICh2Lm9mZnNldCA+IDApXG4gICAgICAgICAgICAgICAgYmkgKz0gNjU1MzY7XG5cbiAgICAgICAgICAgIGlmIChiaSA8IG1pbkJsb2NrSW5kZXgpXG4gICAgICAgICAgICAgICAgbWluQmxvY2tJbmRleCA9IGJpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcCArPSAobmludHYgKiA4KTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIG1pbkJsb2NrSW5kZXg6IG1pbkJsb2NrSW5kZXgsXG4gICAgICAgIG5iaW46IG5iaW4sXG4gICAgICAgIGxlbmd0aDogcCAtIG9mZnNldFxuICAgIH07XG59XG5cblxuZnVuY3Rpb24gbWFrZUJhbShkYXRhLCBiYWksIGluZGV4Q2h1bmtzLCBjYWxsYmFjaywgYXR0ZW1wdGVkKSB7XG4gICAgdmFyIGJhbSA9IG5ldyBCYW1GaWxlKCk7XG4gICAgYmFtLmRhdGEgPSBkYXRhO1xuICAgIGJhbS5iYWkgPSBiYWk7XG4gICAgYmFtLmluZGV4Q2h1bmtzID0gaW5kZXhDaHVua3M7XG5cbiAgICB2YXIgbWluQmxvY2tJbmRleCA9IGJhbS5pbmRleENodW5rcyA/IGJhbS5pbmRleENodW5rcy5taW5CbG9ja0luZGV4IDogMTAwMDAwMDAwMDtcblxuICAgIC8vIEZpbGxzIG91dCBiYW0uY2hyVG9JbmRleCBhbmQgYmFtLmluZGV4VG9DaHIgYmFzZWQgb24gdGhlIGZpcnN0IGZldyBieXRlcyBvZiB0aGUgQkFNLlxuICAgIGZ1bmN0aW9uIHBhcnNlQmFtSGVhZGVyKHIpIHtcbiAgICAgICAgaWYgKCFyKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgXCJDb3VsZG4ndCBhY2Nlc3MgQkFNXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHVuYyA9IHVuYmd6ZihyLCByLmJ5dGVMZW5ndGgpO1xuICAgICAgICB2YXIgdW5jYmEgPSBuZXcgVWludDhBcnJheSh1bmMpO1xuXG4gICAgICAgIHZhciBtYWdpYyA9IHJlYWRJbnQodW5jYmEsIDApO1xuICAgICAgICBpZiAobWFnaWMgIT0gQkFNX01BR0lDKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgXCJOb3QgYSBCQU0gZmlsZSwgbWFnaWM9MHhcIiArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGhlYWRMZW4gPSByZWFkSW50KHVuY2JhLCA0KTtcbiAgICAgICAgdmFyIGhlYWRlciA9ICcnO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhlYWRMZW47ICsraSkge1xuICAgICAgICAgICAgaGVhZGVyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodW5jYmFbaSArIDhdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBuUmVmID0gcmVhZEludCh1bmNiYSwgaGVhZExlbiArIDgpO1xuICAgICAgICB2YXIgcCA9IGhlYWRMZW4gKyAxMjtcblxuICAgICAgICBiYW0uY2hyVG9JbmRleCA9IHt9O1xuICAgICAgICBiYW0uaW5kZXhUb0NociA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5SZWY7ICsraSkge1xuICAgICAgICAgICAgdmFyIGxOYW1lID0gcmVhZEludCh1bmNiYSwgcCk7XG4gICAgICAgICAgICB2YXIgbmFtZSA9ICcnO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBsTmFtZS0xOyArK2opIHtcbiAgICAgICAgICAgICAgICBuYW1lICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodW5jYmFbcCArIDQgKyBqXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgbFJlZiA9IHJlYWRJbnQodW5jYmEsIHAgKyBsTmFtZSArIDQpO1xuICAgICAgICAgICAgYmFtLmNoclRvSW5kZXhbbmFtZV0gPSBpO1xuICAgICAgICAgICAgaWYgKG5hbWUuaW5kZXhPZignY2hyJykgPT0gMCkge1xuICAgICAgICAgICAgICAgIGJhbS5jaHJUb0luZGV4W25hbWUuc3Vic3RyaW5nKDMpXSA9IGk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJhbS5jaHJUb0luZGV4WydjaHInICsgbmFtZV0gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmFtLmluZGV4VG9DaHIucHVzaChuYW1lKTtcblxuICAgICAgICAgICAgcCA9IHAgKyA4ICsgbE5hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYmFtLmluZGljZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhiYW0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGFyc2VCYWkoaGVhZGVyKSB7XG4gICAgICAgIGlmICghaGVhZGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJDb3VsZG4ndCBhY2Nlc3MgQkFJXCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdW5jYmEgPSBuZXcgVWludDhBcnJheShoZWFkZXIpO1xuICAgICAgICB2YXIgYmFpTWFnaWMgPSByZWFkSW50KHVuY2JhLCAwKTtcbiAgICAgICAgaWYgKGJhaU1hZ2ljICE9IEJBSV9NQUdJQykge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsICdOb3QgYSBCQUkgZmlsZSwgbWFnaWM9MHgnICsgYmFpTWFnaWMudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBucmVmID0gcmVhZEludCh1bmNiYSwgNCk7XG5cbiAgICAgICAgYmFtLmluZGljZXMgPSBbXTtcblxuICAgICAgICB2YXIgcCA9IDg7XG4gICAgICAgIGZvciAodmFyIHJlZiA9IDA7IHJlZiA8IG5yZWY7ICsrcmVmKSB7XG4gICAgICAgICAgICB2YXIgYmxvY2tTdGFydCA9IHA7XG4gICAgICAgICAgICB2YXIgbyA9IF9nZXRCYWlSZWZMZW5ndGgodW5jYmEsIGJsb2NrU3RhcnQpO1xuICAgICAgICAgICAgcCArPSBvLmxlbmd0aDtcblxuICAgICAgICAgICAgbWluQmxvY2tJbmRleCA9IE1hdGgubWluKG8ubWluQmxvY2tJbmRleCwgbWluQmxvY2tJbmRleCk7XG5cbiAgICAgICAgICAgIHZhciBuYmluID0gby5uYmluO1xuXG4gICAgICAgICAgICBpZiAobmJpbiA+IDApIHtcbiAgICAgICAgICAgICAgICBiYW0uaW5kaWNlc1tyZWZdID0gbmV3IFVpbnQ4QXJyYXkoaGVhZGVyLCBibG9ja1N0YXJ0LCBwIC0gYmxvY2tTdGFydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoIWJhbS5pbmRleENodW5rcykge1xuICAgICAgICBiYW0uYmFpLmZldGNoKGZ1bmN0aW9uKGhlYWRlcikgeyAgIC8vIERvIHdlIHJlYWxseSBuZWVkIHRvIGZldGNoIHRoZSB3aG9sZSB0aGluZz8gOi0oXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gcGFyc2VCYWkoaGVhZGVyKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoYmFtLmJhaS51cmwgJiYgdHlwZW9mKGF0dGVtcHRlZCkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWxyZWFkeSBhdHRlbXB0ZWQgeC5iYW0uYmFpIG5vdCB0aGVyZSBzbyBub3cgdHJ5aW5nIHguYmFpXG4gICAgICAgICAgICAgICAgICAgIGJhbS5iYWkudXJsID0gYmFtLmRhdGEudXJsLnJlcGxhY2UobmV3IFJlZ0V4cCgnLmJhbSQnKSwgJy5iYWknKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAvLyBUcnVlIGxldHMgdXMga25vdyB3ZSBhcmUgbWFraW5nIGEgc2Vjb25kIGF0dGVtcHRcbiAgICAgICAgICAgICAgICAgICAgbWFrZUJhbShkYXRhLCBiYW0uYmFpLCBpbmRleENodW5rcywgY2FsbGJhY2ssIHRydWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV2UndmUgYXR0ZW1wdGVkIHguYmFtLmJhaSAmIHguYmFpIGFuZCBub3RoaW5nIHdvcmtlZFxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJhbS5kYXRhLnNsaWNlKDAsIG1pbkJsb2NrSW5kZXgpLmZldGNoKHBhcnNlQmFtSGVhZGVyLCB7dGltZW91dDogNTAwMH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB7dGltZW91dDogNTAwMH0pOyAgIC8vIFRpbWVvdXQgb24gZmlyc3QgcmVxdWVzdCB0byBjYXRjaCBDaHJvbWUgbWl4ZWQtY29udGVudCBlcnJvci5cbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY2h1bmtzID0gYmFtLmluZGV4Q2h1bmtzLmNodW5rcztcbiAgICAgICAgYmFtLmluZGljZXMgPSBbXVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNodW5rcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICBiYW0uaW5kaWNlc1tpXSA9IG51bGw7ICAvLyBUbyBiZSBmaWxsZWQgb3V0IGxhemlseSBhcyBuZWVkZWRcbiAgICAgICAgfVxuICAgICAgICBiYW0uZGF0YS5zbGljZSgwLCBtaW5CbG9ja0luZGV4KS5mZXRjaChwYXJzZUJhbUhlYWRlcik7XG4gICAgfVxufVxuXG5cblxuQmFtRmlsZS5wcm90b3R5cGUuYmxvY2tzRm9yUmFuZ2UgPSBmdW5jdGlvbihyZWZJZCwgbWluLCBtYXgpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLmluZGljZXNbcmVmSWRdO1xuICAgIGlmICghaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIHZhciBpbnRCaW5zTCA9IHJlZzJiaW5zKG1pbiwgbWF4KTtcbiAgICB2YXIgaW50QmlucyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW50Qmluc0wubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaW50Qmluc1tpbnRCaW5zTFtpXV0gPSB0cnVlO1xuICAgIH1cbiAgICB2YXIgbGVhZkNodW5rcyA9IFtdLCBvdGhlckNodW5rcyA9IFtdO1xuXG4gICAgdmFyIG5iaW4gPSByZWFkSW50KGluZGV4LCAwKTtcbiAgICB2YXIgcCA9IDQ7XG4gICAgZm9yICh2YXIgYiA9IDA7IGIgPCBuYmluOyArK2IpIHtcbiAgICAgICAgdmFyIGJpbiA9IHJlYWRJbnQoaW5kZXgsIHApO1xuICAgICAgICB2YXIgbmNobmsgPSByZWFkSW50KGluZGV4LCBwKzQpO1xuLy8gICAgICAgIGRsb2coJ2Jpbj0nICsgYmluICsgJzsgbmNobms9JyArIG5jaG5rKTtcbiAgICAgICAgcCArPSA4O1xuICAgICAgICBpZiAoaW50Qmluc1tiaW5dKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBjID0gMDsgYyA8IG5jaG5rOyArK2MpIHtcbiAgICAgICAgICAgICAgICB2YXIgY3MgPSByZWFkVm9iKGluZGV4LCBwKTtcbiAgICAgICAgICAgICAgICB2YXIgY2UgPSByZWFkVm9iKGluZGV4LCBwICsgOCk7XG4gICAgICAgICAgICAgICAgKGJpbiA8IDQ2ODEgPyBvdGhlckNodW5rcyA6IGxlYWZDaHVua3MpLnB1c2gobmV3IENodW5rKGNzLCBjZSkpO1xuICAgICAgICAgICAgICAgIHAgKz0gMTY7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwICs9ICAobmNobmsgKiAxNik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coJ2xlYWZDaHVua3MgPSAnICsgbWluaUpTT05pZnkobGVhZkNodW5rcykpO1xuICAgIC8vIGNvbnNvbGUubG9nKCdvdGhlckNodW5rcyA9ICcgKyBtaW5pSlNPTmlmeShvdGhlckNodW5rcykpO1xuXG4gICAgdmFyIG5pbnR2ID0gcmVhZEludChpbmRleCwgcCk7XG4gICAgdmFyIGxvd2VzdCA9IG51bGw7XG4gICAgdmFyIG1pbkxpbiA9IE1hdGgubWluKG1pbj4+MTQsIG5pbnR2IC0gMSksIG1heExpbiA9IE1hdGgubWluKG1heD4+MTQsIG5pbnR2IC0gMSk7XG4gICAgZm9yICh2YXIgaSA9IG1pbkxpbjsgaSA8PSBtYXhMaW47ICsraSkge1xuICAgICAgICB2YXIgbGIgPSAgcmVhZFZvYihpbmRleCwgcCArIDQgKyAoaSAqIDgpKTtcbiAgICAgICAgaWYgKCFsYikge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFsb3dlc3QgfHwgbGIuYmxvY2sgPCBsb3dlc3QuYmxvY2sgfHwgbGIub2Zmc2V0IDwgbG93ZXN0Lm9mZnNldCkge1xuICAgICAgICAgICAgbG93ZXN0ID0gbGI7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coJ0xvd2VzdCBMQiA9ICcgKyBsb3dlc3QpO1xuICAgIFxuICAgIHZhciBwcnVuZWRPdGhlckNodW5rcyA9IFtdO1xuICAgIGlmIChsb3dlc3QgIT0gbnVsbCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG90aGVyQ2h1bmtzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgY2huayA9IG90aGVyQ2h1bmtzW2ldO1xuICAgICAgICAgICAgaWYgKGNobmsubWF4di5ibG9jayA+PSBsb3dlc3QuYmxvY2sgJiYgY2huay5tYXh2Lm9mZnNldCA+PSBsb3dlc3Qub2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgcHJ1bmVkT3RoZXJDaHVua3MucHVzaChjaG5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBjb25zb2xlLmxvZygncHJ1bmVkT3RoZXJDaHVua3MgPSAnICsgbWluaUpTT05pZnkocHJ1bmVkT3RoZXJDaHVua3MpKTtcbiAgICBvdGhlckNodW5rcyA9IHBydW5lZE90aGVyQ2h1bmtzO1xuXG4gICAgdmFyIGludENodW5rcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3RoZXJDaHVua3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaW50Q2h1bmtzLnB1c2gob3RoZXJDaHVua3NbaV0pO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlYWZDaHVua3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaW50Q2h1bmtzLnB1c2gobGVhZkNodW5rc1tpXSk7XG4gICAgfVxuXG4gICAgaW50Q2h1bmtzLnNvcnQoZnVuY3Rpb24oYzAsIGMxKSB7XG4gICAgICAgIHZhciBkaWYgPSBjMC5taW52LmJsb2NrIC0gYzEubWludi5ibG9jaztcbiAgICAgICAgaWYgKGRpZiAhPSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZGlmO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGMwLm1pbnYub2Zmc2V0IC0gYzEubWludi5vZmZzZXQ7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICB2YXIgbWVyZ2VkQ2h1bmtzID0gW107XG4gICAgaWYgKGludENodW5rcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBjdXIgPSBpbnRDaHVua3NbMF07XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgaW50Q2h1bmtzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgbmMgPSBpbnRDaHVua3NbaV07XG4gICAgICAgICAgICBpZiAobmMubWludi5ibG9jayA9PSBjdXIubWF4di5ibG9jayAvKiAmJiBuYy5taW52Lm9mZnNldCA9PSBjdXIubWF4di5vZmZzZXQgKi8pIHsgLy8gbm8gcG9pbnQgc3BsaXR0aW5nIG1pZC1ibG9ja1xuICAgICAgICAgICAgICAgIGN1ciA9IG5ldyBDaHVuayhjdXIubWludiwgbmMubWF4dik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1lcmdlZENodW5rcy5wdXNoKGN1cik7XG4gICAgICAgICAgICAgICAgY3VyID0gbmM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbWVyZ2VkQ2h1bmtzLnB1c2goY3VyKTtcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coJ21lcmdlZENodW5rcyA9ICcgKyBtaW5pSlNPTmlmeShtZXJnZWRDaHVua3MpKTtcblxuICAgIHJldHVybiBtZXJnZWRDaHVua3M7XG59XG5cbkJhbUZpbGUucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24oY2hyLCBtaW4sIG1heCwgY2FsbGJhY2ssIG9wdHMpIHtcbiAgICB2YXIgdGhpc0IgPSB0aGlzO1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG4gICAgdmFyIGNocklkID0gdGhpcy5jaHJUb0luZGV4W2Nocl07XG4gICAgdmFyIGNodW5rcztcbiAgICBpZiAoY2hySWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjaHVua3MgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGZXRjaCB0aGlzIHBvcnRpb24gb2YgdGhlIEJBSSBpZiBpdCBoYXNuJ3QgYmVlbiBsb2FkZWQgeWV0LlxuICAgICAgICBpZiAodGhpcy5pbmRpY2VzW2NocklkXSA9PT0gbnVsbCAmJiB0aGlzLmluZGV4Q2h1bmtzLmNodW5rc1tjaHJJZF0pIHtcbiAgICAgICAgICAgIHZhciBzdGFydF9zdG9wID0gdGhpcy5pbmRleENodW5rcy5jaHVua3NbY2hySWRdO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYmFpLnNsaWNlKHN0YXJ0X3N0b3BbMF0sIHN0YXJ0X3N0b3BbMV0pLmZldGNoKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICB2YXIgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRpY2VzW2NocklkXSA9IGJ1ZmZlcjtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5mZXRjaChjaHIsIG1pbiwgbWF4LCBjYWxsYmFjaywgb3B0cyk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2h1bmtzID0gdGhpcy5ibG9ja3NGb3JSYW5nZShjaHJJZCwgbWluLCBtYXgpO1xuICAgICAgICBpZiAoIWNodW5rcykge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgJ0Vycm9yIGluIGluZGV4IGZldGNoJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdmFyIHJlY29yZHMgPSBbXTtcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBkYXRhO1xuXG4gICAgZnVuY3Rpb24gdHJhbXAoKSB7XG4gICAgICAgIGlmIChpbmRleCA+PSBjaHVua3MubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2socmVjb3Jkcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWRhdGEpIHtcbiAgICAgICAgICAgIHZhciBjID0gY2h1bmtzW2luZGV4XTtcbiAgICAgICAgICAgIHZhciBmZXRjaE1pbiA9IGMubWludi5ibG9jaztcbiAgICAgICAgICAgIHZhciBmZXRjaE1heCA9IGMubWF4di5ibG9jayArICgxPDwxNik7IC8vICpzaWdoKlxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2ZldGNoaW5nICcgKyBmZXRjaE1pbiArICc6JyArIGZldGNoTWF4KTtcbiAgICAgICAgICAgIHRoaXNCLmRhdGEuc2xpY2UoZmV0Y2hNaW4sIGZldGNoTWF4IC0gZmV0Y2hNaW4pLmZldGNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgICAgICBkYXRhID0gdW5iZ3pmKHIsIGMubWF4di5ibG9jayAtIGMubWludi5ibG9jayArIDEpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFtcCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICAgICAgICAgIHZhciBmaW5pc2hlZCA9IHRoaXNCLnJlYWRCYW1SZWNvcmRzKGJhLCBjaHVua3NbaW5kZXhdLm1pbnYub2Zmc2V0LCByZWNvcmRzLCBtaW4sIG1heCwgY2hySWQsIG9wdHMpO1xuICAgICAgICAgICAgZGF0YSA9IG51bGw7XG4gICAgICAgICAgICArK2luZGV4O1xuICAgICAgICAgICAgaWYgKGZpbmlzaGVkKVxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhyZWNvcmRzKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbXAoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0cmFtcCgpO1xufVxuXG52YXIgU0VRUkVUX0RFQ09ERVIgPSBbJz0nLCAnQScsICdDJywgJ3gnLCAnRycsICd4JywgJ3gnLCAneCcsICdUJywgJ3gnLCAneCcsICd4JywgJ3gnLCAneCcsICd4JywgJ04nXTtcbnZhciBDSUdBUl9ERUNPREVSID0gWydNJywgJ0knLCAnRCcsICdOJywgJ1MnLCAnSCcsICdQJywgJz0nLCAnWCcsICc/JywgJz8nLCAnPycsICc/JywgJz8nLCAnPycsICc/J107XG5cbmZ1bmN0aW9uIEJhbVJlY29yZCgpIHtcbn1cblxuQmFtRmlsZS5wcm90b3R5cGUucmVhZEJhbVJlY29yZHMgPSBmdW5jdGlvbihiYSwgb2Zmc2V0LCBzaW5rLCBtaW4sIG1heCwgY2hySWQsIG9wdHMpIHtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB2YXIgYmxvY2tTaXplID0gcmVhZEludChiYSwgb2Zmc2V0KTtcbiAgICAgICAgdmFyIGJsb2NrRW5kID0gb2Zmc2V0ICsgYmxvY2tTaXplICsgNDtcbiAgICAgICAgaWYgKGJsb2NrRW5kID49IGJhLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlY29yZCA9IG5ldyBCYW1SZWNvcmQoKTtcblxuICAgICAgICB2YXIgcmVmSUQgPSByZWFkSW50KGJhLCBvZmZzZXQgKyA0KTtcbiAgICAgICAgdmFyIHBvcyA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDgpO1xuICAgICAgICBcbiAgICAgICAgdmFyIGJtbiA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDEyKTtcbiAgICAgICAgdmFyIGJpbiA9IChibW4gJiAweGZmZmYwMDAwKSA+PiAxNjtcbiAgICAgICAgdmFyIG1xID0gKGJtbiAmIDB4ZmYwMCkgPj4gODtcbiAgICAgICAgdmFyIG5sID0gYm1uICYgMHhmZjtcblxuICAgICAgICB2YXIgZmxhZ19uYyA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDE2KTtcbiAgICAgICAgdmFyIGZsYWcgPSAoZmxhZ19uYyAmIDB4ZmZmZjAwMDApID4+IDE2O1xuICAgICAgICB2YXIgbmMgPSBmbGFnX25jICYgMHhmZmZmO1xuICAgIFxuICAgICAgICB2YXIgbHNlcSA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDIwKTtcbiAgICAgICAgXG4gICAgICAgIHZhciBuZXh0UmVmICA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDI0KTtcbiAgICAgICAgdmFyIG5leHRQb3MgPSByZWFkSW50KGJhLCBvZmZzZXQgKyAyOCk7XG4gICAgICAgIFxuICAgICAgICB2YXIgdGxlbiA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDMyKTtcbiAgICBcbiAgICAgICAgcmVjb3JkLnNlZ21lbnQgPSB0aGlzLmluZGV4VG9DaHJbcmVmSURdO1xuICAgICAgICByZWNvcmQuZmxhZyA9IGZsYWc7XG4gICAgICAgIHJlY29yZC5wb3MgPSBwb3M7XG4gICAgICAgIHJlY29yZC5tcSA9IG1xO1xuICAgICAgICBpZiAob3B0cy5saWdodClcbiAgICAgICAgICAgIHJlY29yZC5zZXFMZW5ndGggPSBsc2VxO1xuXG4gICAgICAgIGlmICghb3B0cy5saWdodCkge1xuICAgICAgICAgICAgaWYgKG5leHRSZWYgPj0gMCkge1xuICAgICAgICAgICAgICAgIHJlY29yZC5uZXh0U2VnbWVudCA9IHRoaXMuaW5kZXhUb0NocltuZXh0UmVmXTtcbiAgICAgICAgICAgICAgICByZWNvcmQubmV4dFBvcyA9IG5leHRQb3M7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZWFkTmFtZSA9ICcnO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBubC0xOyArK2opIHtcbiAgICAgICAgICAgICAgICByZWFkTmFtZSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJhW29mZnNldCArIDM2ICsgal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVjb3JkLnJlYWROYW1lID0gcmVhZE5hbWU7XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIHAgPSBvZmZzZXQgKyAzNiArIG5sO1xuXG4gICAgICAgICAgICB2YXIgY2lnYXIgPSAnJztcbiAgICAgICAgICAgIGZvciAodmFyIGMgPSAwOyBjIDwgbmM7ICsrYykge1xuICAgICAgICAgICAgICAgIHZhciBjaWdvcCA9IHJlYWRJbnQoYmEsIHApO1xuICAgICAgICAgICAgICAgIGNpZ2FyID0gY2lnYXIgKyAoY2lnb3A+PjQpICsgQ0lHQVJfREVDT0RFUltjaWdvcCAmIDB4Zl07XG4gICAgICAgICAgICAgICAgcCArPSA0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVjb3JkLmNpZ2FyID0gY2lnYXI7XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIHNlcSA9ICcnO1xuICAgICAgICAgICAgdmFyIHNlcUJ5dGVzID0gKGxzZXEgKyAxKSA+PiAxO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBzZXFCeXRlczsgKytqKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNiID0gYmFbcCArIGpdO1xuICAgICAgICAgICAgICAgIHNlcSArPSBTRVFSRVRfREVDT0RFUlsoc2IgJiAweGYwKSA+PiA0XTtcbiAgICAgICAgICAgICAgICBpZiAoc2VxLmxlbmd0aCA8IGxzZXEpXG4gICAgICAgICAgICAgICAgICAgIHNlcSArPSBTRVFSRVRfREVDT0RFUlsoc2IgJiAweDBmKV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwICs9IHNlcUJ5dGVzO1xuICAgICAgICAgICAgcmVjb3JkLnNlcSA9IHNlcTtcblxuICAgICAgICAgICAgdmFyIHFzZXEgPSAnJztcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgbHNlcTsgKytqKSB7XG4gICAgICAgICAgICAgICAgcXNlcSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJhW3AgKyBqXSArIDMzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAgKz0gbHNlcTtcbiAgICAgICAgICAgIHJlY29yZC5xdWFscyA9IHFzZXE7XG5cbiAgICAgICAgICAgIHdoaWxlIChwIDwgYmxvY2tFbmQpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFnID0gU3RyaW5nLmZyb21DaGFyQ29kZShiYVtwXSwgYmFbcCArIDFdKTtcbiAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoYmFbcCArIDJdKTtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnQScpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJhW3AgKyAzXSk7XG4gICAgICAgICAgICAgICAgICAgIHAgKz0gNDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gJ2knIHx8IHR5cGUgPT0gJ0knKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcmVhZEludChiYSwgcCArIDMpO1xuICAgICAgICAgICAgICAgICAgICBwICs9IDc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlID09ICdjJyB8fCB0eXBlID09ICdDJykge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGJhW3AgKyAzXTtcbiAgICAgICAgICAgICAgICAgICAgcCArPSA0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSAncycgfHwgdHlwZSA9PSAnUycpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSByZWFkU2hvcnQoYmEsIHAgKyAzKTtcbiAgICAgICAgICAgICAgICAgICAgcCArPSA1O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSAnZicpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSByZWFkRmxvYXQoYmEsIHAgKyAzKTtcbiAgICAgICAgICAgICAgICAgICAgcCArPSA3O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PSAnWicgfHwgdHlwZSA9PSAnSCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcCArPSAzO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2MgPSBiYVtwKytdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNjID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT0gJ0InKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhdHlwZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoYmFbcCArIDNdKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGFsZW4gPSByZWFkSW50KGJhLCBwICsgNCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlbGVuO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVhZGVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR5cGUgPT0gJ2knIHx8IGF0eXBlID09ICdJJyB8fCBhdHlwZSA9PSAnZicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW4gPSA0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0eXBlID09ICdmJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkZXIgPSByZWFkRmxvYXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVhZGVyID0gcmVhZEludDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHlwZSA9PSAncycgfHwgYXR5cGUgPT0gJ1MnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVuID0gMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRlciA9IHJlYWRTaG9ydDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhdHlwZSA9PSAnYycgfHwgYXR5cGUgPT0gJ0MnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVuID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRlciA9IHJlYWRCeXRlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1Vua25vd24gYXJyYXkgdHlwZSAnICsgYXR5cGU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBwICs9IDg7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYWxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5wdXNoKHJlYWRlcihiYSwgcCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcCArPSBlbGVuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ1Vua25vd24gdHlwZSAnKyB0eXBlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZWNvcmRbdGFnXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtaW4gfHwgcmVjb3JkLnBvcyA8PSBtYXggJiYgcmVjb3JkLnBvcyArIGxzZXEgPj0gbWluKSB7XG4gICAgICAgICAgICBpZiAoY2hySWQgPT09IHVuZGVmaW5lZCB8fCByZWZJRCA9PSBjaHJJZCkge1xuICAgICAgICAgICAgICAgIHNpbmsucHVzaChyZWNvcmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChyZWNvcmQucG9zID4gbWF4KSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgPSBibG9ja0VuZDtcbiAgICB9XG5cbiAgICAvLyBFeGl0cyB2aWEgdG9wIG9mIGxvb3AuXG59O1xuXG5pZiAodHlwZW9mKG1vZHVsZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIG1ha2VCYW06IG1ha2VCYW0sXG4gICAgICAgIEJBTV9NQUdJQzogQkFNX01BR0lDLFxuICAgICAgICBCQUlfTUFHSUM6IEJBSV9NQUdJQyxcbiAgICAgICAgQmFtRmxhZ3M6IEJhbUZsYWdzXG4gICAgfTtcbn1cbiIsIi8qIC0qLSBtb2RlOiBqYXZhc2NyaXB0OyBjLWJhc2ljLW9mZnNldDogNDsgaW5kZW50LXRhYnMtbW9kZTogbmlsIC0qLSAqL1xuXG4vLyBcbi8vIERhbGxpYW5jZSBHZW5vbWUgRXhwbG9yZXJcbi8vIChjKSBUaG9tYXMgRG93biAyMDA2LTIwMTBcbi8vXG4vLyBiaWd3aWcuanM6IGluZGV4ZWQgYmluYXJ5IFdJRyAoYW5kIEJFRCkgZmlsZXNcbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5cbmlmICh0eXBlb2YocmVxdWlyZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIHNwYW5zID0gcmVxdWlyZSgnLi9zcGFucycpO1xuICAgIHZhciBSYW5nZSA9IHNwYW5zLlJhbmdlO1xuICAgIHZhciB1bmlvbiA9IHNwYW5zLnVuaW9uO1xuICAgIHZhciBpbnRlcnNlY3Rpb24gPSBzcGFucy5pbnRlcnNlY3Rpb247XG5cbiAgICB2YXIgZGFzID0gcmVxdWlyZSgnLi9kYXMnKTtcbiAgICB2YXIgREFTRmVhdHVyZSA9IGRhcy5EQVNGZWF0dXJlO1xuICAgIHZhciBEQVNHcm91cCA9IGRhcy5EQVNHcm91cDtcblxuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbiAgICB2YXIgc2hhbGxvd0NvcHkgPSB1dGlscy5zaGFsbG93Q29weTtcblxuICAgIHZhciBiaW4gPSByZXF1aXJlKCcuL2JpbicpO1xuICAgIHZhciByZWFkSW50ID0gYmluLnJlYWRJbnQ7XG5cbiAgICB2YXIganN6bGliID0gcmVxdWlyZSgnanN6bGliJyk7XG4gICAgdmFyIGpzemxpYl9pbmZsYXRlX2J1ZmZlciA9IGpzemxpYi5pbmZsYXRlQnVmZmVyO1xuICAgIHZhciBhcnJheUNvcHkgPSBqc3psaWIuYXJyYXlDb3B5O1xufVxuXG52YXIgQklHX1dJR19NQUdJQyA9IDB4ODg4RkZDMjY7XG52YXIgQklHX1dJR19NQUdJQ19CRSA9IDB4MjZGQzhGODg7XG52YXIgQklHX0JFRF9NQUdJQyA9IDB4ODc4OUYyRUI7XG52YXIgQklHX0JFRF9NQUdJQ19CRSA9IDB4RUJGMjg5ODc7XG5cblxudmFyIEJJR19XSUdfVFlQRV9HUkFQSCA9IDE7XG52YXIgQklHX1dJR19UWVBFX1ZTVEVQID0gMjtcbnZhciBCSUdfV0lHX1RZUEVfRlNURVAgPSAzO1xuICBcbnZhciBNMSA9IDI1NjtcbnZhciBNMiA9IDI1NioyNTY7XG52YXIgTTMgPSAyNTYqMjU2KjI1NjtcbnZhciBNNCA9IDI1NioyNTYqMjU2KjI1NjtcblxudmFyIEJFRF9DT0xPUl9SRUdFWFAgPSBuZXcgUmVnRXhwKFwiXlswLTldKyxbMC05XSssWzAtOV0rXCIpO1xuXG5mdW5jdGlvbiBid2dfcmVhZE9mZnNldChiYSwgbykge1xuICAgIHZhciBvZmZzZXQgPSBiYVtvXSArIGJhW28rMV0qTTEgKyBiYVtvKzJdKk0yICsgYmFbbyszXSpNMyArIGJhW28rNF0qTTQ7XG4gICAgcmV0dXJuIG9mZnNldDtcbn1cblxuZnVuY3Rpb24gQmlnV2lnKCkge1xufVxuXG5CaWdXaWcucHJvdG90eXBlLnJlYWRDaHJvbVRyZWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciB0aGlzQiA9IHRoaXM7XG4gICAgdGhpcy5jaHJvbXNUb0lEcyA9IHt9O1xuICAgIHRoaXMuaWRzVG9DaHJvbXMgPSB7fTtcbiAgICB0aGlzLm1heElEID0gMDtcblxuICAgIHZhciB1ZG8gPSB0aGlzLnVuem9vbWVkRGF0YU9mZnNldDtcbiAgICB2YXIgZWIgPSAodWRvIC0gdGhpcy5jaHJvbVRyZWVPZmZzZXQpICYgMztcbiAgICB1ZG8gPSB1ZG8gKyA0IC0gZWI7XG5cbiAgICB0aGlzLmRhdGEuc2xpY2UodGhpcy5jaHJvbVRyZWVPZmZzZXQsIHVkbyAtIHRoaXMuY2hyb21UcmVlT2Zmc2V0KS5mZXRjaChmdW5jdGlvbihicHQpIHtcbiAgICAgICAgdmFyIGJhID0gbmV3IFVpbnQ4QXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIHNhID0gbmV3IEludDE2QXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIGJwdE1hZ2ljID0gbGFbMF07XG4gICAgICAgIHZhciBibG9ja1NpemUgPSBsYVsxXTtcbiAgICAgICAgdmFyIGtleVNpemUgPSBsYVsyXTtcbiAgICAgICAgdmFyIHZhbFNpemUgPSBsYVszXTtcbiAgICAgICAgdmFyIGl0ZW1Db3VudCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCAxNik7XG4gICAgICAgIHZhciByb290Tm9kZU9mZnNldCA9IDMyO1xuXG4gICAgICAgIHZhciBicHRSZWFkTm9kZSA9IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgICAgICAgICAgdmFyIG5vZGVUeXBlID0gYmFbb2Zmc2V0XTtcbiAgICAgICAgICAgIHZhciBjbnQgPSBzYVsob2Zmc2V0LzIpICsgMV07XG4gICAgICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY250OyArK24pIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZVR5cGUgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBvZmZzZXQgKz0ga2V5U2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIG9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSA4O1xuICAgICAgICAgICAgICAgICAgICBjaGlsZE9mZnNldCAtPSB0aGlzQi5jaHJvbVRyZWVPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIGJwdFJlYWROb2RlKGNoaWxkT2Zmc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGtpID0gMDsga2kgPCBrZXlTaXplOyArK2tpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hhckNvZGUgPSBiYVtvZmZzZXQrK107XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hhckNvZGUgIT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgY2hyb21JZCA9IChiYVtvZmZzZXQrM108PDI0KSB8IChiYVtvZmZzZXQrMl08PDE2KSB8IChiYVtvZmZzZXQrMV08PDgpIHwgKGJhW29mZnNldCswXSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjaHJvbVNpemUgPSAoYmFbb2Zmc2V0ICsgN108PDI0KSB8IChiYVtvZmZzZXQrNl08PDE2KSB8IChiYVtvZmZzZXQrNV08PDgpIHwgKGJhW29mZnNldCs0XSk7XG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSA4O1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXNCLmNocm9tc1RvSURzW2tleV0gPSBjaHJvbUlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5LmluZGV4T2YoJ2NocicpID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNCLmNocm9tc1RvSURzW2tleS5zdWJzdHIoMyldID0gY2hyb21JZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzQi5pZHNUb0Nocm9tc1tjaHJvbUlkXSA9IGtleTtcbiAgICAgICAgICAgICAgICAgICAgdGhpc0IubWF4SUQgPSBNYXRoLm1heCh0aGlzQi5tYXhJRCwgY2hyb21JZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBicHRSZWFkTm9kZShyb290Tm9kZU9mZnNldCk7XG5cbiAgICAgICAgY2FsbGJhY2sodGhpc0IpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBCaWdXaWdWaWV3KGJ3ZywgY2lyVHJlZU9mZnNldCwgY2lyVHJlZUxlbmd0aCwgaXNTdW1tYXJ5KSB7XG4gICAgdGhpcy5id2cgPSBid2c7XG4gICAgdGhpcy5jaXJUcmVlT2Zmc2V0ID0gY2lyVHJlZU9mZnNldDtcbiAgICB0aGlzLmNpclRyZWVMZW5ndGggPSBjaXJUcmVlTGVuZ3RoO1xuICAgIHRoaXMuaXNTdW1tYXJ5ID0gaXNTdW1tYXJ5O1xufVxuXG5cblxuQmlnV2lnVmlldy5wcm90b3R5cGUucmVhZFdpZ0RhdGEgPSBmdW5jdGlvbihjaHJOYW1lLCBtaW4sIG1heCwgY2FsbGJhY2spIHtcbiAgICB2YXIgY2hyID0gdGhpcy5id2cuY2hyb21zVG9JRHNbY2hyTmFtZV07XG4gICAgaWYgKGNociA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIE5vdCBhbiBlcnJvciBiZWNhdXNlIHNvbWUgLmJ3Z3Mgd29uJ3QgaGF2ZSBkYXRhIGZvciBhbGwgY2hyb21vc29tZXMuXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWFkV2lnRGF0YUJ5SWQoY2hyLCBtaW4sIG1heCwgY2FsbGJhY2spO1xuICAgIH1cbn1cblxuQmlnV2lnVmlldy5wcm90b3R5cGUucmVhZFdpZ0RhdGFCeUlkID0gZnVuY3Rpb24oY2hyLCBtaW4sIG1heCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdGhpc0IgPSB0aGlzO1xuICAgIGlmICghdGhpcy5jaXJIZWFkZXIpIHtcbiAgICAgICAgdGhpcy5id2cuZGF0YS5zbGljZSh0aGlzLmNpclRyZWVPZmZzZXQsIDQ4KS5mZXRjaChmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIHRoaXNCLmNpckhlYWRlciA9IHJlc3VsdDtcbiAgICAgICAgICAgIHZhciBsYSA9IG5ldyBJbnQzMkFycmF5KHRoaXNCLmNpckhlYWRlcik7XG4gICAgICAgICAgICB0aGlzQi5jaXJCbG9ja1NpemUgPSBsYVsxXTtcbiAgICAgICAgICAgIHRoaXNCLnJlYWRXaWdEYXRhQnlJZChjaHIsIG1pbiwgbWF4LCBjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGJsb2Nrc1RvRmV0Y2ggPSBbXTtcbiAgICB2YXIgb3V0c3RhbmRpbmcgPSAwO1xuXG4gICAgdmFyIGJlZm9yZUJXRyA9IERhdGUubm93KCk7XG5cbiAgICB2YXIgZmlsdGVyID0gZnVuY3Rpb24oY2hyb21JZCwgZm1pbiwgZm1heCwgdG9rcykge1xuICAgICAgICByZXR1cm4gKChjaHIgPCAwIHx8IGNocm9tSWQgPT0gY2hyKSAmJiBmbWluIDw9IG1heCAmJiBmbWF4ID49IG1pbik7XG4gICAgfVxuXG4gICAgdmFyIGNpckZvYlJlY3VyID0gZnVuY3Rpb24ob2Zmc2V0LCBsZXZlbCkge1xuICAgICAgICBpZiAodGhpc0IuYndnLmluc3RydW1lbnQpXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnbGV2ZWw9JyArIGxldmVsICsgJzsgb2Zmc2V0PScgKyBvZmZzZXQgKyAnOyB0aW1lPScgKyAoRGF0ZS5ub3coKXwwKSk7XG5cbiAgICAgICAgb3V0c3RhbmRpbmcgKz0gb2Zmc2V0Lmxlbmd0aDtcblxuICAgICAgICBpZiAob2Zmc2V0Lmxlbmd0aCA9PSAxICYmIG9mZnNldFswXSAtIHRoaXNCLmNpclRyZWVPZmZzZXQgPT0gNDggJiYgdGhpc0IuY2FjaGVkQ2lyUm9vdCkge1xuICAgICAgICAgICAgY2lyRm9iUmVjdXIyKHRoaXNCLmNhY2hlZENpclJvb3QsIDAsIGxldmVsKTtcbiAgICAgICAgICAgIC0tb3V0c3RhbmRpbmc7XG4gICAgICAgICAgICBpZiAob3V0c3RhbmRpbmcgPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXNCLmZldGNoRmVhdHVyZXMoZmlsdGVyLCBibG9ja3NUb0ZldGNoLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWF4Q2lyQmxvY2tTcGFuID0gNCArICAodGhpc0IuY2lyQmxvY2tTaXplICogMzIpOyAgIC8vIFVwcGVyIGJvdW5kIG9uIHNpemUsIGJhc2VkIG9uIGEgY29tcGxldGVseSBmdWxsIGxlYWYgbm9kZS5cbiAgICAgICAgdmFyIHNwYW5zO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9mZnNldC5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdmFyIGJsb2NrU3BhbiA9IG5ldyBSYW5nZShvZmZzZXRbaV0sIG9mZnNldFtpXSArIG1heENpckJsb2NrU3Bhbik7XG4gICAgICAgICAgICBzcGFucyA9IHNwYW5zID8gdW5pb24oc3BhbnMsIGJsb2NrU3BhbikgOiBibG9ja1NwYW47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHZhciBmZXRjaFJhbmdlcyA9IHNwYW5zLnJhbmdlcygpO1xuICAgICAgICBmb3IgKHZhciByID0gMDsgciA8IGZldGNoUmFuZ2VzLmxlbmd0aDsgKytyKSB7XG4gICAgICAgICAgICB2YXIgZnIgPSBmZXRjaFJhbmdlc1tyXTtcbiAgICAgICAgICAgIGNpckZvYlN0YXJ0RmV0Y2gob2Zmc2V0LCBmciwgbGV2ZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGNpckZvYlN0YXJ0RmV0Y2ggPSBmdW5jdGlvbihvZmZzZXQsIGZyLCBsZXZlbCwgYXR0ZW1wdHMpIHtcbiAgICAgICAgdmFyIGxlbmd0aCA9IGZyLm1heCgpIC0gZnIubWluKCk7XG4gICAgICAgIHRoaXNCLmJ3Zy5kYXRhLnNsaWNlKGZyLm1pbigpLCBmci5tYXgoKSAtIGZyLm1pbigpKS5mZXRjaChmdW5jdGlvbihyZXN1bHRCdWZmZXIpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2Zmc2V0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZyLmNvbnRhaW5zKG9mZnNldFtpXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2lyRm9iUmVjdXIyKHJlc3VsdEJ1ZmZlciwgb2Zmc2V0W2ldIC0gZnIubWluKCksIGxldmVsKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAob2Zmc2V0W2ldIC0gdGhpc0IuY2lyVHJlZU9mZnNldCA9PSA0OCAmJiBvZmZzZXRbaV0gLSBmci5taW4oKSA9PSAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc0IuY2FjaGVkQ2lyUm9vdCA9IHJlc3VsdEJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICAtLW91dHN0YW5kaW5nO1xuICAgICAgICAgICAgICAgICAgICBpZiAob3V0c3RhbmRpbmcgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc0IuZmV0Y2hGZWF0dXJlcyhmaWx0ZXIsIGJsb2Nrc1RvRmV0Y2gsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdmFyIGNpckZvYlJlY3VyMiA9IGZ1bmN0aW9uKGNpckJsb2NrRGF0YSwgb2Zmc2V0LCBsZXZlbCkge1xuICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShjaXJCbG9ja0RhdGEpO1xuICAgICAgICB2YXIgc2EgPSBuZXcgSW50MTZBcnJheShjaXJCbG9ja0RhdGEpO1xuICAgICAgICB2YXIgbGEgPSBuZXcgSW50MzJBcnJheShjaXJCbG9ja0RhdGEpO1xuXG4gICAgICAgIHZhciBpc0xlYWYgPSBiYVtvZmZzZXRdO1xuICAgICAgICB2YXIgY250ID0gc2Fbb2Zmc2V0LzIgKyAxXTtcbiAgICAgICAgb2Zmc2V0ICs9IDQ7XG5cbiAgICAgICAgaWYgKGlzTGVhZiAhPSAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxvID0gb2Zmc2V0LzQ7XG4gICAgICAgICAgICAgICAgdmFyIHN0YXJ0Q2hyb20gPSBsYVtsb107XG4gICAgICAgICAgICAgICAgdmFyIHN0YXJ0QmFzZSA9IGxhW2xvICsgMV07XG4gICAgICAgICAgICAgICAgdmFyIGVuZENocm9tID0gbGFbbG8gKyAyXTtcbiAgICAgICAgICAgICAgICB2YXIgZW5kQmFzZSA9IGxhW2xvICsgM107XG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIG9mZnNldCsxNik7XG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrU2l6ZSA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCBvZmZzZXQrMjQpO1xuICAgICAgICAgICAgICAgIGlmICgoKGNociA8IDAgfHwgc3RhcnRDaHJvbSA8IGNocikgfHwgKHN0YXJ0Q2hyb20gPT0gY2hyICYmIHN0YXJ0QmFzZSA8PSBtYXgpKSAmJlxuICAgICAgICAgICAgICAgICAgICAoKGNociA8IDAgfHwgZW5kQ2hyb20gICA+IGNocikgfHwgKGVuZENocm9tID09IGNociAmJiBlbmRCYXNlID49IG1pbikpKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tzVG9GZXRjaC5wdXNoKHtvZmZzZXQ6IGJsb2NrT2Zmc2V0LCBzaXplOiBibG9ja1NpemV9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb2Zmc2V0ICs9IDMyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlY3VyT2Zmc2V0cyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbnQ7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBsbyA9IG9mZnNldC80O1xuICAgICAgICAgICAgICAgIHZhciBzdGFydENocm9tID0gbGFbbG9dO1xuICAgICAgICAgICAgICAgIHZhciBzdGFydEJhc2UgPSBsYVtsbyArIDFdO1xuICAgICAgICAgICAgICAgIHZhciBlbmRDaHJvbSA9IGxhW2xvICsgMl07XG4gICAgICAgICAgICAgICAgdmFyIGVuZEJhc2UgPSBsYVtsbyArIDNdO1xuICAgICAgICAgICAgICAgIHZhciBibG9ja09mZnNldCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCBvZmZzZXQrMTYpO1xuICAgICAgICAgICAgICAgIGlmICgoY2hyIDwgMCB8fCBzdGFydENocm9tIDwgY2hyIHx8IChzdGFydENocm9tID09IGNociAmJiBzdGFydEJhc2UgPD0gbWF4KSkgJiZcbiAgICAgICAgICAgICAgICAgICAgKGNociA8IDAgfHwgZW5kQ2hyb20gICA+IGNociB8fCAoZW5kQ2hyb20gPT0gY2hyICYmIGVuZEJhc2UgPj0gbWluKSkpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICByZWN1ck9mZnNldHMucHVzaChibG9ja09mZnNldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9mZnNldCArPSAyNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZWN1ck9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNpckZvYlJlY3VyKHJlY3VyT2Zmc2V0cywgbGV2ZWwgKyAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjaXJGb2JSZWN1cihbdGhpc0IuY2lyVHJlZU9mZnNldCArIDQ4XSwgMSk7XG59XG5cblxuQmlnV2lnVmlldy5wcm90b3R5cGUuZmV0Y2hGZWF0dXJlcyA9IGZ1bmN0aW9uKGZpbHRlciwgYmxvY2tzVG9GZXRjaCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdGhpc0IgPSB0aGlzO1xuXG4gICAgYmxvY2tzVG9GZXRjaC5zb3J0KGZ1bmN0aW9uKGIwLCBiMSkge1xuICAgICAgICByZXR1cm4gKGIwLm9mZnNldHwwKSAtIChiMS5vZmZzZXR8MCk7XG4gICAgfSk7XG5cbiAgICBpZiAoYmxvY2tzVG9GZXRjaC5sZW5ndGggPT0gMCkge1xuICAgICAgICBjYWxsYmFjayhbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGZlYXR1cmVzID0gW107XG4gICAgICAgIHZhciBjcmVhdGVGZWF0dXJlID0gZnVuY3Rpb24oY2hyLCBmbWluLCBmbWF4LCBvcHRzKSB7XG4gICAgICAgICAgICBpZiAoIW9wdHMpIHtcbiAgICAgICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIGYgPSBuZXcgREFTRmVhdHVyZSgpO1xuICAgICAgICAgICAgZi5fY2hyb21JZCA9IGNocjtcbiAgICAgICAgICAgIGYuc2VnbWVudCA9IHRoaXNCLmJ3Zy5pZHNUb0Nocm9tc1tjaHJdO1xuICAgICAgICAgICAgZi5taW4gPSBmbWluO1xuICAgICAgICAgICAgZi5tYXggPSBmbWF4O1xuICAgICAgICAgICAgZi50eXBlID0gJ2JpZ3dpZyc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAodmFyIGsgaW4gb3B0cykge1xuICAgICAgICAgICAgICAgIGZba10gPSBvcHRzW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBmZWF0dXJlcy5wdXNoKGYpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciB0cmFtcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKGJsb2Nrc1RvRmV0Y2gubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgYWZ0ZXJCV0cgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIC8vIGRsb2coJ0JXRyBmZXRjaCB0b29rICcgKyAoYWZ0ZXJCV0cgLSBiZWZvcmVCV0cpICsgJ21zJyk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZmVhdHVyZXMpO1xuICAgICAgICAgICAgICAgIHJldHVybjsgIC8vIGp1c3QgaW4gY2FzZS4uLlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2sgPSBibG9ja3NUb0ZldGNoWzBdO1xuICAgICAgICAgICAgICAgIGlmIChibG9jay5kYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNCLnBhcnNlRmVhdHVyZXMoYmxvY2suZGF0YSwgY3JlYXRlRmVhdHVyZSwgZmlsdGVyKTtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tzVG9GZXRjaC5zcGxpY2UoMCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHRyYW1wKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZldGNoU3RhcnQgPSBibG9jay5vZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmZXRjaFNpemUgPSBibG9jay5zaXplO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYmkgPSAxO1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoYmkgPCBibG9ja3NUb0ZldGNoLmxlbmd0aCAmJiBibG9ja3NUb0ZldGNoW2JpXS5vZmZzZXQgPT0gKGZldGNoU3RhcnQgKyBmZXRjaFNpemUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmZXRjaFNpemUgKz0gYmxvY2tzVG9GZXRjaFtiaV0uc2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICsrYmk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzQi5id2cuZGF0YS5zbGljZShmZXRjaFN0YXJ0LCBmZXRjaFNpemUpLmZldGNoKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmkgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKG9mZnNldCA8IGZldGNoU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmYiA9IGJsb2Nrc1RvRmV0Y2hbYmldO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXNCLmJ3Zy51bmNvbXByZXNzQnVmU2l6ZSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IGpzemxpYl9pbmZsYXRlX2J1ZmZlcihyZXN1bHQsIG9mZnNldCArIDIsIGZiLnNpemUgLSAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkoZmIuc2l6ZSk7ICAgIC8vIEZJWE1FIGlzIHRoaXMgcmVhbGx5IHRoZSBiZXN0IHdlIGNhbiBkbz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlDb3B5KG5ldyBVaW50OEFycmF5KHJlc3VsdCwgb2Zmc2V0LCBmYi5zaXplKSwgMCwgdG1wLCAwLCBmYi5zaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IHRtcC5idWZmZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZiLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSBmYi5zaXplO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICsrYmk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFtcCgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdHJhbXAoKTtcbiAgICB9XG59XG5cbkJpZ1dpZ1ZpZXcucHJvdG90eXBlLnBhcnNlRmVhdHVyZXMgPSBmdW5jdGlvbihkYXRhLCBjcmVhdGVGZWF0dXJlLCBmaWx0ZXIpIHtcbiAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShkYXRhKTtcblxuICAgIGlmICh0aGlzLmlzU3VtbWFyeSkge1xuICAgICAgICB2YXIgc2EgPSBuZXcgSW50MTZBcnJheShkYXRhKTtcbiAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkoZGF0YSk7XG4gICAgICAgIHZhciBmYSA9IG5ldyBGbG9hdDMyQXJyYXkoZGF0YSk7XG5cbiAgICAgICAgdmFyIGl0ZW1Db3VudCA9IGRhdGEuYnl0ZUxlbmd0aC8zMjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVtQ291bnQ7ICsraSkge1xuICAgICAgICAgICAgdmFyIGNocm9tSWQgPSAgIGxhWyhpKjgpXTtcbiAgICAgICAgICAgIHZhciBzdGFydCA9ICAgICBsYVsoaSo4KSsxXTtcbiAgICAgICAgICAgIHZhciBlbmQgPSAgICAgICBsYVsoaSo4KSsyXTtcbiAgICAgICAgICAgIHZhciB2YWxpZENudCA9ICBsYVsoaSo4KSszXTtcbiAgICAgICAgICAgIHZhciBtaW5WYWwgICAgPSBmYVsoaSo4KSs0XTtcbiAgICAgICAgICAgIHZhciBtYXhWYWwgICAgPSBmYVsoaSo4KSs1XTtcbiAgICAgICAgICAgIHZhciBzdW1EYXRhICAgPSBmYVsoaSo4KSs2XTtcbiAgICAgICAgICAgIHZhciBzdW1TcURhdGEgPSBmYVsoaSo4KSs3XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGZpbHRlcihjaHJvbUlkLCBzdGFydCArIDEsIGVuZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyeU9wdHMgPSB7dHlwZTogJ2JpZ3dpZycsIHNjb3JlOiBzdW1EYXRhL3ZhbGlkQ250LCBtYXhTY29yZTogbWF4VmFsfTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5id2cudHlwZSA9PSAnYmlnYmVkJykge1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5T3B0cy50eXBlID0gJ2RlbnNpdHknO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjcmVhdGVGZWF0dXJlKGNocm9tSWQsIHN0YXJ0ICsgMSwgZW5kLCBzdW1tYXJ5T3B0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuYndnLnR5cGUgPT0gJ2JpZ3dpZycpIHtcbiAgICAgICAgdmFyIHNhID0gbmV3IEludDE2QXJyYXkoZGF0YSk7XG4gICAgICAgIHZhciBsYSA9IG5ldyBJbnQzMkFycmF5KGRhdGEpO1xuICAgICAgICB2YXIgZmEgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEpO1xuXG4gICAgICAgIHZhciBjaHJvbUlkID0gbGFbMF07XG4gICAgICAgIHZhciBibG9ja1N0YXJ0ID0gbGFbMV07XG4gICAgICAgIHZhciBibG9ja0VuZCA9IGxhWzJdO1xuICAgICAgICB2YXIgaXRlbVN0ZXAgPSBsYVszXTtcbiAgICAgICAgdmFyIGl0ZW1TcGFuID0gbGFbNF07XG4gICAgICAgIHZhciBibG9ja1R5cGUgPSBiYVsyMF07XG4gICAgICAgIHZhciBpdGVtQ291bnQgPSBzYVsxMV07XG4gICAgICAgIFxuICAgICAgICBpZiAoYmxvY2tUeXBlID09IEJJR19XSUdfVFlQRV9GU1RFUCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVtQ291bnQ7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBzY29yZSA9IGZhW2kgKyA2XTtcbiAgICAgICAgICAgICAgICB2YXIgZm1pbiA9IGJsb2NrU3RhcnQgKyAoaSppdGVtU3RlcCkgKyAxLCBmbWF4ID0gYmxvY2tTdGFydCArIChpKml0ZW1TdGVwKSArIGl0ZW1TcGFuO1xuICAgICAgICAgICAgICAgIGlmIChmaWx0ZXIoY2hyb21JZCwgZm1pbiwgZm1heCkpXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZUZlYXR1cmUoY2hyb21JZCwgZm1pbiwgZm1heCwge3Njb3JlOiBzY29yZX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGJsb2NrVHlwZSA9PSBCSUdfV0lHX1RZUEVfVlNURVApIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbUNvdW50OyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RhcnQgPSBsYVsoaSoyKSArIDZdICsgMTtcbiAgICAgICAgICAgICAgICB2YXIgZW5kID0gc3RhcnQgKyBpdGVtU3BhbiAtIDE7XG4gICAgICAgICAgICAgICAgdmFyIHNjb3JlID0gZmFbKGkqMikgKyA3XTtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyKGNocm9tSWQsIHN0YXJ0LCBlbmQpKVxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVGZWF0dXJlKGNocm9tSWQsIHN0YXJ0LCBlbmQsIHtzY29yZTogc2NvcmV9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChibG9ja1R5cGUgPT0gQklHX1dJR19UWVBFX0dSQVBIKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGl0ZW1Db3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0YXJ0ID0gbGFbKGkqMykgKyA2XSArIDE7XG4gICAgICAgICAgICAgICAgdmFyIGVuZCAgID0gbGFbKGkqMykgKyA3XTtcbiAgICAgICAgICAgICAgICB2YXIgc2NvcmUgPSBmYVsoaSozKSArIDhdO1xuICAgICAgICAgICAgICAgIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICAgICAgICAgICAgICBzdGFydCA9IGVuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGZpbHRlcihjaHJvbUlkLCBzdGFydCwgZW5kKSlcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlRmVhdHVyZShjaHJvbUlkLCBzdGFydCwgZW5kLCB7c2NvcmU6IHNjb3JlfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3VycmVudGx5IG5vdCBoYW5kbGluZyBid2dUeXBlPScgKyBibG9ja1R5cGUpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ3Zy50eXBlID09ICdiaWdiZWQnKSB7XG4gICAgICAgIHZhciBvZmZzZXQgPSAwO1xuICAgICAgICB2YXIgZGZjID0gdGhpcy5id2cuZGVmaW5lZEZpZWxkQ291bnQ7XG4gICAgICAgIHZhciBzY2hlbWEgPSB0aGlzLmJ3Zy5zY2hlbWE7XG5cbiAgICAgICAgd2hpbGUgKG9mZnNldCA8IGJhLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGNocm9tSWQgPSAoYmFbb2Zmc2V0KzNdPDwyNCkgfCAoYmFbb2Zmc2V0KzJdPDwxNikgfCAoYmFbb2Zmc2V0KzFdPDw4KSB8IChiYVtvZmZzZXQrMF0pO1xuICAgICAgICAgICAgdmFyIHN0YXJ0ID0gKGJhW29mZnNldCs3XTw8MjQpIHwgKGJhW29mZnNldCs2XTw8MTYpIHwgKGJhW29mZnNldCs1XTw8OCkgfCAoYmFbb2Zmc2V0KzRdKTtcbiAgICAgICAgICAgIHZhciBlbmQgPSAoYmFbb2Zmc2V0KzExXTw8MjQpIHwgKGJhW29mZnNldCsxMF08PDE2KSB8IChiYVtvZmZzZXQrOV08PDgpIHwgKGJhW29mZnNldCs4XSk7XG4gICAgICAgICAgICBvZmZzZXQgKz0gMTI7XG4gICAgICAgICAgICB2YXIgcmVzdCA9ICcnO1xuICAgICAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2ggPSBiYVtvZmZzZXQrK107XG4gICAgICAgICAgICAgICAgaWYgKGNoICE9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBmZWF0dXJlT3B0cyA9IHt9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgYmVkQ29sdW1ucztcbiAgICAgICAgICAgIGlmIChyZXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBiZWRDb2x1bW5zID0gcmVzdC5zcGxpdCgnXFx0Jyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJlZENvbHVtbnMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChiZWRDb2x1bW5zLmxlbmd0aCA+IDAgJiYgZGZjID4gMykge1xuICAgICAgICAgICAgICAgIGZlYXR1cmVPcHRzLmxhYmVsID0gYmVkQ29sdW1uc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChiZWRDb2x1bW5zLmxlbmd0aCA+IDEgJiYgZGZjID4gNCkge1xuICAgICAgICAgICAgICAgIHZhciBzY29yZSA9IHBhcnNlSW50KGJlZENvbHVtbnNbMV0pO1xuICAgICAgICAgICAgICAgIGlmICghaXNOYU4oc2NvcmUpKVxuICAgICAgICAgICAgICAgICAgICBmZWF0dXJlT3B0cy5zY29yZSA9IHNjb3JlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJlZENvbHVtbnMubGVuZ3RoID4gMiAmJiBkZmMgPiA1KSB7XG4gICAgICAgICAgICAgICAgZmVhdHVyZU9wdHMub3JpZW50YXRpb24gPSBiZWRDb2x1bW5zWzJdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGJlZENvbHVtbnMubGVuZ3RoID4gNSAmJiBkZmMgPiA4KSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbG9yID0gYmVkQ29sdW1uc1s1XTtcbiAgICAgICAgICAgICAgICBpZiAoQkVEX0NPTE9SX1JFR0VYUC50ZXN0KGNvbG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBmZWF0dXJlT3B0cy5pdGVtUmdiID0gJ3JnYignICsgY29sb3IgKyAnKSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYmVkQ29sdW1ucy5sZW5ndGggPiBkZmMtMyAmJiBzY2hlbWEpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBjb2wgPSBkZmMgLSAzOyBjb2wgPCBiZWRDb2x1bW5zLmxlbmd0aDsgKytjb2wpIHtcbiAgICAgICAgICAgICAgICAgICAgZmVhdHVyZU9wdHNbc2NoZW1hLmZpZWxkc1tjb2wrM10ubmFtZV0gPSBiZWRDb2x1bW5zW2NvbF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmlsdGVyKGNocm9tSWQsIHN0YXJ0ICsgMSwgZW5kLCBiZWRDb2x1bW5zKSkge1xuICAgICAgICAgICAgICAgIGlmIChkZmMgPCAxMikge1xuICAgICAgICAgICAgICAgICAgICBjcmVhdGVGZWF0dXJlKGNocm9tSWQsIHN0YXJ0ICsgMSwgZW5kLCBmZWF0dXJlT3B0cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRoaWNrU3RhcnQgPSBiZWRDb2x1bW5zWzNdfDA7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0aGlja0VuZCAgID0gYmVkQ29sdW1uc1s0XXwwO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYmxvY2tDb3VudCA9IGJlZENvbHVtbnNbNl18MDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJsb2NrU2l6ZXMgPSBiZWRDb2x1bW5zWzddLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBibG9ja1N0YXJ0cyA9IGJlZENvbHVtbnNbOF0uc3BsaXQoJywnKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZmVhdHVyZU9wdHMuZXhvbkZyYW1lcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGV4b25GcmFtZXMgPSBmZWF0dXJlT3B0cy5leG9uRnJhbWVzLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmZWF0dXJlT3B0cy5leG9uRnJhbWVzID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBmZWF0dXJlT3B0cy50eXBlID0gJ3RyYW5zY3JpcHQnXG4gICAgICAgICAgICAgICAgICAgIHZhciBncnAgPSBuZXcgREFTR3JvdXAoKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgayBpbiBmZWF0dXJlT3B0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JwW2tdID0gZmVhdHVyZU9wdHNba107XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZ3JwLmlkID0gYmVkQ29sdW1uc1swXTtcbiAgICAgICAgICAgICAgICAgICAgZ3JwLnNlZ21lbnQgPSB0aGlzLmJ3Zy5pZHNUb0Nocm9tc1tjaHJvbUlkXTtcbiAgICAgICAgICAgICAgICAgICAgZ3JwLm1pbiA9IHN0YXJ0ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgZ3JwLm1heCA9IGVuZDtcbiAgICAgICAgICAgICAgICAgICAgZ3JwLm5vdGVzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZlYXR1cmVPcHRzLmdyb3VwcyA9IFtncnBdO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vdmluZyB0b3dhcmRzIHVzaW5nIGJpZ0dlbmVQcmVkIG1vZGVsLCBidXQgd2lsbFxuICAgICAgICAgICAgICAgICAgICAvLyBzdGlsbCBzdXBwb3J0IG9sZCBEYWxsaWFuY2Utc3R5bGUgQkVEMTIrZ2VuZS1uYW1lIGZvciB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9yZXNlZWFibGUgZnV0dXJlLlxuICAgICAgICAgICAgICAgICAgICBpZiAoYmVkQ29sdW1ucy5sZW5ndGggPiA5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZ2VuZUlkID0gZmVhdHVyZU9wdHMuZ2VuZU5hbWUgfHwgYmVkQ29sdW1uc1s5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnZW5lTmFtZSA9IGdlbmVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiZWRDb2x1bW5zLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZU5hbWUgPSBiZWRDb2x1bW5zWzEwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmZWF0dXJlT3B0cy5nZW5lTmFtZTIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZU5hbWUgPSBmZWF0dXJlT3B0cy5nZW5lTmFtZTI7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnZyA9IHNoYWxsb3dDb3B5KGdycCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnZy5pZCA9IGdlbmVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdnLmxhYmVsID0gZ2VuZU5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBnZy50eXBlID0gJ2dlbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmVhdHVyZU9wdHMuZ3JvdXBzLnB1c2goZ2cpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwYW5MaXN0ID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGIgPSAwOyBiIDwgYmxvY2tDb3VudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYm1pbiA9IChibG9ja1N0YXJ0c1tiXXwwKSArIHN0YXJ0O1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJtYXggPSBibWluICsgKGJsb2NrU2l6ZXNbYl18MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BhbiA9IG5ldyBSYW5nZShibWluLCBibWF4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwYW5MaXN0LnB1c2goc3Bhbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwYW5zID0gdW5pb24oc3Bhbkxpc3QpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRzTGlzdCA9IHNwYW5zLnJhbmdlcygpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBzID0gMDsgcyA8IHRzTGlzdC5sZW5ndGg7ICsrcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRzID0gdHNMaXN0W3NdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlRmVhdHVyZShjaHJvbUlkLCB0cy5taW4oKSArIDEsIHRzLm1heCgpLCBmZWF0dXJlT3B0cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpY2tFbmQgPiB0aGlja1N0YXJ0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29kaW5nUmVnaW9uID0gKGZlYXR1cmVPcHRzLm9yaWVudGF0aW9uID09ICcrJykgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBSYW5nZSh0aGlja1N0YXJ0LCB0aGlja0VuZCArIDMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgUmFuZ2UodGhpY2tTdGFydCAtIDMsIHRoaWNrRW5kKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyArLy0gMyB0byBhY2NvdW50IGZvciBzdG9wIGNvZG9uXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bCA9IGludGVyc2VjdGlvbihzcGFucywgY29kaW5nUmVnaW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0bCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZlYXR1cmVPcHRzLnR5cGUgPSAndHJhbnNsYXRpb24nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bExpc3QgPSB0bC5yYW5nZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVhZGluZ0ZyYW1lID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bE9mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHRsTGlzdFswXS5taW4oKSA+IHRzTGlzdFt0bE9mZnNldF0ubWF4KCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRsT2Zmc2V0Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBzID0gMDsgcyA8IHRsTGlzdC5sZW5ndGg7ICsrcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSZWNvcmQgcmVhZGluZyBmcmFtZSBmb3IgZXZlcnkgZXhvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmVhdHVyZU9wdHMub3JpZW50YXRpb24gPT0gJy0nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSB0bExpc3QubGVuZ3RoIC0gcyAtIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cyA9IHRsTGlzdFtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZlYXR1cmVPcHRzLnJlYWRmcmFtZSA9IHJlYWRpbmdGcmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV4b25GcmFtZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBicmYgPSBwYXJzZUludChleG9uRnJhbWVzW2luZGV4ICsgdGxPZmZzZXRdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YoYnJmKSA9PT0gJ251bWJlcicgJiYgYnJmID49IDAgJiYgYnJmIDw9IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmZWF0dXJlT3B0cy5yZWFkZnJhbWUgPSBicmY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmVhdHVyZU9wdHMucmVhZGZyYW1lRXhwbGljaXQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsZW5ndGggPSB0cy5tYXgoKSAtIHRzLm1pbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkaW5nRnJhbWUgPSAocmVhZGluZ0ZyYW1lICsgbGVuZ3RoKSAlIDM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZUZlYXR1cmUoY2hyb21JZCwgdHMubWluKCkgKyAxLCB0cy5tYXgoKSwgZmVhdHVyZU9wdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKFwiRG9uJ3Qga25vdyB3aGF0IHRvIGRvIHdpdGggXCIgKyB0aGlzLmJ3Zy50eXBlKTtcbiAgICB9XG59XG5cbi8vXG4vLyBuYXN0eSBjdXQvcGFzdGUsIHNob3VsZCByb2xsIGJhY2sgaW4hXG4vL1xuXG5CaWdXaWdWaWV3LnByb3RvdHlwZS5nZXRGaXJzdEFkamFjZW50ID0gZnVuY3Rpb24oY2hyTmFtZSwgcG9zLCBkaXIsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGNociA9IHRoaXMuYndnLmNocm9tc1RvSURzW2Nock5hbWVdO1xuICAgIGlmIChjaHIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBOb3QgYW4gZXJyb3IgYmVjYXVzZSBzb21lIC5id2dzIHdvbid0IGhhdmUgZGF0YSBmb3IgYWxsIGNocm9tb3NvbWVzLlxuICAgICAgICByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2V0Rmlyc3RBZGphY2VudEJ5SWQoY2hyLCBwb3MsIGRpciwgY2FsbGJhY2spO1xuICAgIH1cbn1cblxuQmlnV2lnVmlldy5wcm90b3R5cGUuZ2V0Rmlyc3RBZGphY2VudEJ5SWQgPSBmdW5jdGlvbihjaHIsIHBvcywgZGlyLCBjYWxsYmFjaykge1xuICAgIHZhciB0aGlzQiA9IHRoaXM7XG4gICAgaWYgKCF0aGlzLmNpckhlYWRlcikge1xuICAgICAgICB0aGlzLmJ3Zy5kYXRhLnNsaWNlKHRoaXMuY2lyVHJlZU9mZnNldCwgNDgpLmZldGNoKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgdGhpc0IuY2lySGVhZGVyID0gcmVzdWx0O1xuICAgICAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkodGhpc0IuY2lySGVhZGVyKTtcbiAgICAgICAgICAgIHRoaXNCLmNpckJsb2NrU2l6ZSA9IGxhWzFdO1xuICAgICAgICAgICAgdGhpc0IuZ2V0Rmlyc3RBZGphY2VudEJ5SWQoY2hyLCBwb3MsIGRpciwgY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBibG9ja1RvRmV0Y2ggPSBudWxsO1xuICAgIHZhciBiZXN0QmxvY2tDaHIgPSAtMTtcbiAgICB2YXIgYmVzdEJsb2NrT2Zmc2V0ID0gLTE7XG5cbiAgICB2YXIgb3V0c3RhbmRpbmcgPSAwO1xuXG4gICAgdmFyIGJlZm9yZUJXRyA9IERhdGUubm93KCk7XG5cbiAgICB2YXIgY2lyRm9iUmVjdXIgPSBmdW5jdGlvbihvZmZzZXQsIGxldmVsKSB7XG4gICAgICAgIG91dHN0YW5kaW5nICs9IG9mZnNldC5sZW5ndGg7XG5cbiAgICAgICAgdmFyIG1heENpckJsb2NrU3BhbiA9IDQgKyAgKHRoaXNCLmNpckJsb2NrU2l6ZSAqIDMyKTsgICAvLyBVcHBlciBib3VuZCBvbiBzaXplLCBiYXNlZCBvbiBhIGNvbXBsZXRlbHkgZnVsbCBsZWFmIG5vZGUuXG4gICAgICAgIHZhciBzcGFucztcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvZmZzZXQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBibG9ja1NwYW4gPSBuZXcgUmFuZ2Uob2Zmc2V0W2ldLCBvZmZzZXRbaV0gKyBtYXhDaXJCbG9ja1NwYW4pO1xuICAgICAgICAgICAgc3BhbnMgPSBzcGFucyA/IHVuaW9uKHNwYW5zLCBibG9ja1NwYW4pIDogYmxvY2tTcGFuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgZmV0Y2hSYW5nZXMgPSBzcGFucy5yYW5nZXMoKTtcbiAgICAgICAgZm9yICh2YXIgciA9IDA7IHIgPCBmZXRjaFJhbmdlcy5sZW5ndGg7ICsrcikge1xuICAgICAgICAgICAgdmFyIGZyID0gZmV0Y2hSYW5nZXNbcl07XG4gICAgICAgICAgICBjaXJGb2JTdGFydEZldGNoKG9mZnNldCwgZnIsIGxldmVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBjaXJGb2JTdGFydEZldGNoID0gZnVuY3Rpb24ob2Zmc2V0LCBmciwgbGV2ZWwsIGF0dGVtcHRzKSB7XG4gICAgICAgIHZhciBsZW5ndGggPSBmci5tYXgoKSAtIGZyLm1pbigpO1xuICAgICAgICB0aGlzQi5id2cuZGF0YS5zbGljZShmci5taW4oKSwgZnIubWF4KCkgLSBmci5taW4oKSkuZmV0Y2goZnVuY3Rpb24ocmVzdWx0QnVmZmVyKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9mZnNldC5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGlmIChmci5jb250YWlucyhvZmZzZXRbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgIGNpckZvYlJlY3VyMihyZXN1bHRCdWZmZXIsIG9mZnNldFtpXSAtIGZyLm1pbigpLCBsZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgIC0tb3V0c3RhbmRpbmc7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvdXRzdGFuZGluZyA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWJsb2NrVG9GZXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkaXIgPiAwICYmIChjaHIgIT0gMCB8fCBwb3MgPiAwKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpc0IuZ2V0Rmlyc3RBZGphY2VudEJ5SWQoMCwgMCwgZGlyLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkaXIgPCAwICYmIChjaHIgIT0gdGhpc0IuYndnLm1heElEIHx8IHBvcyA8IDEwMDAwMDAwMDApKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzQi5nZXRGaXJzdEFkamFjZW50QnlJZCh0aGlzQi5id2cubWF4SUQsIDEwMDAwMDAwMDAsIGRpciwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzQi5mZXRjaEZlYXR1cmVzKGZ1bmN0aW9uKGNocngsIGZtaW4sIGZtYXgsIHRva3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGRpciA8IDAgJiYgKGNocnggPCBjaHIgfHwgZm1heCA8IHBvcykpIHx8IChkaXIgPiAwICYmIChjaHJ4ID4gY2hyIHx8IGZtaW4gPiBwb3MpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIFtibG9ja1RvRmV0Y2hdLCBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiZXN0RmVhdHVyZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJlc3RDaHIgPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmVzdFBvcyA9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGZpID0gMDsgZmkgPCBmZWF0dXJlcy5sZW5ndGg7ICsrZmkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGYgPSBmZWF0dXJlc1tmaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaHJ4ID0gZi5fY2hyb21JZCwgZm1pbiA9IGYubWluLCBmbWF4ID0gZi5tYXg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiZXN0RmVhdHVyZSA9PSBudWxsIHx8ICgoZGlyIDwgMCkgJiYgKGNocnggPiBiZXN0Q2hyIHx8IGZtYXggPiBiZXN0UG9zKSkgfHwgKChkaXIgPiAwKSAmJiAoY2hyeCA8IGJlc3RDaHIgfHwgZm1pbiA8IGJlc3RQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmVzdEZlYXR1cmUgPSBmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmVzdFBvcyA9IChkaXIgPCAwKSA/IGZtYXggOiBmbWluO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmVzdENociA9IGNocng7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYmVzdEZlYXR1cmUgIT0gbnVsbCkgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhbYmVzdEZlYXR1cmVdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdmFyIGNpckZvYlJlY3VyMiA9IGZ1bmN0aW9uKGNpckJsb2NrRGF0YSwgb2Zmc2V0LCBsZXZlbCkge1xuICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShjaXJCbG9ja0RhdGEpO1xuICAgICAgICB2YXIgc2EgPSBuZXcgSW50MTZBcnJheShjaXJCbG9ja0RhdGEpO1xuICAgICAgICB2YXIgbGEgPSBuZXcgSW50MzJBcnJheShjaXJCbG9ja0RhdGEpO1xuXG4gICAgICAgIHZhciBpc0xlYWYgPSBiYVtvZmZzZXRdO1xuICAgICAgICB2YXIgY250ID0gc2Fbb2Zmc2V0LzIgKyAxXTtcbiAgICAgICAgb2Zmc2V0ICs9IDQ7XG5cbiAgICAgICAgaWYgKGlzTGVhZiAhPSAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxvID0gb2Zmc2V0LzQ7XG4gICAgICAgICAgICAgICAgdmFyIHN0YXJ0Q2hyb20gPSBsYVtsb107XG4gICAgICAgICAgICAgICAgdmFyIHN0YXJ0QmFzZSA9IGxhW2xvICsgMV07XG4gICAgICAgICAgICAgICAgdmFyIGVuZENocm9tID0gbGFbbG8gKyAyXTtcbiAgICAgICAgICAgICAgICB2YXIgZW5kQmFzZSA9IGxhW2xvICsgM107XG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIG9mZnNldCsxNik7XG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrU2l6ZSA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCBvZmZzZXQrMjQpO1xuICAgICAgICAgICAgICAgIGlmICgoZGlyIDwgMCAmJiAoKHN0YXJ0Q2hyb20gPCBjaHIgfHwgKHN0YXJ0Q2hyb20gPT0gY2hyICYmIHN0YXJ0QmFzZSA8PSBwb3MpKSkpIHx8XG4gICAgICAgICAgICAgICAgICAgIChkaXIgPiAwICYmICgoZW5kQ2hyb20gPiBjaHIgfHwgKGVuZENocm9tID09IGNociAmJiBlbmRCYXNlID49IHBvcykpKSkpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnR290IGFuIGludGVyZXN0aW5nIGJsb2NrOiBzdGFydEJhc2U9JyArIHN0YXJ0Q2hyb20gKyAnOicgKyBzdGFydEJhc2UgKyAnOyBlbmRCYXNlPScgKyBlbmRDaHJvbSArICc6JyArIGVuZEJhc2UgKyAnOyBvZmZzZXQ9JyArIGJsb2NrT2Zmc2V0ICsgJzsgc2l6ZT0nICsgYmxvY2tTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKC9fcmFuZG9tLy5leGVjKHRoaXNCLmJ3Zy5pZHNUb0Nocm9tc1tzdGFydENocm9tXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRsb2coJ3NraXBwaW5nIHJhbmRvbTogJyArIHRoaXNCLmJ3Zy5pZHNUb0Nocm9tc1tzdGFydENocm9tXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYmxvY2tUb0ZldGNoID09IG51bGwgfHwgKChkaXIgPCAwKSAmJiAoZW5kQ2hyb20gPiBiZXN0QmxvY2tDaHIgfHwgKGVuZENocm9tID09IGJlc3RCbG9ja0NociAmJiBlbmRCYXNlID4gYmVzdEJsb2NrT2Zmc2V0KSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGlyID4gMCkgJiYgKHN0YXJ0Q2hyb20gPCBiZXN0QmxvY2tDaHIgfHwgKHN0YXJ0Q2hyb20gPT0gYmVzdEJsb2NrQ2hyICYmIHN0YXJ0QmFzZSA8IGJlc3RCbG9ja09mZnNldCkpKSlcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICBkbG9nKCdiZXN0IGlzOiBzdGFydEJhc2U9JyArIHN0YXJ0Q2hyb20gKyAnOicgKyBzdGFydEJhc2UgKyAnOyBlbmRCYXNlPScgKyBlbmRDaHJvbSArICc6JyArIGVuZEJhc2UgKyAnOyBvZmZzZXQ9JyArIGJsb2NrT2Zmc2V0ICsgJzsgc2l6ZT0nICsgYmxvY2tTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJsb2NrVG9GZXRjaCA9IHtvZmZzZXQ6IGJsb2NrT2Zmc2V0LCBzaXplOiBibG9ja1NpemV9O1xuICAgICAgICAgICAgICAgICAgICAgICAgYmVzdEJsb2NrT2Zmc2V0ID0gKGRpciA8IDApID8gZW5kQmFzZSA6IHN0YXJ0QmFzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlc3RCbG9ja0NociA9IChkaXIgPCAwKSA/IGVuZENocm9tIDogc3RhcnRDaHJvbTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gMzI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYmVzdFJlY3VyID0gLTE7XG4gICAgICAgICAgICB2YXIgYmVzdFBvcyA9IC0xO1xuICAgICAgICAgICAgdmFyIGJlc3RDaHIgPSAtMTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY250OyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgbG8gPSBvZmZzZXQvNDtcbiAgICAgICAgICAgICAgICB2YXIgc3RhcnRDaHJvbSA9IGxhW2xvXTtcbiAgICAgICAgICAgICAgICB2YXIgc3RhcnRCYXNlID0gbGFbbG8gKyAxXTtcbiAgICAgICAgICAgICAgICB2YXIgZW5kQ2hyb20gPSBsYVtsbyArIDJdO1xuICAgICAgICAgICAgICAgIHZhciBlbmRCYXNlID0gbGFbbG8gKyAzXTtcbiAgICAgICAgICAgICAgICB2YXIgYmxvY2tPZmZzZXQgPSAobGFbbG8gKyA0XTw8MzIpIHwgKGxhW2xvICsgNV0pO1xuICAgICAgICAgICAgICAgIGlmICgoZGlyIDwgMCAmJiAoKHN0YXJ0Q2hyb20gPCBjaHIgfHwgKHN0YXJ0Q2hyb20gPT0gY2hyICYmIHN0YXJ0QmFzZSA8PSBwb3MpKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGVuZENocm9tICAgPj0gY2hyKSkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAoZGlyID4gMCAmJiAoKGVuZENocm9tID4gY2hyIHx8IChlbmRDaHJvbSA9PSBjaHIgJiYgZW5kQmFzZSA+PSBwb3MpKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGFydENocm9tIDw9IGNocikpKSlcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiZXN0UmVjdXIgPCAwIHx8IGVuZEJhc2UgPiBiZXN0UG9zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBiZXN0UmVjdXIgPSBibG9ja09mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlc3RQb3MgPSAoZGlyIDwgMCkgPyBlbmRCYXNlIDogc3RhcnRCYXNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYmVzdENociA9IChkaXIgPCAwKSA/IGVuZENocm9tIDogc3RhcnRDaHJvbTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gMjQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYmVzdFJlY3VyID49IDApIHtcbiAgICAgICAgICAgICAgICBjaXJGb2JSZWN1cihbYmVzdFJlY3VyXSwgbGV2ZWwgKyAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgXG5cbiAgICBjaXJGb2JSZWN1cihbdGhpc0IuY2lyVHJlZU9mZnNldCArIDQ4XSwgMSk7XG59XG5cbkJpZ1dpZy5wcm90b3R5cGUucmVhZFdpZ0RhdGEgPSBmdW5jdGlvbihjaHJOYW1lLCBtaW4sIG1heCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmdldFVuem9vbWVkVmlldygpLnJlYWRXaWdEYXRhKGNock5hbWUsIG1pbiwgbWF4LCBjYWxsYmFjayk7XG59XG5cbkJpZ1dpZy5wcm90b3R5cGUuZ2V0VW56b29tZWRWaWV3ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLnVuem9vbWVkVmlldykge1xuICAgICAgICB2YXIgY2lyTGVuID0gNDAwMDtcbiAgICAgICAgdmFyIG56bCA9IHRoaXMuem9vbUxldmVsc1swXTtcbiAgICAgICAgaWYgKG56bCkge1xuICAgICAgICAgICAgY2lyTGVuID0gdGhpcy56b29tTGV2ZWxzWzBdLmRhdGFPZmZzZXQgLSB0aGlzLnVuem9vbWVkSW5kZXhPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51bnpvb21lZFZpZXcgPSBuZXcgQmlnV2lnVmlldyh0aGlzLCB0aGlzLnVuem9vbWVkSW5kZXhPZmZzZXQsIGNpckxlbiwgZmFsc2UpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy51bnpvb21lZFZpZXc7XG59XG5cbkJpZ1dpZy5wcm90b3R5cGUuZ2V0Wm9vbWVkVmlldyA9IGZ1bmN0aW9uKHopIHtcbiAgICB2YXIgemggPSB0aGlzLnpvb21MZXZlbHNbel07XG4gICAgaWYgKCF6aC52aWV3KSB7XG4gICAgICAgIHpoLnZpZXcgPSBuZXcgQmlnV2lnVmlldyh0aGlzLCB6aC5pbmRleE9mZnNldCwgLyogdGhpcy56b29tTGV2ZWxzW3ogKyAxXS5kYXRhT2Zmc2V0IC0gemguaW5kZXhPZmZzZXQgKi8gNDAwMCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiB6aC52aWV3O1xufVxuXG5mdW5jdGlvbiBtYWtlQndnKGRhdGEsIGNhbGxiYWNrLCBuYW1lKSB7XG4gICAgdmFyIGJ3ZyA9IG5ldyBCaWdXaWcoKTtcbiAgICBid2cuZGF0YSA9IGRhdGE7XG4gICAgYndnLm5hbWUgPSBuYW1lO1xuICAgIGJ3Zy5kYXRhLnNsaWNlKDAsIDUxMikuc2FsdGVkKCkuZmV0Y2goZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgXCJDb3VsZG4ndCBmZXRjaCBmaWxlXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGhlYWRlciA9IHJlc3VsdDtcbiAgICAgICAgdmFyIGJhID0gbmV3IFVpbnQ4QXJyYXkoaGVhZGVyKTtcbiAgICAgICAgdmFyIHNhID0gbmV3IEludDE2QXJyYXkoaGVhZGVyKTtcbiAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkoaGVhZGVyKTtcbiAgICAgICAgdmFyIG1hZ2ljID0gYmFbMF0gKyAoTTEgKiBiYVsxXSkgKyAoTTIgKiBiYVsyXSkgKyAoTTMgKiBiYVszXSk7XG4gICAgICAgIGlmIChtYWdpYyA9PSBCSUdfV0lHX01BR0lDKSB7XG4gICAgICAgICAgICBid2cudHlwZSA9ICdiaWd3aWcnO1xuICAgICAgICB9IGVsc2UgaWYgKG1hZ2ljID09IEJJR19CRURfTUFHSUMpIHtcbiAgICAgICAgICAgIGJ3Zy50eXBlID0gJ2JpZ2JlZCc7XG4gICAgICAgIH0gZWxzZSBpZiAobWFnaWMgPT0gQklHX1dJR19NQUdJQ19CRSB8fCBtYWdpYyA9PSBCSUdfQkVEX01BR0lDX0JFKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgXCJDdXJyZW50bHkgZG9uJ3Qgc3VwcG9ydCBiaWctZW5kaWFuIEJCSSBmaWxlc1wiKTtcbiAgICAgICAgICAgIFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIFwiTm90IGEgc3VwcG9ydGVkIGZvcm1hdCwgbWFnaWM9MHhcIiArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIGJ3Zy52ZXJzaW9uID0gc2FbMl07ICAgICAgICAgICAgIC8vIDRcbiAgICAgICAgYndnLm51bVpvb21MZXZlbHMgPSBzYVszXTsgICAgICAgLy8gNlxuICAgICAgICBid2cuY2hyb21UcmVlT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIDgpO1xuICAgICAgICBid2cudW56b29tZWREYXRhT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIDE2KTtcbiAgICAgICAgYndnLnVuem9vbWVkSW5kZXhPZmZzZXQgPSBid2dfcmVhZE9mZnNldChiYSwgMjQpO1xuICAgICAgICBid2cuZmllbGRDb3VudCA9IHNhWzE2XTsgICAgICAgICAvLyAzMlxuICAgICAgICBid2cuZGVmaW5lZEZpZWxkQ291bnQgPSBzYVsxN107ICAvLyAzNFxuICAgICAgICBid2cuYXNPZmZzZXQgPSBid2dfcmVhZE9mZnNldChiYSwgMzYpO1xuICAgICAgICBid2cudG90YWxTdW1tYXJ5T2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIDQ0KTtcbiAgICAgICAgYndnLnVuY29tcHJlc3NCdWZTaXplID0gbGFbMTNdOyAgLy8gNTJcbiAgICAgICAgYndnLmV4dEhlYWRlck9mZnNldCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCA1Nik7XG5cbiAgICAgICAgYndnLnpvb21MZXZlbHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgemwgPSAwOyB6bCA8IGJ3Zy5udW1ab29tTGV2ZWxzOyArK3psKSB7XG4gICAgICAgICAgICB2YXIgemxSZWR1Y3Rpb24gPSBsYVt6bCo2ICsgMTZdXG4gICAgICAgICAgICB2YXIgemxEYXRhID0gYndnX3JlYWRPZmZzZXQoYmEsIHpsKjI0ICsgNzIpO1xuICAgICAgICAgICAgdmFyIHpsSW5kZXggPSBid2dfcmVhZE9mZnNldChiYSwgemwqMjQgKyA4MCk7XG4gICAgICAgICAgICBid2cuem9vbUxldmVscy5wdXNoKHtyZWR1Y3Rpb246IHpsUmVkdWN0aW9uLCBkYXRhT2Zmc2V0OiB6bERhdGEsIGluZGV4T2Zmc2V0OiB6bEluZGV4fSk7XG4gICAgICAgIH1cblxuICAgICAgICBid2cucmVhZENocm9tVHJlZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGJ3Zy5nZXRBdXRvU1FMKGZ1bmN0aW9uKGFzKSB7XG4gICAgICAgICAgICAgICAgYndnLnNjaGVtYSA9IGFzO1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhid2cpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sIHt0aW1lb3V0OiA1MDAwfSk7ICAgIC8vIFBvdGVudGlhbCB0aW1lb3V0IG9uIGZpcnN0IHJlcXVlc3QgdG8gY2F0Y2ggbWl4ZWQtY29udGVudCBlcnJvcnMgb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaHJvbWl1bS5cbn1cblxuXG5CaWdXaWcucHJvdG90eXBlLl90c0ZldGNoID0gZnVuY3Rpb24oem9vbSwgY2hyLCBtaW4sIG1heCwgY2FsbGJhY2spIHtcbiAgICB2YXIgYndnID0gdGhpcztcbiAgICBpZiAoem9vbSA+PSB0aGlzLnpvb21MZXZlbHMubGVuZ3RoIC0gMSkge1xuICAgICAgICBpZiAoIXRoaXMudG9wTGV2ZWxSZWR1Y3Rpb25DYWNoZSkge1xuICAgICAgICAgICAgdGhpcy5nZXRab29tZWRWaWV3KHRoaXMuem9vbUxldmVscy5sZW5ndGggLSAxKS5yZWFkV2lnRGF0YUJ5SWQoLTEsIDAsIDMwMDAwMDAwMCwgZnVuY3Rpb24oZmVhdHMpIHtcbiAgICAgICAgICAgICAgICBid2cudG9wTGV2ZWxSZWR1Y3Rpb25DYWNoZSA9IGZlYXRzO1xuICAgICAgICAgICAgICAgIHJldHVybiBid2cuX3RzRmV0Y2goem9vbSwgY2hyLCBtaW4sIG1heCwgY2FsbGJhY2spO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgZiA9IFtdO1xuICAgICAgICAgICAgdmFyIGMgPSB0aGlzLnRvcExldmVsUmVkdWN0aW9uQ2FjaGU7XG4gICAgICAgICAgICBmb3IgKHZhciBmaSA9IDA7IGZpIDwgYy5sZW5ndGg7ICsrZmkpIHtcbiAgICAgICAgICAgICAgICBpZiAoY1tmaV0uX2Nocm9tSWQgPT0gY2hyKSB7XG4gICAgICAgICAgICAgICAgICAgIGYucHVzaChjW2ZpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGYpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHZpZXc7XG4gICAgICAgIGlmICh6b29tIDwgMCkge1xuICAgICAgICAgICAgdmlldyA9IHRoaXMuZ2V0VW56b29tZWRWaWV3KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2aWV3ID0gdGhpcy5nZXRab29tZWRWaWV3KHpvb20pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2aWV3LnJlYWRXaWdEYXRhQnlJZChjaHIsIG1pbiwgbWF4LCBjYWxsYmFjayk7XG4gICAgfVxufVxuXG5CaWdXaWcucHJvdG90eXBlLnRocmVzaG9sZFNlYXJjaCA9IGZ1bmN0aW9uKGNock5hbWUsIHJlZmVyZW5jZVBvaW50LCBkaXIsIHRocmVzaG9sZCwgY2FsbGJhY2spIHtcbiAgICBkaXIgPSAoZGlyPDApID8gLTEgOiAxO1xuICAgIHZhciBid2cgPSB0aGlzO1xuICAgIHZhciBpbml0aWFsQ2hyID0gdGhpcy5jaHJvbXNUb0lEc1tjaHJOYW1lXTtcbiAgICB2YXIgY2FuZGlkYXRlcyA9IFt7Y2hyT3JkOiAwLCBjaHI6IGluaXRpYWxDaHIsIHpvb206IGJ3Zy56b29tTGV2ZWxzLmxlbmd0aCAtIDQsIG1pbjogMCwgbWF4OiAzMDAwMDAwMDAsIGZyb21SZWY6IHRydWV9XVxuICAgIGZvciAodmFyIGkgPSAxOyBpIDw9IHRoaXMubWF4SUQgKyAxOyArK2kpIHtcbiAgICAgICAgdmFyIGNocklkID0gKGluaXRpYWxDaHIgKyAoZGlyKmkpKSAlICh0aGlzLm1heElEICsgMSk7XG4gICAgICAgIGlmIChjaHJJZCA8IDApIFxuICAgICAgICAgICAgY2hySWQgKz0gKHRoaXMubWF4SUQgKyAxKTtcbiAgICAgICAgY2FuZGlkYXRlcy5wdXNoKHtjaHJPcmQ6IGksIGNocjogY2hySWQsIHpvb206IGJ3Zy56b29tTGV2ZWxzLmxlbmd0aCAtIDEsIG1pbjogMCwgbWF4OiAzMDAwMDAwMDB9KVxuICAgIH1cbiAgICAgICBcbiAgICBmdW5jdGlvbiBmYlRocmVzaG9sZFNlYXJjaFJlY3VyKCkge1xuICAgIFx0aWYgKGNhbmRpZGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICBcdCAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG4gICAgXHR9XG4gICAgXHRjYW5kaWRhdGVzLnNvcnQoZnVuY3Rpb24oYzEsIGMyKSB7XG4gICAgXHQgICAgdmFyIGQgPSBjMS56b29tIC0gYzIuem9vbTtcbiAgICBcdCAgICBpZiAoZCAhPSAwKVxuICAgIFx0XHQgICAgcmV0dXJuIGQ7XG5cbiAgICAgICAgICAgIGQgPSBjMS5jaHJPcmQgLSBjMi5jaHJPcmQ7XG4gICAgICAgICAgICBpZiAoZCAhPSAwKVxuICAgICAgICAgICAgICAgIHJldHVybiBkO1xuICAgIFx0ICAgIGVsc2VcbiAgICBcdFx0ICAgIHJldHVybiBjMS5taW4gLSBjMi5taW4gKiBkaXI7XG4gICAgXHR9KTtcblxuXHQgICAgdmFyIGNhbmRpZGF0ZSA9IGNhbmRpZGF0ZXMuc3BsaWNlKDAsIDEpWzBdO1xuICAgICAgICBid2cuX3RzRmV0Y2goY2FuZGlkYXRlLnpvb20sIGNhbmRpZGF0ZS5jaHIsIGNhbmRpZGF0ZS5taW4sIGNhbmRpZGF0ZS5tYXgsIGZ1bmN0aW9uKGZlYXRzKSB7XG4gICAgICAgICAgICB2YXIgcnAgPSBkaXIgPiAwID8gMCA6IDMwMDAwMDAwMDtcbiAgICAgICAgICAgIGlmIChjYW5kaWRhdGUuZnJvbVJlZilcbiAgICAgICAgICAgICAgICBycCA9IHJlZmVyZW5jZVBvaW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKHZhciBmaSA9IDA7IGZpIDwgZmVhdHMubGVuZ3RoOyArK2ZpKSB7XG4gICAgXHQgICAgICAgIHZhciBmID0gZmVhdHNbZmldO1xuICAgICAgICAgICAgICAgIHZhciBzY29yZTtcbiAgICAgICAgICAgICAgICBpZiAoZi5tYXhTY29yZSAhPSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgICAgIHNjb3JlID0gZi5tYXhTY29yZTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHNjb3JlID0gZi5zY29yZTtcblxuICAgICAgICAgICAgICAgIGlmIChkaXIgPiAwKSB7XG4gICAgXHQgICAgICAgICAgICBpZiAoc2NvcmUgPiB0aHJlc2hvbGQpIHtcbiAgICAgICAgXHRcdCAgICAgICAgaWYgKGNhbmRpZGF0ZS56b29tIDwgMCkge1xuICAgICAgICBcdFx0ICAgICAgICAgICAgaWYgKGYubWluID4gcnApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhmKTtcbiAgICAgICAgXHRcdCAgICAgICAgfSBlbHNlIGlmIChmLm1heCA+IHJwKSB7XG4gICAgICAgIFx0XHQgICAgICAgICAgICBjYW5kaWRhdGVzLnB1c2goe2NocjogY2FuZGlkYXRlLmNociwgY2hyT3JkOiBjYW5kaWRhdGUuY2hyT3JkLCB6b29tOiBjYW5kaWRhdGUuem9vbSAtIDIsIG1pbjogZi5taW4sIG1heDogZi5tYXgsIGZyb21SZWY6IGNhbmRpZGF0ZS5mcm9tUmVmfSk7XG4gICAgICAgIFx0XHQgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzY29yZSA+IHRocmVzaG9sZCkge1xuICAgICAgICAgICAgXHRcdCAgICBpZiAoY2FuZGlkYXRlLnpvb20gPCAwKSB7XG4gICAgICAgICAgICAgICAgXHQgICAgICAgIGlmIChmLm1heCA8IHJwKVxuICAgICAgICAgICAgICAgIFx0XHRcdCAgICByZXR1cm4gY2FsbGJhY2soZik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGYubWluIDwgcnApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW5kaWRhdGVzLnB1c2goe2NocjogY2FuZGlkYXRlLmNociwgY2hyT3JkOiBjYW5kaWRhdGUuY2hyT3JkLCB6b29tOiBjYW5kaWRhdGUuem9vbSAtIDIsIG1pbjogZi5taW4sIG1heDogZi5tYXgsIGZyb21SZWY6IGNhbmRpZGF0ZS5mcm9tUmVmfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgXHQgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgIFx0ICAgIH1cbiAgICAgICAgICAgIGZiVGhyZXNob2xkU2VhcmNoUmVjdXIoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIGZiVGhyZXNob2xkU2VhcmNoUmVjdXIoKTtcbn1cblxuQmlnV2lnLnByb3RvdHlwZS5nZXRBdXRvU1FMID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgdGhpc0IgPSB0aGlzO1xuICAgIGlmICghdGhpcy5hc09mZnNldClcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuXG5cbiAgICB0aGlzLmRhdGEuc2xpY2UodGhpcy5hc09mZnNldCwgMjA0OCkuZmV0Y2goZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHZhciBiYSA9IG5ldyBVaW50OEFycmF5KHJlc3VsdCk7XG4gICAgICAgIHZhciBzID0gJyc7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmEubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChiYVtpXSA9PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJhW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLyogXG4gICAgICAgICAqIFF1aWNrJ24nZGlydHkgYXR0ZW1wdCB0byBwYXJzZSBhdXRvU3FsIGZvcm1hdC5cbiAgICAgICAgICogU2VlOiBodHRwOi8vd3d3LmxpbnV4am91cm5hbC5jb20vZmlsZXMvbGludXhqb3VybmFsLmNvbS9saW51eGpvdXJuYWwvYXJ0aWNsZXMvMDU5LzU5NDkvNTk0OWwyLmh0bWxcbiAgICAgICAgICovXG5cbiAgICAgICAgdmFyIGhlYWRlcl9yZSA9IC8oXFx3KylcXHMrKFxcdyspXFxzKyhcIihbXlwiXSspXCIpP1xccytcXChcXHMqLztcbiAgICAgICAgdmFyIGZpZWxkX3JlID0gLyhbXFx3XFxbXFxdXSspXFxzKyhcXHcrKVxccyo7XFxzKihcIihbXlwiXSspXCIpP1xccyovZztcblxuICAgICAgICB2YXIgaGVhZGVyTWF0Y2ggPSBoZWFkZXJfcmUuZXhlYyhzKTtcbiAgICAgICAgaWYgKGhlYWRlck1hdGNoKSB7XG4gICAgICAgICAgICB2YXIgYXMgPSB7XG4gICAgICAgICAgICAgICAgZGVjbFR5cGU6IGhlYWRlck1hdGNoWzFdLFxuICAgICAgICAgICAgICAgIG5hbWU6IGhlYWRlck1hdGNoWzJdLFxuICAgICAgICAgICAgICAgIGNvbW1lbnQ6IGhlYWRlck1hdGNoWzRdLFxuXG4gICAgICAgICAgICAgICAgZmllbGRzOiBbXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcyA9IHMuc3Vic3RyaW5nKGhlYWRlck1hdGNoWzBdKTtcbiAgICAgICAgICAgIGZvciAodmFyIG0gPSBmaWVsZF9yZS5leGVjKHMpOyBtICE9IG51bGw7IG0gPSBmaWVsZF9yZS5leGVjKHMpKSB7XG4gICAgICAgICAgICAgICAgYXMuZmllbGRzLnB1c2goe3R5cGU6IG1bMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IG1bMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1lbnQ6IG1bNF19KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGFzKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5CaWdXaWcucHJvdG90eXBlLmdldEV4dHJhSW5kaWNlcyA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHRoaXNCID0gdGhpcztcbiAgICBpZiAodGhpcy52ZXJzaW9uIDwgNCB8fCB0aGlzLmV4dEhlYWRlck9mZnNldCA9PSAwIHx8IHRoaXMudHlwZSAhPSAnYmlnYmVkJykge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kYXRhLnNsaWNlKHRoaXMuZXh0SGVhZGVyT2Zmc2V0LCA2NCkuZmV0Y2goZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBcIkNvdWxkbid0IGZldGNoIGV4dGVuc2lvbiBoZWFkZXJcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBiYSA9IG5ldyBVaW50OEFycmF5KHJlc3VsdCk7XG4gICAgICAgICAgICB2YXIgc2EgPSBuZXcgSW50MTZBcnJheShyZXN1bHQpO1xuICAgICAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkocmVzdWx0KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGV4dEhlYWRlclNpemUgPSBzYVswXTtcbiAgICAgICAgICAgIHZhciBleHRyYUluZGV4Q291bnQgPSBzYVsxXTtcbiAgICAgICAgICAgIHZhciBleHRyYUluZGV4TGlzdE9mZnNldCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCA0KTtcblxuICAgICAgICAgICAgaWYgKGV4dHJhSW5kZXhDb3VudCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGSVhNRSAyMGJ5dGUgcmVjb3JkcyBvbmx5IG1ha2Ugc2Vuc2UgZm9yIHNpbmdsZS1maWVsZCBpbmRpY2VzLlxuICAgICAgICAgICAgLy8gUmlnaHQgbm93LCB0aGVzZSBzZWVtIHRvIGJlIHRoZSBvbmx5IHRoaW5ncyBhcm91bmQsIGJ1dCB0aGUgZm9ybWF0XG4gICAgICAgICAgICAvLyBpcyBhY3R1YWxseSBtb3JlIGdlbmVyYWwuXG4gICAgICAgICAgICB0aGlzQi5kYXRhLnNsaWNlKGV4dHJhSW5kZXhMaXN0T2Zmc2V0LCBleHRyYUluZGV4Q291bnQgKiAyMCkuZmV0Y2goZnVuY3Rpb24oZWlsKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIFwiQ291bGRuJ3QgZmV0Y2ggaW5kZXggaW5mb1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShlaWwpO1xuICAgICAgICAgICAgICAgIHZhciBzYSA9IG5ldyBJbnQxNkFycmF5KGVpbCk7XG4gICAgICAgICAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkoZWlsKTtcblxuICAgICAgICAgICAgICAgIHZhciBpbmRpY2VzID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGV4dHJhSW5kZXhDb3VudDsgKytpaSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZWlUeXBlID0gc2FbaWkqMTBdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZWlGaWVsZENvdW50ID0gc2FbaWkqMTAgKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVpT2Zmc2V0ID0gYndnX3JlYWRPZmZzZXQoYmEsIGlpKjIwICsgNCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlaUZpZWxkID0gc2FbaWkqMTAgKyA4XVxuICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBuZXcgQkJJRXh0cmFJbmRleCh0aGlzQiwgZWlUeXBlLCBlaUZpZWxkQ291bnQsIGVpT2Zmc2V0LCBlaUZpZWxkKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcy5wdXNoKGluZGV4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soaW5kaWNlcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBCQklFeHRyYUluZGV4KGJiaSwgdHlwZSwgZmllbGRDb3VudCwgb2Zmc2V0LCBmaWVsZCkge1xuICAgIHRoaXMuYmJpID0gYmJpO1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5maWVsZENvdW50ID0gZmllbGRDb3VudDtcbiAgICB0aGlzLm9mZnNldCA9IG9mZnNldDtcbiAgICB0aGlzLmZpZWxkID0gZmllbGQ7XG59XG5cbkJCSUV4dHJhSW5kZXgucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHRoaXNCID0gdGhpcztcblxuICAgIHRoaXMuYmJpLmRhdGEuc2xpY2UodGhpcy5vZmZzZXQsIDMyKS5mZXRjaChmdW5jdGlvbihicHQpIHtcbiAgICAgICAgdmFyIGJhID0gbmV3IFVpbnQ4QXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIHNhID0gbmV3IEludDE2QXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIGxhID0gbmV3IEludDMyQXJyYXkoYnB0KTtcbiAgICAgICAgdmFyIGJwdE1hZ2ljID0gbGFbMF07XG4gICAgICAgIHZhciBibG9ja1NpemUgPSBsYVsxXTtcbiAgICAgICAgdmFyIGtleVNpemUgPSBsYVsyXTtcbiAgICAgICAgdmFyIHZhbFNpemUgPSBsYVszXTtcbiAgICAgICAgdmFyIGl0ZW1Db3VudCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCAxNik7XG4gICAgICAgIHZhciByb290Tm9kZU9mZnNldCA9IDMyO1xuXG4gICAgICAgIGZ1bmN0aW9uIGJwdFJlYWROb2RlKG5vZGVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXNCLmJiaS5kYXRhLnNsaWNlKG5vZGVPZmZzZXQsIDQgKyAoYmxvY2tTaXplICogKGtleVNpemUgKyB2YWxTaXplKSkpLmZldGNoKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShub2RlKTtcbiAgICAgICAgICAgICAgICB2YXIgc2EgPSBuZXcgVWludDE2QXJyYXkobm9kZSk7XG4gICAgICAgICAgICAgICAgdmFyIGxhID0gbmV3IFVpbnQzMkFycmF5KG5vZGUpO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5vZGVUeXBlID0gYmFbMF07XG4gICAgICAgICAgICAgICAgdmFyIGNudCA9IHNhWzFdO1xuXG4gICAgICAgICAgICAgICAgdmFyIG9mZnNldCA9IDQ7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVUeXBlID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RDaGlsZE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY250OyArK24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGtpID0gMDsga2kgPCBrZXlTaXplOyArK2tpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoYXJDb2RlID0gYmFbb2Zmc2V0KytdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaGFyQ29kZSAhPSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZE9mZnNldCA9IGJ3Z19yZWFkT2Zmc2V0KGJhLCBvZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IDg7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuYW1lLmxvY2FsZUNvbXBhcmUoa2V5KSA8IDAgJiYgbGFzdENoaWxkT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnB0UmVhZE5vZGUobGFzdENoaWxkT2Zmc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0Q2hpbGRPZmZzZXQgPSBjaGlsZE9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicHRSZWFkTm9kZShsYXN0Q2hpbGRPZmZzZXQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY250OyArK24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGtpID0gMDsga2kgPCBrZXlTaXplOyArK2tpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoYXJDb2RlID0gYmFbb2Zmc2V0KytdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaGFyQ29kZSAhPSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXJDb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNwZWNpZmljIGZvciBFSSBjYXNlLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtleSA9PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0YXJ0ID0gYndnX3JlYWRPZmZzZXQoYmEsIG9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxlbmd0aCA9IHJlYWRJbnQoYmEsIG9mZnNldCArIDgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNCLmJiaS5nZXRVbnpvb21lZFZpZXcoKS5mZXRjaEZlYXR1cmVzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihjaHIsIG1pbiwgbWF4LCB0b2tzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9rcyAmJiB0b2tzLmxlbmd0aCA+IHRoaXNCLmZpZWxkIC0gMylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdG9rc1t0aGlzQi5maWVsZCAtIDNdID09IG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbe29mZnNldDogc3RhcnQsIHNpemU6IGxlbmd0aH1dLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IHZhbFNpemU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKFtdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJwdFJlYWROb2RlKHRoaXNCLm9mZnNldCArIHJvb3ROb2RlT2Zmc2V0KTtcbiAgICB9KTtcbn1cblxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBtYWtlQndnOiBtYWtlQndnLFxuICAgICAgICBCSUdfQkVEX01BR0lDOiBCSUdfQkVEX01BR0lDLFxuICAgICAgICBCSUdfV0lHX01BR0lDOiBCSUdfV0lHX01BR0lDXG4gICAgfVxufVxuIiwiLyogLSotIG1vZGU6IGphdmFzY3JpcHQ7IGMtYmFzaWMtb2Zmc2V0OiA0OyBpbmRlbnQtdGFicy1tb2RlOiBuaWwgLSotICovXG5cbi8vIFxuLy8gRGFsbGlhbmNlIEdlbm9tZSBFeHBsb3JlclxuLy8gKGMpIFRob21hcyBEb3duIDIwMDYtMjAxMVxuLy9cbi8vIGJpbi5qcyBnZW5lcmFsIGJpbmFyeSBkYXRhIHN1cHBvcnRcbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5pZiAodHlwZW9mKHJlcXVpcmUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbiAgICB2YXIgc2hhbGxvd0NvcHkgPSB1dGlscy5zaGFsbG93Q29weTtcblxuICAgIHZhciBzaGExID0gcmVxdWlyZSgnLi9zaGExJyk7XG4gICAgdmFyIGI2NF9zaGExID0gc2hhMS5iNjRfc2hhMTtcbn1cblxuZnVuY3Rpb24gQmxvYkZldGNoYWJsZShiKSB7XG4gICAgdGhpcy5ibG9iID0gYjtcbn1cblxuQmxvYkZldGNoYWJsZS5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbihzdGFydCwgbGVuZ3RoKSB7XG4gICAgdmFyIGI7XG5cbiAgICBpZiAodGhpcy5ibG9iLnNsaWNlKSB7XG4gICAgICAgIGlmIChsZW5ndGgpIHtcbiAgICAgICAgICAgIGIgPSB0aGlzLmJsb2Iuc2xpY2Uoc3RhcnQsIHN0YXJ0ICsgbGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGIgPSB0aGlzLmJsb2Iuc2xpY2Uoc3RhcnQpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGxlbmd0aCkge1xuICAgICAgICAgICAgYiA9IHRoaXMuYmxvYi53ZWJraXRTbGljZShzdGFydCwgc3RhcnQgKyBsZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYiA9IHRoaXMuYmxvYi53ZWJraXRTbGljZShzdGFydCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCbG9iRmV0Y2hhYmxlKGIpO1xufVxuXG5CbG9iRmV0Y2hhYmxlLnByb3RvdHlwZS5zYWx0ZWQgPSBmdW5jdGlvbigpIHtyZXR1cm4gdGhpczt9XG5cbmlmICh0eXBlb2YoRmlsZVJlYWRlcikgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgLy8gY29uc29sZS5sb2coJ2RlZmluaW5nIGFzeW5jIEJsb2JGZXRjaGFibGUuZmV0Y2gnKTtcblxuICAgIEJsb2JGZXRjaGFibGUucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBmdW5jdGlvbihldikge1xuICAgICAgICAgICAgY2FsbGJhY2soYnN0cmluZ1RvQnVmZmVyKHJlYWRlci5yZXN1bHQpKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0JpbmFyeVN0cmluZyh0aGlzLmJsb2IpO1xuICAgIH1cblxufSBlbHNlIHtcbiAgICAvLyBpZiAoY29uc29sZSAmJiBjb25zb2xlLmxvZylcbiAgICAvLyAgICBjb25zb2xlLmxvZygnZGVmaW5pbmcgc3luYyBCbG9iRmV0Y2hhYmxlLmZldGNoJyk7XG5cbiAgICBCbG9iRmV0Y2hhYmxlLnByb3RvdHlwZS5mZXRjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlclN5bmMoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciByZXMgPSByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIodGhpcy5ibG9iKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKHJlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBVUkxGZXRjaGFibGUodXJsLCBzdGFydCwgZW5kLCBvcHRzKSB7XG4gICAgaWYgKCFvcHRzKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBvcHRzID0gc3RhcnQ7XG4gICAgICAgICAgICBzdGFydCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdHMgPSB7fTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydCB8fCAwO1xuICAgIGlmIChlbmQpIHtcbiAgICAgICAgdGhpcy5lbmQgPSBlbmQ7XG4gICAgfVxuICAgIHRoaXMub3B0cyA9IG9wdHM7XG59XG5cblVSTEZldGNoYWJsZS5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbihzLCBsKSB7XG4gICAgaWYgKHMgPCAwKSB7XG4gICAgICAgIHRocm93ICdCYWQgc2xpY2UgJyArIHM7XG4gICAgfVxuXG4gICAgdmFyIG5zID0gdGhpcy5zdGFydCwgbmUgPSB0aGlzLmVuZDtcbiAgICBpZiAobnMgJiYgcykge1xuICAgICAgICBucyA9IG5zICsgcztcbiAgICB9IGVsc2Uge1xuICAgICAgICBucyA9IHMgfHwgbnM7XG4gICAgfVxuICAgIGlmIChsICYmIG5zKSB7XG4gICAgICAgIG5lID0gbnMgKyBsIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZSA9IG5lIHx8IGwgLSAxO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFVSTEZldGNoYWJsZSh0aGlzLnVybCwgbnMsIG5lLCB0aGlzLm9wdHMpO1xufVxuXG52YXIgc2VlZD0wO1xudmFyIGlzU2FmYXJpID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdTYWZhcmknKSA+PSAwICYmIG5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignQ2hyb21lJykgPCAwIDtcblxuVVJMRmV0Y2hhYmxlLnByb3RvdHlwZS5mZXRjaEFzVGV4dCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB2YXIgbGVuZ3RoO1xuICAgICAgICB2YXIgdXJsID0gdGhpcy51cmw7XG4gICAgICAgIGlmICgoaXNTYWZhcmkgfHwgdGhpcy5vcHRzLnNhbHQpICYmIHVybC5pbmRleE9mKCc/JykgPCAwKSB7XG4gICAgICAgICAgICB1cmwgPSB1cmwgKyAnP3NhbHQ9JyArIGI2NF9zaGExKCcnICsgRGF0ZS5ub3coKSArICcsJyArICgrK3NlZWQpKTtcbiAgICAgICAgfVxuICAgICAgICByZXEub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVuZCAtIHRoaXMuc3RhcnQgPiAxMDAwMDAwMDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnTW9uc3RlciBmZXRjaCEnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScgKyB0aGlzLnN0YXJ0ICsgJy0nICsgdGhpcy5lbmQpO1xuICAgICAgICAgICAgbGVuZ3RoID0gdGhpcy5lbmQgLSB0aGlzLnN0YXJ0ICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChyZXEucmVhZHlTdGF0ZSA9PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcS5zdGF0dXMgPT0gMjAwIHx8IHJlcS5zdGF0dXMgPT0gMjA2KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhyZXEucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpZiAodGhpcy5vcHRzLmNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXEud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXEuc2VuZCgnJyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG4gICAgfVxufVxuXG5VUkxGZXRjaGFibGUucHJvdG90eXBlLnNhbHRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvID0gc2hhbGxvd0NvcHkodGhpcy5vcHRzKTtcbiAgICBvLnNhbHQgPSB0cnVlO1xuICAgIHJldHVybiBuZXcgVVJMRmV0Y2hhYmxlKHRoaXMudXJsLCB0aGlzLnN0YXJ0LCB0aGlzLmVuZCwgbyk7XG59XG5cblVSTEZldGNoYWJsZS5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbihjYWxsYmFjaywgb3B0cykge1xuICAgIHZhciB0aGlzQiA9IHRoaXM7XG4gXG4gICAgb3B0cyA9IG9wdHMgfHwge307XG4gICAgdmFyIGF0dGVtcHQgPSBvcHRzLmF0dGVtcHQgfHwgMTtcbiAgICB2YXIgdHJ1bmNhdGVkTGVuZ3RoID0gb3B0cy50cnVuY2F0ZWRMZW5ndGg7XG4gICAgaWYgKGF0dGVtcHQgPiAzKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICB2YXIgdGltZW91dDtcbiAgICAgICAgaWYgKG9wdHMudGltZW91dCAmJiAhdGhpcy5vcHRzLmNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RpbWluZyBvdXQgJyArIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcS5hYm9ydCgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgJ1RpbWVvdXQnKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG9wdHMudGltZW91dFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgdmFyIGxlbmd0aDtcbiAgICAgICAgdmFyIHVybCA9IHRoaXMudXJsO1xuICAgICAgICBpZiAoKGlzU2FmYXJpIHx8IHRoaXMub3B0cy5zYWx0KSAmJiB1cmwuaW5kZXhPZignPycpIDwgMCkge1xuICAgICAgICAgICAgdXJsID0gdXJsICsgJz9zYWx0PScgKyBiNjRfc2hhMSgnJyArIERhdGUubm93KCkgKyAnLCcgKyAoKytzZWVkKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVxLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHJlcS5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3BsYWluOyBjaGFyc2V0PXgtdXNlci1kZWZpbmVkJyk7XG4gICAgICAgIGlmICh0aGlzLmVuZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5kIC0gdGhpcy5zdGFydCA+IDEwMDAwMDAwMCkge1xuICAgICAgICAgICAgICAgIHRocm93ICdNb25zdGVyIGZldGNoISc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXEuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuc3RhcnQgKyAnLScgKyB0aGlzLmVuZCk7XG4gICAgICAgICAgICBsZW5ndGggPSB0aGlzLmVuZCAtIHRoaXMuc3RhcnQgKyAxO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgICAgICByZXEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlcS5zdGF0dXMgPT0gMjAwIHx8IHJlcS5zdGF0dXMgPT0gMjA2KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXEucmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBibCA9IHJlcS5yZXNwb25zZS5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbmd0aCAmJiBsZW5ndGggIT0gYmwgJiYgKCF0cnVuY2F0ZWRMZW5ndGggfHwgYmwgIT0gdHJ1bmNhdGVkTGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzQi5mZXRjaChjYWxsYmFjaywge2F0dGVtcHQ6IGF0dGVtcHQgKyAxLCB0cnVuY2F0ZWRMZW5ndGg6IGJsfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhyZXEucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlcS5tb3pSZXNwb25zZUFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2socmVxLm1velJlc3BvbnNlQXJyYXlCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHIgPSByZXEucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbmd0aCAmJiBsZW5ndGggIT0gci5sZW5ndGggJiYgKCF0cnVuY2F0ZWRMZW5ndGggfHwgci5sZW5ndGggIT0gdHJ1bmNhdGVkTGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzQi5mZXRjaChjYWxsYmFjaywge2F0dGVtcHQ6IGF0dGVtcHQgKyAxLCB0cnVuY2F0ZWRMZW5ndGg6IHIubGVuZ3RofSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhic3RyaW5nVG9CdWZmZXIocmVxLnJlc3BvbnNlVGV4dCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNCLmZldGNoKGNhbGxiYWNrLCB7YXR0ZW1wdDogYXR0ZW1wdCArIDF9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGlmICh0aGlzLm9wdHMuY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJlcS53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5zZW5kKCcnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGJzdHJpbmdUb0J1ZmZlcihyZXN1bHQpIHtcbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShyZXN1bHQubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJhLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGJhW2ldID0gcmVzdWx0LmNoYXJDb2RlQXQoaSk7XG4gICAgfVxuICAgIHJldHVybiBiYS5idWZmZXI7XG59XG5cbi8vIFJlYWQgZnJvbSBVaW50OEFycmF5XG5cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgICB2YXIgY29udmVydEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig4KTtcbiAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShjb252ZXJ0QnVmZmVyKTtcbiAgICB2YXIgZmEgPSBuZXcgRmxvYXQzMkFycmF5KGNvbnZlcnRCdWZmZXIpO1xuXG5cbiAgICBnbG9iYWwucmVhZEZsb2F0ID0gZnVuY3Rpb24oYnVmLCBvZmZzZXQpIHtcbiAgICAgICAgYmFbMF0gPSBidWZbb2Zmc2V0XTtcbiAgICAgICAgYmFbMV0gPSBidWZbb2Zmc2V0KzFdO1xuICAgICAgICBiYVsyXSA9IGJ1ZltvZmZzZXQrMl07XG4gICAgICAgIGJhWzNdID0gYnVmW29mZnNldCszXTtcbiAgICAgICAgcmV0dXJuIGZhWzBdO1xuICAgIH07XG4gfSh0aGlzKSk7XG5cbmZ1bmN0aW9uIHJlYWRJbnQ2NChiYSwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIChiYVtvZmZzZXQgKyA3XSA8PCAyNCkgfCAoYmFbb2Zmc2V0ICsgNl0gPDwgMTYpIHwgKGJhW29mZnNldCArIDVdIDw8IDgpIHwgKGJhW29mZnNldCArIDRdKTtcbn1cblxuZnVuY3Rpb24gcmVhZEludChiYSwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIChiYVtvZmZzZXQgKyAzXSA8PCAyNCkgfCAoYmFbb2Zmc2V0ICsgMl0gPDwgMTYpIHwgKGJhW29mZnNldCArIDFdIDw8IDgpIHwgKGJhW29mZnNldF0pO1xufVxuXG5mdW5jdGlvbiByZWFkU2hvcnQoYmEsIG9mZnNldCkge1xuICAgIHJldHVybiAoYmFbb2Zmc2V0ICsgMV0gPDwgOCkgfCAoYmFbb2Zmc2V0XSk7XG59XG5cbmZ1bmN0aW9uIHJlYWRCeXRlKGJhLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gYmFbb2Zmc2V0XTtcbn1cblxuZnVuY3Rpb24gcmVhZEludEJFKGJhLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gKGJhW29mZnNldF0gPDwgMjQpIHwgKGJhW29mZnNldCArIDFdIDw8IDE2KSB8IChiYVtvZmZzZXQgKyAyXSA8PCA4KSB8IChiYVtvZmZzZXQgKyAzXSk7XG59XG5cbi8vIEV4cG9ydHMgaWYgd2UgYXJlIGJlaW5nIHVzZWQgYXMgYSBtb2R1bGVcblxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBCbG9iRmV0Y2hhYmxlOiBCbG9iRmV0Y2hhYmxlLFxuICAgICAgICBVUkxGZXRjaGFibGU6IFVSTEZldGNoYWJsZSxcblxuICAgICAgICByZWFkSW50OiByZWFkSW50LFxuICAgICAgICByZWFkSW50QkU6IHJlYWRJbnRCRSxcbiAgICAgICAgcmVhZEludDY0OiByZWFkSW50NjQsXG4gICAgICAgIHJlYWRTaG9ydDogcmVhZFNob3J0LFxuICAgICAgICByZWFkQnl0ZTogcmVhZEJ5dGUsXG4gICAgICAgIHJlYWRGbG9hdDogdGhpcy5yZWFkRmxvYXRcbiAgICB9XG59XG4iLCIvKiAtKi0gbW9kZTogamF2YXNjcmlwdDsgYy1iYXNpYy1vZmZzZXQ6IDQ7IGluZGVudC10YWJzLW1vZGU6IG5pbCAtKi0gKi9cblxuLy8gXG4vLyBEYWxsaWFuY2UgR2Vub21lIEV4cGxvcmVyXG4vLyAoYykgVGhvbWFzIERvd24gMjAwNi0yMDEwXG4vL1xuLy8gY29sb3IuanNcbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5mdW5jdGlvbiBEQ29sb3VyKHJlZCwgZ3JlZW4sIGJsdWUsIG5hbWUpIHtcbiAgICB0aGlzLnJlZCA9IHJlZHwwO1xuICAgIHRoaXMuZ3JlZW4gPSBncmVlbnwwO1xuICAgIHRoaXMuYmx1ZSA9IGJsdWV8MDtcbiAgICBpZiAobmFtZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIH1cbn1cblxuRENvbG91ci5wcm90b3R5cGUudG9TdmdTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMubmFtZSkge1xuICAgICAgICB0aGlzLm5hbWUgPSBcInJnYihcIiArIHRoaXMucmVkICsgXCIsXCIgKyB0aGlzLmdyZWVuICsgXCIsXCIgKyB0aGlzLmJsdWUgKyBcIilcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufVxuXG5mdW5jdGlvbiBoZXgyKHgpIHtcbiAgICB2YXIgeSA9ICcwMCcgKyB4LnRvU3RyaW5nKDE2KTtcbiAgICByZXR1cm4geS5zdWJzdHJpbmcoeS5sZW5ndGggLSAyKTtcbn1cblxuRENvbG91ci5wcm90b3R5cGUudG9IZXhTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJyMnICsgaGV4Mih0aGlzLnJlZCkgKyBoZXgyKHRoaXMuZ3JlZW4pICsgaGV4Mih0aGlzLmJsdWUpO1xufVxuXG52YXIgcGFsZXR0ZSA9IHtcbiAgICByZWQ6IG5ldyBEQ29sb3VyKDI1NSwgMCwgMCwgJ3JlZCcpLFxuICAgIGdyZWVuOiBuZXcgRENvbG91cigwLCAyNTUsIDAsICdncmVlbicpLFxuICAgIGJsdWU6IG5ldyBEQ29sb3VyKDAsIDAsIDI1NSwgJ2JsdWUnKSxcbiAgICB5ZWxsb3c6IG5ldyBEQ29sb3VyKDI1NSwgMjU1LCAwLCAneWVsbG93JyksXG4gICAgd2hpdGU6IG5ldyBEQ29sb3VyKDI1NSwgMjU1LCAyNTUsICd3aGl0ZScpLFxuICAgIGJsYWNrOiBuZXcgRENvbG91cigwLCAwLCAwLCAnYmxhY2snKSxcbiAgICBncmF5OiBuZXcgRENvbG91cigxODAsIDE4MCwgMTgwLCAnZ3JheScpLFxuICAgIGdyZXk6IG5ldyBEQ29sb3VyKDE4MCwgMTgwLCAxODAsICdncmV5JyksXG4gICAgbGlnaHRza3libHVlOiBuZXcgRENvbG91cigxMzUsIDIwNiwgMjUwLCAnbGlnaHRza3libHVlJyksXG4gICAgbGlnaHRzYWxtb246IG5ldyBEQ29sb3VyKDI1NSwgMTYwLCAxMjIsICdsaWdodHNhbG1vbicpLFxuICAgIGhvdHBpbms6IG5ldyBEQ29sb3VyKDI1NSwgMTA1LCAxODAsICdob3RwaW5rJylcbn07XG5cbnZhciBDT0xPUl9SRSA9IG5ldyBSZWdFeHAoJ14jKFswLTlBLUZhLWZdezJ9KShbMC05QS1GYS1mXXsyfSkoWzAtOUEtRmEtZl17Mn0pJCcpO1xudmFyIENTU19DT0xPUl9SRSA9IC9yZ2JcXCgoWzAtOV0rKSwoWzAtOV0rKSwoWzAtOV0rKVxcKS9cblxuZnVuY3Rpb24gZGFzQ29sb3VyRm9yTmFtZShuYW1lKSB7XG4gICAgdmFyIGMgPSBwYWxldHRlW25hbWVdO1xuICAgIGlmICghYykge1xuICAgICAgICB2YXIgbWF0Y2ggPSBDT0xPUl9SRS5leGVjKG5hbWUpO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGMgPSBuZXcgRENvbG91cigoJzB4JyArIG1hdGNoWzFdKXwwLCAoJzB4JyArIG1hdGNoWzJdKXwwLCAoJzB4JyArIG1hdGNoWzNdKXwwLCBuYW1lKTtcbiAgICAgICAgICAgIHBhbGV0dGVbbmFtZV0gPSBjO1xuICAgICAgICB9IGVsc2Uge1xuICAgIFx0ICAgIG1hdGNoID0gQ1NTX0NPTE9SX1JFLmV4ZWMobmFtZSk7XG4gICAgXHQgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIFx0XHRjID0gbmV3IERDb2xvdXIobWF0Y2hbMV18MCwgbWF0Y2hbMl18MCwgbWF0Y2hbM118MCwgbmFtZSk7XG4gICAgICAgIFx0XHRwYWxldHRlW25hbWVdID0gYztcblx0ICAgICAgIH0gZWxzZSB7XG5cdFx0ICAgICAgY29uc29sZS5sb2coXCJjb3VsZG4ndCBoYW5kbGUgY29sb3I6IFwiICsgbmFtZSk7XG5cdFx0ICAgICAgYyA9IHBhbGV0dGUuYmxhY2s7XG5cdFx0ICAgICAgcGFsZXR0ZVtuYW1lXSA9IGM7XG5cdCAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGM7XG59XG5cbmZ1bmN0aW9uIG1ha2VDb2xvdXJTdGVwcyhzdGVwcywgc3RvcHMsIGNvbG91cnMpIHtcbiAgICB2YXIgZGNvbG91cnMgPSBbXTtcbiAgICBmb3IgKHZhciBjaSA9IDA7IGNpIDwgY29sb3Vycy5sZW5ndGg7ICsrY2kpIHtcbiAgICAgICAgZGNvbG91cnMucHVzaChkYXNDb2xvdXJGb3JOYW1lKGNvbG91cnNbY2ldKSk7XG4gICAgfVxuXG4gICAgdmFyIGdyYWQgPSBbXTtcbiAgU1RFUF9MT09QOlxuICAgIGZvciAodmFyIHNpID0gMDsgc2kgPCBzdGVwczsgKytzaSkge1xuICAgICAgICB2YXIgcnMgPSAoMS4wICogc2kpIC8gKHN0ZXBzLTEpO1xuICAgICAgICB2YXIgc2NvcmUgPSBzdG9wc1swXSArIChzdG9wc1tzdG9wcy5sZW5ndGggLTFdIC0gc3RvcHNbMF0pICogcnM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RvcHMubGVuZ3RoIC0gMTsgKytpKSB7XG4gICAgICAgICAgICBpZiAoc2NvcmUgPj0gc3RvcHNbaV0gJiYgc2NvcmUgPD0gc3RvcHNbaSsxXSkge1xuICAgICAgICAgICAgICAgIHZhciBmcmFjID0gKHNjb3JlIC0gc3RvcHNbaV0pIC8gKHN0b3BzW2krMV0gLSBzdG9wc1tpXSk7XG4gICAgICAgICAgICAgICAgdmFyIGNhID0gZGNvbG91cnNbaV07XG4gICAgICAgICAgICAgICAgdmFyIGNiID0gZGNvbG91cnNbaSsxXTtcblxuICAgICAgICAgICAgICAgIHZhciBmaWxsID0gbmV3IERDb2xvdXIoXG4gICAgICAgICAgICAgICAgICAgICgoY2EucmVkICogKDEuMCAtIGZyYWMpKSArIChjYi5yZWQgKiBmcmFjKSl8MCxcbiAgICAgICAgICAgICAgICAgICAgKChjYS5ncmVlbiAqICgxLjAgLSBmcmFjKSkgKyAoY2IuZ3JlZW4gKiBmcmFjKSl8MCxcbiAgICAgICAgICAgICAgICAgICAgKChjYS5ibHVlICogKDEuMCAtIGZyYWMpKSArIChjYi5ibHVlICogZnJhYykpfDBcbiAgICAgICAgICAgICAgICApLnRvU3ZnU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgZ3JhZC5wdXNoKGZpbGwpO1xuXG4gICAgICAgICAgICAgICAgY29udGludWUgU1RFUF9MT09QO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRocm93ICdCYWQgc3RlcCc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYWQ7XG59XG5cbmZ1bmN0aW9uIG1ha2VHcmFkaWVudChzdGVwcywgY29sb3IxLCBjb2xvcjIsIGNvbG9yMykge1xuICAgIGlmIChjb2xvcjMpIHtcbiAgICAgICAgcmV0dXJuIG1ha2VDb2xvdXJTdGVwcyhzdGVwcywgWzAsIDAuNSwgMV0sIFtjb2xvcjEsIGNvbG9yMiwgY29sb3IzXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG1ha2VDb2xvdXJTdGVwcyhzdGVwcywgWzAsIDFdLCBbY29sb3IxLCBjb2xvcjJdKTtcbiAgICB9XG59XG5cbmlmICh0eXBlb2YobW9kdWxlKSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgbWFrZUNvbG91clN0ZXBzOiBtYWtlQ29sb3VyU3RlcHMsXG4gICAgICAgIG1ha2VHcmFkaWVudDogbWFrZUdyYWRpZW50LFxuICAgICAgICBkYXNDb2xvdXJGb3JOYW1lOiBkYXNDb2xvdXJGb3JOYW1lXG4gICAgfTtcbn1cbiIsIi8qIC0qLSBtb2RlOiBqYXZhc2NyaXB0OyBjLWJhc2ljLW9mZnNldDogNDsgaW5kZW50LXRhYnMtbW9kZTogbmlsIC0qLSAqL1xuXG4vLyBcbi8vIERhbGxpYW5jZSBHZW5vbWUgRXhwbG9yZXJcbi8vIChjKSBUaG9tYXMgRG93biAyMDA2LTIwMTBcbi8vXG4vLyBkYXMuanM6IHF1ZXJpZXMgYW5kIGxvdy1sZXZlbCBkYXRhIG1vZGVsLlxuLy9cblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbmlmICh0eXBlb2YocmVxdWlyZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuICAgIHZhciBzaGFsbG93Q29weSA9IHV0aWxzLnNoYWxsb3dDb3B5O1xuICAgIHZhciBwdXNobyA9IHV0aWxzLnB1c2hvO1xuXG4gICAgdmFyIGNvbG9yID0gcmVxdWlyZSgnLi9jb2xvcicpO1xuICAgIHZhciBtYWtlQ29sb3VyU3RlcHMgPSBjb2xvci5tYWtlQ29sb3VyU3RlcHM7XG59XG5cbnZhciBkYXNMaWJFcnJvckhhbmRsZXIgPSBmdW5jdGlvbihlcnJNc2cpIHtcbiAgICBhbGVydChlcnJNc2cpO1xufVxudmFyIGRhc0xpYlJlcXVlc3RRdWV1ZSA9IG5ldyBBcnJheSgpO1xuXG5mdW5jdGlvbiBEQVNTZWdtZW50KG5hbWUsIHN0YXJ0LCBlbmQsIGRlc2NyaXB0aW9uKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5lbmQgPSBlbmQ7XG4gICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xufVxuREFTU2VnbWVudC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5uYW1lICsgJzonICsgdGhpcy5zdGFydCArICcuLicgKyB0aGlzLmVuZDtcbn07XG5EQVNTZWdtZW50LnByb3RvdHlwZS5pc0JvdW5kZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdGFydCAmJiB0aGlzLmVuZDtcbn1cbkRBU1NlZ21lbnQucHJvdG90eXBlLnRvREFTUXVlcnkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcSA9ICdzZWdtZW50PScgKyB0aGlzLm5hbWU7XG4gICAgaWYgKHRoaXMuc3RhcnQgJiYgdGhpcy5lbmQpIHtcbiAgICAgICAgcSArPSAoJzonICsgdGhpcy5zdGFydCArICcsJyArIHRoaXMuZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHE7XG59XG5cblxuZnVuY3Rpb24gREFTU291cmNlKGExLCBhMikge1xuICAgIHZhciBvcHRpb25zO1xuICAgIGlmICh0eXBlb2YgYTEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy51cmkgPSBhMTtcbiAgICAgICAgb3B0aW9ucyA9IGEyIHx8IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMgPSBhMSB8fCB7fTtcbiAgICB9XG4gICAgZm9yICh2YXIgayBpbiBvcHRpb25zKSB7XG4gICAgICAgIGlmICh0eXBlb2Yob3B0aW9uc1trXSkgIT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpc1trXSA9IG9wdGlvbnNba107XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIGlmICghdGhpcy5jb29yZHMpIHtcbiAgICAgICAgdGhpcy5jb29yZHMgPSBbXTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLnByb3BzKSB7XG4gICAgICAgIHRoaXMucHJvcHMgPSB7fTtcbiAgICB9XG5cbiAgICB0aGlzLmRhc0Jhc2VVUkkgPSB0aGlzLnVyaTtcbiAgICBpZiAodGhpcy5kYXNCYXNlVVJJICYmIHRoaXMuZGFzQmFzZVVSSS5zdWJzdHIodGhpcy51cmkubGVuZ3RoIC0gMSkgIT0gJy8nKSB7XG4gICAgICAgIHRoaXMuZGFzQmFzZVVSSSA9IHRoaXMuZGFzQmFzZVVSSSArICcvJztcbiAgICB9XG59XG5cbmZ1bmN0aW9uIERBU0Nvb3JkcygpIHtcbn1cblxuZnVuY3Rpb24gY29vcmRzTWF0Y2goYzEsIGMyKSB7XG4gICAgcmV0dXJuIGMxLnRheG9uID09IGMyLnRheG9uICYmIGMxLmF1dGggPT0gYzIuYXV0aCAmJiBjMS52ZXJzaW9uID09IGMyLnZlcnNpb247XG59XG5cbi8vXG4vLyBEQVMgMS42IGVudHJ5X3BvaW50cyBjb21tYW5kXG4vL1xuXG5EQVNTb3VyY2UucHJvdG90eXBlLmVudHJ5UG9pbnRzID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgZGFzVVJJID0gdGhpcy5kYXNCYXNlVVJJICsgJ2VudHJ5X3BvaW50cyc7XG4gICAgdGhpcy5kb0Nyb3NzRG9tYWluUmVxdWVzdChkYXNVUkksIGZ1bmN0aW9uKHJlc3BvbnNlWE1MKSB7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlWE1MKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKFtdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBlbnRyeVBvaW50cyA9IG5ldyBBcnJheSgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBzZWdzID0gcmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ1NFR01FTlQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlZ3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZyA9IHNlZ3NbaV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWdJZCA9IHNlZy5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB2YXIgc2VnU2l6ZSA9IHNlZy5nZXRBdHRyaWJ1dGUoJ3NpemUnKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZ01pbiwgc2VnTWF4O1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VnU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VnTWluID0gMTsgc2VnTWF4ID0gc2VnU2l6ZXwwO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VnTWluID0gc2VnLmdldEF0dHJpYnV0ZSgnc3RhcnQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWdNaW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWdNaW4gfD0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlZ01heCA9IHNlZy5nZXRBdHRyaWJ1dGUoJ3N0b3AnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWdNYXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWdNYXggfD0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgc2VnRGVzYyA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWcuZmlyc3RDaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VnRGVzYyA9IHNlZy5maXJzdENoaWxkLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbnRyeVBvaW50cy5wdXNoKG5ldyBEQVNTZWdtZW50KHNlZ0lkLCBzZWdNaW4sIHNlZ01heCwgc2VnRGVzYykpO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgXG4gICAgICAgICAgICAgICBjYWxsYmFjayhlbnRyeVBvaW50cyk7XG4gICAgfSk7ICAgICAgICAgXG59XG5cbi8vXG4vLyBEQVMgMS42IHNlcXVlbmNlIGNvbW1hbmRcbi8vIERvIHdlIG5lZWQgYW4gb3B0aW9uIHRvIGZhbGwgYmFjayB0byB0aGUgZG5hIGNvbW1hbmQ/XG4vL1xuXG5mdW5jdGlvbiBEQVNTZXF1ZW5jZShuYW1lLCBzdGFydCwgZW5kLCBhbHBoYSwgc2VxKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnN0YXJ0ID0gc3RhcnQ7XG4gICAgdGhpcy5lbmQgPSBlbmQ7XG4gICAgdGhpcy5hbHBoYWJldCA9IGFscGhhO1xuICAgIHRoaXMuc2VxID0gc2VxO1xufVxuXG5EQVNTb3VyY2UucHJvdG90eXBlLnNlcXVlbmNlID0gZnVuY3Rpb24oc2VnbWVudCwgY2FsbGJhY2spIHtcbiAgICB2YXIgZGFzVVJJID0gdGhpcy5kYXNCYXNlVVJJICsgJ3NlcXVlbmNlPycgKyBzZWdtZW50LnRvREFTUXVlcnkoKTtcbiAgICB0aGlzLmRvQ3Jvc3NEb21haW5SZXF1ZXN0KGRhc1VSSSwgZnVuY3Rpb24ocmVzcG9uc2VYTUwpIHtcbiAgICAgICAgaWYgKCFyZXNwb25zZVhNTCkge1xuICAgICAgICAgICAgY2FsbGJhY2soW10pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBzZXFzID0gbmV3IEFycmF5KCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHNlZ3MgPSByZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnU0VRVUVOQ0UnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlZ3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZyA9IHNlZ3NbaV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWdJZCA9IHNlZy5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWdNaW4gPSBzZWcuZ2V0QXR0cmlidXRlKCdzdGFydCcpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VnTWF4ID0gc2VnLmdldEF0dHJpYnV0ZSgnc3RvcCcpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VnQWxwaGEgPSAnRE5BJztcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZ1NlcSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWcuZmlyc3RDaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJhd1NlcSA9IHNlZy5maXJzdENoaWxkLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlZ1NlcSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlkeCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzcGFjZSA9IHJhd1NlcS5pbmRleE9mKCdcXG4nLCBpZHgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGFjZSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlZ1NlcSArPSByYXdTZXEuc3Vic3RyaW5nKGlkeCwgc3BhY2UpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkeCA9IHNwYWNlICsgMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWdTZXEgKz0gcmF3U2VxLnN1YnN0cmluZyhpZHgpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXFzLnB1c2gobmV3IERBU1NlcXVlbmNlKHNlZ0lkLCBzZWdNaW4sIHNlZ01heCwgc2VnQWxwaGEsIHNlZ1NlcSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhzZXFzKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG4vL1xuLy8gREFTIDEuNiBmZWF0dXJlcyBjb21tYW5kXG4vL1xuXG5mdW5jdGlvbiBEQVNGZWF0dXJlKCkge1xufVxuXG5mdW5jdGlvbiBEQVNHcm91cChpZCkge1xuICAgIGlmIChpZClcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xufVxuXG5mdW5jdGlvbiBEQVNMaW5rKGRlc2MsIHVyaSkge1xuICAgIHRoaXMuZGVzYyA9IGRlc2M7XG4gICAgdGhpcy51cmkgPSB1cmk7XG59XG5cbkRBU1NvdXJjZS5wcm90b3R5cGUuZmVhdHVyZXMgPSBmdW5jdGlvbihzZWdtZW50LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciB0aGlzQiA9IHRoaXM7XG5cbiAgICB2YXIgZGFzVVJJO1xuICAgIGlmICh0aGlzLmZlYXR1cmVzX3VyaSkge1xuICAgICAgICBkYXNVUkkgPSB0aGlzLmZlYXR1cmVzX3VyaTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZmlsdGVycyA9IFtdO1xuXG4gICAgICAgIGlmIChzZWdtZW50KSB7XG4gICAgICAgICAgICBmaWx0ZXJzLnB1c2goc2VnbWVudC50b0RBU1F1ZXJ5KCkpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuZ3JvdXApIHtcbiAgICAgICAgICAgIHZhciBnID0gb3B0aW9ucy5ncm91cDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZyA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGZpbHRlcnMucHVzaCgnZ3JvdXBfaWQ9JyArIGcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBnaSA9IDA7IGdpIDwgZy5sZW5ndGg7ICsrZ2kpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVycy5wdXNoKCdncm91cF9pZD0nICsgZ1tnaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmFkamFjZW50KSB7XG4gICAgICAgICAgICB2YXIgYWRqID0gb3B0aW9ucy5hZGphY2VudDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYWRqID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgYWRqID0gW2Fkal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBhaSA9IDA7IGFpIDwgYWRqLmxlbmd0aDsgKythaSkge1xuICAgICAgICAgICAgICAgIGZpbHRlcnMucHVzaCgnYWRqYWNlbnQ9JyArIGFkalthaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudHlwZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnR5cGUgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJzLnB1c2goJ3R5cGU9JyArIG9wdGlvbnMudHlwZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHRpID0gMDsgdGkgPCBvcHRpb25zLnR5cGUubGVuZ3RoOyArK3RpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcnMucHVzaCgndHlwZT0nICsgb3B0aW9ucy50eXBlW3RpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAob3B0aW9ucy5tYXhiaW5zKSB7XG4gICAgICAgICAgICBmaWx0ZXJzLnB1c2goJ21heGJpbnM9JyArIG9wdGlvbnMubWF4Ymlucyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChmaWx0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGRhc1VSSSA9IHRoaXMuZGFzQmFzZVVSSSArICdmZWF0dXJlcz8nICsgZmlsdGVycy5qb2luKCc7Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhbXSwgJ05vIGZpbHRlcnMgc3BlY2lmaWVkJyk7XG4gICAgICAgIH1cbiAgICB9IFxuICAgXG5cbiAgICB0aGlzLmRvQ3Jvc3NEb21haW5SZXF1ZXN0KGRhc1VSSSwgZnVuY3Rpb24ocmVzcG9uc2VYTUwsIHJlcSkge1xuICAgICAgICBpZiAoIXJlc3BvbnNlWE1MKSB7XG4gICAgICAgICAgICB2YXIgbXNnO1xuICAgICAgICAgICAgaWYgKHJlcS5zdGF0dXMgPT0gMCkge1xuICAgICAgICAgICAgICAgIG1zZyA9ICdzZXJ2ZXIgbWF5IG5vdCBzdXBwb3J0IENPUlMnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtc2cgPSAnc3RhdHVzPScgKyByZXEuc3RhdHVzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FsbGJhY2soW10sICdGYWlsZWQgcmVxdWVzdDogJyArIG1zZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbi8qICAgICAgaWYgKHJlcSkge1xuICAgICAgICAgICAgdmFyIGNhcHMgPSByZXEuZ2V0UmVzcG9uc2VIZWFkZXIoJ1gtREFTLUNhcGFiaWx0aWVzJyk7XG4gICAgICAgICAgICBpZiAoY2Fwcykge1xuICAgICAgICAgICAgICAgIGFsZXJ0KGNhcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICovXG5cbiAgICAgICAgdmFyIGZlYXR1cmVzID0gbmV3IEFycmF5KCk7XG4gICAgICAgIHZhciBzZWdtZW50TWFwID0ge307XG5cbiAgICAgICAgdmFyIHNlZ3MgPSByZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnU0VHTUVOVCcpO1xuICAgICAgICBmb3IgKHZhciBzaSA9IDA7IHNpIDwgc2Vncy5sZW5ndGg7ICsrc2kpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50WE1MID0gc2Vnc1tzaV07XG4gICAgICAgICAgICB2YXIgc2VnbWVudElEID0gc2VnbWVudFhNTC5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgICAgICAgICBzZWdtZW50TWFwW3NlZ21lbnRJRF0gPSB7XG4gICAgICAgICAgICAgICAgbWluOiBzZWdtZW50WE1MLmdldEF0dHJpYnV0ZSgnc3RhcnQnKSxcbiAgICAgICAgICAgICAgICBtYXg6IHNlZ21lbnRYTUwuZ2V0QXR0cmlidXRlKCdzdG9wJylcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBmZWF0dXJlWE1McyA9IHNlZ21lbnRYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ0ZFQVRVUkUnKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmVhdHVyZVhNTHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVYTUxzW2ldO1xuICAgICAgICAgICAgICAgIHZhciBkYXNGZWF0dXJlID0gbmV3IERBU0ZlYXR1cmUoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLnNlZ21lbnQgPSBzZWdtZW50SUQ7XG4gICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5pZCA9IGZlYXR1cmUuZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUubGFiZWwgPSBmZWF0dXJlLmdldEF0dHJpYnV0ZSgnbGFiZWwnKTtcblxuXG4vKlxuICAgICAgICAgICAgICAgIHZhciBjaGlsZE5vZGVzID0gZmVhdHVyZS5jaGlsZE5vZGVzO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGMgPSAwOyBjIDwgY2hpbGROb2Rlcy5sZW5ndGg7ICsrYykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY24gPSBjaGlsZE5vZGVzW2NdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY24ubm9kZVR5cGUgPT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSBjbi50YWdOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy92YXIgdmFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vaWYgKGNuLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgdmFsID0gY24uZmlyc3RDaGlsZC5ub2RlVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL31cbiAgICAgICAgICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmVba2V5XSA9ICd4JztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gKi9cblxuXG4gICAgICAgICAgICAgICAgdmFyIHNwb3MgPSBlbGVtZW50VmFsdWUoZmVhdHVyZSwgXCJTVEFSVFwiKTtcbiAgICAgICAgICAgICAgICB2YXIgZXBvcyA9IGVsZW1lbnRWYWx1ZShmZWF0dXJlLCBcIkVORFwiKTtcbiAgICAgICAgICAgICAgICBpZiAoKHNwb3N8MCkgPiAoZXBvc3wwKSkge1xuICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLm1pbiA9IGVwb3N8MDtcbiAgICAgICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5tYXggPSBzcG9zfDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5taW4gPSBzcG9zfDA7XG4gICAgICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUubWF4ID0gZXBvc3wwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZWMgPSBmZWF0dXJlLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdUWVBFJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZWMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRlID0gdGVjWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRlLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLnR5cGUgPSB0ZS5maXJzdENoaWxkLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUudHlwZUlkID0gdGUuZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGFzRmVhdHVyZS50eXBlQ3YgPSB0ZS5nZXRBdHRyaWJ1dGUoJ2N2SWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLnR5cGUgPSBlbGVtZW50VmFsdWUoZmVhdHVyZSwgXCJUWVBFXCIpO1xuICAgICAgICAgICAgICAgIGlmICghZGFzRmVhdHVyZS50eXBlICYmIGRhc0ZlYXR1cmUudHlwZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUudHlwZSA9IGRhc0ZlYXR1cmUudHlwZUlkOyAvLyBGSVhNRT9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5tZXRob2QgPSBlbGVtZW50VmFsdWUoZmVhdHVyZSwgXCJNRVRIT0RcIik7XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3JpID0gZWxlbWVudFZhbHVlKGZlYXR1cmUsIFwiT1JJRU5UQVRJT05cIik7XG4gICAgICAgICAgICAgICAgICAgIGlmICghb3JpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmkgPSAnMCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5vcmllbnRhdGlvbiA9IG9yaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5zY29yZSA9IGVsZW1lbnRWYWx1ZShmZWF0dXJlLCBcIlNDT1JFXCIpO1xuICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUubGlua3MgPSBkYXNMaW5rc09mKGZlYXR1cmUpO1xuICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUubm90ZXMgPSBkYXNOb3Rlc09mKGZlYXR1cmUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBncm91cHMgPSBmZWF0dXJlLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiR1JPVVBcIik7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgZ2kgID0gMDsgZ2kgPCBncm91cHMubGVuZ3RoOyArK2dpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBncm91cFhNTCA9IGdyb3Vwc1tnaV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXNHcm91cCA9IG5ldyBEQVNHcm91cCgpO1xuICAgICAgICAgICAgICAgICAgICBkYXNHcm91cC50eXBlID0gZ3JvdXBYTUwuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG4gICAgICAgICAgICAgICAgICAgIGRhc0dyb3VwLmlkID0gZ3JvdXBYTUwuZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgICAgICAgICAgICAgICBkYXNHcm91cC5saW5rcyA9IGRhc0xpbmtzT2YoZ3JvdXBYTUwpO1xuICAgICAgICAgICAgICAgICAgICBkYXNHcm91cC5ub3RlcyA9IGRhc05vdGVzT2YoZ3JvdXBYTUwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRhc0ZlYXR1cmUuZ3JvdXBzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLmdyb3VwcyA9IG5ldyBBcnJheShkYXNHcm91cCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLmdyb3Vwcy5wdXNoKGRhc0dyb3VwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE1hZ2ljIG5vdGVzLiAgQ2hlY2sgd2l0aCBUQUQgYmVmb3JlIGNoYW5naW5nIHRoaXMuXG4gICAgICAgICAgICAgICAgaWYgKGRhc0ZlYXR1cmUubm90ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgbmkgPSAwOyBuaSA8IGRhc0ZlYXR1cmUubm90ZXMubGVuZ3RoOyArK25pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbiA9IGRhc0ZlYXR1cmUubm90ZXNbbmldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG4uaW5kZXhPZignR2VuZW5hbWU9JykgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnZyA9IG5ldyBEQVNHcm91cCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdnLnR5cGU9J2dlbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdnLmlkID0gbi5zdWJzdHJpbmcoOSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkYXNGZWF0dXJlLmdyb3Vwcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLmdyb3VwcyA9IG5ldyBBcnJheShnZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGFzRmVhdHVyZS5ncm91cHMucHVzaChnZyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBlYyA9IGZlYXR1cmUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ1BBUlQnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlYy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGFydHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHBpID0gMDsgcGkgPCBwZWMubGVuZ3RoOyArK3BpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydHMucHVzaChwZWNbcGldLmdldEF0dHJpYnV0ZSgnaWQnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXNGZWF0dXJlLnBhcnRzID0gcGFydHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcGVjID0gZmVhdHVyZS5nZXRFbGVtZW50c0J5VGFnTmFtZSgnUEFSRU5UJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmVudHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHBpID0gMDsgcGkgPCBwZWMubGVuZ3RoOyArK3BpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50cy5wdXNoKHBlY1twaV0uZ2V0QXR0cmlidXRlKCdpZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRhc0ZlYXR1cmUucGFyZW50cyA9IHBhcmVudHM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZmVhdHVyZXMucHVzaChkYXNGZWF0dXJlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICBjYWxsYmFjayhmZWF0dXJlcywgdW5kZWZpbmVkLCBzZWdtZW50TWFwKTtcbiAgICB9LFxuICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgY2FsbGJhY2soW10sIGVycik7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIERBU0FsaWdubWVudCh0eXBlKSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9iamVjdHMgPSB7fTtcbiAgICB0aGlzLmJsb2NrcyA9IFtdO1xufVxuXG5EQVNTb3VyY2UucHJvdG90eXBlLmFsaWdubWVudHMgPSBmdW5jdGlvbihzZWdtZW50LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHZhciBkYXNVUkkgPSB0aGlzLmRhc0Jhc2VVUkkgKyAnYWxpZ25tZW50P3F1ZXJ5PScgKyBzZWdtZW50O1xuICAgIHRoaXMuZG9Dcm9zc0RvbWFpblJlcXVlc3QoZGFzVVJJLCBmdW5jdGlvbihyZXNwb25zZVhNTCkge1xuICAgICAgICBpZiAoIXJlc3BvbnNlWE1MKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhbXSwgJ0ZhaWxlZCByZXF1ZXN0ICcgKyBkYXNVUkkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFsaWdubWVudHMgPSBbXTtcbiAgICAgICAgdmFyIGFsaVhNTHMgPSByZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYWxpZ25tZW50Jyk7XG4gICAgICAgIGZvciAodmFyIGFpID0gMDsgYWkgPCBhbGlYTUxzLmxlbmd0aDsgKythaSkge1xuICAgICAgICAgICAgdmFyIGFsaVhNTCA9IGFsaVhNTHNbYWldO1xuICAgICAgICAgICAgdmFyIGFsaSA9IG5ldyBEQVNBbGlnbm1lbnQoYWxpWE1MLmdldEF0dHJpYnV0ZSgnYWxpZ25UeXBlJykpO1xuICAgICAgICAgICAgdmFyIG9ialhNTHMgPSBhbGlYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2FsaWduT2JqZWN0Jyk7XG4gICAgICAgICAgICBmb3IgKHZhciBvaSA9IDA7IG9pIDwgb2JqWE1Mcy5sZW5ndGg7ICsrb2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqWE1MID0gb2JqWE1Mc1tvaV07XG4gICAgICAgICAgICAgICAgdmFyIG9iaiA9IHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICAgICAgICAgIG9ialhNTC5nZXRBdHRyaWJ1dGUoJ2ludE9iamVjdElkJyksXG4gICAgICAgICAgICAgICAgICAgIGFjY2Vzc2lvbjogICBvYmpYTUwuZ2V0QXR0cmlidXRlKCdkYkFjY2Vzc2lvbklkJyksXG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb246ICAgICBvYmpYTUwuZ2V0QXR0cmlidXRlKCdvYmplY3RWZXJzaW9uJyksXG4gICAgICAgICAgICAgICAgICAgIGRiU291cmNlOiAgICBvYmpYTUwuZ2V0QXR0cmlidXRlKCdkYlNvdXJjZScpLFxuICAgICAgICAgICAgICAgICAgICBkYlZlcnNpb246ICAgb2JqWE1MLmdldEF0dHJpYnV0ZSgnZGJWZXJzaW9uJylcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFsaS5vYmplY3RzW29iai5pZF0gPSBvYmo7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBibG9ja1hNTHMgPSBhbGlYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2Jsb2NrJyk7XG4gICAgICAgICAgICBmb3IgKHZhciBiaSA9IDA7IGJpIDwgYmxvY2tYTUxzLmxlbmd0aDsgKytiaSkge1xuICAgICAgICAgICAgICAgIHZhciBibG9ja1hNTCA9IGJsb2NrWE1Mc1tiaV07XG4gICAgICAgICAgICAgICAgdmFyIGJsb2NrID0ge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcjogICAgICBibG9ja1hNTC5nZXRBdHRyaWJ1dGUoJ2Jsb2NrT3JkZXInKSxcbiAgICAgICAgICAgICAgICAgICAgc2VnbWVudHM6ICAgW11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHZhciBzZWdYTUxzID0gYmxvY2tYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NlZ21lbnQnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBzaSA9IDA7IHNpIDwgc2VnWE1Mcy5sZW5ndGg7ICsrc2kpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZ1hNTCA9IHNlZ1hNTHNbc2ldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VnID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiAgICAgIHNlZ1hNTC5nZXRBdHRyaWJ1dGUoJ2ludE9iamVjdElkJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgICAgc2VnWE1MLmdldEF0dHJpYnV0ZSgnc3RhcnQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgICBzZWdYTUwuZ2V0QXR0cmlidXRlKCdlbmQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmFuZDogICAgICBzZWdYTUwuZ2V0QXR0cmlidXRlKCdzdHJhbmQnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNpZ2FyOiAgICAgICBlbGVtZW50VmFsdWUoc2VnWE1MLCAnY2lnYXInKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBibG9jay5zZWdtZW50cy5wdXNoKHNlZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFsaS5ibG9ja3MucHVzaChibG9jayk7XG4gICAgICAgICAgICB9ICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGFsaWdubWVudHMucHVzaChhbGkpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGFsaWdubWVudHMpO1xuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIERBU1N0eWxlc2hlZXQoKSB7XG4vKlxuICAgIHRoaXMuaGlnaFpvb21TdHlsZXMgPSBuZXcgT2JqZWN0KCk7XG4gICAgdGhpcy5tZWRpdW1ab29tU3R5bGVzID0gbmV3IE9iamVjdCgpO1xuICAgIHRoaXMubG93Wm9vbVN0eWxlcyA9IG5ldyBPYmplY3QoKTtcbiovXG5cbiAgICB0aGlzLnN0eWxlcyA9IFtdO1xufVxuXG5EQVNTdHlsZXNoZWV0LnByb3RvdHlwZS5wdXNoU3R5bGUgPSBmdW5jdGlvbihmaWx0ZXJzLCB6b29tLCBzdHlsZSkge1xuICAgIC8qXG5cbiAgICBpZiAoIXpvb20pIHtcbiAgICAgICAgdGhpcy5oaWdoWm9vbVN0eWxlc1t0eXBlXSA9IHN0eWxlO1xuICAgICAgICB0aGlzLm1lZGl1bVpvb21TdHlsZXNbdHlwZV0gPSBzdHlsZTtcbiAgICAgICAgdGhpcy5sb3dab29tU3R5bGVzW3R5cGVdID0gc3R5bGU7XG4gICAgfSBlbHNlIGlmICh6b29tID09ICdoaWdoJykge1xuICAgICAgICB0aGlzLmhpZ2hab29tU3R5bGVzW3R5cGVdID0gc3R5bGU7XG4gICAgfSBlbHNlIGlmICh6b29tID09ICdtZWRpdW0nKSB7XG4gICAgICAgIHRoaXMubWVkaXVtWm9vbVN0eWxlc1t0eXBlXSA9IHN0eWxlO1xuICAgIH0gZWxzZSBpZiAoem9vbSA9PSAnbG93Jykge1xuICAgICAgICB0aGlzLmxvd1pvb21TdHlsZXNbdHlwZV0gPSBzdHlsZTtcbiAgICB9XG5cbiAgICAqL1xuXG4gICAgaWYgKCFmaWx0ZXJzKSB7XG4gICAgICAgIGZpbHRlcnMgPSB7dHlwZTogJ2RlZmF1bHQnfTtcbiAgICB9XG4gICAgdmFyIHN0eWxlSG9sZGVyID0gc2hhbGxvd0NvcHkoZmlsdGVycyk7XG4gICAgaWYgKHpvb20pIHtcbiAgICAgICAgc3R5bGVIb2xkZXIuem9vbSA9IHpvb207XG4gICAgfVxuICAgIHN0eWxlSG9sZGVyLnN0eWxlID0gc3R5bGU7XG4gICAgdGhpcy5zdHlsZXMucHVzaChzdHlsZUhvbGRlcik7XG59XG5cbmZ1bmN0aW9uIERBU1N0eWxlKCkge1xufVxuXG5mdW5jdGlvbiBwYXJzZUdyYWRpZW50KGdyYWQpIHtcbiAgICB2YXIgc3RlcHMgPSBncmFkLmdldEF0dHJpYnV0ZSgnc3RlcHMnKTtcbiAgICBpZiAoc3RlcHMpIHtcbiAgICAgICAgc3RlcHMgPSBzdGVwc3wwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ZXBzID0gNTA7XG4gICAgfVxuXG5cbiAgICB2YXIgc3RvcHMgPSBbXTtcbiAgICB2YXIgY29sb3JzID0gW107XG4gICAgdmFyIHNlID0gZ3JhZC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnU1RPUCcpO1xuICAgIGZvciAodmFyIHNpID0gMDsgc2kgPCBzZS5sZW5ndGg7ICsrc2kpIHtcbiAgICAgICAgdmFyIHN0b3AgPSBzZVtzaV07XG4gICAgICAgIHN0b3BzLnB1c2goMS4wICogc3RvcC5nZXRBdHRyaWJ1dGUoJ3Njb3JlJykpO1xuICAgICAgICBjb2xvcnMucHVzaChzdG9wLmZpcnN0Q2hpbGQubm9kZVZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbWFrZUNvbG91clN0ZXBzKHN0ZXBzLCBzdG9wcywgY29sb3JzKTtcbn1cblxuREFTU291cmNlLnByb3RvdHlwZS5zdHlsZXNoZWV0ID0gZnVuY3Rpb24oc3VjY2Vzc0NCLCBmYWlsdXJlQ0IpIHtcbiAgICB2YXIgZGFzVVJJLCBjcmVkcyA9IHRoaXMuY3JlZGVudGlhbHM7XG4gICAgaWYgKHRoaXMuc3R5bGVzaGVldF91cmkpIHtcbiAgICAgICAgZGFzVVJJID0gdGhpcy5zdHlsZXNoZWV0X3VyaTtcbiAgICAgICAgY3JlZHMgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBkYXNVUkkgPSB0aGlzLmRhc0Jhc2VVUkkgKyAnc3R5bGVzaGVldCc7XG4gICAgfVxuXG4gICAgZG9Dcm9zc0RvbWFpblJlcXVlc3QoZGFzVVJJLCBmdW5jdGlvbihyZXNwb25zZVhNTCkge1xuICAgICAgICBpZiAoIXJlc3BvbnNlWE1MKSB7XG4gICAgICAgICAgICBpZiAoZmFpbHVyZUNCKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZUNCKCk7XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzdHlsZXNoZWV0ID0gbmV3IERBU1N0eWxlc2hlZXQoKTtcbiAgICAgICAgdmFyIHR5cGVYTUxzID0gcmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ1RZUEUnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlWE1Mcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdmFyIHR5cGVTdHlsZSA9IHR5cGVYTUxzW2ldO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgZmlsdGVyID0ge307XG4gICAgICAgICAgICBmaWx0ZXIudHlwZSA9IHR5cGVTdHlsZS5nZXRBdHRyaWJ1dGUoJ2lkJyk7IC8vIEFtIEkgcmlnaHQgaW4gdGhpbmtpbmcgdGhhdCB0aGlzIG1ha2VzIERBU1NUWUxFIFhNTCBpbnZhbGlkPyAgVWdoLlxuICAgICAgICAgICAgZmlsdGVyLmxhYmVsID0gdHlwZVN0eWxlLmdldEF0dHJpYnV0ZSgnbGFiZWwnKTtcbiAgICAgICAgICAgIGZpbHRlci5tZXRob2QgPSB0eXBlU3R5bGUuZ2V0QXR0cmlidXRlKCdtZXRob2QnKTtcbiAgICAgICAgICAgIHZhciBnbHlwaFhNTHMgPSB0eXBlU3R5bGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ0dMWVBIJyk7XG4gICAgICAgICAgICBmb3IgKHZhciBnaSA9IDA7IGdpIDwgZ2x5cGhYTUxzLmxlbmd0aDsgKytnaSkge1xuICAgICAgICAgICAgICAgIHZhciBnbHlwaFhNTCA9IGdseXBoWE1Mc1tnaV07XG4gICAgICAgICAgICAgICAgdmFyIHpvb20gPSBnbHlwaFhNTC5nZXRBdHRyaWJ1dGUoJ3pvb20nKTtcbiAgICAgICAgICAgICAgICB2YXIgZ2x5cGggPSBjaGlsZEVsZW1lbnRPZihnbHlwaFhNTCk7XG4gICAgICAgICAgICAgICAgdmFyIHN0eWxlID0gbmV3IERBU1N0eWxlKCk7XG4gICAgICAgICAgICAgICAgc3R5bGUuZ2x5cGggPSBnbHlwaC5sb2NhbE5hbWU7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gZ2x5cGguZmlyc3RDaGlsZDtcbiAgICAgICAgXG4gICAgICAgICAgICAgICAgd2hpbGUgKGNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZC5ub2RlVHlwZSA9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxlcnQoY2hpbGQubG9jYWxOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZC5sb2NhbE5hbWUgPT0gJ0JHR1JBRCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZVtjaGlsZC5sb2NhbE5hbWVdID0gcGFyc2VHcmFkaWVudChjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlW2NoaWxkLmxvY2FsTmFtZV0gPSBjaGlsZC5maXJzdENoaWxkLm5vZGVWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdHlsZXNoZWV0LnB1c2hTdHlsZShmaWx0ZXIsIHpvb20sIHN0eWxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdWNjZXNzQ0Ioc3R5bGVzaGVldCk7XG4gICAgfSwgY3JlZHMpO1xufVxuXG4vL1xuLy8gc291cmNlcyBjb21tYW5kXG4vLyBcblxuZnVuY3Rpb24gREFTUmVnaXN0cnkodXJpLCBvcHRzKVxue1xuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIHRoaXMudXJpID0gdXJpO1xuICAgIHRoaXMub3B0cyA9IG9wdHM7ICAgXG59XG5cbkRBU1JlZ2lzdHJ5LnByb3RvdHlwZS5zb3VyY2VzID0gZnVuY3Rpb24oY2FsbGJhY2ssIGZhaWx1cmUsIG9wdHMpXG57XG4gICAgaWYgKCFvcHRzKSB7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG5cbiAgICB2YXIgZmlsdGVycyA9IFtdO1xuICAgIGlmIChvcHRzLnRheG9uKSB7XG4gICAgICAgIGZpbHRlcnMucHVzaCgnb3JnYW5pc209JyArIG9wdHMudGF4b24pO1xuICAgIH1cbiAgICBpZiAob3B0cy5hdXRoKSB7XG4gICAgICAgIGZpbHRlcnMucHVzaCgnYXV0aG9yaXR5PScgKyBvcHRzLmF1dGgpO1xuICAgIH1cbiAgICBpZiAob3B0cy52ZXJzaW9uKSB7XG4gICAgICAgIGZpbHRlcnMucHVzaCgndmVyc2lvbj0nICsgb3B0cy52ZXJzaW9uKTtcbiAgICB9XG4gICAgdmFyIHF1cmkgPSB0aGlzLnVyaTtcbiAgICBpZiAoZmlsdGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHF1cmkgPSBxdXJpICsgJz8nICsgZmlsdGVycy5qb2luKCcmJyk7ICAgLy8gJyYnIGFzIGEgc2VwYXJhdG9yIHRvIGhhY2sgYXJvdW5kIGRhc3JlZ2lzdHJ5Lm9yZyBidWcuXG4gICAgfVxuXG4gICAgZG9Dcm9zc0RvbWFpblJlcXVlc3QocXVyaSwgZnVuY3Rpb24ocmVzcG9uc2VYTUwpIHtcbiAgICAgICAgaWYgKCFyZXNwb25zZVhNTCAmJiBmYWlsdXJlKSB7XG4gICAgICAgICAgICBmYWlsdXJlKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc291cmNlcyA9IFtdOyAgICAgICBcbiAgICAgICAgdmFyIHNvdXJjZVhNTHMgPSByZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnU09VUkNFJyk7XG4gICAgICAgIGZvciAodmFyIHNpID0gMDsgc2kgPCBzb3VyY2VYTUxzLmxlbmd0aDsgKytzaSkge1xuICAgICAgICAgICAgdmFyIHNvdXJjZVhNTCA9IHNvdXJjZVhNTHNbc2ldO1xuICAgICAgICAgICAgdmFyIHZlcnNpb25YTUxzID0gc291cmNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdWRVJTSU9OJyk7XG4gICAgICAgICAgICBpZiAodmVyc2lvblhNTHMubGVuZ3RoIDwgMSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHZlcnNpb25YTUwgPSB2ZXJzaW9uWE1Mc1swXTtcblxuICAgICAgICAgICAgdmFyIGNvb3JkWE1McyA9IHZlcnNpb25YTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ0NPT1JESU5BVEVTJyk7XG4gICAgICAgICAgICB2YXIgY29vcmRzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBjaSA9IDA7IGNpIDwgY29vcmRYTUxzLmxlbmd0aDsgKytjaSkge1xuICAgICAgICAgICAgICAgIHZhciBjb29yZFhNTCA9IGNvb3JkWE1Mc1tjaV07XG4gICAgICAgICAgICAgICAgdmFyIGNvb3JkID0gbmV3IERBU0Nvb3JkcygpO1xuICAgICAgICAgICAgICAgIGNvb3JkLmF1dGggPSBjb29yZFhNTC5nZXRBdHRyaWJ1dGUoJ2F1dGhvcml0eScpO1xuICAgICAgICAgICAgICAgIGNvb3JkLnRheG9uID0gY29vcmRYTUwuZ2V0QXR0cmlidXRlKCd0YXhpZCcpO1xuICAgICAgICAgICAgICAgIGNvb3JkLnZlcnNpb24gPSBjb29yZFhNTC5nZXRBdHRyaWJ1dGUoJ3ZlcnNpb24nKTtcbiAgICAgICAgICAgICAgICBjb29yZHMucHVzaChjb29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBjYXBzID0gW107XG4gICAgICAgICAgICB2YXIgY2FwWE1McyA9IHZlcnNpb25YTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ0NBUEFCSUxJVFknKTtcbiAgICAgICAgICAgIHZhciB1cmk7XG4gICAgICAgICAgICBmb3IgKHZhciBjaSA9IDA7IGNpIDwgY2FwWE1Mcy5sZW5ndGg7ICsrY2kpIHtcbiAgICAgICAgICAgICAgICB2YXIgY2FwWE1MID0gY2FwWE1Mc1tjaV07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY2Fwcy5wdXNoKGNhcFhNTC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FwWE1MLmdldEF0dHJpYnV0ZSgndHlwZScpID09ICdkYXMxOmZlYXR1cmVzJykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmVwID0gY2FwWE1MLmdldEF0dHJpYnV0ZSgncXVlcnlfdXJpJyk7XG4gICAgICAgICAgICAgICAgICAgIHVyaSA9IGZlcC5zdWJzdHJpbmcoMCwgZmVwLmxlbmd0aCAtICgnZmVhdHVyZXMnLmxlbmd0aCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHByb3BzID0ge307XG4gICAgICAgICAgICB2YXIgcHJvcFhNTHMgPSB2ZXJzaW9uWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdQUk9QJyk7XG4gICAgICAgICAgICBmb3IgKHZhciBwaSA9IDA7IHBpIDwgcHJvcFhNTHMubGVuZ3RoOyArK3BpKSB7XG4gICAgICAgICAgICAgICAgcHVzaG8ocHJvcHMsIHByb3BYTUxzW3BpXS5nZXRBdHRyaWJ1dGUoJ25hbWUnKSwgcHJvcFhNTHNbcGldLmdldEF0dHJpYnV0ZSgndmFsdWUnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh1cmkpIHtcbiAgICAgICAgICAgICAgICB2YXIgc291cmNlID0gbmV3IERBU1NvdXJjZSh1cmksIHtcbiAgICAgICAgICAgICAgICAgICAgc291cmNlX3VyaTogc291cmNlWE1MLmdldEF0dHJpYnV0ZSgndXJpJyksXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICBzb3VyY2VYTUwuZ2V0QXR0cmlidXRlKCd0aXRsZScpLFxuICAgICAgICAgICAgICAgICAgICBkZXNjOiAgc291cmNlWE1MLmdldEF0dHJpYnV0ZSgnZGVzY3JpcHRpb24nKSxcbiAgICAgICAgICAgICAgICAgICAgY29vcmRzOiBjb29yZHMsXG4gICAgICAgICAgICAgICAgICAgIHByb3BzOiBwcm9wcyxcbiAgICAgICAgICAgICAgICAgICAgY2FwYWJpbGl0aWVzOiBjYXBzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc291cmNlcy5wdXNoKHNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNhbGxiYWNrKHNvdXJjZXMpO1xuICAgIH0pO1xufVxuXG5cbi8vXG4vLyBVdGlsaXR5IGZ1bmN0aW9uc1xuLy9cblxuZnVuY3Rpb24gZWxlbWVudFZhbHVlKGVsZW1lbnQsIHRhZylcbntcbiAgICB2YXIgY2hpbGRyZW4gPSBlbGVtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKHRhZyk7XG4gICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA+IDAgJiYgY2hpbGRyZW5bMF0uZmlyc3RDaGlsZCkge1xuICAgICAgICB2YXIgYyA9IGNoaWxkcmVuWzBdO1xuICAgICAgICBpZiAoYy5jaGlsZE5vZGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gYy5maXJzdENoaWxkLm5vZGVWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBzID0gJyc7XG4gICAgICAgICAgICBmb3IgKHZhciBuaSA9IDA7IG5pIDwgYy5jaGlsZE5vZGVzLmxlbmd0aDsgKytuaSkge1xuICAgICAgICAgICAgICAgIHMgKz0gYy5jaGlsZE5vZGVzW25pXS5ub2RlVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcztcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjaGlsZEVsZW1lbnRPZihlbGVtZW50KVxue1xuICAgIGlmIChlbGVtZW50Lmhhc0NoaWxkTm9kZXMoKSkge1xuICAgICAgICB2YXIgY2hpbGQgPSBlbGVtZW50LmZpcnN0Q2hpbGQ7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIGlmIChjaGlsZC5ub2RlVHlwZSA9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZDtcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nO1xuICAgICAgICB9IHdoaWxlIChjaGlsZCAhPSBudWxsKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cblxuZnVuY3Rpb24gZGFzTGlua3NPZihlbGVtZW50KVxue1xuICAgIHZhciBsaW5rcyA9IG5ldyBBcnJheSgpO1xuICAgIHZhciBtYXliZUxpbmtDaGlsZGVuID0gZWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnTElOSycpO1xuICAgIGZvciAodmFyIGNpID0gMDsgY2kgPCBtYXliZUxpbmtDaGlsZGVuLmxlbmd0aDsgKytjaSkge1xuICAgICAgICB2YXIgbGlua1hNTCA9IG1heWJlTGlua0NoaWxkZW5bY2ldO1xuICAgICAgICBpZiAobGlua1hNTC5wYXJlbnROb2RlID09IGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGxpbmtzLnB1c2gobmV3IERBU0xpbmsobGlua1hNTC5maXJzdENoaWxkID8gbGlua1hNTC5maXJzdENoaWxkLm5vZGVWYWx1ZSA6ICdVbmtub3duJywgbGlua1hNTC5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBsaW5rcztcbn1cblxuZnVuY3Rpb24gZGFzTm90ZXNPZihlbGVtZW50KVxue1xuICAgIHZhciBub3RlcyA9IFtdO1xuICAgIHZhciBtYXliZU5vdGVzID0gZWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnTk9URScpO1xuICAgIGZvciAodmFyIG5pID0gMDsgbmkgPCBtYXliZU5vdGVzLmxlbmd0aDsgKytuaSkge1xuICAgICAgICBpZiAobWF5YmVOb3Rlc1tuaV0uZmlyc3RDaGlsZCkge1xuICAgICAgICAgICAgbm90ZXMucHVzaChtYXliZU5vdGVzW25pXS5maXJzdENoaWxkLm5vZGVWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5vdGVzO1xufVxuXG5mdW5jdGlvbiBkb0Nyb3NzRG9tYWluUmVxdWVzdCh1cmwsIGhhbmRsZXIsIGNyZWRlbnRpYWxzLCBjdXN0QXV0aCkge1xuICAgIC8vIFRPRE86IGV4cGxpY2l0IGVycm9yIGhhbmRsZXJzP1xuXG4gICAgaWYgKHdpbmRvdy5YRG9tYWluUmVxdWVzdCkge1xuICAgICAgICB2YXIgcmVxID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG4gICAgICAgIHJlcS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBkb20gPSBuZXcgQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxET01cIik7XG4gICAgICAgICAgICBkb20uYXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAgIGRvbS5sb2FkWE1MKHJlcS5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgaGFuZGxlcihkb20pO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5vcGVuKFwiZ2V0XCIsIHVybCk7XG4gICAgICAgIHJlcS5zZW5kKCcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGltaW5nIG91dCAnICArIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcS5hYm9ydCgpO1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyKG51bGwsIHJlcSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICA1MDAwXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXEudGltZW91dCA9IDUwMDA7XG4gICAgICAgICAgICByZXEub250aW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RpbWVvdXQgb24gJyArIHVybCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlcS5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVxLnN0YXR1cyA+PSAyMDAgfHwgcmVxLnN0YXR1cyA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVyKHJlcS5yZXNwb25zZVhNTCwgcmVxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXEub3BlbihcImdldFwiLCB1cmwsIHRydWUpO1xuICAgICAgICAgICAgaWYgKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICAgICAgcmVxLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3VzdEF1dGgpIHtcbiAgICAgICAgICAgICAgICByZXEuc2V0UmVxdWVzdEhlYWRlcignWC1EQVMtQXV0aG9yaXNhdGlvbicsIGN1c3RBdXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcS5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3htbCcpO1xuICAgICAgICAgICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi94bWwsKi8qJyk7XG4gICAgICAgICAgICByZXEuc2VuZCgnJyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGhhbmRsZXIobnVsbCwgcmVxLCBlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuREFTU291cmNlLnByb3RvdHlwZS5kb0Nyb3NzRG9tYWluUmVxdWVzdCA9IGZ1bmN0aW9uKHVybCwgaGFuZGxlciwgZXJySGFuZGxlcikge1xuICAgIHZhciBjdXN0QXV0aDtcbiAgICBpZiAodGhpcy54VXNlcikge1xuICAgICAgICBjdXN0QXV0aCA9ICdCYXNpYyAnICsgYnRvYSh0aGlzLnhVc2VyICsgJzonICsgdGhpcy54UGFzcyk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGRvQ3Jvc3NEb21haW5SZXF1ZXN0KHVybCwgaGFuZGxlciwgdGhpcy5jcmVkZW50aWFscywgY3VzdEF1dGgpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJySGFuZGxlcikge1xuICAgICAgICAgICAgZXJySGFuZGxlcihlcnIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc0Rhc0Jvb2xlYW5UcnVlKHMpIHtcbiAgICBzID0gKCcnICsgcykudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gcz09PSd5ZXMnIHx8IHM9PT0ndHJ1ZSc7XG59XG5cbmZ1bmN0aW9uIGlzRGFzQm9vbGVhbk5vdEZhbHNlKHMpIHtcbiAgICBpZiAoIXMpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIHMgPSAoJycgKyBzKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBzIT09J25vJyB8fCBzIT09J2ZhbHNlJztcbn1cblxuZnVuY3Rpb24gY29weVN0eWxlc2hlZXQoc3MpIHtcbiAgICB2YXIgbnNzID0gc2hhbGxvd0NvcHkoc3MpO1xuICAgIG5zcy5zdHlsZXMgPSBbXTtcbiAgICBmb3IgKHZhciBzaSA9IDA7IHNpIDwgc3Muc3R5bGVzLmxlbmd0aDsgKytzaSkge1xuICAgICAgICB2YXIgc2ggPSBuc3Muc3R5bGVzW3NpXSA9IHNoYWxsb3dDb3B5KHNzLnN0eWxlc1tzaV0pO1xuICAgICAgICBzaC5fbWV0aG9kUkUgPSBzaC5fbGFiZWxSRSA9IHNoLl90eXBlUkUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHNoLnN0eWxlID0gc2hhbGxvd0NvcHkoc2guc3R5bGUpO1xuICAgICAgICBzaC5zdHlsZS5pZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgc2guc3R5bGUuX2dyYWRpZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gbnNzO1xufVxuXG5pZiAodHlwZW9mKG1vZHVsZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIERBU0dyb3VwOiBEQVNHcm91cCxcbiAgICAgICAgREFTRmVhdHVyZTogREFTRmVhdHVyZSxcbiAgICAgICAgREFTU3R5bGVzaGVldDogREFTU3R5bGVzaGVldCxcbiAgICAgICAgREFTU3R5bGU6IERBU1N0eWxlLFxuICAgICAgICBEQVNTb3VyY2U6IERBU1NvdXJjZSxcbiAgICAgICAgREFTU2VnbWVudDogREFTU2VnbWVudCxcbiAgICAgICAgREFTUmVnaXN0cnk6IERBU1JlZ2lzdHJ5LFxuICAgICAgICBEQVNTZXF1ZW5jZTogREFTU2VxdWVuY2UsXG4gICAgICAgIERBU0xpbms6IERBU0xpbmssXG5cbiAgICAgICAgaXNEYXNCb29sZWFuVHJ1ZTogaXNEYXNCb29sZWFuVHJ1ZSxcbiAgICAgICAgaXNEYXNCb29sZWFuTm90RmFsc2U6IGlzRGFzQm9vbGVhbk5vdEZhbHNlLFxuICAgICAgICBjb3B5U3R5bGVzaGVldDogY29weVN0eWxlc2hlZXQsXG4gICAgICAgIGNvb3Jkc01hdGNoOiBjb29yZHNNYXRjaFxuICAgIH07XG59XG4iLCIvKiAtKi0gbW9kZTogamF2YXNjcmlwdDsgYy1iYXNpYy1vZmZzZXQ6IDQ7IGluZGVudC10YWJzLW1vZGU6IG5pbCAtKi0gKi9cblxuLy8gXG4vLyBEYWxsaWFuY2UgR2Vub21lIEV4cGxvcmVyXG4vLyAoYykgVGhvbWFzIERvd24gMjAwNi0yMDE0XG4vL1xuLy8gZW5jb2RlLmpzOiBpbnRlcmZhY2UgZm9yIEVOQ09ERSBEQ0Mgc2VydmljZXNcbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5pZiAodHlwZW9mKHJlcXVpcmUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBQcm9taXNlID0gcmVxdWlyZSgnZXM2LXByb21pc2UnKS5Qcm9taXNlO1xufVxuXG5mdW5jdGlvbiBsb29rdXBFbmNvZGVVUkkodXJpLCBqc29uKSB7XG4gICAgaWYgKHVyaS5pbmRleE9mKCc/JykgPCAwKVxuICAgICAgICB1cmkgPSB1cmkgKyAnP3NvZnQ9dHJ1ZSc7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24oYWNjZXB0LCByZWplY3QpIHtcbiAgICAgICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgICAgIGlmIChyZXEuc3RhdHVzID49IDMwMCkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoJ0Vycm9yIGNvZGUgJyArIHJlcS5zdGF0dXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXNwID0gSlNPTi5wYXJzZShyZXEucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICBhY2NlcHQoanNvbiA/IHJlc3AgOiByZXNwLmxvY2F0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcS5vcGVuKCdHRVQnLCB1cmksIHRydWUpO1xuICAgICAgICByZXEuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgcmVxLnJlc3BvbnNlVHlwZSA9ICd0ZXh0JztcbiAgICAgICAgcmVxLnNlbmQoJycpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBFbmNvZGVVUkxIb2xkZXIodXJsKSB7XG4gICAgdGhpcy5yYXd1cmwgPSB1cmw7XG59XG5cbkVuY29kZVVSTEhvbGRlci5wcm90b3R5cGUuZ2V0VVJMUHJvbWlzZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLnVybFByb21pc2UgJiYgdGhpcy51cmxQcm9taXNlVmFsaWRpdHkgPiBEYXRlLm5vdygpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVybFByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51cmxQcm9taXNlID0gbG9va3VwRW5jb2RlVVJJKHRoaXMucmF3dXJsLCB0cnVlKS50aGVuKGZ1bmN0aW9uKHJlc3ApIHtcbiAgICAgICAgICAgIHJldHVybiByZXNwLmxvY2F0aW9uO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy51cmxQcm9taXNlVmFsaWRpdHkgPSBEYXRlLm5vdygpICsgKDEyICogMzYwMCAqIDEwMDApO1xuICAgICAgICByZXR1cm4gdGhpcy51cmxQcm9taXNlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gRW5jb2RlRmV0Y2hhYmxlKHVybCwgc3RhcnQsIGVuZCwgb3B0cykge1xuICAgIGlmICghb3B0cykge1xuICAgICAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgb3B0cyA9IHN0YXJ0O1xuICAgICAgICAgICAgc3RhcnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRzID0ge307XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnVybCA9ICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJyA/IG5ldyBFbmNvZGVVUkxIb2xkZXIodXJsKSA6IHVybCk7XG4gICAgdGhpcy5zdGFydCA9IHN0YXJ0IHx8IDA7XG4gICAgaWYgKGVuZCkge1xuICAgICAgICB0aGlzLmVuZCA9IGVuZDtcbiAgICB9XG4gICAgdGhpcy5vcHRzID0gb3B0cztcbn1cblxuXG5cbkVuY29kZUZldGNoYWJsZS5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbihzLCBsKSB7XG4gICAgaWYgKHMgPCAwKSB7XG4gICAgICAgIHRocm93ICdCYWQgc2xpY2UgJyArIHM7XG4gICAgfVxuXG4gICAgdmFyIG5zID0gdGhpcy5zdGFydCwgbmUgPSB0aGlzLmVuZDtcbiAgICBpZiAobnMgJiYgcykge1xuICAgICAgICBucyA9IG5zICsgcztcbiAgICB9IGVsc2Uge1xuICAgICAgICBucyA9IHMgfHwgbnM7XG4gICAgfVxuICAgIGlmIChsICYmIG5zKSB7XG4gICAgICAgIG5lID0gbnMgKyBsIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZSA9IG5lIHx8IGwgLSAxO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEVuY29kZUZldGNoYWJsZSh0aGlzLnVybCwgbnMsIG5lLCB0aGlzLm9wdHMpO1xufVxuXG5FbmNvZGVGZXRjaGFibGUucHJvdG90eXBlLmZldGNoQXNUZXh0ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHZhciBsZW5ndGg7XG4gICAgc2VsZi51cmwuZ2V0VVJMUHJvbWlzZSgpLnRoZW4oZnVuY3Rpb24odXJsKSB7XG4gICAgICAgIHJlcS5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgIGlmIChzZWxmLmVuZCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuZW5kIC0gc2VsZi5zdGFydCA+IDEwMDAwMDAwMCkge1xuICAgICAgICAgICAgICAgIHRocm93ICdNb25zdGVyIGZldGNoISc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXEuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHNlbGYuc3RhcnQgKyAnLScgKyBzZWxmLmVuZCk7XG4gICAgICAgICAgICBsZW5ndGggPSBzZWxmLmVuZCAtIHNlbGYuc3RhcnQgKyAxO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHJlcS5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVxLnN0YXR1cyA9PSAyMDAgfHwgcmVxLnN0YXR1cyA9PSAyMDYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlcS5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGlmIChzZWxmLm9wdHMuY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJlcS53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5zZW5kKCcnKTtcbiAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xuICAgIH0pO1xufVxuXG5FbmNvZGVGZXRjaGFibGUucHJvdG90eXBlLnNhbHRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzO1xufVxuXG5FbmNvZGVGZXRjaGFibGUucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIGF0dGVtcHQsIHRydW5jYXRlZExlbmd0aCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGF0dGVtcHQgPSBhdHRlbXB0IHx8IDE7XG4gICAgaWYgKGF0dGVtcHQgPiAzKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsKTtcbiAgICB9XG5cbiAgICBzZWxmLnVybC5nZXRVUkxQcm9taXNlKCkudGhlbihmdW5jdGlvbiAodXJsKSB7XG4gICAgICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgdmFyIGxlbmd0aDtcbiAgICAgICAgcmVxLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHJlcS5vdmVycmlkZU1pbWVUeXBlKCd0ZXh0L3BsYWluOyBjaGFyc2V0PXgtdXNlci1kZWZpbmVkJyk7XG4gICAgICAgIGlmIChzZWxmLmVuZCkge1xuICAgICAgICAgICAgaWYgKHNlbGYuZW5kIC0gc2VsZi5zdGFydCA+IDEwMDAwMDAwMCkge1xuICAgICAgICAgICAgICAgIHRocm93ICdNb25zdGVyIGZldGNoISc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXEuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHNlbGYuc3RhcnQgKyAnLScgKyBzZWxmLmVuZCk7XG4gICAgICAgICAgICBsZW5ndGggPSBzZWxmLmVuZCAtIHNlbGYuc3RhcnQgKyAxO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgICAgICByZXEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT0gNCkge1xuICAgICAgICAgICAgICAgIGlmIChyZXEuc3RhdHVzID09IDIwMCB8fCByZXEuc3RhdHVzID09IDIwNikge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVxLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmwgPSByZXEucmVzcG9uc2UuYnl0ZUxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZW5ndGggJiYgbGVuZ3RoICE9IGJsICYmICghdHJ1bmNhdGVkTGVuZ3RoIHx8IGJsICE9IHRydW5jYXRlZExlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5mZXRjaChjYWxsYmFjaywgYXR0ZW1wdCArIDEsIGJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlcS5yZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVxLm1velJlc3BvbnNlQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhyZXEubW96UmVzcG9uc2VBcnJheUJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IHJlcS5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVuZ3RoICYmIGxlbmd0aCAhPSByLmxlbmd0aCAmJiAoIXRydW5jYXRlZExlbmd0aCB8fCByLmxlbmd0aCAhPSB0cnVuY2F0ZWRMZW5ndGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuZmV0Y2goY2FsbGJhY2ssIGF0dGVtcHQgKyAxLCByLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhic3RyaW5nVG9CdWZmZXIocmVxLnJlc3BvbnNlVGV4dCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuZmV0Y2goY2FsbGJhY2ssIGF0dGVtcHQgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGlmIChzZWxmLm9wdHMuY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJlcS53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJlcS5zZW5kKCcnKTtcbiAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYnN0cmluZ1RvQnVmZmVyKHJlc3VsdCkge1xuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciBiYSA9IG5ldyBVaW50OEFycmF5KHJlc3VsdC5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmEubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgYmFbaV0gPSByZXN1bHQuY2hhckNvZGVBdChpKTtcbiAgICB9XG4gICAgcmV0dXJuIGJhLmJ1ZmZlcjtcbn1cblxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBsb29rdXBFbmNvZGVVUkk6IGxvb2t1cEVuY29kZVVSSSxcbiAgICAgICAgRW5jb2RlRmV0Y2hhYmxlOiBFbmNvZGVGZXRjaGFibGVcbiAgICB9O1xufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLyogLSotIG1vZGU6IGphdmFzY3JpcHQ7IGMtYmFzaWMtb2Zmc2V0OiA0OyBpbmRlbnQtdGFicy1tb2RlOiBuaWwgLSotICovXG5cbi8vIFxuLy8gRGFsbGlhbmNlIEdlbm9tZSBFeHBsb3JlclxuLy8gKGMpIFRob21hcyBEb3duIDIwMDYtMjAxNFxuLy9cbi8vIGZldGNod29ya2VyLmpzXG4vL1xuXG5cInVzZSBzdHJpY3RcIjtcblxudmFyIGJpbiA9IHJlcXVpcmUoJy4vYmluJyk7XG52YXIgYmFtID0gcmVxdWlyZSgnLi9iYW0nKTtcbnZhciBiaWd3aWcgPSByZXF1aXJlKCcuL2JpZ3dpZycpO1xudmFyIGVuY29kZSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBjb25uZWN0aW9ucyA9IHt9O1xuXG52YXIgaWRTZWVkID0gMDtcblxuZ2xvYmFsLm5ld0lEID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICdjbicgKyAoKytpZFNlZWQpO1xufVxuXG5wb3N0TWVzc2FnZSh7dGFnOiAnaW5pdCd9KTtcblxuc2VsZi5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgIHZhciBkID0gZXZlbnQuZGF0YTtcbiAgICB2YXIgY29tbWFuZCA9IGV2ZW50LmRhdGEuY29tbWFuZDtcbiAgICB2YXIgdGFnID0gZXZlbnQuZGF0YS50YWc7XG5cbiAgICBpZiAoY29tbWFuZCA9PT0gJ2Nvbm5lY3RCQU0nKSB7XG4gICAgICAgIHZhciBpZCA9IG5ld0lEKCk7XG5cbiAgICAgICAgdmFyIGJhbUYsIGJhaUYsIGluZGV4Q2h1bmtzO1xuICAgICAgICBpZiAoZC5ibG9iKSB7XG4gICAgICAgICAgICBiYW1GID0gbmV3IGJpbi5CbG9iRmV0Y2hhYmxlKGQuYmxvYik7XG4gICAgICAgICAgICBiYWlGID0gbmV3IGJpbi5CbG9iRmV0Y2hhYmxlKGQuaW5kZXhCbG9iKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJhbUYgPSBuZXcgYmluLlVSTEZldGNoYWJsZShkLnVyaSwge2NyZWRlbnRpYWxzOiBkLmNyZWRlbnRpYWxzfSk7XG4gICAgICAgICAgICBiYWlGID0gbmV3IGJpbi5VUkxGZXRjaGFibGUoZC5pbmRleFVyaSwge2NyZWRlbnRpYWxzOiBkLmNyZWRlbnRpYWxzfSk7XG4gICAgICAgICAgICBpbmRleENodW5rcyA9IGQuaW5kZXhDaHVua3M7XG4gICAgICAgIH1cblxuICAgICAgICBiYW0ubWFrZUJhbShiYW1GLCBiYWlGLCBpbmRleENodW5rcywgZnVuY3Rpb24oYmFtT2JqLCBlcnIpIHtcbiAgICAgICAgICAgIGlmIChiYW1PYmopIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uc1tpZF0gPSBuZXcgQkFNV29ya2VyRmV0Y2hlcihiYW1PYmopO1xuICAgICAgICAgICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiBpZH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZSh7dGFnOiB0YWcsIGVycm9yOiBlcnIgfHwgXCJDb3VsZG4ndCBmZXRjaCBCQU1cIn0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICdjb25uZWN0QkJJJykge1xuICAgICAgICB2YXIgaWQgPSBuZXdJRCgpO1xuICAgICAgICB2YXIgYmJpO1xuICAgICAgICBpZiAoZC5ibG9iKSB7XG4gICAgICAgICAgICBiYmkgPSBuZXcgYmluLkJsb2JGZXRjaGFibGUoZC5ibG9iKTtcbiAgICAgICAgfSBlbHNlIGlmIChkLnRyYW5zcG9ydCA9PSAnZW5jb2RlJykge1xuICAgICAgICAgICAgYmJpID0gbmV3IGVuY29kZS5FbmNvZGVGZXRjaGFibGUoZC51cmksIHtjcmVkZW50aWFsczogZC5jcmVkZW50aWFsc30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmJpID0gbmV3IGJpbi5VUkxGZXRjaGFibGUoZC51cmksIHtjcmVkZW50aWFsczogZC5jcmVkZW50aWFsc30pO1xuICAgICAgICB9XG5cbiAgICAgICAgYmlnd2lnLm1ha2VCd2coYmJpLCBmdW5jdGlvbihid2csIGVycikge1xuICAgICAgICAgICAgaWYgKGJ3Zykge1xuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb25zW2lkXSA9IG5ldyBCQklXb3JrZXJGZXRjaGVyKGJ3Zyk7XG4gICAgICAgICAgICAgICAgcG9zdE1lc3NhZ2Uoe3RhZzogdGFnLCByZXN1bHQ6IGlkfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6IGVyciB8fCBcIkNvdWxkbid0IGZldGNoIEJCSVwifSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGQudXJpKTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICd0ZXh0eGhyJykge1xuICAgICAgICB1dGlscy50ZXh0WEhSKGQudXJpLCBmdW5jdGlvbihyZXNwLCBlcnIpIHtcbiAgICAgICAgICAgIGlmIChyZXNwKSB7XG4gICAgICAgICAgICAgICAgcG9zdE1lc3NhZ2Uoe3RhZzogdGFnLCByZXN1bHQ6IHJlc3B9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcG9zdE1lc3NhZ2Uoe3RhZzogdGFnLCBlcnI6IGVyciB8fCBcIkNvdWxkbid0IGZldGNoIHJlc291cmNlXCJ9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChjb21tYW5kID09PSAnZmV0Y2gnKSB7XG4gICAgICAgIHZhciBjb24gPSBjb25uZWN0aW9uc1tldmVudC5kYXRhLmNvbm5lY3Rpb25dO1xuICAgICAgICBpZiAoIWNvbikge1xuICAgICAgICAgICAgcmV0dXJuIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6ICdObyBzdWNoIGNvbm5lY3Rpb246ICcgKyBldmVudC5kYXRhLmNvbm5lY3Rpb259KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbi5mZXRjaChkLnRhZywgZC5jaHIsIGQubWluLCBkLm1heCwgZC56b29tLCBkLm9wdHMpO1xuICAgIH0gZWxzZSBpZiAoY29tbWFuZCA9PT0gJ2xlYXAnKSB7XG4gICAgICAgIHZhciBjb24gPSBjb25uZWN0aW9uc1tldmVudC5kYXRhLmNvbm5lY3Rpb25dO1xuICAgICAgICBpZiAoIWNvbikge1xuICAgICAgICAgICAgcmV0dXJuIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6ICdObyBzdWNoIGNvbm5lY3Rpb246ICcgKyBldmVudC5kYXRhLmNvbm5lY3Rpb259KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbi5sZWFwKGQudGFnLCBkLmNociwgZC5wb3MsIGQuZGlyKTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICdxdWFudExlYXAnKSB7XG4gICAgICAgIHZhciBjb24gPSBjb25uZWN0aW9uc1tldmVudC5kYXRhLmNvbm5lY3Rpb25dO1xuICAgICAgICBpZiAoIWNvbikge1xuICAgICAgICAgICAgcmV0dXJuIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6ICdObyBzdWNoIGNvbm5lY3Rpb246ICcgKyBldmVudC5kYXRhLmNvbm5lY3Rpb259KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbi5xdWFudExlYXAoZC50YWcsIGQuY2hyLCBkLnBvcywgZC5kaXIsIGQudGhyZXNob2xkLCBkLnVuZGVyKTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICdtZXRhJykge1xuICAgICAgICB2YXIgY29uID0gY29ubmVjdGlvbnNbZXZlbnQuZGF0YS5jb25uZWN0aW9uXTtcbiAgICAgICAgaWYgKCFjb24pIHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0TWVzc2FnZSh7dGFnOiB0YWcsIGVycm9yOiAnTm8gc3VjaCBjb25uZWN0aW9uOiAnICsgZXZlbnQuZGF0YS5jb25uZWN0aW9ufSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb24ubWV0YShkLnRhZyk7XG4gICAgfSBlbHNlIGlmIChjb21tYW5kID09PSAnc2VhcmNoJykge1xuICAgICAgICB2YXIgY29uID0gY29ubmVjdGlvbnNbZXZlbnQuZGF0YS5jb25uZWN0aW9uXTtcbiAgICAgICAgaWYgKCFjb24pIHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0TWVzc2FnZSh7dGFnOiB0YWcsIGVycm9yOiAnTm8gc3VjaCBjb25uZWN0aW9uOiAnICsgZXZlbnQuZGF0YS5jb25uZWN0aW9ufSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb24uc2VhcmNoKGQudGFnLCBkLnF1ZXJ5LCBkLmluZGV4KTtcbiAgICB9IGVsc2UgaWYgKGNvbW1hbmQgPT09ICdkYXRlJykge1xuICAgICAgICByZXR1cm4gcG9zdE1lc3NhZ2Uoe3RhZzogdGFnLCByZXN1bHQ6IERhdGUubm93KCl8MH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6ICdCYWQgY29tbWFuZCAnICsgY29tbWFuZH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gQkFNV29ya2VyRmV0Y2hlcihiYW0pIHtcbiAgICB0aGlzLmJhbSA9IGJhbTtcbn1cblxuQkFNV29ya2VyRmV0Y2hlci5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbih0YWcsIGNociwgbWluLCBtYXgsIHpvb20sIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB0aGlzLmJhbS5mZXRjaChjaHIsIG1pbiwgbWF4LCBmdW5jdGlvbihyZWNvcmRzLCBlcnIpIHtcbiAgICAgICAgaWYgKHJlY29yZHMpIHtcbiAgICAgICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiByZWNvcmRzLCB0aW1lOiBEYXRlLm5vdygpfDB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgZXJyb3I6IGVycn0pO1xuICAgICAgICB9XG4gICAgfSwgb3B0cyk7XG59XG5cbmZ1bmN0aW9uIEJCSVdvcmtlckZldGNoZXIoYmJpKSB7XG4gICAgdGhpcy5iYmkgPSBiYmk7XG59XG5cbkJCSVdvcmtlckZldGNoZXIucHJvdG90eXBlLmZldGNoID0gZnVuY3Rpb24odGFnLCBjaHIsIG1pbiwgbWF4LCB6b29tKSB7XG4gICAgaWYgKHR5cGVvZih6b29tKSAhPT0gJ251bWJlcicpXG4gICAgICAgIHpvb20gPSAtMTtcblxuICAgIHZhciBkYXRhO1xuICAgIGlmICh6b29tIDwgMCkge1xuICAgICAgICBkYXRhID0gdGhpcy5iYmkuZ2V0VW56b29tZWRWaWV3KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZGF0YSA9IHRoaXMuYmJpLmdldFpvb21lZFZpZXcoem9vbSk7XG4gICAgfVxuXG4gICAgZGF0YS5yZWFkV2lnRGF0YShjaHIsIG1pbiwgbWF4LCBmdW5jdGlvbihmZWF0dXJlcykge1xuICAgICAgICBwb3N0TWVzc2FnZSh7dGFnOiB0YWcsIHJlc3VsdDogZmVhdHVyZXN9KTtcbiAgICB9KTtcbn1cblxuQkJJV29ya2VyRmV0Y2hlci5wcm90b3R5cGUubWV0YSA9IGZ1bmN0aW9uKHRhZykge1xuICAgIHZhciBzY2FsZXMgPSBbMV07XG4gICAgZm9yICh2YXIgeiA9IDA7IHogPCB0aGlzLmJiaS56b29tTGV2ZWxzLmxlbmd0aDsgKyt6KSB7XG4gICAgICAgIHNjYWxlcy5wdXNoKHRoaXMuYmJpLnpvb21MZXZlbHNbel0ucmVkdWN0aW9uKTtcbiAgICB9XG5cbiAgICB2YXIgdGhpc0IgPSB0aGlzO1xuICAgIHZhciBtZXRhID0ge3R5cGU6IHRoaXMuYmJpLnR5cGUsXG4gICAgICAgICAgICAgICAgem9vbUxldmVsczogc2NhbGVzLFxuICAgICAgICAgICAgICAgIGZpZWxkQ291bnQ6IHRoaXMuYmJpLmZpZWxkQ291bnQsXG4gICAgICAgICAgICAgICAgZGVmaW5lZEZpZWxkQ291bnQ6IHRoaXMuYmJpLmRlZmluZWRGaWVsZENvdW50LFxuICAgICAgICAgICAgICAgIHNjaGVtYTogdGhpcy5iYmkuc2NoZW1hfTtcbiAgICBpZiAodGhpcy5iYmkudHlwZSA9PT0gJ2JpZ2JlZCcpIHtcbiAgICAgICAgdGhpcy5iYmkuZ2V0RXh0cmFJbmRpY2VzKGZ1bmN0aW9uKGVpKSB7XG4gICAgICAgICAgICBpZiAoZWkpIHtcbiAgICAgICAgICAgICAgICB0aGlzQi5leHRyYUluZGljZXMgPSBlaTtcbiAgICAgICAgICAgICAgICBtZXRhLmV4dHJhSW5kaWNlcyA9IGVpLm1hcChmdW5jdGlvbihpKSB7cmV0dXJuIGkuZmllbGR9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiBtZXRhfSk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiBtZXRhfSk7XG4gICAgfVxufVxuXG5CQklXb3JrZXJGZXRjaGVyLnByb3RvdHlwZS5sZWFwID0gZnVuY3Rpb24odGFnLCBjaHIsIHBvcywgZGlyKSB7XG4gICAgdGhpcy5iYmkuZ2V0VW56b29tZWRWaWV3KCkuZ2V0Rmlyc3RBZGphY2VudChjaHIsIHBvcywgZGlyLCBmdW5jdGlvbihyZXN1bHQsIGVycikge1xuICAgICAgICBwb3N0TWVzc2FnZSh7dGFnOiB0YWcsIHJlc3VsdDogcmVzdWx0LCBlcnJvcjogZXJyfSk7XG4gICAgfSk7XG59XG5cbkJCSVdvcmtlckZldGNoZXIucHJvdG90eXBlLnF1YW50TGVhcCA9IGZ1bmN0aW9uKHRhZywgY2hyLCBwb3MsIGRpciwgdGhyZXNob2xkLCB1bmRlcikge1xuICAgIHRoaXMuYmJpLnRocmVzaG9sZFNlYXJjaChjaHIsIHBvcywgZGlyLCB0aHJlc2hvbGQsIGZ1bmN0aW9uKHJlc3VsdCwgZXJyKSB7XG4gICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiByZXN1bHQsIGVycm9yOiBlcnJ9KTtcbiAgICB9KTtcbn1cblxuQkJJV29ya2VyRmV0Y2hlci5wcm90b3R5cGUuc2VhcmNoID0gZnVuY3Rpb24odGFnLCBxdWVyeSwgaW5kZXgpIHtcbiAgICB2YXIgaXMgPSB0aGlzLmV4dHJhSW5kaWNlc1swXTtcbiAgICBpcy5sb29rdXAocXVlcnksIGZ1bmN0aW9uKHJlc3VsdCwgZXJyKSB7XG4gICAgICAgIHBvc3RNZXNzYWdlKHt0YWc6IHRhZywgcmVzdWx0OiByZXN1bHQsIGVycm9yOiBlcnJ9KTtcbiAgICB9KTtcbn1cblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIvKiAtKi0gbW9kZTogamF2YXNjcmlwdDsgYy1iYXNpYy1vZmZzZXQ6IDQ7IGluZGVudC10YWJzLW1vZGU6IG5pbCAtKi0gKi9cblxuLy8gXG4vLyBEYWxsaWFuY2UgR2Vub21lIEV4cGxvcmVyXG4vLyAoYykgVGhvbWFzIERvd24gMjAwNi0yMDExXG4vL1xuLy8gbGgzdXRpbHMuanM6IGNvbW1vbiBzdXBwb3J0IGZvciBsaDMncyBmaWxlIGZvcm1hdHNcbi8vXG5cbmlmICh0eXBlb2YocmVxdWlyZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdmFyIGpzemxpYiA9IHJlcXVpcmUoJ2pzemxpYicpO1xuICAgIHZhciBqc3psaWJfaW5mbGF0ZV9idWZmZXIgPSBqc3psaWIuaW5mbGF0ZUJ1ZmZlcjtcbiAgICB2YXIgYXJyYXlDb3B5ID0ganN6bGliLmFycmF5Q29weTtcbn1cblxuZnVuY3Rpb24gVm9iKGIsIG8pIHtcbiAgICB0aGlzLmJsb2NrID0gYjtcbiAgICB0aGlzLm9mZnNldCA9IG87XG59XG5cblZvYi5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJycgKyB0aGlzLmJsb2NrICsgJzonICsgdGhpcy5vZmZzZXQ7XG59XG5cbmZ1bmN0aW9uIHJlYWRWb2IoYmEsIG9mZnNldCkge1xuICAgIHZhciBibG9jayA9ICgoYmFbb2Zmc2V0KzZdICYgMHhmZikgKiAweDEwMDAwMDAwMCkgKyAoKGJhW29mZnNldCs1XSAmIDB4ZmYpICogMHgxMDAwMDAwKSArICgoYmFbb2Zmc2V0KzRdICYgMHhmZikgKiAweDEwMDAwKSArICgoYmFbb2Zmc2V0KzNdICYgMHhmZikgKiAweDEwMCkgKyAoKGJhW29mZnNldCsyXSAmIDB4ZmYpKTtcbiAgICB2YXIgYmludCA9IChiYVtvZmZzZXQrMV0gPDwgOCkgfCAoYmFbb2Zmc2V0XSk7XG4gICAgaWYgKGJsb2NrID09IDAgJiYgYmludCA9PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsOyAgLy8gU2hvdWxkIG9ubHkgaGFwcGVuIGluIHRoZSBsaW5lYXIgaW5kZXg/XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBWb2IoYmxvY2ssIGJpbnQpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdW5iZ3pmKGRhdGEsIGxpbSkge1xuICAgIGxpbSA9IE1hdGgubWluKGxpbSB8fCAxLCBkYXRhLmJ5dGVMZW5ndGggLSA1MCk7XG4gICAgdmFyIG9CbG9ja0xpc3QgPSBbXTtcbiAgICB2YXIgcHRyID0gWzBdO1xuICAgIHZhciB0b3RhbFNpemUgPSAwO1xuXG4gICAgd2hpbGUgKHB0clswXSA8IGxpbSkge1xuICAgICAgICB2YXIgYmEgPSBuZXcgVWludDhBcnJheShkYXRhLCBwdHJbMF0sIDEyKTsgLy8gRklYTUUgaXMgdGhpcyBlbm91Z2ggZm9yIGFsbCBjcmVkaWJsZSBCR1pGIGJsb2NrIGhlYWRlcnM/XG4gICAgICAgIHZhciB4bGVuID0gKGJhWzExXSA8PCA4KSB8IChiYVsxMF0pO1xuICAgICAgICAvLyBkbG9nKCd4bGVuWycgKyAocHRyWzBdKSArJ109JyArIHhsZW4pO1xuICAgICAgICB2YXIgdW5jID0ganN6bGliX2luZmxhdGVfYnVmZmVyKGRhdGEsIDEyICsgeGxlbiArIHB0clswXSwgTWF0aC5taW4oNjU1MzYsIGRhdGEuYnl0ZUxlbmd0aCAtIDEyIC0geGxlbiAtIHB0clswXSksIHB0cik7XG4gICAgICAgIHB0clswXSArPSA4O1xuICAgICAgICB0b3RhbFNpemUgKz0gdW5jLmJ5dGVMZW5ndGg7XG4gICAgICAgIG9CbG9ja0xpc3QucHVzaCh1bmMpO1xuICAgIH1cblxuICAgIGlmIChvQmxvY2tMaXN0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHJldHVybiBvQmxvY2tMaXN0WzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBvdXQgPSBuZXcgVWludDhBcnJheSh0b3RhbFNpemUpO1xuICAgICAgICB2YXIgY3Vyc29yID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvQmxvY2tMaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgYiA9IG5ldyBVaW50OEFycmF5KG9CbG9ja0xpc3RbaV0pO1xuICAgICAgICAgICAgYXJyYXlDb3B5KGIsIDAsIG91dCwgY3Vyc29yLCBiLmxlbmd0aCk7XG4gICAgICAgICAgICBjdXJzb3IgKz0gYi5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dC5idWZmZXI7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBDaHVuayhtaW52LCBtYXh2KSB7XG4gICAgdGhpcy5taW52ID0gbWludjsgdGhpcy5tYXh2ID0gbWF4djtcbn1cblxuXG4vL1xuLy8gQmlubmluZyAodHJhbnNsaXRlcmF0ZWQgZnJvbSBTQU0xLjMgc3BlYylcbi8vXG5cbi8qIGNhbGN1bGF0ZSBiaW4gZ2l2ZW4gYW4gYWxpZ25tZW50IGNvdmVyaW5nIFtiZWcsZW5kKSAoemVyby1iYXNlZCwgaGFsZi1jbG9zZS1oYWxmLW9wZW4pICovXG5mdW5jdGlvbiByZWcyYmluKGJlZywgZW5kKVxue1xuICAgIC0tZW5kO1xuICAgIGlmIChiZWc+PjE0ID09IGVuZD4+MTQpIHJldHVybiAoKDE8PDE1KS0xKS83ICsgKGJlZz4+MTQpO1xuICAgIGlmIChiZWc+PjE3ID09IGVuZD4+MTcpIHJldHVybiAoKDE8PDEyKS0xKS83ICsgKGJlZz4+MTcpO1xuICAgIGlmIChiZWc+PjIwID09IGVuZD4+MjApIHJldHVybiAoKDE8PDkpLTEpLzcgKyAoYmVnPj4yMCk7XG4gICAgaWYgKGJlZz4+MjMgPT0gZW5kPj4yMykgcmV0dXJuICgoMTw8NiktMSkvNyArIChiZWc+PjIzKTtcbiAgICBpZiAoYmVnPj4yNiA9PSBlbmQ+PjI2KSByZXR1cm4gKCgxPDwzKS0xKS83ICsgKGJlZz4+MjYpO1xuICAgIHJldHVybiAwO1xufVxuXG4vKiBjYWxjdWxhdGUgdGhlIGxpc3Qgb2YgYmlucyB0aGF0IG1heSBvdmVybGFwIHdpdGggcmVnaW9uIFtiZWcsZW5kKSAoemVyby1iYXNlZCkgKi9cbnZhciBNQVhfQklOID0gKCgoMTw8MTgpLTEpLzcpO1xuZnVuY3Rpb24gcmVnMmJpbnMoYmVnLCBlbmQpIFxue1xuICAgIHZhciBpID0gMCwgaywgbGlzdCA9IFtdO1xuICAgIC0tZW5kO1xuICAgIGxpc3QucHVzaCgwKTtcbiAgICBmb3IgKGsgPSAxICsgKGJlZz4+MjYpOyBrIDw9IDEgKyAoZW5kPj4yNik7ICsraykgbGlzdC5wdXNoKGspO1xuICAgIGZvciAoayA9IDkgKyAoYmVnPj4yMyk7IGsgPD0gOSArIChlbmQ+PjIzKTsgKytrKSBsaXN0LnB1c2goayk7XG4gICAgZm9yIChrID0gNzMgKyAoYmVnPj4yMCk7IGsgPD0gNzMgKyAoZW5kPj4yMCk7ICsraykgbGlzdC5wdXNoKGspO1xuICAgIGZvciAoayA9IDU4NSArIChiZWc+PjE3KTsgayA8PSA1ODUgKyAoZW5kPj4xNyk7ICsraykgbGlzdC5wdXNoKGspO1xuICAgIGZvciAoayA9IDQ2ODEgKyAoYmVnPj4xNCk7IGsgPD0gNDY4MSArIChlbmQ+PjE0KTsgKytrKSBsaXN0LnB1c2goayk7XG4gICAgcmV0dXJuIGxpc3Q7XG59XG5cbmlmICh0eXBlb2YobW9kdWxlKSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgdW5iZ3pmOiB1bmJnemYsXG4gICAgICAgIHJlYWRWb2I6IHJlYWRWb2IsXG4gICAgICAgIHJlZzJiaW46IHJlZzJiaW4sXG4gICAgICAgIHJlZzJiaW5zOiByZWcyYmlucyxcbiAgICAgICAgQ2h1bms6IENodW5rXG4gICAgfTtcbn0iLCIvKlxyXG4gKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNlY3VyZSBIYXNoIEFsZ29yaXRobSwgU0hBLTEsIGFzIGRlZmluZWRcclxuICogaW4gRklQUyAxODAtMVxyXG4gKiBWZXJzaW9uIDIuMiBDb3B5cmlnaHQgUGF1bCBKb2huc3RvbiAyMDAwIC0gMjAwOS5cclxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxyXG4gKiBEaXN0cmlidXRlZCB1bmRlciB0aGUgQlNEIExpY2Vuc2VcclxuICogU2VlIGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDUgZm9yIGRldGFpbHMuXHJcbiAqL1xyXG5cclxuIFwidXNlIHN0cmljdFwiO1xyXG5cclxuLypcclxuICogQ29uZmlndXJhYmxlIHZhcmlhYmxlcy4gWW91IG1heSBuZWVkIHRvIHR3ZWFrIHRoZXNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aFxyXG4gKiB0aGUgc2VydmVyLXNpZGUsIGJ1dCB0aGUgZGVmYXVsdHMgd29yayBpbiBtb3N0IGNhc2VzLlxyXG4gKi9cclxudmFyIGhleGNhc2UgPSAwOyAgLyogaGV4IG91dHB1dCBmb3JtYXQuIDAgLSBsb3dlcmNhc2U7IDEgLSB1cHBlcmNhc2UgICAgICAgICovXHJcbnZhciBiNjRwYWQgID0gXCJcIjsgLyogYmFzZS02NCBwYWQgY2hhcmFjdGVyLiBcIj1cIiBmb3Igc3RyaWN0IFJGQyBjb21wbGlhbmNlICAgKi9cclxuXHJcbi8qXHJcbiAqIFRoZXNlIGFyZSB0aGUgZnVuY3Rpb25zIHlvdSdsbCB1c3VhbGx5IHdhbnQgdG8gY2FsbFxyXG4gKiBUaGV5IHRha2Ugc3RyaW5nIGFyZ3VtZW50cyBhbmQgcmV0dXJuIGVpdGhlciBoZXggb3IgYmFzZS02NCBlbmNvZGVkIHN0cmluZ3NcclxuICovXHJcbmZ1bmN0aW9uIGhleF9zaGExKHMpICAgIHsgcmV0dXJuIHJzdHIyaGV4KHJzdHJfc2hhMShzdHIycnN0cl91dGY4KHMpKSk7IH1cclxuZnVuY3Rpb24gYjY0X3NoYTEocykgICAgeyByZXR1cm4gcnN0cjJiNjQocnN0cl9zaGExKHN0cjJyc3RyX3V0ZjgocykpKTsgfVxyXG5mdW5jdGlvbiBhbnlfc2hhMShzLCBlKSB7IHJldHVybiByc3RyMmFueShyc3RyX3NoYTEoc3RyMnJzdHJfdXRmOChzKSksIGUpOyB9XHJcbmZ1bmN0aW9uIGhleF9obWFjX3NoYTEoaywgZClcclxuICB7IHJldHVybiByc3RyMmhleChyc3RyX2htYWNfc2hhMShzdHIycnN0cl91dGY4KGspLCBzdHIycnN0cl91dGY4KGQpKSk7IH1cclxuZnVuY3Rpb24gYjY0X2htYWNfc2hhMShrLCBkKVxyXG4gIHsgcmV0dXJuIHJzdHIyYjY0KHJzdHJfaG1hY19zaGExKHN0cjJyc3RyX3V0ZjgoayksIHN0cjJyc3RyX3V0ZjgoZCkpKTsgfVxyXG5mdW5jdGlvbiBhbnlfaG1hY19zaGExKGssIGQsIGUpXHJcbiAgeyByZXR1cm4gcnN0cjJhbnkocnN0cl9obWFjX3NoYTEoc3RyMnJzdHJfdXRmOChrKSwgc3RyMnJzdHJfdXRmOChkKSksIGUpOyB9XHJcblxyXG4vKlxyXG4gKiBQZXJmb3JtIGEgc2ltcGxlIHNlbGYtdGVzdCB0byBzZWUgaWYgdGhlIFZNIGlzIHdvcmtpbmdcclxuICovXHJcbmZ1bmN0aW9uIHNoYTFfdm1fdGVzdCgpXHJcbntcclxuICByZXR1cm4gaGV4X3NoYTEoXCJhYmNcIikudG9Mb3dlckNhc2UoKSA9PSBcImE5OTkzZTM2NDcwNjgxNmFiYTNlMjU3MTc4NTBjMjZjOWNkMGQ4OWRcIjtcclxufVxyXG5cclxuLypcclxuICogQ2FsY3VsYXRlIHRoZSBTSEExIG9mIGEgcmF3IHN0cmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gcnN0cl9zaGExKHMpXHJcbntcclxuICByZXR1cm4gYmluYjJyc3RyKGJpbmJfc2hhMShyc3RyMmJpbmIocyksIHMubGVuZ3RoICogOCkpO1xyXG59XHJcblxyXG4vKlxyXG4gKiBDYWxjdWxhdGUgdGhlIEhNQUMtU0hBMSBvZiBhIGtleSBhbmQgc29tZSBkYXRhIChyYXcgc3RyaW5ncylcclxuICovXHJcbmZ1bmN0aW9uIHJzdHJfaG1hY19zaGExKGtleSwgZGF0YSlcclxue1xyXG4gIHZhciBia2V5ID0gcnN0cjJiaW5iKGtleSk7XHJcbiAgaWYoYmtleS5sZW5ndGggPiAxNikgYmtleSA9IGJpbmJfc2hhMShia2V5LCBrZXkubGVuZ3RoICogOCk7XHJcblxyXG4gIHZhciBpcGFkID0gQXJyYXkoMTYpLCBvcGFkID0gQXJyYXkoMTYpO1xyXG4gIGZvcih2YXIgaSA9IDA7IGkgPCAxNjsgaSsrKVxyXG4gIHtcclxuICAgIGlwYWRbaV0gPSBia2V5W2ldIF4gMHgzNjM2MzYzNjtcclxuICAgIG9wYWRbaV0gPSBia2V5W2ldIF4gMHg1QzVDNUM1QztcclxuICB9XHJcblxyXG4gIHZhciBoYXNoID0gYmluYl9zaGExKGlwYWQuY29uY2F0KHJzdHIyYmluYihkYXRhKSksIDUxMiArIGRhdGEubGVuZ3RoICogOCk7XHJcbiAgcmV0dXJuIGJpbmIycnN0cihiaW5iX3NoYTEob3BhZC5jb25jYXQoaGFzaCksIDUxMiArIDE2MCkpO1xyXG59XHJcblxyXG4vKlxyXG4gKiBDb252ZXJ0IGEgcmF3IHN0cmluZyB0byBhIGhleCBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIHJzdHIyaGV4KGlucHV0KVxyXG57XHJcbiAgLy8gdHJ5IHsgaGV4Y2FzZSB9IGNhdGNoKGUpIHsgaGV4Y2FzZT0wOyB9XHJcbiAgdmFyIGhleF90YWIgPSBoZXhjYXNlID8gXCIwMTIzNDU2Nzg5QUJDREVGXCIgOiBcIjAxMjM0NTY3ODlhYmNkZWZcIjtcclxuICB2YXIgb3V0cHV0ID0gXCJcIjtcclxuICB2YXIgeDtcclxuICBmb3IodmFyIGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspXHJcbiAge1xyXG4gICAgeCA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XHJcbiAgICBvdXRwdXQgKz0gaGV4X3RhYi5jaGFyQXQoKHggPj4+IDQpICYgMHgwRilcclxuICAgICAgICAgICArICBoZXhfdGFiLmNoYXJBdCggeCAgICAgICAgJiAweDBGKTtcclxuICB9XHJcbiAgcmV0dXJuIG91dHB1dDtcclxufVxyXG5cclxuLypcclxuICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYSBiYXNlLTY0IHN0cmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gcnN0cjJiNjQoaW5wdXQpXHJcbntcclxuICAvLyB0cnkgeyBiNjRwYWQgfSBjYXRjaChlKSB7IGI2NHBhZD0nJzsgfVxyXG4gIHZhciB0YWIgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky9cIjtcclxuICB2YXIgb3V0cHV0ID0gXCJcIjtcclxuICB2YXIgbGVuID0gaW5wdXQubGVuZ3RoO1xyXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMylcclxuICB7XHJcbiAgICB2YXIgdHJpcGxldCA9IChpbnB1dC5jaGFyQ29kZUF0KGkpIDw8IDE2KVxyXG4gICAgICAgICAgICAgICAgfCAoaSArIDEgPCBsZW4gPyBpbnB1dC5jaGFyQ29kZUF0KGkrMSkgPDwgOCA6IDApXHJcbiAgICAgICAgICAgICAgICB8IChpICsgMiA8IGxlbiA/IGlucHV0LmNoYXJDb2RlQXQoaSsyKSAgICAgIDogMCk7XHJcbiAgICBmb3IodmFyIGogPSAwOyBqIDwgNDsgaisrKVxyXG4gICAge1xyXG4gICAgICBpZihpICogOCArIGogKiA2ID4gaW5wdXQubGVuZ3RoICogOCkgb3V0cHV0ICs9IGI2NHBhZDtcclxuICAgICAgZWxzZSBvdXRwdXQgKz0gdGFiLmNoYXJBdCgodHJpcGxldCA+Pj4gNiooMy1qKSkgJiAweDNGKTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIG91dHB1dDtcclxufVxyXG5cclxuLypcclxuICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYW4gYXJiaXRyYXJ5IHN0cmluZyBlbmNvZGluZ1xyXG4gKi9cclxuZnVuY3Rpb24gcnN0cjJhbnkoaW5wdXQsIGVuY29kaW5nKVxyXG57XHJcbiAgdmFyIGRpdmlzb3IgPSBlbmNvZGluZy5sZW5ndGg7XHJcbiAgdmFyIHJlbWFpbmRlcnMgPSBBcnJheSgpO1xyXG4gIHZhciBpLCBxLCB4LCBxdW90aWVudDtcclxuXHJcbiAgLyogQ29udmVydCB0byBhbiBhcnJheSBvZiAxNi1iaXQgYmlnLWVuZGlhbiB2YWx1ZXMsIGZvcm1pbmcgdGhlIGRpdmlkZW5kICovXHJcbiAgdmFyIGRpdmlkZW5kID0gQXJyYXkoTWF0aC5jZWlsKGlucHV0Lmxlbmd0aCAvIDIpKTtcclxuICBmb3IoaSA9IDA7IGkgPCBkaXZpZGVuZC5sZW5ndGg7IGkrKylcclxuICB7XHJcbiAgICBkaXZpZGVuZFtpXSA9IChpbnB1dC5jaGFyQ29kZUF0KGkgKiAyKSA8PCA4KSB8IGlucHV0LmNoYXJDb2RlQXQoaSAqIDIgKyAxKTtcclxuICB9XHJcblxyXG4gIC8qXHJcbiAgICogUmVwZWF0ZWRseSBwZXJmb3JtIGEgbG9uZyBkaXZpc2lvbi4gVGhlIGJpbmFyeSBhcnJheSBmb3JtcyB0aGUgZGl2aWRlbmQsXHJcbiAgICogdGhlIGxlbmd0aCBvZiB0aGUgZW5jb2RpbmcgaXMgdGhlIGRpdmlzb3IuIE9uY2UgY29tcHV0ZWQsIHRoZSBxdW90aWVudFxyXG4gICAqIGZvcm1zIHRoZSBkaXZpZGVuZCBmb3IgdGhlIG5leHQgc3RlcC4gV2Ugc3RvcCB3aGVuIHRoZSBkaXZpZGVuZCBpcyB6ZXJvLlxyXG4gICAqIEFsbCByZW1haW5kZXJzIGFyZSBzdG9yZWQgZm9yIGxhdGVyIHVzZS5cclxuICAgKi9cclxuICB3aGlsZShkaXZpZGVuZC5sZW5ndGggPiAwKVxyXG4gIHtcclxuICAgIHF1b3RpZW50ID0gQXJyYXkoKTtcclxuICAgIHggPSAwO1xyXG4gICAgZm9yKGkgPSAwOyBpIDwgZGl2aWRlbmQubGVuZ3RoOyBpKyspXHJcbiAgICB7XHJcbiAgICAgIHggPSAoeCA8PCAxNikgKyBkaXZpZGVuZFtpXTtcclxuICAgICAgcSA9IE1hdGguZmxvb3IoeCAvIGRpdmlzb3IpO1xyXG4gICAgICB4IC09IHEgKiBkaXZpc29yO1xyXG4gICAgICBpZihxdW90aWVudC5sZW5ndGggPiAwIHx8IHEgPiAwKVxyXG4gICAgICAgIHF1b3RpZW50W3F1b3RpZW50Lmxlbmd0aF0gPSBxO1xyXG4gICAgfVxyXG4gICAgcmVtYWluZGVyc1tyZW1haW5kZXJzLmxlbmd0aF0gPSB4O1xyXG4gICAgZGl2aWRlbmQgPSBxdW90aWVudDtcclxuICB9XHJcblxyXG4gIC8qIENvbnZlcnQgdGhlIHJlbWFpbmRlcnMgdG8gdGhlIG91dHB1dCBzdHJpbmcgKi9cclxuICB2YXIgb3V0cHV0ID0gXCJcIjtcclxuICBmb3IoaSA9IHJlbWFpbmRlcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pXHJcbiAgICBvdXRwdXQgKz0gZW5jb2RpbmcuY2hhckF0KHJlbWFpbmRlcnNbaV0pO1xyXG5cclxuICAvKiBBcHBlbmQgbGVhZGluZyB6ZXJvIGVxdWl2YWxlbnRzICovXHJcbiAgdmFyIGZ1bGxfbGVuZ3RoID0gTWF0aC5jZWlsKGlucHV0Lmxlbmd0aCAqIDggL1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoTWF0aC5sb2coZW5jb2RpbmcubGVuZ3RoKSAvIE1hdGgubG9nKDIpKSlcclxuICBmb3IoaSA9IG91dHB1dC5sZW5ndGg7IGkgPCBmdWxsX2xlbmd0aDsgaSsrKVxyXG4gICAgb3V0cHV0ID0gZW5jb2RpbmdbMF0gKyBvdXRwdXQ7XHJcblxyXG4gIHJldHVybiBvdXRwdXQ7XHJcbn1cclxuXHJcbi8qXHJcbiAqIEVuY29kZSBhIHN0cmluZyBhcyB1dGYtOC5cclxuICogRm9yIGVmZmljaWVuY3ksIHRoaXMgYXNzdW1lcyB0aGUgaW5wdXQgaXMgdmFsaWQgdXRmLTE2LlxyXG4gKi9cclxuZnVuY3Rpb24gc3RyMnJzdHJfdXRmOChpbnB1dClcclxue1xyXG4gIHZhciBvdXRwdXQgPSBcIlwiO1xyXG4gIHZhciBpID0gLTE7XHJcbiAgdmFyIHgsIHk7XHJcblxyXG4gIHdoaWxlKCsraSA8IGlucHV0Lmxlbmd0aClcclxuICB7XHJcbiAgICAvKiBEZWNvZGUgdXRmLTE2IHN1cnJvZ2F0ZSBwYWlycyAqL1xyXG4gICAgeCA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XHJcbiAgICB5ID0gaSArIDEgPCBpbnB1dC5sZW5ndGggPyBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKSA6IDA7XHJcbiAgICBpZigweEQ4MDAgPD0geCAmJiB4IDw9IDB4REJGRiAmJiAweERDMDAgPD0geSAmJiB5IDw9IDB4REZGRilcclxuICAgIHtcclxuICAgICAgeCA9IDB4MTAwMDAgKyAoKHggJiAweDAzRkYpIDw8IDEwKSArICh5ICYgMHgwM0ZGKTtcclxuICAgICAgaSsrO1xyXG4gICAgfVxyXG5cclxuICAgIC8qIEVuY29kZSBvdXRwdXQgYXMgdXRmLTggKi9cclxuICAgIGlmKHggPD0gMHg3RilcclxuICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoeCk7XHJcbiAgICBlbHNlIGlmKHggPD0gMHg3RkYpXHJcbiAgICAgIG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4QzAgfCAoKHggPj4+IDYgKSAmIDB4MUYpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAweDgwIHwgKCB4ICAgICAgICAgJiAweDNGKSk7XHJcbiAgICBlbHNlIGlmKHggPD0gMHhGRkZGKVxyXG4gICAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgweEUwIHwgKCh4ID4+PiAxMikgJiAweDBGKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMHg4MCB8ICgoeCA+Pj4gNiApICYgMHgzRiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDB4ODAgfCAoIHggICAgICAgICAmIDB4M0YpKTtcclxuICAgIGVsc2UgaWYoeCA8PSAweDFGRkZGRilcclxuICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHhGMCB8ICgoeCA+Pj4gMTgpICYgMHgwNyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDB4ODAgfCAoKHggPj4+IDEyKSAmIDB4M0YpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAweDgwIHwgKCh4ID4+PiA2ICkgJiAweDNGKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMHg4MCB8ICggeCAgICAgICAgICYgMHgzRikpO1xyXG4gIH1cclxuICByZXR1cm4gb3V0cHV0O1xyXG59XHJcblxyXG4vKlxyXG4gKiBFbmNvZGUgYSBzdHJpbmcgYXMgdXRmLTE2XHJcbiAqL1xyXG5mdW5jdGlvbiBzdHIycnN0cl91dGYxNmxlKGlucHV0KVxyXG57XHJcbiAgdmFyIG91dHB1dCA9IFwiXCI7XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKVxyXG4gICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoIGlucHV0LmNoYXJDb2RlQXQoaSkgICAgICAgICYgMHhGRixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChpbnB1dC5jaGFyQ29kZUF0KGkpID4+PiA4KSAmIDB4RkYpO1xyXG4gIHJldHVybiBvdXRwdXQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0cjJyc3RyX3V0ZjE2YmUoaW5wdXQpXHJcbntcclxuICB2YXIgb3V0cHV0ID0gXCJcIjtcclxuICBmb3IodmFyIGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspXHJcbiAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoaW5wdXQuY2hhckNvZGVBdChpKSA+Pj4gOCkgJiAweEZGLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0LmNoYXJDb2RlQXQoaSkgICAgICAgICYgMHhGRik7XHJcbiAgcmV0dXJuIG91dHB1dDtcclxufVxyXG5cclxuLypcclxuICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3Jkc1xyXG4gKiBDaGFyYWN0ZXJzID4yNTUgaGF2ZSB0aGVpciBoaWdoLWJ5dGUgc2lsZW50bHkgaWdub3JlZC5cclxuICovXHJcbmZ1bmN0aW9uIHJzdHIyYmluYihpbnB1dClcclxue1xyXG4gIHZhciBvdXRwdXQgPSBBcnJheShpbnB1dC5sZW5ndGggPj4gMik7XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IG91dHB1dC5sZW5ndGg7IGkrKylcclxuICAgIG91dHB1dFtpXSA9IDA7XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAqIDg7IGkgKz0gOClcclxuICAgIG91dHB1dFtpPj41XSB8PSAoaW5wdXQuY2hhckNvZGVBdChpIC8gOCkgJiAweEZGKSA8PCAoMjQgLSBpICUgMzIpO1xyXG4gIHJldHVybiBvdXRwdXQ7XHJcbn1cclxuXHJcbi8qXHJcbiAqIENvbnZlcnQgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gYmluYjJyc3RyKGlucHV0KVxyXG57XHJcbiAgdmFyIG91dHB1dCA9IFwiXCI7XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAqIDMyOyBpICs9IDgpXHJcbiAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoaW5wdXRbaT4+NV0gPj4+ICgyNCAtIGkgJSAzMikpICYgMHhGRik7XHJcbiAgcmV0dXJuIG91dHB1dDtcclxufVxyXG5cclxuLypcclxuICogQ2FsY3VsYXRlIHRoZSBTSEEtMSBvZiBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoXHJcbiAqL1xyXG5mdW5jdGlvbiBiaW5iX3NoYTEoeCwgbGVuKVxyXG57XHJcbiAgLyogYXBwZW5kIHBhZGRpbmcgKi9cclxuICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIGxlbiAlIDMyKTtcclxuICB4WygobGVuICsgNjQgPj4gOSkgPDwgNCkgKyAxNV0gPSBsZW47XHJcblxyXG4gIHZhciB3ID0gQXJyYXkoODApO1xyXG4gIHZhciBhID0gIDE3MzI1ODQxOTM7XHJcbiAgdmFyIGIgPSAtMjcxNzMzODc5O1xyXG4gIHZhciBjID0gLTE3MzI1ODQxOTQ7XHJcbiAgdmFyIGQgPSAgMjcxNzMzODc4O1xyXG4gIHZhciBlID0gLTEwMDk1ODk3NzY7XHJcblxyXG4gIGZvcih2YXIgaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNilcclxuICB7XHJcbiAgICB2YXIgb2xkYSA9IGE7XHJcbiAgICB2YXIgb2xkYiA9IGI7XHJcbiAgICB2YXIgb2xkYyA9IGM7XHJcbiAgICB2YXIgb2xkZCA9IGQ7XHJcbiAgICB2YXIgb2xkZSA9IGU7XHJcblxyXG4gICAgZm9yKHZhciBqID0gMDsgaiA8IDgwOyBqKyspXHJcbiAgICB7XHJcbiAgICAgIGlmKGogPCAxNikgd1tqXSA9IHhbaSArIGpdO1xyXG4gICAgICBlbHNlIHdbal0gPSBiaXRfcm9sKHdbai0zXSBeIHdbai04XSBeIHdbai0xNF0gXiB3W2otMTZdLCAxKTtcclxuICAgICAgdmFyIHQgPSBzYWZlX2FkZChzYWZlX2FkZChiaXRfcm9sKGEsIDUpLCBzaGExX2Z0KGosIGIsIGMsIGQpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICBzYWZlX2FkZChzYWZlX2FkZChlLCB3W2pdKSwgc2hhMV9rdChqKSkpO1xyXG4gICAgICBlID0gZDtcclxuICAgICAgZCA9IGM7XHJcbiAgICAgIGMgPSBiaXRfcm9sKGIsIDMwKTtcclxuICAgICAgYiA9IGE7XHJcbiAgICAgIGEgPSB0O1xyXG4gICAgfVxyXG5cclxuICAgIGEgPSBzYWZlX2FkZChhLCBvbGRhKTtcclxuICAgIGIgPSBzYWZlX2FkZChiLCBvbGRiKTtcclxuICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcclxuICAgIGQgPSBzYWZlX2FkZChkLCBvbGRkKTtcclxuICAgIGUgPSBzYWZlX2FkZChlLCBvbGRlKTtcclxuICB9XHJcbiAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQsIGUpO1xyXG5cclxufVxyXG5cclxuLypcclxuICogUGVyZm9ybSB0aGUgYXBwcm9wcmlhdGUgdHJpcGxldCBjb21iaW5hdGlvbiBmdW5jdGlvbiBmb3IgdGhlIGN1cnJlbnRcclxuICogaXRlcmF0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiBzaGExX2Z0KHQsIGIsIGMsIGQpXHJcbntcclxuICBpZih0IDwgMjApIHJldHVybiAoYiAmIGMpIHwgKCh+YikgJiBkKTtcclxuICBpZih0IDwgNDApIHJldHVybiBiIF4gYyBeIGQ7XHJcbiAgaWYodCA8IDYwKSByZXR1cm4gKGIgJiBjKSB8IChiICYgZCkgfCAoYyAmIGQpO1xyXG4gIHJldHVybiBiIF4gYyBeIGQ7XHJcbn1cclxuXHJcbi8qXHJcbiAqIERldGVybWluZSB0aGUgYXBwcm9wcmlhdGUgYWRkaXRpdmUgY29uc3RhbnQgZm9yIHRoZSBjdXJyZW50IGl0ZXJhdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gc2hhMV9rdCh0KVxyXG57XHJcbiAgcmV0dXJuICh0IDwgMjApID8gIDE1MTg1MDAyNDkgOiAodCA8IDQwKSA/ICAxODU5Nzc1MzkzIDpcclxuICAgICAgICAgKHQgPCA2MCkgPyAtMTg5NDAwNzU4OCA6IC04OTk0OTc1MTQ7XHJcbn1cclxuXHJcbi8qXHJcbiAqIEFkZCBpbnRlZ2Vycywgd3JhcHBpbmcgYXQgMl4zMi4gVGhpcyB1c2VzIDE2LWJpdCBvcGVyYXRpb25zIGludGVybmFsbHlcclxuICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cclxuICovXHJcbmZ1bmN0aW9uIHNhZmVfYWRkKHgsIHkpXHJcbntcclxuICB2YXIgbHN3ID0gKHggJiAweEZGRkYpICsgKHkgJiAweEZGRkYpO1xyXG4gIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcclxuICByZXR1cm4gKG1zdyA8PCAxNikgfCAobHN3ICYgMHhGRkZGKTtcclxufVxyXG5cclxuLypcclxuICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxyXG4gKi9cclxuZnVuY3Rpb24gYml0X3JvbChudW0sIGNudClcclxue1xyXG4gIHJldHVybiAobnVtIDw8IGNudCkgfCAobnVtID4+PiAoMzIgLSBjbnQpKTtcclxufVxyXG5cclxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xyXG4gIG1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYjY0X3NoYTE6IGI2NF9zaGExLFxyXG4gICAgaGV4X3NoYTE6IGhleF9zaGExXHJcbiAgfVxyXG59XHJcbiIsIi8qIC0qLSBtb2RlOiBqYXZhc2NyaXB0OyBjLWJhc2ljLW9mZnNldDogNDsgaW5kZW50LXRhYnMtbW9kZTogbmlsIC0qLSAqL1xuXG4vLyBcbi8vIERhbGxpYW5jZSBHZW5vbWUgRXhwbG9yZXJcbi8vIChjKSBUaG9tYXMgRG93biAyMDA2LTIwMTBcbi8vXG4vLyBzcGFucy5qczogSmF2YVNjcmlwdCBJbnRzZXQvTG9jYXRpb24gcG9ydC5cbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5cbmZ1bmN0aW9uIFJhbmdlKG1pbiwgbWF4KVxue1xuICAgIGlmICh0eXBlb2YobWluKSAhPSAnbnVtYmVyJyB8fCB0eXBlb2YobWF4KSAhPSAnbnVtYmVyJylcbiAgICAgICAgdGhyb3cgJ0JhZCByYW5nZSAnICsgbWluICsgJywnICsgbWF4O1xuICAgIHRoaXMuX21pbiA9IG1pbjtcbiAgICB0aGlzLl9tYXggPSBtYXg7XG59XG5cblJhbmdlLnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWluO1xufVxuXG5SYW5nZS5wcm90b3R5cGUubWF4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX21heDtcbn1cblxuUmFuZ2UucHJvdG90eXBlLmNvbnRhaW5zID0gZnVuY3Rpb24ocG9zKSB7XG4gICAgcmV0dXJuIHBvcyA+PSB0aGlzLl9taW4gJiYgcG9zIDw9IHRoaXMuX21heDtcbn1cblxuUmFuZ2UucHJvdG90eXBlLmlzQ29udGlndW91cyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5SYW5nZS5wcm90b3R5cGUucmFuZ2VzID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFt0aGlzXTtcbn1cblxuUmFuZ2UucHJvdG90eXBlLl9wdXNoUmFuZ2VzID0gZnVuY3Rpb24ocmFuZ2VzKSB7XG4gICAgcmFuZ2VzLnB1c2godGhpcyk7XG59XG5cblJhbmdlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAnWycgKyB0aGlzLl9taW4gKyAnLScgKyB0aGlzLl9tYXggKyAnXSc7XG59XG5cbmZ1bmN0aW9uIF9Db21wb3VuZChyYW5nZXMpIHtcbiAgICAvLyBnaXZlbjogYSBzZXQgb2YgdW5zb3J0ZWQgcG9zc2libHkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgLy8gc29ydCB0aGUgaW5wdXQgcmFuZ2VzXG4gICAgdmFyIHNvcnRlZCA9IHJhbmdlcy5zb3J0KF9yYW5nZU9yZGVyKTtcbiAgICAvLyBtZXJnZSBvdmVybGFwcyBiZXR3ZWVuIGFkamFjZW50IHJhbmdlc1xuICAgIHZhciBtZXJnZWQgPSBbXTtcbiAgICB2YXIgY3VycmVudCA9IHNvcnRlZC5zaGlmdCgpO1xuICAgIHNvcnRlZC5mb3JFYWNoKGZ1bmN0aW9uKHJhbmdlKSB7XG4gICAgICAgIGlmIChyYW5nZS5fbWluIDw9IGN1cnJlbnQuX21heCkge1xuICAgICAgICAgICAgaWYgKHJhbmdlLl9tYXggPiBjdXJyZW50Ll9tYXgpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50Ll9tYXggPSByYW5nZS5fbWF4O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbWVyZ2VkLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICBjdXJyZW50ID0gcmFuZ2U7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBtZXJnZWQucHVzaChjdXJyZW50KTtcbiAgICB0aGlzLl9yYW5nZXMgPSBtZXJnZWQ7XG59XG5cbl9Db21wb3VuZC5wcm90b3R5cGUubWluID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jhbmdlc1swXS5taW4oKTtcbn1cblxuX0NvbXBvdW5kLnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZ2VzW3RoaXMuX3Jhbmdlcy5sZW5ndGggLSAxXS5tYXgoKTtcbn1cblxuLy8gcmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGZpcnN0IHJhbmdlIHRoYXQgaXMgbm90IGxlc3MgdGhhbiBwb3Ncbl9Db21wb3VuZC5wcm90b3R5cGUubG93ZXJfYm91bmQgPSBmdW5jdGlvbihwb3MpIHtcbiAgICAvLyBmaXJzdCBjaGVjayBpZiBwb3MgaXMgb3V0IG9mIHJhbmdlXG4gICAgdmFyIHIgPSB0aGlzLnJhbmdlcygpO1xuICAgIGlmIChwb3MgPiB0aGlzLm1heCgpKSByZXR1cm4gci5sZW5ndGg7XG4gICAgaWYgKHBvcyA8IHRoaXMubWluKCkpIHJldHVybiAwO1xuICAgIC8vIGRvIGEgYmluYXJ5IHNlYXJjaFxuICAgIHZhciBhPTAsIGI9ci5sZW5ndGggLSAxO1xuICAgIHdoaWxlIChhIDw9IGIpIHtcbiAgICAgICAgdmFyIG0gPSBNYXRoLmZsb29yKChhK2IpLzIpO1xuICAgICAgICBpZiAocG9zID4gclttXS5fbWF4KSB7XG4gICAgICAgICAgICBhID0gbSsxO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHBvcyA8IHJbbV0uX21pbikge1xuICAgICAgICAgICAgYiA9IG0tMTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhO1xufVxuXG5fQ29tcG91bmQucHJvdG90eXBlLmNvbnRhaW5zID0gZnVuY3Rpb24ocG9zKSB7XG4gICAgdmFyIGxiID0gdGhpcy5sb3dlcl9ib3VuZChwb3MpO1xuICAgIGlmIChsYiA8IHRoaXMuX3Jhbmdlcy5sZW5ndGggJiYgdGhpcy5fcmFuZ2VzW2xiXS5jb250YWlucyhwb3MpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbl9Db21wb3VuZC5wcm90b3R5cGUuaW5zZXJ0UmFuZ2UgPSBmdW5jdGlvbihyYW5nZSkge1xuICAgIHZhciBsYiA9IHRoaXMubG93ZXJfYm91bmQocmFuZ2UuX21pbik7XG4gICAgaWYgKGxiID09PSB0aGlzLl9yYW5nZXMubGVuZ3RoKSB7IC8vIHJhbmdlIGZvbGxvd3MgdGhpc1xuICAgICAgICB0aGlzLl9yYW5nZXMucHVzaChyYW5nZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgdmFyIHIgPSB0aGlzLnJhbmdlcygpO1xuICAgIGlmIChyYW5nZS5fbWF4IDwgcltsYl0uX21pbikgeyAvLyByYW5nZSBwcmVjZWVkcyBsYlxuICAgICAgICB0aGlzLl9yYW5nZXMuc3BsaWNlKGxiLDAscmFuZ2UpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmFuZ2Ugb3ZlcmxhcHMgbGIgKGF0IGxlYXN0KVxuICAgIGlmIChyW2xiXS5fbWluIDwgcmFuZ2UuX21pbikgcmFuZ2UuX21pbiA9IHJbbGJdLl9taW47XG4gICAgdmFyIHViID0gbGIrMTtcbiAgICB3aGlsZSAodWIgPCByLmxlbmd0aCAmJiByW3ViXS5fbWluIDw9IHJhbmdlLl9tYXgpIHtcbiAgICAgICAgdWIrKztcbiAgICB9XG4gICAgdWItLTtcbiAgICAvLyB1YiBpcyB0aGUgdXBwZXIgYm91bmQgb2YgdGhlIG5ldyByYW5nZVxuICAgIGlmIChyW3ViXS5fbWF4ID4gcmFuZ2UuX21heCkgcmFuZ2UuX21heCA9IHJbdWJdLl9tYXg7XG4gICAgXG4gICAgLy8gc3BsaWNlIHJhbmdlIGludG8gdGhpcy5fcmFuZ2VzXG4gICAgdGhpcy5fcmFuZ2VzLnNwbGljZShsYix1Yi1sYisxLHJhbmdlKTtcbiAgICByZXR1cm47XG59XG5cbl9Db21wb3VuZC5wcm90b3R5cGUuaXNDb250aWd1b3VzID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jhbmdlcy5sZW5ndGggPiAxO1xufVxuXG5fQ29tcG91bmQucHJvdG90eXBlLnJhbmdlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9yYW5nZXM7XG59XG5cbl9Db21wb3VuZC5wcm90b3R5cGUuX3B1c2hSYW5nZXMgPSBmdW5jdGlvbihyYW5nZXMpIHtcbiAgICBmb3IgKHZhciByaSA9IDA7IHJpIDwgdGhpcy5fcmFuZ2VzLmxlbmd0aDsgKytyaSlcbiAgICAgICAgcmFuZ2VzLnB1c2godGhpcy5fcmFuZ2VzW3JpXSk7XG59XG5cbl9Db21wb3VuZC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcyA9ICcnO1xuICAgIGZvciAodmFyIHIgPSAwOyByIDwgdGhpcy5fcmFuZ2VzLmxlbmd0aDsgKytyKSB7XG4gICAgICAgIGlmIChyPjApIHtcbiAgICAgICAgICAgIHMgPSBzICsgJywnO1xuICAgICAgICB9XG4gICAgICAgIHMgPSBzICsgdGhpcy5fcmFuZ2VzW3JdLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIHJldHVybiBzO1xufVxuXG5mdW5jdGlvbiB1bmlvbihzMCwgczEpIHtcbiAgICBpZiAoISAoczAgaW5zdGFuY2VvZiBfQ29tcG91bmQpKSB7XG4gICAgICAgIGlmICghIChzMCBpbnN0YW5jZW9mIEFycmF5KSlcbiAgICAgICAgICAgIHMwID0gW3MwXTtcbiAgICAgICAgczAgPSBuZXcgX0NvbXBvdW5kKHMwKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHMxKVxuICAgICAgICBzMC5pbnNlcnRSYW5nZShzMSk7XG5cbiAgICByZXR1cm4gczA7XG59XG5cbmZ1bmN0aW9uIGludGVyc2VjdGlvbihzMCwgczEpIHtcbiAgICB2YXIgcjAgPSBzMC5yYW5nZXMoKTtcbiAgICB2YXIgcjEgPSBzMS5yYW5nZXMoKTtcbiAgICB2YXIgbDAgPSByMC5sZW5ndGgsIGwxID0gcjEubGVuZ3RoO1xuICAgIHZhciBpMCA9IDAsIGkxID0gMDtcbiAgICB2YXIgb3IgPSBbXTtcblxuICAgIHdoaWxlIChpMCA8IGwwICYmIGkxIDwgbDEpIHtcbiAgICAgICAgdmFyIHMwID0gcjBbaTBdLCBzMSA9IHIxW2kxXTtcbiAgICAgICAgdmFyIGxhcE1pbiA9IE1hdGgubWF4KHMwLm1pbigpLCBzMS5taW4oKSk7XG4gICAgICAgIHZhciBsYXBNYXggPSBNYXRoLm1pbihzMC5tYXgoKSwgczEubWF4KCkpO1xuICAgICAgICBpZiAobGFwTWF4ID49IGxhcE1pbikge1xuICAgICAgICAgICAgb3IucHVzaChuZXcgUmFuZ2UobGFwTWluLCBsYXBNYXgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczAubWF4KCkgPiBzMS5tYXgoKSkge1xuICAgICAgICAgICAgKytpMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsraTA7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKG9yLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBGSVhNRVxuICAgIH0gZWxzZSBpZiAob3IubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIG9yWzBdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgX0NvbXBvdW5kKG9yKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNvdmVyYWdlKHMpIHtcbiAgICB2YXIgdG90ID0gMDtcbiAgICB2YXIgcmwgPSBzLnJhbmdlcygpO1xuICAgIGZvciAodmFyIHJpID0gMDsgcmkgPCBybC5sZW5ndGg7ICsrcmkpIHtcbiAgICAgICAgdmFyIHIgPSBybFtyaV07XG4gICAgICAgIHRvdCArPSAoci5tYXgoKSAtIHIubWluKCkgKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRvdDtcbn1cblxuXG5cbmZ1bmN0aW9uIHJhbmdlT3JkZXIoYSwgYilcbntcbiAgICBpZiAoYS5taW4oKSA8IGIubWluKCkpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSBpZiAoYS5taW4oKSA+IGIubWluKCkpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfSBlbHNlIGlmIChhLm1heCgpIDwgYi5tYXgoKSkge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSBlbHNlIGlmIChiLm1heCgpID4gYS5tYXgoKSkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIF9yYW5nZU9yZGVyKGEsIGIpXG57XG4gICAgaWYgKGEuX21pbiA8IGIuX21pbikge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSBlbHNlIGlmIChhLl9taW4gPiBiLl9taW4pIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfSBlbHNlIGlmIChhLl9tYXggPCBiLl9tYXgpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSBpZiAoYi5fbWF4ID4gYS5fbWF4KSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbn1cblxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBSYW5nZTogUmFuZ2UsXG4gICAgICAgIHVuaW9uOiB1bmlvbixcbiAgICAgICAgaW50ZXJzZWN0aW9uOiBpbnRlcnNlY3Rpb24sXG4gICAgICAgIGNvdmVyYWdlOiBjb3ZlcmFnZSxcbiAgICAgICAgcmFuZ2VPdmVyOiByYW5nZU9yZGVyLFxuICAgICAgICBfcmFuZ2VPcmRlcjogX3JhbmdlT3JkZXJcbiAgICB9XG59IiwiLyogLSotIG1vZGU6IGphdmFzY3JpcHQ7IGMtYmFzaWMtb2Zmc2V0OiA0OyBpbmRlbnQtdGFicy1tb2RlOiBuaWwgLSotICovXG5cbi8vIFxuLy8gRGFsbGlhbmNlIEdlbm9tZSBFeHBsb3JlclxuLy8gKGMpIFRob21hcyBEb3duIDIwMDYtMjAxMFxuLy9cbi8vIHV0aWxzLmpzOiBvZGRzLCBzb2RzLCBhbmQgZW5kcy5cbi8vXG5cblwidXNlIHN0cmljdFwiO1xuXG5pZiAodHlwZW9mKHJlcXVpcmUpICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBzaGExID0gcmVxdWlyZSgnLi9zaGExJyk7XG4gICAgdmFyIGI2NF9zaGExID0gc2hhMS5iNjRfc2hhMTtcbn1cblxudmFyIE5VTV9SRUdFWFAgPSBuZXcgUmVnRXhwKCdbMC05XSsnKTtcblxuZnVuY3Rpb24gc3RyaW5nVG9OdW1iZXJzQXJyYXkoc3RyKSB7XG4gICAgdmFyIG51bXMgPSBuZXcgQXJyYXkoKTtcbiAgICB2YXIgbTtcbiAgICB3aGlsZSAobSA9IE5VTV9SRUdFWFAuZXhlYyhzdHIpKSB7XG4gICAgICAgIG51bXMucHVzaChtWzBdKTtcbiAgICAgICAgc3RyPXN0ci5zdWJzdHJpbmcobS5pbmRleCArIChtWzBdLmxlbmd0aCkpO1xuICAgIH1cbiAgICByZXR1cm4gbnVtcztcbn1cblxudmFyIFNUUklDVF9OVU1fUkVHRVhQID0gbmV3IFJlZ0V4cCgnXlswLTldKyQnKTtcblxuZnVuY3Rpb24gc3RyaW5nVG9JbnQoc3RyKSB7XG4gICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cCgnLCcsICdnJyksICcnKTtcbiAgICBpZiAoIVNUUklDVF9OVU1fUkVHRVhQLnRlc3Qoc3RyKSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIHN0cnwwO1xufVxuXG5mdW5jdGlvbiBwdXNobmV3KGEsIHYpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgaWYgKGFbaV0gPT0gdikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIGEucHVzaCh2KTtcbn1cblxuZnVuY3Rpb24gcHVzaG8ob2JqLCBrLCB2KSB7XG4gICAgaWYgKG9ialtrXSkge1xuICAgICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmpba10gPSBbdl07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwdXNobmV3byhvYmosIGssIHYpIHtcbiAgICB2YXIgYSA9IG9ialtrXTtcbiAgICBpZiAoYSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyArK2kpIHsgICAgLy8gaW5kZXhPZiByZXF1aXJlcyBKUzE2IDotKC5cbiAgICAgICAgICAgIGlmIChhW2ldID09IHYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYS5wdXNoKHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9ialtrXSA9IFt2XTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gcGljayhhLCBiLCBjLCBkKVxue1xuICAgIGlmIChhKSB7XG4gICAgICAgIHJldHVybiBhO1xuICAgIH0gZWxzZSBpZiAoYikge1xuICAgICAgICByZXR1cm4gYjtcbiAgICB9IGVsc2UgaWYgKGMpIHtcbiAgICAgICAgcmV0dXJuIGM7XG4gICAgfSBlbHNlIGlmIChkKSB7XG4gICAgICAgIHJldHVybiBkO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHVzaG5ldyhsLCBvKVxue1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbC5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAobFtpXSA9PSBvKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgbC5wdXNoKG8pO1xufVxuXG5cblxuZnVuY3Rpb24gYXJyYXlJbmRleE9mKGEsIHgpIHtcbiAgICBpZiAoIWEpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAoYVtpXSA9PT0geCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xufVxuXG5mdW5jdGlvbiBhcnJheVJlbW92ZShhLCB4KSB7XG4gICAgdmFyIGkgPSBhcnJheUluZGV4T2YoYSwgeCk7XG4gICAgaWYgKGkgPj0gMCkge1xuICAgICAgICBhLnNwbGljZShpLCAxKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLy9cbi8vIERPTSB1dGlsaXRpZXNcbi8vXG5cblxuZnVuY3Rpb24gbWFrZUVsZW1lbnQodGFnLCBjaGlsZHJlbiwgYXR0cmlicywgc3R5bGVzKVxue1xuICAgIHZhciBlbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgaWYgKGNoaWxkcmVuKSB7XG4gICAgICAgIGlmICghIChjaGlsZHJlbiBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgY2hpbGRyZW4gPSBbY2hpbGRyZW5dO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBjID0gY2hpbGRyZW5baV07XG4gICAgICAgICAgICBpZiAoYykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYyA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoYyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYyA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICBjID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycgKyBjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxlLmFwcGVuZENoaWxkKGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmIChhdHRyaWJzKSB7XG4gICAgICAgIGZvciAodmFyIGwgaW4gYXR0cmlicykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBlbGVbbF0gPSBhdHRyaWJzW2xdO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdlcnJvciBzZXR0aW5nICcgKyBsKTtcbiAgICAgICAgICAgICAgICB0aHJvdyhlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICAgIGZvciAodmFyIGwgaW4gc3R5bGVzKSB7XG4gICAgICAgICAgICBlbGUuc3R5bGVbbF0gPSBzdHlsZXNbbF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGVsZTtcbn1cblxuZnVuY3Rpb24gbWFrZUVsZW1lbnROUyhuYW1lc3BhY2UsIHRhZywgY2hpbGRyZW4sIGF0dHJpYnMpXG57XG4gICAgdmFyIGVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2UsIHRhZyk7XG4gICAgaWYgKGNoaWxkcmVuKSB7XG4gICAgICAgIGlmICghIChjaGlsZHJlbiBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgY2hpbGRyZW4gPSBbY2hpbGRyZW5dO1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBjID0gY2hpbGRyZW5baV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIGMgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBjID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbGUuYXBwZW5kQ2hpbGQoYyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgc2V0QXR0cnMoZWxlLCBhdHRyaWJzKTtcbiAgICByZXR1cm4gZWxlO1xufVxuXG52YXIgYXR0cl9uYW1lX2NhY2hlID0ge307XG5cbmZ1bmN0aW9uIHNldEF0dHIobm9kZSwga2V5LCB2YWx1ZSlcbntcbiAgICB2YXIgYXR0ciA9IGF0dHJfbmFtZV9jYWNoZVtrZXldO1xuICAgIGlmICghYXR0cikge1xuICAgICAgICB2YXIgX2F0dHIgPSAnJztcbiAgICAgICAgZm9yICh2YXIgYyA9IDA7IGMgPCBrZXkubGVuZ3RoOyArK2MpIHtcbiAgICAgICAgICAgIHZhciBjYyA9IGtleS5zdWJzdHJpbmcoYywgYysxKTtcbiAgICAgICAgICAgIHZhciBsY2MgPSBjYy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGxjYyAhPSBjYykge1xuICAgICAgICAgICAgICAgIF9hdHRyID0gX2F0dHIgKyAnLScgKyBsY2M7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF9hdHRyID0gX2F0dHIgKyBjYztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhdHRyX25hbWVfY2FjaGVba2V5XSA9IF9hdHRyO1xuICAgICAgICBhdHRyID0gX2F0dHI7XG4gICAgfVxuICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHIsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gc2V0QXR0cnMobm9kZSwgYXR0cmlicylcbntcbiAgICBpZiAoYXR0cmlicykge1xuICAgICAgICBmb3IgKHZhciBsIGluIGF0dHJpYnMpIHtcbiAgICAgICAgICAgIHNldEF0dHIobm9kZSwgbCwgYXR0cmlic1tsXSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZHJlbihub2RlKVxue1xuICAgIGlmICghbm9kZSB8fCAhbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB3aGlsZSAobm9kZS5jaGlsZE5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbm9kZS5yZW1vdmVDaGlsZChub2RlLmZpcnN0Q2hpbGQpO1xuICAgIH1cbn1cblxuXG5cbi8vXG4vLyBXQVJOSU5HOiBub3QgZm9yIGdlbmVyYWwgdXNlIVxuLy9cblxuZnVuY3Rpb24gbWluaUpTT05pZnkobywgZXhjKSB7XG4gICAgaWYgKHR5cGVvZiBvID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gICAgfSBlbHNlIGlmIChvID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICdudWxsJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBcIidcIiArIG8gKyBcIidcIjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvID09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiBcIlwiICsgbztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvID09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gXCJcIiArIG87XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbyA9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAobyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgICB2YXIgcyA9IG51bGw7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG8ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBzID0gKHMgPT0gbnVsbCA/ICcnIDogKHMgKyAnLCAnKSkgKyBtaW5pSlNPTmlmeShvW2ldLCBleGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICdbJyArIChzP3M6JycpICsgJ10nO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhjID0gZXhjIHx8IHt9O1xuICAgICAgICAgICAgdmFyIHMgPSBudWxsO1xuICAgICAgICAgICAgZm9yICh2YXIgayBpbiBvKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV4Y1trXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgaWYgKGsgIT0gdW5kZWZpbmVkICYmIHR5cGVvZihvW2tdKSAhPSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHMgPSAocyA9PSBudWxsID8gJycgOiAocyArICcsICcpKSArIGsgKyAnOiAnICsgbWluaUpTT05pZnkob1trXSwgZXhjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gJ3snICsgKHM/czonJykgKyAnfSc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBvKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNoYWxsb3dDb3B5KG8pIHtcbiAgICB2YXIgbiA9IHt9O1xuICAgIGZvciAodmFyIGsgaW4gbykge1xuICAgICAgICBuW2tdID0gb1trXTtcbiAgICB9XG4gICAgcmV0dXJuIG47XG59XG5cbmZ1bmN0aW9uIE9ic2VydmVkKHgpIHtcbiAgICB0aGlzLnZhbHVlID0geDtcbiAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xufVxuXG5PYnNlcnZlZC5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbihmKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMucHVzaChmKTtcbn1cblxuT2JzZXJ2ZWQucHJvdG90eXBlLmFkZExpc3RlbmVyQW5kRmlyZSA9IGZ1bmN0aW9uKGYpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGYpO1xuICAgIGYodGhpcy52YWx1ZSk7XG59XG5cbk9ic2VydmVkLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKGYpIHtcbiAgICBhcnJheVJlbW92ZSh0aGlzLmxpc3RlbmVycywgZik7XG59XG5cbk9ic2VydmVkLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZTtcbn1cblxuT2JzZXJ2ZWQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHgpIHtcbiAgICB0aGlzLnZhbHVlID0geDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGlzdGVuZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzW2ldKHgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gQXdhaXRlZCgpIHtcbiAgICB0aGlzLnF1ZXVlID0gW107XG59XG5cbkF3YWl0ZWQucHJvdG90eXBlLnByb3ZpZGUgPSBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHRoaXMucmVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgXCJSZXNvdXJjZSBoYXMgYWxyZWFkeSBiZWVuIHByb3ZpZGVkLlwiO1xuICAgIH1cblxuICAgIHRoaXMucmVzID0geDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVldWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdGhpcy5xdWV1ZVtpXSh4KTtcbiAgICB9XG4gICAgdGhpcy5xdWV1ZSA9IG51bGw7ICAgLy8gYXZvaWQgbGVha2luZyBjbG9zdXJlcy5cbn1cblxuQXdhaXRlZC5wcm90b3R5cGUuYXdhaXQgPSBmdW5jdGlvbihmKSB7XG4gICAgaWYgKHRoaXMucmVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZih0aGlzLnJlcyk7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcztcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnF1ZXVlLnB1c2goZik7XG4gICAgfVxufVxuXG52YXIgX19kYWxsaWFuY2Vfc2FsdFNlZWQgPSAwO1xuXG5mdW5jdGlvbiBzYWx0VVJMKHVybCkge1xuICAgIHJldHVybiB1cmwgKyAnP3NhbHQ9JyArIGI2NF9zaGExKCcnICsgRGF0ZS5ub3coKSArICcsJyArICgrK19fZGFsbGlhbmNlX3NhbHRTZWVkKSk7XG59XG5cbmZ1bmN0aW9uIHRleHRYSFIodXJsLCBjYWxsYmFjaywgb3B0cykge1xuICAgIGlmIChvcHRzICYmIG9wdHMuc2FsdCkgXG4gICAgICAgIHVybCA9IHNhbHRVUkwodXJsKTtcblxuICAgIHRyeSB7XG4gICAgICAgIHZhciB0aW1lb3V0O1xuICAgICAgICBpZiAob3B0cy50aW1lb3V0KSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChcbiAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RpbWluZyBvdXQgJyArIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcS5hYm9ydCgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgJ1RpbWVvdXQnKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG9wdHMudGltZW91dFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIFx0ICAgIGlmIChyZXEucmVhZHlTdGF0ZSA9PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICBcdCAgICAgICAgaWYgKHJlcS5zdGF0dXMgPCAyMDAgfHwgcmVxLnN0YXR1cyA+PSAzMDApIHtcbiAgICBcdFx0ICAgIGNhbGxiYWNrKG51bGwsICdFcnJvciBjb2RlICcgKyByZXEuc3RhdHVzKTtcbiAgICBcdCAgICAgICAgfSBlbHNlIHtcbiAgICBcdFx0ICAgIGNhbGxiYWNrKHJlcS5yZXNwb25zZVRleHQpO1xuICAgIFx0ICAgICAgICB9XG4gICAgXHQgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgcmVxLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgICAgIHJlcS5yZXNwb25zZVR5cGUgPSAndGV4dCc7XG5cbiAgICAgICAgaWYgKG9wdHMgJiYgb3B0cy5jcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmVxLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVxLnNlbmQoJycpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgJ0V4Y2VwdGlvbiAnICsgZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWxhdGl2ZVVSTChiYXNlLCByZWwpIHtcbiAgICAvLyBGSVhNRSBxdWl0ZSBuYWl2ZSAtLSBnb29kIGVub3VnaCBmb3IgdHJhY2todWJzP1xuXG4gICAgaWYgKHJlbC5pbmRleE9mKCdodHRwOicpID09IDAgfHwgcmVsLmluZGV4T2YoJ2h0dHBzOicpID09IDApIHtcbiAgICAgICAgcmV0dXJuIHJlbDtcbiAgICB9XG5cbiAgICB2YXIgbGkgPSBiYXNlLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgaWYgKGxpID49IDApIHtcbiAgICAgICAgcmV0dXJuIGJhc2Uuc3Vic3RyKDAsIGxpICsgMSkgKyByZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlbDtcbiAgICB9XG59XG5cbnZhciBBTUlOT19BQ0lEX1RSQU5TTEFUSU9OID0ge1xuICAgICdUVFQnOiAnRicsXG4gICAgJ1RUQyc6ICdGJyxcbiAgICAnVFRBJzogJ0wnLFxuICAgICdUVEcnOiAnTCcsXG4gICAgJ0NUVCc6ICdMJyxcbiAgICAnQ1RDJzogJ0wnLFxuICAgICdDVEEnOiAnTCcsXG4gICAgJ0NURyc6ICdMJyxcbiAgICAnQVRUJzogJ0knLFxuICAgICdBVEMnOiAnSScsXG4gICAgJ0FUQSc6ICdJJyxcbiAgICAnQVRHJzogJ00nLFxuICAgICdHVFQnOiAnVicsXG4gICAgJ0dUQyc6ICdWJyxcbiAgICAnR1RBJzogJ1YnLFxuICAgICdHVEcnOiAnVicsXG4gICAgJ1RDVCc6ICdTJyxcbiAgICAnVENDJzogJ1MnLFxuICAgICdUQ0EnOiAnUycsXG4gICAgJ1RDRyc6ICdTJyxcbiAgICAnQ0NUJzogJ1AnLFxuICAgICdDQ0MnOiAnUCcsXG4gICAgJ0NDQSc6ICdQJyxcbiAgICAnQ0NHJzogJ1AnLFxuICAgICdBQ1QnOiAnVCcsXG4gICAgJ0FDQyc6ICdUJyxcbiAgICAnQUNBJzogJ1QnLFxuICAgICdBQ0cnOiAnVCcsXG4gICAgJ0dDVCc6ICdBJyxcbiAgICAnR0NDJzogJ0EnLFxuICAgICdHQ0EnOiAnQScsXG4gICAgJ0dDRyc6ICdBJyxcbiAgICAnVEFUJzogJ1knLFxuICAgICdUQUMnOiAnWScsXG4gICAgJ1RBQSc6ICcqJywgIC8vIHN0b3BcbiAgICAnVEFHJzogJyonLCAgLy8gc3RvcFxuICAgICdDQVQnOiAnSCcsXG4gICAgJ0NBQyc6ICdIJyxcbiAgICAnQ0FBJzogJ1EnLFxuICAgICdDQUcnOiAnUScsXG4gICAgJ0FBVCc6ICdOJyxcbiAgICAnQUFDJzogJ04nLFxuICAgICdBQUEnOiAnSycsXG4gICAgJ0FBRyc6ICdLJyxcbiAgICAnR0FUJzogJ0QnLFxuICAgICdHQUMnOiAnRCcsXG4gICAgJ0dBQSc6ICdFJyxcbiAgICAnR0FHJzogJ0UnLFxuICAgICdUR1QnOiAnQycsXG4gICAgJ1RHQyc6ICdDJyxcbiAgICAnVEdBJzogJyonLCAgLy8gc3RvcFxuICAgICdUR0cnOiAnVycsXG4gICAgJ0NHVCc6ICdSJyxcbiAgICAnQ0dDJzogJ1InLFxuICAgICdDR0EnOiAnUicsXG4gICAgJ0NHRyc6ICdSJyxcbiAgICAnQUdUJzogJ1MnLFxuICAgICdBR0MnOiAnUycsXG4gICAgJ0FHQSc6ICdSJyxcbiAgICAnQUdHJzogJ1InLFxuICAgICdHR1QnOiAnRycsXG4gICAgJ0dHQyc6ICdHJyxcbiAgICAnR0dBJzogJ0cnLFxuICAgICdHR0cnOiAnRydcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZVVybFRvUGFnZShyZWwpIHtcbiAgICByZXR1cm4gbWFrZUVsZW1lbnQoJ2EnLCBudWxsLCB7aHJlZjogcmVsfSkuaHJlZjtcbn1cblxuLy9cbi8vIE1pc3NpbmcgQVBJc1xuLy8gXG5cbmlmICghKCd0cmltJyBpbiBTdHJpbmcucHJvdG90eXBlKSkge1xuICAgIFN0cmluZy5wcm90b3R5cGUudHJpbSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9eXFxzKy8sICcnKS5yZXBsYWNlKC9cXHMrJC8sICcnKTtcbiAgICB9O1xufVxuXG5pZiAodHlwZW9mKG1vZHVsZSkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIHRleHRYSFI6IHRleHRYSFIsXG4gICAgICAgIHJlbGF0aXZlVVJMOiByZWxhdGl2ZVVSTCxcbiAgICAgICAgcmVzb2x2ZVVybFRvUGFnZTogcmVzb2x2ZVVybFRvUGFnZSxcbiAgICAgICAgc2hhbGxvd0NvcHk6IHNoYWxsb3dDb3B5LFxuICAgICAgICBwdXNobzogcHVzaG8sXG4gICAgICAgIHB1c2huZXc6IHB1c2huZXcsXG4gICAgICAgIHB1c2huZXdvOiBwdXNobmV3byxcbiAgICAgICAgYXJyYXlJbmRleE9mOiBhcnJheUluZGV4T2YsXG4gICAgICAgIHBpY2s6IHBpY2ssXG5cbiAgICAgICAgbWFrZUVsZW1lbnQ6IG1ha2VFbGVtZW50LFxuICAgICAgICBtYWtlRWxlbWVudE5TOiBtYWtlRWxlbWVudE5TLFxuICAgICAgICByZW1vdmVDaGlsZHJlbjogcmVtb3ZlQ2hpbGRyZW4sXG5cbiAgICAgICAgbWluaUpTT05pZnk6IG1pbmlKU09OaWZ5LFxuXG4gICAgICAgIE9ic2VydmVkOiBPYnNlcnZlZCxcbiAgICAgICAgQXdhaXRlZDogQXdhaXRlZCxcblxuICAgICAgICBBTUlOT19BQ0lEX1RSQU5TTEFUSU9OOiBBTUlOT19BQ0lEX1RSQU5TTEFUSU9OXG4gICAgfVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoXCIuL3Byb21pc2UvcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIHBvbHlmaWxsID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wb2x5ZmlsbFwiKS5wb2x5ZmlsbDtcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XG5leHBvcnRzLnBvbHlmaWxsID0gcG9seWZpbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cblxudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0FycmF5O1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG4vKipcbiAgUmV0dXJucyBhIHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgdGhlIGdpdmVuIHByb21pc2VzIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC4gVGhlIHJldHVybiBwcm9taXNlXG4gIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IHRoYXQgZ2l2ZXMgYWxsIHRoZSB2YWx1ZXMgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZVxuICBwYXNzZWQgaW4gdGhlIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIHByb21pc2UyID0gUlNWUC5yZXNvbHZlKDIpO1xuICB2YXIgcHJvbWlzZTMgPSBSU1ZQLnJlc29sdmUoMyk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcbiAgfSk7XG4gIGBgYFxuXG4gIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgUlNWUC5hbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2VcbiAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG4gIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgcHJvbWlzZTIgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcbiAgdmFyIHByb21pc2UzID0gUlNWUC5yZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCBhbGxcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbFxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuKi9cbmZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gYWxsLicpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHJlbWFpbmluZyA9IHByb21pc2VzLmxlbmd0aCxcbiAgICBwcm9taXNlO1xuXG4gICAgaWYgKHJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgcmVzb2x2ZShbXSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZXIoaW5kZXgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXNvbHZlQWxsKGluZGV4LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlc29sdmVBbGwoaW5kZXgsIHZhbHVlKSB7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9taXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2VzW2ldO1xuXG4gICAgICBpZiAocHJvbWlzZSAmJiBpc0Z1bmN0aW9uKHByb21pc2UudGhlbikpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZUFsbChpLCBwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnRzLmFsbCA9IGFsbDsiLCIoZnVuY3Rpb24gKHByb2Nlc3MsZ2xvYmFsKXtcblwidXNlIHN0cmljdFwiO1xudmFyIGJyb3dzZXJHbG9iYWwgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpID8gd2luZG93IDoge307XG52YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xudmFyIGxvY2FsID0gKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSA/IGdsb2JhbCA6ICh0aGlzID09PSB1bmRlZmluZWQ/IHdpbmRvdzp0aGlzKTtcblxuLy8gbm9kZVxuZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIG5vZGUuZGF0YSA9IChpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMik7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBsb2NhbC5zZXRUaW1lb3V0KGZsdXNoLCAxKTtcbiAgfTtcbn1cblxudmFyIHF1ZXVlID0gW107XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgIHZhciB0dXBsZSA9IHF1ZXVlW2ldO1xuICAgIHZhciBjYWxsYmFjayA9IHR1cGxlWzBdLCBhcmcgPSB0dXBsZVsxXTtcbiAgICBjYWxsYmFjayhhcmcpO1xuICB9XG4gIHF1ZXVlID0gW107XG59XG5cbnZhciBzY2hlZHVsZUZsdXNoO1xuXG4vLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXScpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG59IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG59IGVsc2Uge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgdmFyIGxlbmd0aCA9IHF1ZXVlLnB1c2goW2NhbGxiYWNrLCBhcmddKTtcbiAgaWYgKGxlbmd0aCA9PT0gMSkge1xuICAgIC8vIElmIGxlbmd0aCBpcyAxLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICBzY2hlZHVsZUZsdXNoKCk7XG4gIH1cbn1cblxuZXhwb3J0cy5hc2FwID0gYXNhcDtcbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiMVlpWjVTXCIpLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJcInVzZSBzdHJpY3RcIjtcbi8qKlxuICBgUlNWUC5Qcm9taXNlLmNhc3RgIHJldHVybnMgdGhlIHNhbWUgcHJvbWlzZSBpZiB0aGF0IHByb21pc2Ugc2hhcmVzIGEgY29uc3RydWN0b3JcbiAgd2l0aCB0aGUgcHJvbWlzZSBiZWluZyBjYXN0ZWQuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgY2FzdGVkID0gUlNWUC5Qcm9taXNlLmNhc3QocHJvbWlzZSk7XG5cbiAgY29uc29sZS5sb2cocHJvbWlzZSA9PT0gY2FzdGVkKTsgLy8gdHJ1ZVxuICBgYGBcblxuICBJbiB0aGUgY2FzZSBvZiBhIHByb21pc2Ugd2hvc2UgY29uc3RydWN0b3IgZG9lcyBub3QgbWF0Y2gsIGl0IGlzIGFzc2ltaWxhdGVkLlxuICBUaGUgcmVzdWx0aW5nIHByb21pc2Ugd2lsbCBmdWxmaWxsIG9yIHJlamVjdCBiYXNlZCBvbiB0aGUgb3V0Y29tZSBvZiB0aGVcbiAgcHJvbWlzZSBiZWluZyBjYXN0ZWQuXG5cbiAgSW4gdGhlIGNhc2Ugb2YgYSBub24tcHJvbWlzZSwgYSBwcm9taXNlIHdoaWNoIHdpbGwgZnVsZmlsbCB3aXRoIHRoYXQgdmFsdWUgaXNcbiAgcmV0dXJuZWQuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciB2YWx1ZSA9IDE7IC8vIGNvdWxkIGJlIGEgbnVtYmVyLCBib29sZWFuLCBzdHJpbmcsIHVuZGVmaW5lZC4uLlxuICB2YXIgY2FzdGVkID0gUlNWUC5Qcm9taXNlLmNhc3QodmFsdWUpO1xuXG4gIGNvbnNvbGUubG9nKHZhbHVlID09PSBjYXN0ZWQpOyAvLyBmYWxzZVxuICBjb25zb2xlLmxvZyhjYXN0ZWQgaW5zdGFuY2VvZiBSU1ZQLlByb21pc2UpIC8vIHRydWVcblxuICBjYXN0ZWQudGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICB2YWwgPT09IHZhbHVlIC8vID0+IHRydWVcbiAgfSk7XG4gIGBgYFxuXG4gIGBSU1ZQLlByb21pc2UuY2FzdGAgaXMgc2ltaWxhciB0byBgUlNWUC5yZXNvbHZlYCwgYnV0IGBSU1ZQLlByb21pc2UuY2FzdGAgZGlmZmVycyBpbiB0aGVcbiAgZm9sbG93aW5nIHdheXM6XG4gICogYFJTVlAuUHJvbWlzZS5jYXN0YCBzZXJ2ZXMgYXMgYSBtZW1vcnktZWZmaWNpZW50IHdheSBvZiBnZXR0aW5nIGEgcHJvbWlzZSwgd2hlbiB5b3VcbiAgaGF2ZSBzb21ldGhpbmcgdGhhdCBjb3VsZCBlaXRoZXIgYmUgYSBwcm9taXNlIG9yIGEgdmFsdWUuIFJTVlAucmVzb2x2ZVxuICB3aWxsIGhhdmUgdGhlIHNhbWUgZWZmZWN0IGJ1dCB3aWxsIGNyZWF0ZSBhIG5ldyBwcm9taXNlIHdyYXBwZXIgaWYgdGhlXG4gIGFyZ3VtZW50IGlzIGEgcHJvbWlzZS5cbiAgKiBgUlNWUC5Qcm9taXNlLmNhc3RgIGlzIGEgd2F5IG9mIGNhc3RpbmcgaW5jb21pbmcgdGhlbmFibGVzIG9yIHByb21pc2Ugc3ViY2xhc3NlcyB0b1xuICBwcm9taXNlcyBvZiB0aGUgZXhhY3QgY2xhc3Mgc3BlY2lmaWVkLCBzbyB0aGF0IHRoZSByZXN1bHRpbmcgb2JqZWN0J3MgYHRoZW5gIGlzXG4gIGVuc3VyZWQgdG8gaGF2ZSB0aGUgYmVoYXZpb3Igb2YgdGhlIGNvbnN0cnVjdG9yIHlvdSBhcmUgY2FsbGluZyBjYXN0IG9uIChpLmUuLCBSU1ZQLlByb21pc2UpLlxuXG4gIEBtZXRob2QgY2FzdFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtPYmplY3R9IG9iamVjdCB0byBiZSBjYXN0ZWRcbiAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBwcm9wZXJ0aWVzIG9mIGBwcm9taXNlc2BcbiAgaGF2ZSBiZWVuIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuKi9cblxuXG5mdW5jdGlvbiBjYXN0KG9iamVjdCkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gdGhpcykge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICByZXNvbHZlKG9iamVjdCk7XG4gIH0pO1xufVxuXG5leHBvcnRzLmNhc3QgPSBjYXN0OyIsIlwidXNlIHN0cmljdFwiO1xudmFyIGNvbmZpZyA9IHtcbiAgaW5zdHJ1bWVudDogZmFsc2Vcbn07XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZShuYW1lLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGNvbmZpZ1tuYW1lXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBjb25maWdbbmFtZV07XG4gIH1cbn1cblxuZXhwb3J0cy5jb25maWcgPSBjb25maWc7XG5leHBvcnRzLmNvbmZpZ3VyZSA9IGNvbmZpZ3VyZTsiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cInVzZSBzdHJpY3RcIjtcbi8qZ2xvYmFsIHNlbGYqL1xudmFyIFJTVlBQcm9taXNlID0gcmVxdWlyZShcIi4vcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgdmFyIGxvY2FsO1xuXG4gIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsID0gZ2xvYmFsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kb2N1bWVudCkge1xuICAgIGxvY2FsID0gd2luZG93O1xuICB9IGVsc2Uge1xuICAgIGxvY2FsID0gc2VsZjtcbiAgfVxuXG4gIHZhciBlczZQcm9taXNlU3VwcG9ydCA9IFxuICAgIFwiUHJvbWlzZVwiIGluIGxvY2FsICYmXG4gICAgLy8gU29tZSBvZiB0aGVzZSBtZXRob2RzIGFyZSBtaXNzaW5nIGZyb21cbiAgICAvLyBGaXJlZm94L0Nocm9tZSBleHBlcmltZW50YWwgaW1wbGVtZW50YXRpb25zXG4gICAgXCJjYXN0XCIgaW4gbG9jYWwuUHJvbWlzZSAmJlxuICAgIFwicmVzb2x2ZVwiIGluIGxvY2FsLlByb21pc2UgJiZcbiAgICBcInJlamVjdFwiIGluIGxvY2FsLlByb21pc2UgJiZcbiAgICBcImFsbFwiIGluIGxvY2FsLlByb21pc2UgJiZcbiAgICBcInJhY2VcIiBpbiBsb2NhbC5Qcm9taXNlICYmXG4gICAgLy8gT2xkZXIgdmVyc2lvbiBvZiB0aGUgc3BlYyBoYWQgYSByZXNvbHZlciBvYmplY3RcbiAgICAvLyBhcyB0aGUgYXJnIHJhdGhlciB0aGFuIGEgZnVuY3Rpb25cbiAgICAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVzb2x2ZTtcbiAgICAgIG5ldyBsb2NhbC5Qcm9taXNlKGZ1bmN0aW9uKHIpIHsgcmVzb2x2ZSA9IHI7IH0pO1xuICAgICAgcmV0dXJuIGlzRnVuY3Rpb24ocmVzb2x2ZSk7XG4gICAgfSgpKTtcblxuICBpZiAoIWVzNlByb21pc2VTdXBwb3J0KSB7XG4gICAgbG9jYWwuUHJvbWlzZSA9IFJTVlBQcm9taXNlO1xuICB9XG59XG5cbmV4cG9ydHMucG9seWZpbGwgPSBwb2x5ZmlsbDtcbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY29uZmlnID0gcmVxdWlyZShcIi4vY29uZmlnXCIpLmNvbmZpZztcbnZhciBjb25maWd1cmUgPSByZXF1aXJlKFwiLi9jb25maWdcIikuY29uZmlndXJlO1xudmFyIG9iamVjdE9yRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5vYmplY3RPckZ1bmN0aW9uO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xudmFyIG5vdyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLm5vdztcbnZhciBjYXN0ID0gcmVxdWlyZShcIi4vY2FzdFwiKS5jYXN0O1xudmFyIGFsbCA9IHJlcXVpcmUoXCIuL2FsbFwiKS5hbGw7XG52YXIgcmFjZSA9IHJlcXVpcmUoXCIuL3JhY2VcIikucmFjZTtcbnZhciBzdGF0aWNSZXNvbHZlID0gcmVxdWlyZShcIi4vcmVzb2x2ZVwiKS5yZXNvbHZlO1xudmFyIHN0YXRpY1JlamVjdCA9IHJlcXVpcmUoXCIuL3JlamVjdFwiKS5yZWplY3Q7XG52YXIgYXNhcCA9IHJlcXVpcmUoXCIuL2FzYXBcIikuYXNhcDtcblxudmFyIGNvdW50ZXIgPSAwO1xuXG5jb25maWcuYXN5bmMgPSBhc2FwOyAvLyBkZWZhdWx0IGFzeW5jIGlzIGFzYXA7XG5cbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKHJlc29sdmVyKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbiAgfVxuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG4gIH1cblxuICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gIGludm9rZVJlc29sdmVyKHJlc29sdmVyLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHByb21pc2UpIHtcbiAgZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gIH1cblxuICB0cnkge1xuICAgIHJlc29sdmVyKHJlc29sdmVQcm9taXNlLCByZWplY3RQcm9taXNlKTtcbiAgfSBjYXRjaChlKSB7XG4gICAgcmVqZWN0UHJvbWlzZShlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHZhciBoYXNDYWxsYmFjayA9IGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgdmFsdWUsIGVycm9yLCBzdWNjZWVkZWQsIGZhaWxlZDtcblxuICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgdmFsdWUgPSBjYWxsYmFjayhkZXRhaWwpO1xuICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICBlcnJvciA9IGU7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhbHVlID0gZGV0YWlsO1xuICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gIH1cblxuICBpZiAoaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKSB7XG4gICAgcmV0dXJuO1xuICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbnZhciBQRU5ESU5HICAgPSB2b2lkIDA7XG52YXIgU0VBTEVEICAgID0gMDtcbnZhciBGVUxGSUxMRUQgPSAxO1xudmFyIFJFSkVDVEVEICA9IDI7XG5cbmZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICB2YXIgbGVuZ3RoID0gc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gIHN1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gIHN1YnNjcmliZXJzW2xlbmd0aCArIFJFSkVDVEVEXSAgPSBvblJlamVjdGlvbjtcbn1cblxuZnVuY3Rpb24gcHVibGlzaChwcm9taXNlLCBzZXR0bGVkKSB7XG4gIHZhciBjaGlsZCwgY2FsbGJhY2ssIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnMsIGRldGFpbCA9IHByb21pc2UuX2RldGFpbDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgfVxuXG4gIHByb21pc2UuX3N1YnNjcmliZXJzID0gbnVsbDtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBQcm9taXNlLFxuXG4gIF9zdGF0ZTogdW5kZWZpbmVkLFxuICBfZGV0YWlsOiB1bmRlZmluZWQsXG4gIF9zdWJzY3JpYmVyczogdW5kZWZpbmVkLFxuXG4gIHRoZW46IGZ1bmN0aW9uKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgdmFyIHRoZW5Qcm9taXNlID0gbmV3IHRoaXMuY29uc3RydWN0b3IoZnVuY3Rpb24oKSB7fSk7XG5cbiAgICBpZiAodGhpcy5fc3RhdGUpIHtcbiAgICAgIHZhciBjYWxsYmFja3MgPSBhcmd1bWVudHM7XG4gICAgICBjb25maWcuYXN5bmMoZnVuY3Rpb24gaW52b2tlUHJvbWlzZUNhbGxiYWNrKCkge1xuICAgICAgICBpbnZva2VDYWxsYmFjayhwcm9taXNlLl9zdGF0ZSwgdGhlblByb21pc2UsIGNhbGxiYWNrc1twcm9taXNlLl9zdGF0ZSAtIDFdLCBwcm9taXNlLl9kZXRhaWwpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1YnNjcmliZSh0aGlzLCB0aGVuUHJvbWlzZSwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICAgIH1cblxuICAgIHJldHVybiB0aGVuUHJvbWlzZTtcbiAgfSxcblxuICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICB9XG59O1xuXG5Qcm9taXNlLmFsbCA9IGFsbDtcblByb21pc2UuY2FzdCA9IGNhc3Q7XG5Qcm9taXNlLnJhY2UgPSByYWNlO1xuUHJvbWlzZS5yZXNvbHZlID0gc3RhdGljUmVzb2x2ZTtcblByb21pc2UucmVqZWN0ID0gc3RhdGljUmVqZWN0O1xuXG5mdW5jdGlvbiBoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkge1xuICB2YXIgdGhlbiA9IG51bGwsXG4gIHJlc29sdmVkO1xuXG4gIHRyeSB7XG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLlwiKTtcbiAgICB9XG5cbiAgICBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHRoZW4gPSB2YWx1ZS50aGVuO1xuXG4gICAgICBpZiAoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdmFsKSB7XG4gICAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIHJlamVjdChwcm9taXNlLCB2YWwpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICghaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSB2YWx1ZTtcblxuICBjb25maWcuYXN5bmMocHVibGlzaEZ1bGZpbGxtZW50LCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSByZWFzb247XG5cbiAgY29uZmlnLmFzeW5jKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoRnVsZmlsbG1lbnQocHJvbWlzZSkge1xuICBwdWJsaXNoKHByb21pc2UsIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEKTtcbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIHB1Ymxpc2gocHJvbWlzZSwgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRCk7XG59XG5cbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNBcnJheTtcblxuLyoqXG4gIGBSU1ZQLnJhY2VgIGFsbG93cyB5b3UgdG8gd2F0Y2ggYSBzZXJpZXMgb2YgcHJvbWlzZXMgYW5kIGFjdCBhcyBzb29uIGFzIHRoZVxuICBmaXJzdCBwcm9taXNlIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgIGFyZ3VtZW50IGZ1bGZpbGxzIG9yIHJlamVjdHMuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAxXCIpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIHZhciBwcm9taXNlMiA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAyXCIpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFJTVlAucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gXCJwcm9taXNlIDJcIiBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcbiAgICAvLyB3YXMgcmVzb2x2ZWQuXG4gIH0pO1xuICBgYGBcblxuICBgUlNWUC5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0IGNvbXBsZXRlZFxuICBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgXG4gIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZSBoYXMgYmVjb21lXG4gIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkIHByb21pc2VcbiAgd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZShcInByb21pc2UgMVwiKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICB2YXIgcHJvbWlzZTIgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcihcInByb21pc2UgMlwiKSk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUlNWUC5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09IFwicHJvbWlzZTJcIiBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG4gICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBkZXNjcmliaW5nIHRoZSBwcm9taXNlIHJldHVybmVkLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IGJlY29tZXMgZnVsZmlsbGVkIHdpdGggdGhlIHZhbHVlIHRoZSBmaXJzdFxuICBjb21wbGV0ZWQgcHJvbWlzZXMgaXMgcmVzb2x2ZWQgd2l0aCBpZiB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2Ugd2FzXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIHRoYXQgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlXG4gIHdhcyByZWplY3RlZCB3aXRoLlxuKi9cbmZ1bmN0aW9uIHJhY2UocHJvbWlzZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShwcm9taXNlcykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJyk7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHByb21pc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydHMucmFjZSA9IHJhY2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZFxuICBgcmVhc29uYC4gYFJTVlAucmVqZWN0YCBpcyBlc3NlbnRpYWxseSBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlamVjdFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgaWRlbnRpZnlpbmcgdGhlIHJldHVybmVkIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVqZWN0ID0gcmVqZWN0OyIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gIGBSU1ZQLnJlc29sdmVgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIHBhc3NlZFxuICBgdmFsdWVgLiBgUlNWUC5yZXNvbHZlYCBpcyBlc3NlbnRpYWxseSBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZXNvbHZlKDEpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVzb2x2ZSgxKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlc29sdmVcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBpZGVudGlmeWluZyB0aGUgcmV0dXJuZWQgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHZhbHVlYFxuKi9cbmZ1bmN0aW9uIHJlc29sdmUodmFsdWUpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG4gIH0pO1xufVxuXG5leHBvcnRzLnJlc29sdmUgPSByZXNvbHZlOyIsIlwidXNlIHN0cmljdFwiO1xuZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gIHJldHVybiBpc0Z1bmN0aW9uKHgpIHx8ICh0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsKTtcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5KHgpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xufVxuXG4vLyBEYXRlLm5vdyBpcyBub3QgYXZhaWxhYmxlIGluIGJyb3dzZXJzIDwgSUU5XG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9EYXRlL25vdyNDb21wYXRpYmlsaXR5XG52YXIgbm93ID0gRGF0ZS5ub3cgfHwgZnVuY3Rpb24oKSB7IHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTsgfTtcblxuXG5leHBvcnRzLm9iamVjdE9yRnVuY3Rpb24gPSBvYmplY3RPckZ1bmN0aW9uO1xuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5leHBvcnRzLm5vdyA9IG5vdzsiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5Qb3N0ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cucG9zdE1lc3NhZ2UgJiYgd2luZG93LmFkZEV2ZW50TGlzdGVuZXJcbiAgICA7XG5cbiAgICBpZiAoY2FuU2V0SW1tZWRpYXRlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZikgeyByZXR1cm4gd2luZG93LnNldEltbWVkaWF0ZShmKSB9O1xuICAgIH1cblxuICAgIGlmIChjYW5Qb3N0KSB7XG4gICAgICAgIHZhciBxdWV1ZSA9IFtdO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgICAgICAgICAgdmFyIHNvdXJjZSA9IGV2LnNvdXJjZTtcbiAgICAgICAgICAgIGlmICgoc291cmNlID09PSB3aW5kb3cgfHwgc291cmNlID09PSBudWxsKSAmJiBldi5kYXRhID09PSAncHJvY2Vzcy10aWNrJykge1xuICAgICAgICAgICAgICAgIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGlmIChxdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlLnB1c2goZm4pO1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKCdwcm9jZXNzLXRpY2snLCAnKicpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICBzZXRUaW1lb3V0KGZuLCAwKTtcbiAgICB9O1xufSkoKTtcblxucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbi8vIFRPRE8oc2h0eWxtYW4pXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbiIsIi8qIC0qLSBtb2RlOiBqYXZhc2NyaXB0OyBjLWJhc2ljLW9mZnNldDogNDsgaW5kZW50LXRhYnMtbW9kZTogbmlsIC0qLSAqL1xuXG4vLyBcbi8vIEphdmFzY3JpcHQgWkxpYlxuLy8gQnkgVGhvbWFzIERvd24gMjAxMC0yMDExXG4vL1xuLy8gQmFzZWQgdmVyeSBoZWF2aWx5IG9uIHBvcnRpb25zIG9mIGp6bGliIChieSB5bW5rQGpjcmFmdC5jb20pLCB3aG8gaW5cbi8vIHR1cm4gY3JlZGl0cyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyIGZvciB0aGUgb3JpZ2luYWwgemxpYiBjb2RlLlxuLy9cbi8vIGluZmxhdGUuanM6IFpMaWIgaW5mbGF0ZSBjb2RlXG4vL1xuXG4vL1xuLy8gU2hhcmVkIGNvbnN0YW50c1xuLy9cblxudmFyIE1BWF9XQklUUz0xNTsgLy8gMzJLIExaNzcgd2luZG93XG52YXIgREVGX1dCSVRTPU1BWF9XQklUUztcbnZhciBNQVhfTUVNX0xFVkVMPTk7XG52YXIgTUFOWT0xNDQwO1xudmFyIEJNQVggPSAxNTtcblxuLy8gcHJlc2V0IGRpY3Rpb25hcnkgZmxhZyBpbiB6bGliIGhlYWRlclxudmFyIFBSRVNFVF9ESUNUPTB4MjA7XG5cbnZhciBaX05PX0ZMVVNIPTA7XG52YXIgWl9QQVJUSUFMX0ZMVVNIPTE7XG52YXIgWl9TWU5DX0ZMVVNIPTI7XG52YXIgWl9GVUxMX0ZMVVNIPTM7XG52YXIgWl9GSU5JU0g9NDtcblxudmFyIFpfREVGTEFURUQ9ODtcblxudmFyIFpfT0s9MDtcbnZhciBaX1NUUkVBTV9FTkQ9MTtcbnZhciBaX05FRURfRElDVD0yO1xudmFyIFpfRVJSTk89LTE7XG52YXIgWl9TVFJFQU1fRVJST1I9LTI7XG52YXIgWl9EQVRBX0VSUk9SPS0zO1xudmFyIFpfTUVNX0VSUk9SPS00O1xudmFyIFpfQlVGX0VSUk9SPS01O1xudmFyIFpfVkVSU0lPTl9FUlJPUj0tNjtcblxudmFyIE1FVEhPRD0wOyAgIC8vIHdhaXRpbmcgZm9yIG1ldGhvZCBieXRlXG52YXIgRkxBRz0xOyAgICAgLy8gd2FpdGluZyBmb3IgZmxhZyBieXRlXG52YXIgRElDVDQ9MjsgICAgLy8gZm91ciBkaWN0aW9uYXJ5IGNoZWNrIGJ5dGVzIHRvIGdvXG52YXIgRElDVDM9MzsgICAgLy8gdGhyZWUgZGljdGlvbmFyeSBjaGVjayBieXRlcyB0byBnb1xudmFyIERJQ1QyPTQ7ICAgIC8vIHR3byBkaWN0aW9uYXJ5IGNoZWNrIGJ5dGVzIHRvIGdvXG52YXIgRElDVDE9NTsgICAgLy8gb25lIGRpY3Rpb25hcnkgY2hlY2sgYnl0ZSB0byBnb1xudmFyIERJQ1QwPTY7ICAgIC8vIHdhaXRpbmcgZm9yIGluZmxhdGVTZXREaWN0aW9uYXJ5XG52YXIgQkxPQ0tTPTc7ICAgLy8gZGVjb21wcmVzc2luZyBibG9ja3NcbnZhciBDSEVDSzQ9ODsgICAvLyBmb3VyIGNoZWNrIGJ5dGVzIHRvIGdvXG52YXIgQ0hFQ0szPTk7ICAgLy8gdGhyZWUgY2hlY2sgYnl0ZXMgdG8gZ29cbnZhciBDSEVDSzI9MTA7ICAvLyB0d28gY2hlY2sgYnl0ZXMgdG8gZ29cbnZhciBDSEVDSzE9MTE7ICAvLyBvbmUgY2hlY2sgYnl0ZSB0byBnb1xudmFyIERPTkU9MTI7ICAgIC8vIGZpbmlzaGVkIGNoZWNrLCBkb25lXG52YXIgQkFEPTEzOyAgICAgLy8gZ290IGFuIGVycm9yLS1zdGF5IGhlcmVcblxudmFyIGluZmxhdGVfbWFzayA9IFsweDAwMDAwMDAwLCAweDAwMDAwMDAxLCAweDAwMDAwMDAzLCAweDAwMDAwMDA3LCAweDAwMDAwMDBmLCAweDAwMDAwMDFmLCAweDAwMDAwMDNmLCAweDAwMDAwMDdmLCAweDAwMDAwMGZmLCAweDAwMDAwMWZmLCAweDAwMDAwM2ZmLCAweDAwMDAwN2ZmLCAweDAwMDAwZmZmLCAweDAwMDAxZmZmLCAweDAwMDAzZmZmLCAweDAwMDA3ZmZmLCAweDAwMDBmZmZmXTtcblxudmFyIElCX1RZUEU9MDsgIC8vIGdldCB0eXBlIGJpdHMgKDMsIGluY2x1ZGluZyBlbmQgYml0KVxudmFyIElCX0xFTlM9MTsgIC8vIGdldCBsZW5ndGhzIGZvciBzdG9yZWRcbnZhciBJQl9TVE9SRUQ9MjsvLyBwcm9jZXNzaW5nIHN0b3JlZCBibG9ja1xudmFyIElCX1RBQkxFPTM7IC8vIGdldCB0YWJsZSBsZW5ndGhzXG52YXIgSUJfQlRSRUU9NDsgLy8gZ2V0IGJpdCBsZW5ndGhzIHRyZWUgZm9yIGEgZHluYW1pYyBibG9ja1xudmFyIElCX0RUUkVFPTU7IC8vIGdldCBsZW5ndGgsIGRpc3RhbmNlIHRyZWVzIGZvciBhIGR5bmFtaWMgYmxvY2tcbnZhciBJQl9DT0RFUz02OyAvLyBwcm9jZXNzaW5nIGZpeGVkIG9yIGR5bmFtaWMgYmxvY2tcbnZhciBJQl9EUlk9NzsgICAvLyBvdXRwdXQgcmVtYWluaW5nIHdpbmRvdyBieXRlc1xudmFyIElCX0RPTkU9ODsgIC8vIGZpbmlzaGVkIGxhc3QgYmxvY2ssIGRvbmVcbnZhciBJQl9CQUQ9OTsgICAvLyBvdCBhIGRhdGEgZXJyb3ItLXN0dWNrIGhlcmVcblxudmFyIGZpeGVkX2JsID0gOTtcbnZhciBmaXhlZF9iZCA9IDU7XG5cbnZhciBmaXhlZF90bCA9IFtcbiAgICA5Niw3LDI1NiwgMCw4LDgwLCAwLDgsMTYsIDg0LDgsMTE1LFxuICAgIDgyLDcsMzEsIDAsOCwxMTIsIDAsOCw0OCwgMCw5LDE5MixcbiAgICA4MCw3LDEwLCAwLDgsOTYsIDAsOCwzMiwgMCw5LDE2MCxcbiAgICAwLDgsMCwgMCw4LDEyOCwgMCw4LDY0LCAwLDksMjI0LFxuICAgIDgwLDcsNiwgMCw4LDg4LCAwLDgsMjQsIDAsOSwxNDQsXG4gICAgODMsNyw1OSwgMCw4LDEyMCwgMCw4LDU2LCAwLDksMjA4LFxuICAgIDgxLDcsMTcsIDAsOCwxMDQsIDAsOCw0MCwgMCw5LDE3NixcbiAgICAwLDgsOCwgMCw4LDEzNiwgMCw4LDcyLCAwLDksMjQwLFxuICAgIDgwLDcsNCwgMCw4LDg0LCAwLDgsMjAsIDg1LDgsMjI3LFxuICAgIDgzLDcsNDMsIDAsOCwxMTYsIDAsOCw1MiwgMCw5LDIwMCxcbiAgICA4MSw3LDEzLCAwLDgsMTAwLCAwLDgsMzYsIDAsOSwxNjgsXG4gICAgMCw4LDQsIDAsOCwxMzIsIDAsOCw2OCwgMCw5LDIzMixcbiAgICA4MCw3LDgsIDAsOCw5MiwgMCw4LDI4LCAwLDksMTUyLFxuICAgIDg0LDcsODMsIDAsOCwxMjQsIDAsOCw2MCwgMCw5LDIxNixcbiAgICA4Miw3LDIzLCAwLDgsMTA4LCAwLDgsNDQsIDAsOSwxODQsXG4gICAgMCw4LDEyLCAwLDgsMTQwLCAwLDgsNzYsIDAsOSwyNDgsXG4gICAgODAsNywzLCAwLDgsODIsIDAsOCwxOCwgODUsOCwxNjMsXG4gICAgODMsNywzNSwgMCw4LDExNCwgMCw4LDUwLCAwLDksMTk2LFxuICAgIDgxLDcsMTEsIDAsOCw5OCwgMCw4LDM0LCAwLDksMTY0LFxuICAgIDAsOCwyLCAwLDgsMTMwLCAwLDgsNjYsIDAsOSwyMjgsXG4gICAgODAsNyw3LCAwLDgsOTAsIDAsOCwyNiwgMCw5LDE0OCxcbiAgICA4NCw3LDY3LCAwLDgsMTIyLCAwLDgsNTgsIDAsOSwyMTIsXG4gICAgODIsNywxOSwgMCw4LDEwNiwgMCw4LDQyLCAwLDksMTgwLFxuICAgIDAsOCwxMCwgMCw4LDEzOCwgMCw4LDc0LCAwLDksMjQ0LFxuICAgIDgwLDcsNSwgMCw4LDg2LCAwLDgsMjIsIDE5Miw4LDAsXG4gICAgODMsNyw1MSwgMCw4LDExOCwgMCw4LDU0LCAwLDksMjA0LFxuICAgIDgxLDcsMTUsIDAsOCwxMDIsIDAsOCwzOCwgMCw5LDE3MixcbiAgICAwLDgsNiwgMCw4LDEzNCwgMCw4LDcwLCAwLDksMjM2LFxuICAgIDgwLDcsOSwgMCw4LDk0LCAwLDgsMzAsIDAsOSwxNTYsXG4gICAgODQsNyw5OSwgMCw4LDEyNiwgMCw4LDYyLCAwLDksMjIwLFxuICAgIDgyLDcsMjcsIDAsOCwxMTAsIDAsOCw0NiwgMCw5LDE4OCxcbiAgICAwLDgsMTQsIDAsOCwxNDIsIDAsOCw3OCwgMCw5LDI1MixcbiAgICA5Niw3LDI1NiwgMCw4LDgxLCAwLDgsMTcsIDg1LDgsMTMxLFxuICAgIDgyLDcsMzEsIDAsOCwxMTMsIDAsOCw0OSwgMCw5LDE5NCxcbiAgICA4MCw3LDEwLCAwLDgsOTcsIDAsOCwzMywgMCw5LDE2MixcbiAgICAwLDgsMSwgMCw4LDEyOSwgMCw4LDY1LCAwLDksMjI2LFxuICAgIDgwLDcsNiwgMCw4LDg5LCAwLDgsMjUsIDAsOSwxNDYsXG4gICAgODMsNyw1OSwgMCw4LDEyMSwgMCw4LDU3LCAwLDksMjEwLFxuICAgIDgxLDcsMTcsIDAsOCwxMDUsIDAsOCw0MSwgMCw5LDE3OCxcbiAgICAwLDgsOSwgMCw4LDEzNywgMCw4LDczLCAwLDksMjQyLFxuICAgIDgwLDcsNCwgMCw4LDg1LCAwLDgsMjEsIDgwLDgsMjU4LFxuICAgIDgzLDcsNDMsIDAsOCwxMTcsIDAsOCw1MywgMCw5LDIwMixcbiAgICA4MSw3LDEzLCAwLDgsMTAxLCAwLDgsMzcsIDAsOSwxNzAsXG4gICAgMCw4LDUsIDAsOCwxMzMsIDAsOCw2OSwgMCw5LDIzNCxcbiAgICA4MCw3LDgsIDAsOCw5MywgMCw4LDI5LCAwLDksMTU0LFxuICAgIDg0LDcsODMsIDAsOCwxMjUsIDAsOCw2MSwgMCw5LDIxOCxcbiAgICA4Miw3LDIzLCAwLDgsMTA5LCAwLDgsNDUsIDAsOSwxODYsXG4gICAgMCw4LDEzLCAwLDgsMTQxLCAwLDgsNzcsIDAsOSwyNTAsXG4gICAgODAsNywzLCAwLDgsODMsIDAsOCwxOSwgODUsOCwxOTUsXG4gICAgODMsNywzNSwgMCw4LDExNSwgMCw4LDUxLCAwLDksMTk4LFxuICAgIDgxLDcsMTEsIDAsOCw5OSwgMCw4LDM1LCAwLDksMTY2LFxuICAgIDAsOCwzLCAwLDgsMTMxLCAwLDgsNjcsIDAsOSwyMzAsXG4gICAgODAsNyw3LCAwLDgsOTEsIDAsOCwyNywgMCw5LDE1MCxcbiAgICA4NCw3LDY3LCAwLDgsMTIzLCAwLDgsNTksIDAsOSwyMTQsXG4gICAgODIsNywxOSwgMCw4LDEwNywgMCw4LDQzLCAwLDksMTgyLFxuICAgIDAsOCwxMSwgMCw4LDEzOSwgMCw4LDc1LCAwLDksMjQ2LFxuICAgIDgwLDcsNSwgMCw4LDg3LCAwLDgsMjMsIDE5Miw4LDAsXG4gICAgODMsNyw1MSwgMCw4LDExOSwgMCw4LDU1LCAwLDksMjA2LFxuICAgIDgxLDcsMTUsIDAsOCwxMDMsIDAsOCwzOSwgMCw5LDE3NCxcbiAgICAwLDgsNywgMCw4LDEzNSwgMCw4LDcxLCAwLDksMjM4LFxuICAgIDgwLDcsOSwgMCw4LDk1LCAwLDgsMzEsIDAsOSwxNTgsXG4gICAgODQsNyw5OSwgMCw4LDEyNywgMCw4LDYzLCAwLDksMjIyLFxuICAgIDgyLDcsMjcsIDAsOCwxMTEsIDAsOCw0NywgMCw5LDE5MCxcbiAgICAwLDgsMTUsIDAsOCwxNDMsIDAsOCw3OSwgMCw5LDI1NCxcbiAgICA5Niw3LDI1NiwgMCw4LDgwLCAwLDgsMTYsIDg0LDgsMTE1LFxuICAgIDgyLDcsMzEsIDAsOCwxMTIsIDAsOCw0OCwgMCw5LDE5MyxcblxuICAgIDgwLDcsMTAsIDAsOCw5NiwgMCw4LDMyLCAwLDksMTYxLFxuICAgIDAsOCwwLCAwLDgsMTI4LCAwLDgsNjQsIDAsOSwyMjUsXG4gICAgODAsNyw2LCAwLDgsODgsIDAsOCwyNCwgMCw5LDE0NSxcbiAgICA4Myw3LDU5LCAwLDgsMTIwLCAwLDgsNTYsIDAsOSwyMDksXG4gICAgODEsNywxNywgMCw4LDEwNCwgMCw4LDQwLCAwLDksMTc3LFxuICAgIDAsOCw4LCAwLDgsMTM2LCAwLDgsNzIsIDAsOSwyNDEsXG4gICAgODAsNyw0LCAwLDgsODQsIDAsOCwyMCwgODUsOCwyMjcsXG4gICAgODMsNyw0MywgMCw4LDExNiwgMCw4LDUyLCAwLDksMjAxLFxuICAgIDgxLDcsMTMsIDAsOCwxMDAsIDAsOCwzNiwgMCw5LDE2OSxcbiAgICAwLDgsNCwgMCw4LDEzMiwgMCw4LDY4LCAwLDksMjMzLFxuICAgIDgwLDcsOCwgMCw4LDkyLCAwLDgsMjgsIDAsOSwxNTMsXG4gICAgODQsNyw4MywgMCw4LDEyNCwgMCw4LDYwLCAwLDksMjE3LFxuICAgIDgyLDcsMjMsIDAsOCwxMDgsIDAsOCw0NCwgMCw5LDE4NSxcbiAgICAwLDgsMTIsIDAsOCwxNDAsIDAsOCw3NiwgMCw5LDI0OSxcbiAgICA4MCw3LDMsIDAsOCw4MiwgMCw4LDE4LCA4NSw4LDE2MyxcbiAgICA4Myw3LDM1LCAwLDgsMTE0LCAwLDgsNTAsIDAsOSwxOTcsXG4gICAgODEsNywxMSwgMCw4LDk4LCAwLDgsMzQsIDAsOSwxNjUsXG4gICAgMCw4LDIsIDAsOCwxMzAsIDAsOCw2NiwgMCw5LDIyOSxcbiAgICA4MCw3LDcsIDAsOCw5MCwgMCw4LDI2LCAwLDksMTQ5LFxuICAgIDg0LDcsNjcsIDAsOCwxMjIsIDAsOCw1OCwgMCw5LDIxMyxcbiAgICA4Miw3LDE5LCAwLDgsMTA2LCAwLDgsNDIsIDAsOSwxODEsXG4gICAgMCw4LDEwLCAwLDgsMTM4LCAwLDgsNzQsIDAsOSwyNDUsXG4gICAgODAsNyw1LCAwLDgsODYsIDAsOCwyMiwgMTkyLDgsMCxcbiAgICA4Myw3LDUxLCAwLDgsMTE4LCAwLDgsNTQsIDAsOSwyMDUsXG4gICAgODEsNywxNSwgMCw4LDEwMiwgMCw4LDM4LCAwLDksMTczLFxuICAgIDAsOCw2LCAwLDgsMTM0LCAwLDgsNzAsIDAsOSwyMzcsXG4gICAgODAsNyw5LCAwLDgsOTQsIDAsOCwzMCwgMCw5LDE1NyxcbiAgICA4NCw3LDk5LCAwLDgsMTI2LCAwLDgsNjIsIDAsOSwyMjEsXG4gICAgODIsNywyNywgMCw4LDExMCwgMCw4LDQ2LCAwLDksMTg5LFxuICAgIDAsOCwxNCwgMCw4LDE0MiwgMCw4LDc4LCAwLDksMjUzLFxuICAgIDk2LDcsMjU2LCAwLDgsODEsIDAsOCwxNywgODUsOCwxMzEsXG4gICAgODIsNywzMSwgMCw4LDExMywgMCw4LDQ5LCAwLDksMTk1LFxuICAgIDgwLDcsMTAsIDAsOCw5NywgMCw4LDMzLCAwLDksMTYzLFxuICAgIDAsOCwxLCAwLDgsMTI5LCAwLDgsNjUsIDAsOSwyMjcsXG4gICAgODAsNyw2LCAwLDgsODksIDAsOCwyNSwgMCw5LDE0NyxcbiAgICA4Myw3LDU5LCAwLDgsMTIxLCAwLDgsNTcsIDAsOSwyMTEsXG4gICAgODEsNywxNywgMCw4LDEwNSwgMCw4LDQxLCAwLDksMTc5LFxuICAgIDAsOCw5LCAwLDgsMTM3LCAwLDgsNzMsIDAsOSwyNDMsXG4gICAgODAsNyw0LCAwLDgsODUsIDAsOCwyMSwgODAsOCwyNTgsXG4gICAgODMsNyw0MywgMCw4LDExNywgMCw4LDUzLCAwLDksMjAzLFxuICAgIDgxLDcsMTMsIDAsOCwxMDEsIDAsOCwzNywgMCw5LDE3MSxcbiAgICAwLDgsNSwgMCw4LDEzMywgMCw4LDY5LCAwLDksMjM1LFxuICAgIDgwLDcsOCwgMCw4LDkzLCAwLDgsMjksIDAsOSwxNTUsXG4gICAgODQsNyw4MywgMCw4LDEyNSwgMCw4LDYxLCAwLDksMjE5LFxuICAgIDgyLDcsMjMsIDAsOCwxMDksIDAsOCw0NSwgMCw5LDE4NyxcbiAgICAwLDgsMTMsIDAsOCwxNDEsIDAsOCw3NywgMCw5LDI1MSxcbiAgICA4MCw3LDMsIDAsOCw4MywgMCw4LDE5LCA4NSw4LDE5NSxcbiAgICA4Myw3LDM1LCAwLDgsMTE1LCAwLDgsNTEsIDAsOSwxOTksXG4gICAgODEsNywxMSwgMCw4LDk5LCAwLDgsMzUsIDAsOSwxNjcsXG4gICAgMCw4LDMsIDAsOCwxMzEsIDAsOCw2NywgMCw5LDIzMSxcbiAgICA4MCw3LDcsIDAsOCw5MSwgMCw4LDI3LCAwLDksMTUxLFxuICAgIDg0LDcsNjcsIDAsOCwxMjMsIDAsOCw1OSwgMCw5LDIxNSxcbiAgICA4Miw3LDE5LCAwLDgsMTA3LCAwLDgsNDMsIDAsOSwxODMsXG4gICAgMCw4LDExLCAwLDgsMTM5LCAwLDgsNzUsIDAsOSwyNDcsXG4gICAgODAsNyw1LCAwLDgsODcsIDAsOCwyMywgMTkyLDgsMCxcbiAgICA4Myw3LDUxLCAwLDgsMTE5LCAwLDgsNTUsIDAsOSwyMDcsXG4gICAgODEsNywxNSwgMCw4LDEwMywgMCw4LDM5LCAwLDksMTc1LFxuICAgIDAsOCw3LCAwLDgsMTM1LCAwLDgsNzEsIDAsOSwyMzksXG4gICAgODAsNyw5LCAwLDgsOTUsIDAsOCwzMSwgMCw5LDE1OSxcbiAgICA4NCw3LDk5LCAwLDgsMTI3LCAwLDgsNjMsIDAsOSwyMjMsXG4gICAgODIsNywyNywgMCw4LDExMSwgMCw4LDQ3LCAwLDksMTkxLFxuICAgIDAsOCwxNSwgMCw4LDE0MywgMCw4LDc5LCAwLDksMjU1XG5dO1xudmFyIGZpeGVkX3RkID0gW1xuICAgIDgwLDUsMSwgODcsNSwyNTcsIDgzLDUsMTcsIDkxLDUsNDA5NyxcbiAgICA4MSw1LDUsIDg5LDUsMTAyNSwgODUsNSw2NSwgOTMsNSwxNjM4NSxcbiAgICA4MCw1LDMsIDg4LDUsNTEzLCA4NCw1LDMzLCA5Miw1LDgxOTMsXG4gICAgODIsNSw5LCA5MCw1LDIwNDksIDg2LDUsMTI5LCAxOTIsNSwyNDU3NyxcbiAgICA4MCw1LDIsIDg3LDUsMzg1LCA4Myw1LDI1LCA5MSw1LDYxNDUsXG4gICAgODEsNSw3LCA4OSw1LDE1MzcsIDg1LDUsOTcsIDkzLDUsMjQ1NzcsXG4gICAgODAsNSw0LCA4OCw1LDc2OSwgODQsNSw0OSwgOTIsNSwxMjI4OSxcbiAgICA4Miw1LDEzLCA5MCw1LDMwNzMsIDg2LDUsMTkzLCAxOTIsNSwyNDU3N1xuXTtcblxuICAvLyBUYWJsZXMgZm9yIGRlZmxhdGUgZnJvbSBQS1pJUCdzIGFwcG5vdGUudHh0LlxuICB2YXIgY3BsZW5zID0gWyAvLyBDb3B5IGxlbmd0aHMgZm9yIGxpdGVyYWwgY29kZXMgMjU3Li4yODVcbiAgICAgICAgMywgNCwgNSwgNiwgNywgOCwgOSwgMTAsIDExLCAxMywgMTUsIDE3LCAxOSwgMjMsIDI3LCAzMSxcbiAgICAgICAgMzUsIDQzLCA1MSwgNTksIDY3LCA4MywgOTksIDExNSwgMTMxLCAxNjMsIDE5NSwgMjI3LCAyNTgsIDAsIDBcbiAgXTtcblxuICAvLyBzZWUgbm90ZSAjMTMgYWJvdmUgYWJvdXQgMjU4XG4gIHZhciBjcGxleHQgPSBbIC8vIEV4dHJhIGJpdHMgZm9yIGxpdGVyYWwgY29kZXMgMjU3Li4yODVcbiAgICAgICAgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMSwgMSwgMSwgMSwgMiwgMiwgMiwgMixcbiAgICAgICAgMywgMywgMywgMywgNCwgNCwgNCwgNCwgNSwgNSwgNSwgNSwgMCwgMTEyLCAxMTIgIC8vIDExMj09aW52YWxpZFxuICBdO1xuXG4gdmFyIGNwZGlzdCA9IFsgLy8gQ29weSBvZmZzZXRzIGZvciBkaXN0YW5jZSBjb2RlcyAwLi4yOVxuICAgICAgICAxLCAyLCAzLCA0LCA1LCA3LCA5LCAxMywgMTcsIDI1LCAzMywgNDksIDY1LCA5NywgMTI5LCAxOTMsXG4gICAgICAgIDI1NywgMzg1LCA1MTMsIDc2OSwgMTAyNSwgMTUzNywgMjA0OSwgMzA3MywgNDA5NywgNjE0NSxcbiAgICAgICAgODE5MywgMTIyODksIDE2Mzg1LCAyNDU3N1xuICBdO1xuXG4gIHZhciBjcGRleHQgPSBbIC8vIEV4dHJhIGJpdHMgZm9yIGRpc3RhbmNlIGNvZGVzXG4gICAgICAgIDAsIDAsIDAsIDAsIDEsIDEsIDIsIDIsIDMsIDMsIDQsIDQsIDUsIDUsIDYsIDYsXG4gICAgICAgIDcsIDcsIDgsIDgsIDksIDksIDEwLCAxMCwgMTEsIDExLFxuICAgICAgICAxMiwgMTIsIDEzLCAxM107XG5cbi8vXG4vLyBaU3RyZWFtLmphdmFcbi8vXG5cbmZ1bmN0aW9uIFpTdHJlYW0oKSB7XG59XG5cblxuWlN0cmVhbS5wcm90b3R5cGUuaW5mbGF0ZUluaXQgPSBmdW5jdGlvbih3LCBub3dyYXApIHtcbiAgICBpZiAoIXcpIHtcblx0dyA9IERFRl9XQklUUztcbiAgICB9XG4gICAgaWYgKG5vd3JhcCkge1xuXHRub3dyYXAgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5pc3RhdGUgPSBuZXcgSW5mbGF0ZSgpO1xuICAgIHJldHVybiB0aGlzLmlzdGF0ZS5pbmZsYXRlSW5pdCh0aGlzLCBub3dyYXA/LXc6dyk7XG59XG5cblpTdHJlYW0ucHJvdG90eXBlLmluZmxhdGUgPSBmdW5jdGlvbihmKSB7XG4gICAgaWYodGhpcy5pc3RhdGU9PW51bGwpIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgICByZXR1cm4gdGhpcy5pc3RhdGUuaW5mbGF0ZSh0aGlzLCBmKTtcbn1cblxuWlN0cmVhbS5wcm90b3R5cGUuaW5mbGF0ZUVuZCA9IGZ1bmN0aW9uKCl7XG4gICAgaWYodGhpcy5pc3RhdGU9PW51bGwpIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgICB2YXIgcmV0PWlzdGF0ZS5pbmZsYXRlRW5kKHRoaXMpO1xuICAgIHRoaXMuaXN0YXRlID0gbnVsbDtcbiAgICByZXR1cm4gcmV0O1xufVxuWlN0cmVhbS5wcm90b3R5cGUuaW5mbGF0ZVN5bmMgPSBmdW5jdGlvbigpe1xuICAgIC8vIGlmKGlzdGF0ZSA9PSBudWxsKSByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgcmV0dXJuIGlzdGF0ZS5pbmZsYXRlU3luYyh0aGlzKTtcbn1cblpTdHJlYW0ucHJvdG90eXBlLmluZmxhdGVTZXREaWN0aW9uYXJ5ID0gZnVuY3Rpb24oZGljdGlvbmFyeSwgZGljdExlbmd0aCl7XG4gICAgLy8gaWYoaXN0YXRlID09IG51bGwpIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgICByZXR1cm4gaXN0YXRlLmluZmxhdGVTZXREaWN0aW9uYXJ5KHRoaXMsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgpO1xufVxuXG4vKlxuXG4gIHB1YmxpYyBpbnQgZGVmbGF0ZUluaXQoaW50IGxldmVsKXtcbiAgICByZXR1cm4gZGVmbGF0ZUluaXQobGV2ZWwsIE1BWF9XQklUUyk7XG4gIH1cbiAgcHVibGljIGludCBkZWZsYXRlSW5pdChpbnQgbGV2ZWwsIGJvb2xlYW4gbm93cmFwKXtcbiAgICByZXR1cm4gZGVmbGF0ZUluaXQobGV2ZWwsIE1BWF9XQklUUywgbm93cmFwKTtcbiAgfVxuICBwdWJsaWMgaW50IGRlZmxhdGVJbml0KGludCBsZXZlbCwgaW50IGJpdHMpe1xuICAgIHJldHVybiBkZWZsYXRlSW5pdChsZXZlbCwgYml0cywgZmFsc2UpO1xuICB9XG4gIHB1YmxpYyBpbnQgZGVmbGF0ZUluaXQoaW50IGxldmVsLCBpbnQgYml0cywgYm9vbGVhbiBub3dyYXApe1xuICAgIGRzdGF0ZT1uZXcgRGVmbGF0ZSgpO1xuICAgIHJldHVybiBkc3RhdGUuZGVmbGF0ZUluaXQodGhpcywgbGV2ZWwsIG5vd3JhcD8tYml0czpiaXRzKTtcbiAgfVxuICBwdWJsaWMgaW50IGRlZmxhdGUoaW50IGZsdXNoKXtcbiAgICBpZihkc3RhdGU9PW51bGwpe1xuICAgICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICAgIH1cbiAgICByZXR1cm4gZHN0YXRlLmRlZmxhdGUodGhpcywgZmx1c2gpO1xuICB9XG4gIHB1YmxpYyBpbnQgZGVmbGF0ZUVuZCgpe1xuICAgIGlmKGRzdGF0ZT09bnVsbCkgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICAgIGludCByZXQ9ZHN0YXRlLmRlZmxhdGVFbmQoKTtcbiAgICBkc3RhdGU9bnVsbDtcbiAgICByZXR1cm4gcmV0O1xuICB9XG4gIHB1YmxpYyBpbnQgZGVmbGF0ZVBhcmFtcyhpbnQgbGV2ZWwsIGludCBzdHJhdGVneSl7XG4gICAgaWYoZHN0YXRlPT1udWxsKSByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgcmV0dXJuIGRzdGF0ZS5kZWZsYXRlUGFyYW1zKHRoaXMsIGxldmVsLCBzdHJhdGVneSk7XG4gIH1cbiAgcHVibGljIGludCBkZWZsYXRlU2V0RGljdGlvbmFyeSAoYnl0ZVtdIGRpY3Rpb25hcnksIGludCBkaWN0TGVuZ3RoKXtcbiAgICBpZihkc3RhdGUgPT0gbnVsbClcbiAgICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgICByZXR1cm4gZHN0YXRlLmRlZmxhdGVTZXREaWN0aW9uYXJ5KHRoaXMsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgpO1xuICB9XG5cbiovXG5cbi8qXG4gIC8vIEZsdXNoIGFzIG11Y2ggcGVuZGluZyBvdXRwdXQgYXMgcG9zc2libGUuIEFsbCBkZWZsYXRlKCkgb3V0cHV0IGdvZXNcbiAgLy8gdGhyb3VnaCB0aGlzIGZ1bmN0aW9uIHNvIHNvbWUgYXBwbGljYXRpb25zIG1heSB3aXNoIHRvIG1vZGlmeSBpdFxuICAvLyB0byBhdm9pZCBhbGxvY2F0aW5nIGEgbGFyZ2Ugc3RybS0+bmV4dF9vdXQgYnVmZmVyIGFuZCBjb3B5aW5nIGludG8gaXQuXG4gIC8vIChTZWUgYWxzbyByZWFkX2J1ZigpKS5cbiAgdm9pZCBmbHVzaF9wZW5kaW5nKCl7XG4gICAgaW50IGxlbj1kc3RhdGUucGVuZGluZztcblxuICAgIGlmKGxlbj5hdmFpbF9vdXQpIGxlbj1hdmFpbF9vdXQ7XG4gICAgaWYobGVuPT0wKSByZXR1cm47XG5cbiAgICBpZihkc3RhdGUucGVuZGluZ19idWYubGVuZ3RoPD1kc3RhdGUucGVuZGluZ19vdXQgfHxcbiAgICAgICBuZXh0X291dC5sZW5ndGg8PW5leHRfb3V0X2luZGV4IHx8XG4gICAgICAgZHN0YXRlLnBlbmRpbmdfYnVmLmxlbmd0aDwoZHN0YXRlLnBlbmRpbmdfb3V0K2xlbikgfHxcbiAgICAgICBuZXh0X291dC5sZW5ndGg8KG5leHRfb3V0X2luZGV4K2xlbikpe1xuICAgICAgU3lzdGVtLm91dC5wcmludGxuKGRzdGF0ZS5wZW5kaW5nX2J1Zi5sZW5ndGgrXCIsIFwiK2RzdGF0ZS5wZW5kaW5nX291dCtcblx0XHRcdCBcIiwgXCIrbmV4dF9vdXQubGVuZ3RoK1wiLCBcIituZXh0X291dF9pbmRleCtcIiwgXCIrbGVuKTtcbiAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihcImF2YWlsX291dD1cIithdmFpbF9vdXQpO1xuICAgIH1cblxuICAgIFN5c3RlbS5hcnJheWNvcHkoZHN0YXRlLnBlbmRpbmdfYnVmLCBkc3RhdGUucGVuZGluZ19vdXQsXG5cdFx0ICAgICBuZXh0X291dCwgbmV4dF9vdXRfaW5kZXgsIGxlbik7XG5cbiAgICBuZXh0X291dF9pbmRleCs9bGVuO1xuICAgIGRzdGF0ZS5wZW5kaW5nX291dCs9bGVuO1xuICAgIHRvdGFsX291dCs9bGVuO1xuICAgIGF2YWlsX291dC09bGVuO1xuICAgIGRzdGF0ZS5wZW5kaW5nLT1sZW47XG4gICAgaWYoZHN0YXRlLnBlbmRpbmc9PTApe1xuICAgICAgZHN0YXRlLnBlbmRpbmdfb3V0PTA7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVhZCBhIG5ldyBidWZmZXIgZnJvbSB0aGUgY3VycmVudCBpbnB1dCBzdHJlYW0sIHVwZGF0ZSB0aGUgYWRsZXIzMlxuICAvLyBhbmQgdG90YWwgbnVtYmVyIG9mIGJ5dGVzIHJlYWQuICBBbGwgZGVmbGF0ZSgpIGlucHV0IGdvZXMgdGhyb3VnaFxuICAvLyB0aGlzIGZ1bmN0aW9uIHNvIHNvbWUgYXBwbGljYXRpb25zIG1heSB3aXNoIHRvIG1vZGlmeSBpdCB0byBhdm9pZFxuICAvLyBhbGxvY2F0aW5nIGEgbGFyZ2Ugc3RybS0+bmV4dF9pbiBidWZmZXIgYW5kIGNvcHlpbmcgZnJvbSBpdC5cbiAgLy8gKFNlZSBhbHNvIGZsdXNoX3BlbmRpbmcoKSkuXG4gIGludCByZWFkX2J1ZihieXRlW10gYnVmLCBpbnQgc3RhcnQsIGludCBzaXplKSB7XG4gICAgaW50IGxlbj1hdmFpbF9pbjtcblxuICAgIGlmKGxlbj5zaXplKSBsZW49c2l6ZTtcbiAgICBpZihsZW49PTApIHJldHVybiAwO1xuXG4gICAgYXZhaWxfaW4tPWxlbjtcblxuICAgIGlmKGRzdGF0ZS5ub2hlYWRlcj09MCkge1xuICAgICAgYWRsZXI9X2FkbGVyLmFkbGVyMzIoYWRsZXIsIG5leHRfaW4sIG5leHRfaW5faW5kZXgsIGxlbik7XG4gICAgfVxuICAgIFN5c3RlbS5hcnJheWNvcHkobmV4dF9pbiwgbmV4dF9pbl9pbmRleCwgYnVmLCBzdGFydCwgbGVuKTtcbiAgICBuZXh0X2luX2luZGV4ICArPSBsZW47XG4gICAgdG90YWxfaW4gKz0gbGVuO1xuICAgIHJldHVybiBsZW47XG4gIH1cblxuICBwdWJsaWMgdm9pZCBmcmVlKCl7XG4gICAgbmV4dF9pbj1udWxsO1xuICAgIG5leHRfb3V0PW51bGw7XG4gICAgbXNnPW51bGw7XG4gICAgX2FkbGVyPW51bGw7XG4gIH1cbn1cbiovXG5cblxuLy9cbi8vIEluZmxhdGUuamF2YVxuLy9cblxuZnVuY3Rpb24gSW5mbGF0ZSgpIHtcbiAgICB0aGlzLndhcyA9IFswXTtcbn1cblxuSW5mbGF0ZS5wcm90b3R5cGUuaW5mbGF0ZVJlc2V0ID0gZnVuY3Rpb24oeikge1xuICAgIGlmKHogPT0gbnVsbCB8fCB6LmlzdGF0ZSA9PSBudWxsKSByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgXG4gICAgei50b3RhbF9pbiA9IHoudG90YWxfb3V0ID0gMDtcbiAgICB6Lm1zZyA9IG51bGw7XG4gICAgei5pc3RhdGUubW9kZSA9IHouaXN0YXRlLm5vd3JhcCE9MCA/IEJMT0NLUyA6IE1FVEhPRDtcbiAgICB6LmlzdGF0ZS5ibG9ja3MucmVzZXQoeiwgbnVsbCk7XG4gICAgcmV0dXJuIFpfT0s7XG59XG5cbkluZmxhdGUucHJvdG90eXBlLmluZmxhdGVFbmQgPSBmdW5jdGlvbih6KXtcbiAgICBpZih0aGlzLmJsb2NrcyAhPSBudWxsKVxuICAgICAgdGhpcy5ibG9ja3MuZnJlZSh6KTtcbiAgICB0aGlzLmJsb2Nrcz1udWxsO1xuICAgIHJldHVybiBaX09LO1xufVxuXG5JbmZsYXRlLnByb3RvdHlwZS5pbmZsYXRlSW5pdCA9IGZ1bmN0aW9uKHosIHcpe1xuICAgIHoubXNnID0gbnVsbDtcbiAgICB0aGlzLmJsb2NrcyA9IG51bGw7XG5cbiAgICAvLyBoYW5kbGUgdW5kb2N1bWVudGVkIG5vd3JhcCBvcHRpb24gKG5vIHpsaWIgaGVhZGVyIG9yIGNoZWNrKVxuICAgIG5vd3JhcCA9IDA7XG4gICAgaWYodyA8IDApe1xuICAgICAgdyA9IC0gdztcbiAgICAgIG5vd3JhcCA9IDE7XG4gICAgfVxuXG4gICAgLy8gc2V0IHdpbmRvdyBzaXplXG4gICAgaWYodzw4IHx8dz4xNSl7XG4gICAgICB0aGlzLmluZmxhdGVFbmQoeik7XG4gICAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgfVxuICAgIHRoaXMud2JpdHM9dztcblxuICAgIHouaXN0YXRlLmJsb2Nrcz1uZXcgSW5mQmxvY2tzKHosIFxuXHRcdFx0XHQgIHouaXN0YXRlLm5vd3JhcCE9MCA/IG51bGwgOiB0aGlzLFxuXHRcdFx0XHQgIDE8PHcpO1xuXG4gICAgLy8gcmVzZXQgc3RhdGVcbiAgICB0aGlzLmluZmxhdGVSZXNldCh6KTtcbiAgICByZXR1cm4gWl9PSztcbiAgfVxuXG5JbmZsYXRlLnByb3RvdHlwZS5pbmZsYXRlID0gZnVuY3Rpb24oeiwgZil7XG4gICAgdmFyIHIsIGI7XG5cbiAgICBpZih6ID09IG51bGwgfHwgei5pc3RhdGUgPT0gbnVsbCB8fCB6Lm5leHRfaW4gPT0gbnVsbClcbiAgICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgICBmID0gZiA9PSBaX0ZJTklTSCA/IFpfQlVGX0VSUk9SIDogWl9PSztcbiAgICByID0gWl9CVUZfRVJST1I7XG4gICAgd2hpbGUgKHRydWUpe1xuICAgICAgc3dpdGNoICh6LmlzdGF0ZS5tb2RlKXtcbiAgICAgIGNhc2UgTUVUSE9EOlxuXG4gICAgICAgIGlmKHouYXZhaWxfaW49PTApcmV0dXJuIHI7cj1mO1xuXG4gICAgICAgIHouYXZhaWxfaW4tLTsgei50b3RhbF9pbisrO1xuICAgICAgICBpZigoKHouaXN0YXRlLm1ldGhvZCA9IHoubmV4dF9pblt6Lm5leHRfaW5faW5kZXgrK10pJjB4ZikhPVpfREVGTEFURUQpe1xuICAgICAgICAgIHouaXN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgei5tc2c9XCJ1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZFwiO1xuICAgICAgICAgIHouaXN0YXRlLm1hcmtlciA9IDU7ICAgICAgIC8vIGNhbid0IHRyeSBpbmZsYXRlU3luY1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmKCh6LmlzdGF0ZS5tZXRob2Q+PjQpKzg+ei5pc3RhdGUud2JpdHMpe1xuICAgICAgICAgIHouaXN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgei5tc2c9XCJpbnZhbGlkIHdpbmRvdyBzaXplXCI7XG4gICAgICAgICAgei5pc3RhdGUubWFya2VyID0gNTsgICAgICAgLy8gY2FuJ3QgdHJ5IGluZmxhdGVTeW5jXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgei5pc3RhdGUubW9kZT1GTEFHO1xuICAgICAgY2FzZSBGTEFHOlxuXG4gICAgICAgIGlmKHouYXZhaWxfaW49PTApcmV0dXJuIHI7cj1mO1xuXG4gICAgICAgIHouYXZhaWxfaW4tLTsgei50b3RhbF9pbisrO1xuICAgICAgICBiID0gKHoubmV4dF9pblt6Lm5leHRfaW5faW5kZXgrK10pJjB4ZmY7XG5cbiAgICAgICAgaWYoKCgoei5pc3RhdGUubWV0aG9kIDw8IDgpK2IpICUgMzEpIT0wKXtcbiAgICAgICAgICB6LmlzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIHoubXNnID0gXCJpbmNvcnJlY3QgaGVhZGVyIGNoZWNrXCI7XG4gICAgICAgICAgei5pc3RhdGUubWFya2VyID0gNTsgICAgICAgLy8gY2FuJ3QgdHJ5IGluZmxhdGVTeW5jXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZigoYiZQUkVTRVRfRElDVCk9PTApe1xuICAgICAgICAgIHouaXN0YXRlLm1vZGUgPSBCTE9DS1M7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgei5pc3RhdGUubW9kZSA9IERJQ1Q0O1xuICAgICAgY2FzZSBESUNUNDpcblxuICAgICAgICBpZih6LmF2YWlsX2luPT0wKXJldHVybiByO3I9ZjtcblxuICAgICAgICB6LmF2YWlsX2luLS07IHoudG90YWxfaW4rKztcbiAgICAgICAgei5pc3RhdGUubmVlZD0oKHoubmV4dF9pblt6Lm5leHRfaW5faW5kZXgrK10mMHhmZik8PDI0KSYweGZmMDAwMDAwO1xuICAgICAgICB6LmlzdGF0ZS5tb2RlPURJQ1QzO1xuICAgICAgY2FzZSBESUNUMzpcblxuICAgICAgICBpZih6LmF2YWlsX2luPT0wKXJldHVybiByO3I9ZjtcblxuICAgICAgICB6LmF2YWlsX2luLS07IHoudG90YWxfaW4rKztcbiAgICAgICAgei5pc3RhdGUubmVlZCs9KCh6Lm5leHRfaW5bei5uZXh0X2luX2luZGV4KytdJjB4ZmYpPDwxNikmMHhmZjAwMDA7XG4gICAgICAgIHouaXN0YXRlLm1vZGU9RElDVDI7XG4gICAgICBjYXNlIERJQ1QyOlxuXG4gICAgICAgIGlmKHouYXZhaWxfaW49PTApcmV0dXJuIHI7cj1mO1xuXG4gICAgICAgIHouYXZhaWxfaW4tLTsgei50b3RhbF9pbisrO1xuICAgICAgICB6LmlzdGF0ZS5uZWVkKz0oKHoubmV4dF9pblt6Lm5leHRfaW5faW5kZXgrK10mMHhmZik8PDgpJjB4ZmYwMDtcbiAgICAgICAgei5pc3RhdGUubW9kZT1ESUNUMTtcbiAgICAgIGNhc2UgRElDVDE6XG5cbiAgICAgICAgaWYoei5hdmFpbF9pbj09MClyZXR1cm4gcjtyPWY7XG5cbiAgICAgICAgei5hdmFpbF9pbi0tOyB6LnRvdGFsX2luKys7XG4gICAgICAgIHouaXN0YXRlLm5lZWQgKz0gKHoubmV4dF9pblt6Lm5leHRfaW5faW5kZXgrK10mMHhmZik7XG4gICAgICAgIHouYWRsZXIgPSB6LmlzdGF0ZS5uZWVkO1xuICAgICAgICB6LmlzdGF0ZS5tb2RlID0gRElDVDA7XG4gICAgICAgIHJldHVybiBaX05FRURfRElDVDtcbiAgICAgIGNhc2UgRElDVDA6XG4gICAgICAgIHouaXN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgIHoubXNnID0gXCJuZWVkIGRpY3Rpb25hcnlcIjtcbiAgICAgICAgei5pc3RhdGUubWFya2VyID0gMDsgICAgICAgLy8gY2FuIHRyeSBpbmZsYXRlU3luY1xuICAgICAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgICBjYXNlIEJMT0NLUzpcblxuICAgICAgICByID0gei5pc3RhdGUuYmxvY2tzLnByb2Moeiwgcik7XG4gICAgICAgIGlmKHIgPT0gWl9EQVRBX0VSUk9SKXtcbiAgICAgICAgICB6LmlzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIHouaXN0YXRlLm1hcmtlciA9IDA7ICAgICAvLyBjYW4gdHJ5IGluZmxhdGVTeW5jXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYociA9PSBaX09LKXtcbiAgICAgICAgICByID0gZjtcbiAgICAgICAgfVxuICAgICAgICBpZihyICE9IFpfU1RSRUFNX0VORCl7XG4gICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgIH1cbiAgICAgICAgciA9IGY7XG4gICAgICAgIHouaXN0YXRlLmJsb2Nrcy5yZXNldCh6LCB6LmlzdGF0ZS53YXMpO1xuICAgICAgICBpZih6LmlzdGF0ZS5ub3dyYXAhPTApe1xuICAgICAgICAgIHouaXN0YXRlLm1vZGU9RE9ORTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICB6LmlzdGF0ZS5tb2RlPUNIRUNLNDtcbiAgICAgIGNhc2UgQ0hFQ0s0OlxuXG4gICAgICAgIGlmKHouYXZhaWxfaW49PTApcmV0dXJuIHI7cj1mO1xuXG4gICAgICAgIHouYXZhaWxfaW4tLTsgei50b3RhbF9pbisrO1xuICAgICAgICB6LmlzdGF0ZS5uZWVkPSgoei5uZXh0X2luW3oubmV4dF9pbl9pbmRleCsrXSYweGZmKTw8MjQpJjB4ZmYwMDAwMDA7XG4gICAgICAgIHouaXN0YXRlLm1vZGU9Q0hFQ0szO1xuICAgICAgY2FzZSBDSEVDSzM6XG5cbiAgICAgICAgaWYoei5hdmFpbF9pbj09MClyZXR1cm4gcjtyPWY7XG5cbiAgICAgICAgei5hdmFpbF9pbi0tOyB6LnRvdGFsX2luKys7XG4gICAgICAgIHouaXN0YXRlLm5lZWQrPSgoei5uZXh0X2luW3oubmV4dF9pbl9pbmRleCsrXSYweGZmKTw8MTYpJjB4ZmYwMDAwO1xuICAgICAgICB6LmlzdGF0ZS5tb2RlID0gQ0hFQ0syO1xuICAgICAgY2FzZSBDSEVDSzI6XG5cbiAgICAgICAgaWYoei5hdmFpbF9pbj09MClyZXR1cm4gcjtyPWY7XG5cbiAgICAgICAgei5hdmFpbF9pbi0tOyB6LnRvdGFsX2luKys7XG4gICAgICAgIHouaXN0YXRlLm5lZWQrPSgoei5uZXh0X2luW3oubmV4dF9pbl9pbmRleCsrXSYweGZmKTw8OCkmMHhmZjAwO1xuICAgICAgICB6LmlzdGF0ZS5tb2RlID0gQ0hFQ0sxO1xuICAgICAgY2FzZSBDSEVDSzE6XG5cbiAgICAgICAgaWYoei5hdmFpbF9pbj09MClyZXR1cm4gcjtyPWY7XG5cbiAgICAgICAgei5hdmFpbF9pbi0tOyB6LnRvdGFsX2luKys7XG4gICAgICAgIHouaXN0YXRlLm5lZWQrPSh6Lm5leHRfaW5bei5uZXh0X2luX2luZGV4KytdJjB4ZmYpO1xuXG4gICAgICAgIGlmKCgoei5pc3RhdGUud2FzWzBdKSkgIT0gKCh6LmlzdGF0ZS5uZWVkKSkpe1xuICAgICAgICAgIHouaXN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgei5tc2cgPSBcImluY29ycmVjdCBkYXRhIGNoZWNrXCI7XG4gICAgICAgICAgei5pc3RhdGUubWFya2VyID0gNTsgICAgICAgLy8gY2FuJ3QgdHJ5IGluZmxhdGVTeW5jXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB6LmlzdGF0ZS5tb2RlID0gRE9ORTtcbiAgICAgIGNhc2UgRE9ORTpcbiAgICAgICAgcmV0dXJuIFpfU1RSRUFNX0VORDtcbiAgICAgIGNhc2UgQkFEOlxuICAgICAgICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbkluZmxhdGUucHJvdG90eXBlLmluZmxhdGVTZXREaWN0aW9uYXJ5ID0gZnVuY3Rpb24oeiwgIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgpIHtcbiAgICB2YXIgaW5kZXg9MDtcbiAgICB2YXIgbGVuZ3RoID0gZGljdExlbmd0aDtcbiAgICBpZih6PT1udWxsIHx8IHouaXN0YXRlID09IG51bGx8fCB6LmlzdGF0ZS5tb2RlICE9IERJQ1QwKVxuICAgICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXG4gICAgaWYoei5fYWRsZXIuYWRsZXIzMigxLCBkaWN0aW9uYXJ5LCAwLCBkaWN0TGVuZ3RoKSE9ei5hZGxlcil7XG4gICAgICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuICAgIH1cblxuICAgIHouYWRsZXIgPSB6Ll9hZGxlci5hZGxlcjMyKDAsIG51bGwsIDAsIDApO1xuXG4gICAgaWYobGVuZ3RoID49ICgxPDx6LmlzdGF0ZS53Yml0cykpe1xuICAgICAgbGVuZ3RoID0gKDE8PHouaXN0YXRlLndiaXRzKS0xO1xuICAgICAgaW5kZXg9ZGljdExlbmd0aCAtIGxlbmd0aDtcbiAgICB9XG4gICAgei5pc3RhdGUuYmxvY2tzLnNldF9kaWN0aW9uYXJ5KGRpY3Rpb25hcnksIGluZGV4LCBsZW5ndGgpO1xuICAgIHouaXN0YXRlLm1vZGUgPSBCTE9DS1M7XG4gICAgcmV0dXJuIFpfT0s7XG4gIH1cblxuLy8gIHN0YXRpYyBwcml2YXRlIGJ5dGVbXSBtYXJrID0geyhieXRlKTAsIChieXRlKTAsIChieXRlKTB4ZmYsIChieXRlKTB4ZmZ9O1xudmFyIG1hcmsgPSBbMCwgMCwgMjU1LCAyNTVdXG5cbkluZmxhdGUucHJvdG90eXBlLmluZmxhdGVTeW5jID0gZnVuY3Rpb24oeil7XG4gICAgdmFyIG47ICAgICAgIC8vIG51bWJlciBvZiBieXRlcyB0byBsb29rIGF0XG4gICAgdmFyIHA7ICAgICAgIC8vIHBvaW50ZXIgdG8gYnl0ZXNcbiAgICB2YXIgbTsgICAgICAgLy8gbnVtYmVyIG9mIG1hcmtlciBieXRlcyBmb3VuZCBpbiBhIHJvd1xuICAgIHZhciByLCB3OyAgIC8vIHRlbXBvcmFyaWVzIHRvIHNhdmUgdG90YWxfaW4gYW5kIHRvdGFsX291dFxuXG4gICAgLy8gc2V0IHVwXG4gICAgaWYoeiA9PSBudWxsIHx8IHouaXN0YXRlID09IG51bGwpXG4gICAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgaWYoei5pc3RhdGUubW9kZSAhPSBCQUQpe1xuICAgICAgei5pc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgIHouaXN0YXRlLm1hcmtlciA9IDA7XG4gICAgfVxuICAgIGlmKChuPXouYXZhaWxfaW4pPT0wKVxuICAgICAgcmV0dXJuIFpfQlVGX0VSUk9SO1xuICAgIHA9ei5uZXh0X2luX2luZGV4O1xuICAgIG09ei5pc3RhdGUubWFya2VyO1xuXG4gICAgLy8gc2VhcmNoXG4gICAgd2hpbGUgKG4hPTAgJiYgbSA8IDQpe1xuICAgICAgaWYoei5uZXh0X2luW3BdID09IG1hcmtbbV0pe1xuICAgICAgICBtKys7XG4gICAgICB9XG4gICAgICBlbHNlIGlmKHoubmV4dF9pbltwXSE9MCl7XG4gICAgICAgIG0gPSAwO1xuICAgICAgfVxuICAgICAgZWxzZXtcbiAgICAgICAgbSA9IDQgLSBtO1xuICAgICAgfVxuICAgICAgcCsrOyBuLS07XG4gICAgfVxuXG4gICAgLy8gcmVzdG9yZVxuICAgIHoudG90YWxfaW4gKz0gcC16Lm5leHRfaW5faW5kZXg7XG4gICAgei5uZXh0X2luX2luZGV4ID0gcDtcbiAgICB6LmF2YWlsX2luID0gbjtcbiAgICB6LmlzdGF0ZS5tYXJrZXIgPSBtO1xuXG4gICAgLy8gcmV0dXJuIG5vIGpveSBvciBzZXQgdXAgdG8gcmVzdGFydCBvbiBhIG5ldyBibG9ja1xuICAgIGlmKG0gIT0gNCl7XG4gICAgICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuICAgIH1cbiAgICByPXoudG90YWxfaW47ICB3PXoudG90YWxfb3V0O1xuICAgIHRoaXMuaW5mbGF0ZVJlc2V0KHopO1xuICAgIHoudG90YWxfaW49cjsgIHoudG90YWxfb3V0ID0gdztcbiAgICB6LmlzdGF0ZS5tb2RlID0gQkxPQ0tTO1xuICAgIHJldHVybiBaX09LO1xufVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiBpbmZsYXRlIGlzIGN1cnJlbnRseSBhdCB0aGUgZW5kIG9mIGEgYmxvY2sgZ2VuZXJhdGVkXG4gIC8vIGJ5IFpfU1lOQ19GTFVTSCBvciBaX0ZVTExfRkxVU0guIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCBieSBvbmUgUFBQXG4gIC8vIGltcGxlbWVudGF0aW9uIHRvIHByb3ZpZGUgYW4gYWRkaXRpb25hbCBzYWZldHkgY2hlY2suIFBQUCB1c2VzIFpfU1lOQ19GTFVTSFxuICAvLyBidXQgcmVtb3ZlcyB0aGUgbGVuZ3RoIGJ5dGVzIG9mIHRoZSByZXN1bHRpbmcgZW1wdHkgc3RvcmVkIGJsb2NrLiBXaGVuXG4gIC8vIGRlY29tcHJlc3NpbmcsIFBQUCBjaGVja3MgdGhhdCBhdCB0aGUgZW5kIG9mIGlucHV0IHBhY2tldCwgaW5mbGF0ZSBpc1xuICAvLyB3YWl0aW5nIGZvciB0aGVzZSBsZW5ndGggYnl0ZXMuXG5JbmZsYXRlLnByb3RvdHlwZS5pbmZsYXRlU3luY1BvaW50ID0gZnVuY3Rpb24oeil7XG4gICAgaWYoeiA9PSBudWxsIHx8IHouaXN0YXRlID09IG51bGwgfHwgei5pc3RhdGUuYmxvY2tzID09IG51bGwpXG4gICAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgcmV0dXJuIHouaXN0YXRlLmJsb2Nrcy5zeW5jX3BvaW50KCk7XG59XG5cblxuLy9cbi8vIEluZkJsb2Nrcy5qYXZhXG4vL1xuXG52YXIgSU5GQkxPQ0tTX0JPUkRFUiA9IFsxNiwgMTcsIDE4LCAwLCA4LCA3LCA5LCA2LCAxMCwgNSwgMTEsIDQsIDEyLCAzLCAxMywgMiwgMTQsIDEsIDE1XTtcblxuZnVuY3Rpb24gSW5mQmxvY2tzKHosIGNoZWNrZm4sIHcpIHtcbiAgICB0aGlzLmh1ZnRzPW5ldyBJbnQzMkFycmF5KE1BTlkqMyk7XG4gICAgdGhpcy53aW5kb3c9bmV3IFVpbnQ4QXJyYXkodyk7XG4gICAgdGhpcy5lbmQ9dztcbiAgICB0aGlzLmNoZWNrZm4gPSBjaGVja2ZuO1xuICAgIHRoaXMubW9kZSA9IElCX1RZUEU7XG4gICAgdGhpcy5yZXNldCh6LCBudWxsKTtcblxuICAgIHRoaXMubGVmdCA9IDA7ICAgICAgICAgICAgLy8gaWYgU1RPUkVELCBieXRlcyBsZWZ0IHRvIGNvcHkgXG5cbiAgICB0aGlzLnRhYmxlID0gMDsgICAgICAgICAgIC8vIHRhYmxlIGxlbmd0aHMgKDE0IGJpdHMpIFxuICAgIHRoaXMuaW5kZXggPSAwOyAgICAgICAgICAgLy8gaW5kZXggaW50byBibGVucyAob3IgYm9yZGVyKSBcbiAgICB0aGlzLmJsZW5zID0gbnVsbDsgICAgICAgICAvLyBiaXQgbGVuZ3RocyBvZiBjb2RlcyBcbiAgICB0aGlzLmJiPW5ldyBJbnQzMkFycmF5KDEpOyAvLyBiaXQgbGVuZ3RoIHRyZWUgZGVwdGggXG4gICAgdGhpcy50Yj1uZXcgSW50MzJBcnJheSgxKTsgLy8gYml0IGxlbmd0aCBkZWNvZGluZyB0cmVlIFxuXG4gICAgdGhpcy5jb2RlcyA9IG5ldyBJbmZDb2RlcygpO1xuXG4gICAgdGhpcy5sYXN0ID0gMDsgICAgICAgICAgICAvLyB0cnVlIGlmIHRoaXMgYmxvY2sgaXMgdGhlIGxhc3QgYmxvY2sgXG5cbiAgLy8gbW9kZSBpbmRlcGVuZGVudCBpbmZvcm1hdGlvbiBcbiAgICB0aGlzLmJpdGsgPSAwOyAgICAgICAgICAgIC8vIGJpdHMgaW4gYml0IGJ1ZmZlciBcbiAgICB0aGlzLmJpdGIgPSAwOyAgICAgICAgICAgIC8vIGJpdCBidWZmZXIgXG4gICAgdGhpcy5yZWFkID0gMDsgICAgICAgICAgICAvLyB3aW5kb3cgcmVhZCBwb2ludGVyIFxuICAgIHRoaXMud3JpdGUgPSAwOyAgICAgICAgICAgLy8gd2luZG93IHdyaXRlIHBvaW50ZXIgXG4gICAgdGhpcy5jaGVjayA9IDA7ICAgICAgICAgIC8vIGNoZWNrIG9uIG91dHB1dCBcblxuICAgIHRoaXMuaW5mdHJlZT1uZXcgSW5mVHJlZSgpO1xufVxuXG5cblxuXG5JbmZCbG9ja3MucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24oeiwgYyl7XG4gICAgaWYoYykgY1swXT10aGlzLmNoZWNrO1xuICAgIGlmKHRoaXMubW9kZT09SUJfQ09ERVMpe1xuICAgICAgdGhpcy5jb2Rlcy5mcmVlKHopO1xuICAgIH1cbiAgICB0aGlzLm1vZGU9SUJfVFlQRTtcbiAgICB0aGlzLmJpdGs9MDtcbiAgICB0aGlzLmJpdGI9MDtcbiAgICB0aGlzLnJlYWQ9dGhpcy53cml0ZT0wO1xuXG4gICAgaWYodGhpcy5jaGVja2ZuKVxuICAgICAgei5hZGxlcj10aGlzLmNoZWNrPXouX2FkbGVyLmFkbGVyMzIoMCwgbnVsbCwgMCwgMCk7XG4gIH1cblxuIEluZkJsb2Nrcy5wcm90b3R5cGUucHJvYyA9IGZ1bmN0aW9uKHosIHIpe1xuICAgIHZhciB0OyAgICAgICAgICAgICAgLy8gdGVtcG9yYXJ5IHN0b3JhZ2VcbiAgICB2YXIgYjsgICAgICAgICAgICAgIC8vIGJpdCBidWZmZXJcbiAgICB2YXIgazsgICAgICAgICAgICAgIC8vIGJpdHMgaW4gYml0IGJ1ZmZlclxuICAgIHZhciBwOyAgICAgICAgICAgICAgLy8gaW5wdXQgZGF0YSBwb2ludGVyXG4gICAgdmFyIG47ICAgICAgICAgICAgICAvLyBieXRlcyBhdmFpbGFibGUgdGhlcmVcbiAgICB2YXIgcTsgICAgICAgICAgICAgIC8vIG91dHB1dCB3aW5kb3cgd3JpdGUgcG9pbnRlclxuICAgIHZhciBtOyAgICAgICAgICAgICAgLy8gYnl0ZXMgdG8gZW5kIG9mIHdpbmRvdyBvciByZWFkIHBvaW50ZXJcblxuICAgIC8vIGNvcHkgaW5wdXQvb3V0cHV0IGluZm9ybWF0aW9uIHRvIGxvY2FscyAoVVBEQVRFIG1hY3JvIHJlc3RvcmVzKVxuICAgIHtwPXoubmV4dF9pbl9pbmRleDtuPXouYXZhaWxfaW47Yj10aGlzLmJpdGI7az10aGlzLmJpdGs7fVxuICAgIHtxPXRoaXMud3JpdGU7bT0ocTx0aGlzLnJlYWQgPyB0aGlzLnJlYWQtcS0xIDogdGhpcy5lbmQtcSk7fVxuXG4gICAgLy8gcHJvY2VzcyBpbnB1dCBiYXNlZCBvbiBjdXJyZW50IHN0YXRlXG4gICAgd2hpbGUodHJ1ZSl7XG4gICAgICBzd2l0Y2ggKHRoaXMubW9kZSl7XG4gICAgICBjYXNlIElCX1RZUEU6XG5cblx0d2hpbGUoazwoMykpe1xuXHQgIGlmKG4hPTApe1xuXHQgICAgcj1aX09LO1xuXHQgIH1cblx0ICBlbHNle1xuXHQgICAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICAgIHouYXZhaWxfaW49bjtcblx0ICAgIHoudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgdGhpcy53cml0ZT1xO1xuXHQgICAgcmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgIH07XG5cdCAgbi0tO1xuXHQgIGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztcblx0ICBrKz04O1xuXHR9XG5cdHQgPSAoYiAmIDcpO1xuXHR0aGlzLmxhc3QgPSB0ICYgMTtcblxuXHRzd2l0Y2ggKHQgPj4+IDEpe1xuICAgICAgICBjYXNlIDA6ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHN0b3JlZCBcbiAgICAgICAgICB7Yj4+Pj0oMyk7ay09KDMpO31cbiAgICAgICAgICB0ID0gayAmIDc7ICAgICAgICAgICAgICAgICAgICAvLyBnbyB0byBieXRlIGJvdW5kYXJ5XG5cbiAgICAgICAgICB7Yj4+Pj0odCk7ay09KHQpO31cbiAgICAgICAgICB0aGlzLm1vZGUgPSBJQl9MRU5TOyAgICAgICAgICAgICAgICAgIC8vIGdldCBsZW5ndGggb2Ygc3RvcmVkIGJsb2NrXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTogICAgICAgICAgICAgICAgICAgICAgICAgLy8gZml4ZWRcbiAgICAgICAgICB7XG4gICAgICAgICAgICAgIHZhciBibD1uZXcgSW50MzJBcnJheSgxKTtcblx0ICAgICAgdmFyIGJkPW5ldyBJbnQzMkFycmF5KDEpO1xuICAgICAgICAgICAgICB2YXIgdGw9W107XG5cdCAgICAgIHZhciB0ZD1bXTtcblxuXHQgICAgICBpbmZsYXRlX3RyZWVzX2ZpeGVkKGJsLCBiZCwgdGwsIHRkLCB6KTtcbiAgICAgICAgICAgICAgdGhpcy5jb2Rlcy5pbml0KGJsWzBdLCBiZFswXSwgdGxbMF0sIDAsIHRkWzBdLCAwLCB6KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB7Yj4+Pj0oMyk7ay09KDMpO31cblxuICAgICAgICAgIHRoaXMubW9kZSA9IElCX0NPREVTO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGR5bmFtaWNcblxuICAgICAgICAgIHtiPj4+PSgzKTtrLT0oMyk7fVxuXG4gICAgICAgICAgdGhpcy5tb2RlID0gSUJfVEFCTEU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMzogICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWxsZWdhbFxuXG4gICAgICAgICAge2I+Pj49KDMpO2stPSgzKTt9XG4gICAgICAgICAgdGhpcy5tb2RlID0gQkFEO1xuICAgICAgICAgIHoubXNnID0gXCJpbnZhbGlkIGJsb2NrIHR5cGVcIjtcbiAgICAgICAgICByID0gWl9EQVRBX0VSUk9SO1xuXG5cdCAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICB6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgdGhpcy53cml0ZT1xO1xuXHQgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0fVxuXHRicmVhaztcbiAgICAgIGNhc2UgSUJfTEVOUzpcblx0d2hpbGUoazwoMzIpKXtcblx0ICBpZihuIT0wKXtcblx0ICAgIHI9Wl9PSztcblx0ICB9XG5cdCAgZWxzZXtcblx0ICAgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgICB6LmF2YWlsX2luPW47XG5cdCAgICB6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgIHRoaXMud3JpdGU9cTtcblx0ICAgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICB9O1xuXHQgIG4tLTtcblx0ICBifD0oei5uZXh0X2luW3ArK10mMHhmZik8PGs7XG5cdCAgays9ODtcblx0fVxuXG5cdGlmICgoKCh+YikgPj4+IDE2KSAmIDB4ZmZmZikgIT0gKGIgJiAweGZmZmYpKXtcblx0ICB0aGlzLm1vZGUgPSBCQUQ7XG5cdCAgei5tc2cgPSBcImludmFsaWQgc3RvcmVkIGJsb2NrIGxlbmd0aHNcIjtcblx0ICByID0gWl9EQVRBX0VSUk9SO1xuXG5cdCAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICB6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgdGhpcy53cml0ZT1xO1xuXHQgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0fVxuXHR0aGlzLmxlZnQgPSAoYiAmIDB4ZmZmZik7XG5cdGIgPSBrID0gMDsgICAgICAgICAgICAgICAgICAgICAgIC8vIGR1bXAgYml0c1xuXHR0aGlzLm1vZGUgPSB0aGlzLmxlZnQhPTAgPyBJQl9TVE9SRUQgOiAodGhpcy5sYXN0IT0wID8gSUJfRFJZIDogSUJfVFlQRSk7XG5cdGJyZWFrO1xuICAgICAgY2FzZSBJQl9TVE9SRUQ6XG5cdGlmIChuID09IDApe1xuXHQgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgIHdyaXRlPXE7XG5cdCAgcmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHR9XG5cblx0aWYobT09MCl7XG5cdCAgaWYocT09ZW5kJiZyZWFkIT0wKXtcblx0ICAgIHE9MDsgbT0ocTx0aGlzLnJlYWQgPyB0aGlzLnJlYWQtcS0xIDogdGhpcy5lbmQtcSk7XG5cdCAgfVxuXHQgIGlmKG09PTApe1xuXHQgICAgdGhpcy53cml0ZT1xOyBcblx0ICAgIHI9dGhpcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdCAgICBxPXRoaXMud3JpdGU7IG0gPSAocSA8IHRoaXMucmVhZCA/IHRoaXMucmVhZC1xLTEgOiB0aGlzLmVuZC1xKTtcblx0ICAgIGlmKHE9PXRoaXMuZW5kICYmIHRoaXMucmVhZCAhPSAwKXtcblx0ICAgICAgcT0wOyBtID0gKHEgPCB0aGlzLnJlYWQgPyB0aGlzLnJlYWQtcS0xIDogdGhpcy5lbmQtcSk7XG5cdCAgICB9XG5cdCAgICBpZihtPT0wKXtcblx0ICAgICAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICAgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgICB0aGlzLndyaXRlPXE7XG5cdCAgICAgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICAgIH1cblx0ICB9XG5cdH1cblx0cj1aX09LO1xuXG5cdHQgPSB0aGlzLmxlZnQ7XG5cdGlmKHQ+bikgdCA9IG47XG5cdGlmKHQ+bSkgdCA9IG07XG5cdGFycmF5Q29weSh6Lm5leHRfaW4sIHAsIHRoaXMud2luZG93LCBxLCB0KTtcblx0cCArPSB0OyAgbiAtPSB0O1xuXHRxICs9IHQ7ICBtIC09IHQ7XG5cdGlmICgodGhpcy5sZWZ0IC09IHQpICE9IDApXG5cdCAgYnJlYWs7XG5cdHRoaXMubW9kZSA9ICh0aGlzLmxhc3QgIT0gMCA/IElCX0RSWSA6IElCX1RZUEUpO1xuXHRicmVhaztcbiAgICAgIGNhc2UgSUJfVEFCTEU6XG5cblx0d2hpbGUoazwoMTQpKXtcblx0ICBpZihuIT0wKXtcblx0ICAgIHI9Wl9PSztcblx0ICB9XG5cdCAgZWxzZXtcblx0ICAgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgICB6LmF2YWlsX2luPW47XG5cdCAgICB6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgIHRoaXMud3JpdGU9cTtcblx0ICAgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICB9O1xuXHQgIG4tLTtcblx0ICBifD0oei5uZXh0X2luW3ArK10mMHhmZik8PGs7XG5cdCAgays9ODtcblx0fVxuXG5cdHRoaXMudGFibGUgPSB0ID0gKGIgJiAweDNmZmYpO1xuXHRpZiAoKHQgJiAweDFmKSA+IDI5IHx8ICgodCA+PiA1KSAmIDB4MWYpID4gMjkpXG5cdCAge1xuXHQgICAgdGhpcy5tb2RlID0gSUJfQkFEO1xuXHQgICAgei5tc2cgPSBcInRvbyBtYW55IGxlbmd0aCBvciBkaXN0YW5jZSBzeW1ib2xzXCI7XG5cdCAgICByID0gWl9EQVRBX0VSUk9SO1xuXG5cdCAgICB0aGlzLmJpdGI9YjsgdGhpcy5iaXRrPWs7IFxuXHQgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgdGhpcy53cml0ZT1xO1xuXHQgICAgcmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgIH1cblx0dCA9IDI1OCArICh0ICYgMHgxZikgKyAoKHQgPj4gNSkgJiAweDFmKTtcblx0aWYodGhpcy5ibGVucz09bnVsbCB8fCB0aGlzLmJsZW5zLmxlbmd0aDx0KXtcblx0ICAgIHRoaXMuYmxlbnM9bmV3IEludDMyQXJyYXkodCk7XG5cdH1cblx0ZWxzZXtcblx0ICBmb3IodmFyIGk9MDsgaTx0OyBpKyspe1xuICAgICAgICAgICAgICB0aGlzLmJsZW5zW2ldPTA7XG4gICAgICAgICAgfVxuXHR9XG5cblx0e2I+Pj49KDE0KTtrLT0oMTQpO31cblxuXHR0aGlzLmluZGV4ID0gMDtcblx0bW9kZSA9IElCX0JUUkVFO1xuICAgICAgY2FzZSBJQl9CVFJFRTpcblx0d2hpbGUgKHRoaXMuaW5kZXggPCA0ICsgKHRoaXMudGFibGUgPj4+IDEwKSl7XG5cdCAgd2hpbGUoazwoMykpe1xuXHQgICAgaWYobiE9MCl7XG5cdCAgICAgIHI9Wl9PSztcblx0ICAgIH1cblx0ICAgIGVsc2V7XG5cdCAgICAgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgICAgIHouYXZhaWxfaW49bjtcblx0ICAgICAgei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgICAgIHRoaXMud3JpdGU9cTtcblx0ICAgICAgcmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgICAgfTtcblx0ICAgIG4tLTtcblx0ICAgIGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztcblx0ICAgIGsrPTg7XG5cdCAgfVxuXG5cdCAgdGhpcy5ibGVuc1tJTkZCTE9DS1NfQk9SREVSW3RoaXMuaW5kZXgrK11dID0gYiY3O1xuXG5cdCAge2I+Pj49KDMpO2stPSgzKTt9XG5cdH1cblxuXHR3aGlsZSh0aGlzLmluZGV4IDwgMTkpe1xuXHQgIHRoaXMuYmxlbnNbSU5GQkxPQ0tTX0JPUkRFUlt0aGlzLmluZGV4KytdXSA9IDA7XG5cdH1cblxuXHR0aGlzLmJiWzBdID0gNztcblx0dCA9IHRoaXMuaW5mdHJlZS5pbmZsYXRlX3RyZWVzX2JpdHModGhpcy5ibGVucywgdGhpcy5iYiwgdGhpcy50YiwgdGhpcy5odWZ0cywgeik7XG5cdGlmICh0ICE9IFpfT0spe1xuXHQgIHIgPSB0O1xuXHQgIGlmIChyID09IFpfREFUQV9FUlJPUil7XG5cdCAgICB0aGlzLmJsZW5zPW51bGw7XG5cdCAgICB0aGlzLm1vZGUgPSBJQl9CQUQ7XG5cdCAgfVxuXG5cdCAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICB6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgd3JpdGU9cTtcblx0ICByZXR1cm4gdGhpcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdH1cblxuXHR0aGlzLmluZGV4ID0gMDtcblx0dGhpcy5tb2RlID0gSUJfRFRSRUU7XG4gICAgICBjYXNlIElCX0RUUkVFOlxuXHR3aGlsZSAodHJ1ZSl7XG5cdCAgdCA9IHRoaXMudGFibGU7XG5cdCAgaWYoISh0aGlzLmluZGV4IDwgMjU4ICsgKHQgJiAweDFmKSArICgodCA+PiA1KSAmIDB4MWYpKSl7XG5cdCAgICBicmVhaztcblx0ICB9XG5cblx0ICB2YXIgaDsgLy9pbnRbXVxuXHQgIHZhciBpLCBqLCBjO1xuXG5cdCAgdCA9IHRoaXMuYmJbMF07XG5cblx0ICB3aGlsZShrPCh0KSl7XG5cdCAgICBpZihuIT0wKXtcblx0ICAgICAgcj1aX09LO1xuXHQgICAgfVxuXHQgICAgZWxzZXtcblx0ICAgICAgdGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ICAgICAgei5hdmFpbF9pbj1uO1xuXHQgICAgICB6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgICAgdGhpcy53cml0ZT1xO1xuXHQgICAgICByZXR1cm4gdGhpcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdCAgICB9O1xuXHQgICAgbi0tO1xuXHQgICAgYnw9KHoubmV4dF9pbltwKytdJjB4ZmYpPDxrO1xuXHQgICAgays9ODtcblx0ICB9XG5cbi8vXHQgIGlmICh0aGlzLnRiWzBdPT0tMSl7XG4vLyAgICAgICAgICAgIGRsb2coXCJudWxsLi4uXCIpO1xuLy9cdCAgfVxuXG5cdCAgdD10aGlzLmh1ZnRzWyh0aGlzLnRiWzBdKyhiICYgaW5mbGF0ZV9tYXNrW3RdKSkqMysxXTtcblx0ICBjPXRoaXMuaHVmdHNbKHRoaXMudGJbMF0rKGIgJiBpbmZsYXRlX21hc2tbdF0pKSozKzJdO1xuXG5cdCAgaWYgKGMgPCAxNil7XG5cdCAgICBiPj4+PSh0KTtrLT0odCk7XG5cdCAgICB0aGlzLmJsZW5zW3RoaXMuaW5kZXgrK10gPSBjO1xuXHQgIH1cblx0ICBlbHNlIHsgLy8gYyA9PSAxNi4uMThcblx0ICAgIGkgPSBjID09IDE4ID8gNyA6IGMgLSAxNDtcblx0ICAgIGogPSBjID09IDE4ID8gMTEgOiAzO1xuXG5cdCAgICB3aGlsZShrPCh0K2kpKXtcblx0ICAgICAgaWYobiE9MCl7XG5cdFx0cj1aX09LO1xuXHQgICAgICB9XG5cdCAgICAgIGVsc2V7XG5cdFx0dGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0XHR6LmF2YWlsX2luPW47XG5cdFx0ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdFx0dGhpcy53cml0ZT1xO1xuXHRcdHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICAgICAgfTtcblx0ICAgICAgbi0tO1xuXHQgICAgICBifD0oei5uZXh0X2luW3ArK10mMHhmZik8PGs7XG5cdCAgICAgIGsrPTg7XG5cdCAgICB9XG5cblx0ICAgIGI+Pj49KHQpO2stPSh0KTtcblxuXHQgICAgaiArPSAoYiAmIGluZmxhdGVfbWFza1tpXSk7XG5cblx0ICAgIGI+Pj49KGkpO2stPShpKTtcblxuXHQgICAgaSA9IHRoaXMuaW5kZXg7XG5cdCAgICB0ID0gdGhpcy50YWJsZTtcblx0ICAgIGlmIChpICsgaiA+IDI1OCArICh0ICYgMHgxZikgKyAoKHQgPj4gNSkgJiAweDFmKSB8fFxuXHRcdChjID09IDE2ICYmIGkgPCAxKSl7XG5cdCAgICAgIHRoaXMuYmxlbnM9bnVsbDtcblx0ICAgICAgdGhpcy5tb2RlID0gSUJfQkFEO1xuXHQgICAgICB6Lm1zZyA9IFwiaW52YWxpZCBiaXQgbGVuZ3RoIHJlcGVhdFwiO1xuXHQgICAgICByID0gWl9EQVRBX0VSUk9SO1xuXG5cdCAgICAgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgICAgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgICAgdGhpcy53cml0ZT1xO1xuXHQgICAgICByZXR1cm4gdGhpcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdCAgICB9XG5cblx0ICAgIGMgPSBjID09IDE2ID8gdGhpcy5ibGVuc1tpLTFdIDogMDtcblx0ICAgIGRve1xuXHQgICAgICB0aGlzLmJsZW5zW2krK10gPSBjO1xuXHQgICAgfVxuXHQgICAgd2hpbGUgKC0taiE9MCk7XG5cdCAgICB0aGlzLmluZGV4ID0gaTtcblx0ICB9XG5cdH1cblxuXHR0aGlzLnRiWzBdPS0xO1xuXHR7XG5cdCAgICB2YXIgYmw9bmV3IEludDMyQXJyYXkoMSk7XG5cdCAgICB2YXIgYmQ9bmV3IEludDMyQXJyYXkoMSk7XG5cdCAgICB2YXIgdGw9bmV3IEludDMyQXJyYXkoMSk7XG5cdCAgICB2YXIgdGQ9bmV3IEludDMyQXJyYXkoMSk7XG5cdCAgICBibFswXSA9IDk7ICAgICAgICAgLy8gbXVzdCBiZSA8PSA5IGZvciBsb29rYWhlYWQgYXNzdW1wdGlvbnNcblx0ICAgIGJkWzBdID0gNjsgICAgICAgICAvLyBtdXN0IGJlIDw9IDkgZm9yIGxvb2thaGVhZCBhc3N1bXB0aW9uc1xuXG5cdCAgICB0ID0gdGhpcy50YWJsZTtcblx0ICAgIHQgPSB0aGlzLmluZnRyZWUuaW5mbGF0ZV90cmVlc19keW5hbWljKDI1NyArICh0ICYgMHgxZiksIFxuXHRcdFx0XHRcdCAgICAgIDEgKyAoKHQgPj4gNSkgJiAweDFmKSxcblx0XHRcdFx0XHQgICAgICB0aGlzLmJsZW5zLCBibCwgYmQsIHRsLCB0ZCwgdGhpcy5odWZ0cywgeik7XG5cblx0ICAgIGlmICh0ICE9IFpfT0spe1xuXHQgICAgICAgIGlmICh0ID09IFpfREFUQV9FUlJPUil7XG5cdCAgICAgICAgICAgIHRoaXMuYmxlbnM9bnVsbDtcblx0ICAgICAgICAgICAgdGhpcy5tb2RlID0gQkFEO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByID0gdDtcblxuXHQgICAgICAgIHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdCAgICAgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgICAgIHRoaXMud3JpdGU9cTtcblx0ICAgICAgICByZXR1cm4gdGhpcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdCAgICB9XG5cdCAgICB0aGlzLmNvZGVzLmluaXQoYmxbMF0sIGJkWzBdLCB0aGlzLmh1ZnRzLCB0bFswXSwgdGhpcy5odWZ0cywgdGRbMF0sIHopO1xuXHR9XG5cdHRoaXMubW9kZSA9IElCX0NPREVTO1xuICAgICAgY2FzZSBJQl9DT0RFUzpcblx0dGhpcy5iaXRiPWI7IHRoaXMuYml0az1rO1xuXHR6LmF2YWlsX2luPW47IHoudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHR0aGlzLndyaXRlPXE7XG5cblx0aWYgKChyID0gdGhpcy5jb2Rlcy5wcm9jKHRoaXMsIHosIHIpKSAhPSBaX1NUUkVBTV9FTkQpe1xuXHQgIHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdH1cblx0ciA9IFpfT0s7XG5cdHRoaXMuY29kZXMuZnJlZSh6KTtcblxuXHRwPXoubmV4dF9pbl9pbmRleDsgbj16LmF2YWlsX2luO2I9dGhpcy5iaXRiO2s9dGhpcy5iaXRrO1xuXHRxPXRoaXMud3JpdGU7bSA9IChxIDwgdGhpcy5yZWFkID8gdGhpcy5yZWFkLXEtMSA6IHRoaXMuZW5kLXEpO1xuXG5cdGlmICh0aGlzLmxhc3Q9PTApe1xuXHQgIHRoaXMubW9kZSA9IElCX1RZUEU7XG5cdCAgYnJlYWs7XG5cdH1cblx0dGhpcy5tb2RlID0gSUJfRFJZO1xuICAgICAgY2FzZSBJQl9EUlk6XG5cdHRoaXMud3JpdGU9cTsgXG5cdHIgPSB0aGlzLmluZmxhdGVfZmx1c2goeiwgcik7IFxuXHRxPXRoaXMud3JpdGU7IG0gPSAocSA8IHRoaXMucmVhZCA/IHRoaXMucmVhZC1xLTEgOiB0aGlzLmVuZC1xKTtcblx0aWYgKHRoaXMucmVhZCAhPSB0aGlzLndyaXRlKXtcblx0ICB0aGlzLmJpdGI9YjsgdGhpcy5iaXRrPWs7IFxuXHQgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICB0aGlzLndyaXRlPXE7XG5cdCAgcmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0fVxuXHRtb2RlID0gRE9ORTtcbiAgICAgIGNhc2UgSUJfRE9ORTpcblx0ciA9IFpfU1RSRUFNX0VORDtcblxuXHR0aGlzLmJpdGI9YjsgdGhpcy5iaXRrPWs7IFxuXHR6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdHRoaXMud3JpdGU9cTtcblx0cmV0dXJuIHRoaXMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcbiAgICAgIGNhc2UgSUJfQkFEOlxuXHRyID0gWl9EQVRBX0VSUk9SO1xuXG5cdHRoaXMuYml0Yj1iOyB0aGlzLmJpdGs9azsgXG5cdHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0dGhpcy53cml0ZT1xO1xuXHRyZXR1cm4gdGhpcy5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXG4gICAgICBkZWZhdWx0OlxuXHRyID0gWl9TVFJFQU1fRVJST1I7XG5cblx0dGhpcy5iaXRiPWI7IHRoaXMuYml0az1rOyBcblx0ei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHR0aGlzLndyaXRlPXE7XG5cdHJldHVybiB0aGlzLmluZmxhdGVfZmx1c2goeiwgcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbkluZkJsb2Nrcy5wcm90b3R5cGUuZnJlZSA9IGZ1bmN0aW9uKHope1xuICAgIHRoaXMucmVzZXQoeiwgbnVsbCk7XG4gICAgdGhpcy53aW5kb3c9bnVsbDtcbiAgICB0aGlzLmh1ZnRzPW51bGw7XG59XG5cbkluZkJsb2Nrcy5wcm90b3R5cGUuc2V0X2RpY3Rpb25hcnkgPSBmdW5jdGlvbihkLCBzdGFydCwgbil7XG4gICAgYXJyYXlDb3B5KGQsIHN0YXJ0LCB3aW5kb3csIDAsIG4pO1xuICAgIHRoaXMucmVhZCA9IHRoaXMud3JpdGUgPSBuO1xufVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiBpbmZsYXRlIGlzIGN1cnJlbnRseSBhdCB0aGUgZW5kIG9mIGEgYmxvY2sgZ2VuZXJhdGVkXG4gIC8vIGJ5IFpfU1lOQ19GTFVTSCBvciBaX0ZVTExfRkxVU0guIFxuSW5mQmxvY2tzLnByb3RvdHlwZS5zeW5jX3BvaW50ID0gZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gdGhpcy5tb2RlID09IElCX0xFTlM7XG59XG5cbiAgLy8gY29weSBhcyBtdWNoIGFzIHBvc3NpYmxlIGZyb20gdGhlIHNsaWRpbmcgd2luZG93IHRvIHRoZSBvdXRwdXQgYXJlYVxuSW5mQmxvY2tzLnByb3RvdHlwZS5pbmZsYXRlX2ZsdXNoID0gZnVuY3Rpb24oeiwgcil7XG4gICAgdmFyIG47XG4gICAgdmFyIHA7XG4gICAgdmFyIHE7XG5cbiAgICAvLyBsb2NhbCBjb3BpZXMgb2Ygc291cmNlIGFuZCBkZXN0aW5hdGlvbiBwb2ludGVyc1xuICAgIHAgPSB6Lm5leHRfb3V0X2luZGV4O1xuICAgIHEgPSB0aGlzLnJlYWQ7XG5cbiAgICAvLyBjb21wdXRlIG51bWJlciBvZiBieXRlcyB0byBjb3B5IGFzIGZhciBhcyBlbmQgb2Ygd2luZG93XG4gICAgbiA9ICgocSA8PSB0aGlzLndyaXRlID8gdGhpcy53cml0ZSA6IHRoaXMuZW5kKSAtIHEpO1xuICAgIGlmIChuID4gei5hdmFpbF9vdXQpIG4gPSB6LmF2YWlsX291dDtcbiAgICBpZiAobiE9MCAmJiByID09IFpfQlVGX0VSUk9SKSByID0gWl9PSztcblxuICAgIC8vIHVwZGF0ZSBjb3VudGVyc1xuICAgIHouYXZhaWxfb3V0IC09IG47XG4gICAgei50b3RhbF9vdXQgKz0gbjtcblxuICAgIC8vIHVwZGF0ZSBjaGVjayBpbmZvcm1hdGlvblxuICAgIGlmKHRoaXMuY2hlY2tmbiAhPSBudWxsKVxuICAgICAgei5hZGxlcj10aGlzLmNoZWNrPXouX2FkbGVyLmFkbGVyMzIodGhpcy5jaGVjaywgdGhpcy53aW5kb3csIHEsIG4pO1xuXG4gICAgLy8gY29weSBhcyBmYXIgYXMgZW5kIG9mIHdpbmRvd1xuICAgIGFycmF5Q29weSh0aGlzLndpbmRvdywgcSwgei5uZXh0X291dCwgcCwgbik7XG4gICAgcCArPSBuO1xuICAgIHEgKz0gbjtcblxuICAgIC8vIHNlZSBpZiBtb3JlIHRvIGNvcHkgYXQgYmVnaW5uaW5nIG9mIHdpbmRvd1xuICAgIGlmIChxID09IHRoaXMuZW5kKXtcbiAgICAgIC8vIHdyYXAgcG9pbnRlcnNcbiAgICAgIHEgPSAwO1xuICAgICAgaWYgKHRoaXMud3JpdGUgPT0gdGhpcy5lbmQpXG4gICAgICAgIHRoaXMud3JpdGUgPSAwO1xuXG4gICAgICAvLyBjb21wdXRlIGJ5dGVzIHRvIGNvcHlcbiAgICAgIG4gPSB0aGlzLndyaXRlIC0gcTtcbiAgICAgIGlmIChuID4gei5hdmFpbF9vdXQpIG4gPSB6LmF2YWlsX291dDtcbiAgICAgIGlmIChuIT0wICYmIHIgPT0gWl9CVUZfRVJST1IpIHIgPSBaX09LO1xuXG4gICAgICAvLyB1cGRhdGUgY291bnRlcnNcbiAgICAgIHouYXZhaWxfb3V0IC09IG47XG4gICAgICB6LnRvdGFsX291dCArPSBuO1xuXG4gICAgICAvLyB1cGRhdGUgY2hlY2sgaW5mb3JtYXRpb25cbiAgICAgIGlmKHRoaXMuY2hlY2tmbiAhPSBudWxsKVxuXHR6LmFkbGVyPXRoaXMuY2hlY2s9ei5fYWRsZXIuYWRsZXIzMih0aGlzLmNoZWNrLCB0aGlzLndpbmRvdywgcSwgbik7XG5cbiAgICAgIC8vIGNvcHlcbiAgICAgIGFycmF5Q29weSh0aGlzLndpbmRvdywgcSwgei5uZXh0X291dCwgcCwgbik7XG4gICAgICBwICs9IG47XG4gICAgICBxICs9IG47XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlIHBvaW50ZXJzXG4gICAgei5uZXh0X291dF9pbmRleCA9IHA7XG4gICAgdGhpcy5yZWFkID0gcTtcblxuICAgIC8vIGRvbmVcbiAgICByZXR1cm4gcjtcbiAgfVxuXG4vL1xuLy8gSW5mQ29kZXMuamF2YVxuLy9cblxudmFyIElDX1NUQVJUPTA7ICAvLyB4OiBzZXQgdXAgZm9yIExFTlxudmFyIElDX0xFTj0xOyAgICAvLyBpOiBnZXQgbGVuZ3RoL2xpdGVyYWwvZW9iIG5leHRcbnZhciBJQ19MRU5FWFQ9MjsgLy8gaTogZ2V0dGluZyBsZW5ndGggZXh0cmEgKGhhdmUgYmFzZSlcbnZhciBJQ19ESVNUPTM7ICAgLy8gaTogZ2V0IGRpc3RhbmNlIG5leHRcbnZhciBJQ19ESVNURVhUPTQ7Ly8gaTogZ2V0dGluZyBkaXN0YW5jZSBleHRyYVxudmFyIElDX0NPUFk9NTsgICAvLyBvOiBjb3B5aW5nIGJ5dGVzIGluIHdpbmRvdywgd2FpdGluZyBmb3Igc3BhY2VcbnZhciBJQ19MSVQ9NjsgICAgLy8gbzogZ290IGxpdGVyYWwsIHdhaXRpbmcgZm9yIG91dHB1dCBzcGFjZVxudmFyIElDX1dBU0g9NzsgICAvLyBvOiBnb3QgZW9iLCBwb3NzaWJseSBzdGlsbCBvdXRwdXQgd2FpdGluZ1xudmFyIElDX0VORD04OyAgICAvLyB4OiBnb3QgZW9iIGFuZCBhbGwgZGF0YSBmbHVzaGVkXG52YXIgSUNfQkFEQ09ERT05Oy8vIHg6IGdvdCBlcnJvclxuXG5mdW5jdGlvbiBJbmZDb2RlcygpIHtcbn1cblxuSW5mQ29kZXMucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihibCwgYmQsIHRsLCB0bF9pbmRleCwgdGQsIHRkX2luZGV4LCB6KSB7XG4gICAgdGhpcy5tb2RlPUlDX1NUQVJUO1xuICAgIHRoaXMubGJpdHM9Ymw7XG4gICAgdGhpcy5kYml0cz1iZDtcbiAgICB0aGlzLmx0cmVlPXRsO1xuICAgIHRoaXMubHRyZWVfaW5kZXg9dGxfaW5kZXg7XG4gICAgdGhpcy5kdHJlZSA9IHRkO1xuICAgIHRoaXMuZHRyZWVfaW5kZXg9dGRfaW5kZXg7XG4gICAgdGhpcy50cmVlPW51bGw7XG59XG5cbkluZkNvZGVzLnByb3RvdHlwZS5wcm9jID0gZnVuY3Rpb24ocywgeiwgcil7IFxuICAgIHZhciBqOyAgICAgICAgICAgICAgLy8gdGVtcG9yYXJ5IHN0b3JhZ2VcbiAgICB2YXIgdDsgICAgICAgICAgICAgIC8vIHRlbXBvcmFyeSBwb2ludGVyIChpbnRbXSlcbiAgICB2YXIgdGluZGV4OyAgICAgICAgIC8vIHRlbXBvcmFyeSBwb2ludGVyXG4gICAgdmFyIGU7ICAgICAgICAgICAgICAvLyBleHRyYSBiaXRzIG9yIG9wZXJhdGlvblxuICAgIHZhciBiPTA7ICAgICAgICAgICAgLy8gYml0IGJ1ZmZlclxuICAgIHZhciBrPTA7ICAgICAgICAgICAgLy8gYml0cyBpbiBiaXQgYnVmZmVyXG4gICAgdmFyIHA9MDsgICAgICAgICAgICAvLyBpbnB1dCBkYXRhIHBvaW50ZXJcbiAgICB2YXIgbjsgICAgICAgICAgICAgIC8vIGJ5dGVzIGF2YWlsYWJsZSB0aGVyZVxuICAgIHZhciBxOyAgICAgICAgICAgICAgLy8gb3V0cHV0IHdpbmRvdyB3cml0ZSBwb2ludGVyXG4gICAgdmFyIG07ICAgICAgICAgICAgICAvLyBieXRlcyB0byBlbmQgb2Ygd2luZG93IG9yIHJlYWQgcG9pbnRlclxuICAgIHZhciBmOyAgICAgICAgICAgICAgLy8gcG9pbnRlciB0byBjb3B5IHN0cmluZ3MgZnJvbVxuXG4gICAgLy8gY29weSBpbnB1dC9vdXRwdXQgaW5mb3JtYXRpb24gdG8gbG9jYWxzIChVUERBVEUgbWFjcm8gcmVzdG9yZXMpXG4gICAgcD16Lm5leHRfaW5faW5kZXg7bj16LmF2YWlsX2luO2I9cy5iaXRiO2s9cy5iaXRrO1xuICAgIHE9cy53cml0ZTttPXE8cy5yZWFkP3MucmVhZC1xLTE6cy5lbmQtcTtcblxuICAgIC8vIHByb2Nlc3MgaW5wdXQgYW5kIG91dHB1dCBiYXNlZCBvbiBjdXJyZW50IHN0YXRlXG4gICAgd2hpbGUgKHRydWUpe1xuICAgICAgc3dpdGNoICh0aGlzLm1vZGUpe1xuXHQvLyB3YWl0aW5nIGZvciBcImk6XCI9aW5wdXQsIFwibzpcIj1vdXRwdXQsIFwieDpcIj1ub3RoaW5nXG4gICAgICBjYXNlIElDX1NUQVJUOiAgICAgICAgIC8vIHg6IHNldCB1cCBmb3IgTEVOXG5cdGlmIChtID49IDI1OCAmJiBuID49IDEwKXtcblxuXHQgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICBzLndyaXRlPXE7XG5cdCAgciA9IHRoaXMuaW5mbGF0ZV9mYXN0KHRoaXMubGJpdHMsIHRoaXMuZGJpdHMsIFxuXHRcdFx0ICAgdGhpcy5sdHJlZSwgdGhpcy5sdHJlZV9pbmRleCwgXG5cdFx0XHQgICB0aGlzLmR0cmVlLCB0aGlzLmR0cmVlX2luZGV4LFxuXHRcdFx0ICAgcywgeik7XG5cblx0ICBwPXoubmV4dF9pbl9pbmRleDtuPXouYXZhaWxfaW47Yj1zLmJpdGI7az1zLmJpdGs7XG5cdCAgcT1zLndyaXRlO209cTxzLnJlYWQ/cy5yZWFkLXEtMTpzLmVuZC1xO1xuXG5cdCAgaWYgKHIgIT0gWl9PSyl7XG5cdCAgICB0aGlzLm1vZGUgPSByID09IFpfU1RSRUFNX0VORCA/IElDX1dBU0ggOiBJQ19CQURDT0RFO1xuXHQgICAgYnJlYWs7XG5cdCAgfVxuXHR9XG5cdHRoaXMubmVlZCA9IHRoaXMubGJpdHM7XG5cdHRoaXMudHJlZSA9IHRoaXMubHRyZWU7XG5cdHRoaXMudHJlZV9pbmRleD10aGlzLmx0cmVlX2luZGV4O1xuXG5cdHRoaXMubW9kZSA9IElDX0xFTjtcbiAgICAgIGNhc2UgSUNfTEVOOiAgICAgICAgICAgLy8gaTogZ2V0IGxlbmd0aC9saXRlcmFsL2VvYiBuZXh0XG5cdGogPSB0aGlzLm5lZWQ7XG5cblx0d2hpbGUoazwoaikpe1xuXHQgIGlmKG4hPTApcj1aX09LO1xuXHQgIGVsc2V7XG5cblx0ICAgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgcy53cml0ZT1xO1xuXHQgICAgcmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgIH1cblx0ICBuLS07XG5cdCAgYnw9KHoubmV4dF9pbltwKytdJjB4ZmYpPDxrO1xuXHQgIGsrPTg7XG5cdH1cblxuXHR0aW5kZXg9KHRoaXMudHJlZV9pbmRleCsoYiZpbmZsYXRlX21hc2tbal0pKSozO1xuXG5cdGI+Pj49KHRoaXMudHJlZVt0aW5kZXgrMV0pO1xuXHRrLT0odGhpcy50cmVlW3RpbmRleCsxXSk7XG5cblx0ZT10aGlzLnRyZWVbdGluZGV4XTtcblxuXHRpZihlID09IDApeyAgICAgICAgICAgICAgIC8vIGxpdGVyYWxcblx0ICB0aGlzLmxpdCA9IHRoaXMudHJlZVt0aW5kZXgrMl07XG5cdCAgdGhpcy5tb2RlID0gSUNfTElUO1xuXHQgIGJyZWFrO1xuXHR9XG5cdGlmKChlICYgMTYpIT0wICl7ICAgICAgICAgIC8vIGxlbmd0aFxuXHQgIHRoaXMuZ2V0ID0gZSAmIDE1O1xuXHQgIHRoaXMubGVuID0gdGhpcy50cmVlW3RpbmRleCsyXTtcblx0ICB0aGlzLm1vZGUgPSBJQ19MRU5FWFQ7XG5cdCAgYnJlYWs7XG5cdH1cblx0aWYgKChlICYgNjQpID09IDApeyAgICAgICAgLy8gbmV4dCB0YWJsZVxuXHQgIHRoaXMubmVlZCA9IGU7XG5cdCAgdGhpcy50cmVlX2luZGV4ID0gdGluZGV4LzMgKyB0aGlzLnRyZWVbdGluZGV4KzJdO1xuXHQgIGJyZWFrO1xuXHR9XG5cdGlmICgoZSAmIDMyKSE9MCl7ICAgICAgICAgICAgICAgLy8gZW5kIG9mIGJsb2NrXG5cdCAgdGhpcy5tb2RlID0gSUNfV0FTSDtcblx0ICBicmVhaztcblx0fVxuXHR0aGlzLm1vZGUgPSBJQ19CQURDT0RFOyAgICAgICAgLy8gaW52YWxpZCBjb2RlXG5cdHoubXNnID0gXCJpbnZhbGlkIGxpdGVyYWwvbGVuZ3RoIGNvZGVcIjtcblx0ciA9IFpfREFUQV9FUlJPUjtcblxuXHRzLmJpdGI9YjtzLmJpdGs9aztcblx0ei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHRzLndyaXRlPXE7XG5cdHJldHVybiBzLmluZmxhdGVfZmx1c2goeixyKTtcblxuICAgICAgY2FzZSBJQ19MRU5FWFQ6ICAgICAgICAvLyBpOiBnZXR0aW5nIGxlbmd0aCBleHRyYSAoaGF2ZSBiYXNlKVxuXHRqID0gdGhpcy5nZXQ7XG5cblx0d2hpbGUoazwoaikpe1xuXHQgIGlmKG4hPTApcj1aX09LO1xuXHQgIGVsc2V7XG5cblx0ICAgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgcy53cml0ZT1xO1xuXHQgICAgcmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgIH1cblx0ICBuLS07IGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztcblx0ICBrKz04O1xuXHR9XG5cblx0dGhpcy5sZW4gKz0gKGIgJiBpbmZsYXRlX21hc2tbal0pO1xuXG5cdGI+Pj1qO1xuXHRrLT1qO1xuXG5cdHRoaXMubmVlZCA9IHRoaXMuZGJpdHM7XG5cdHRoaXMudHJlZSA9IHRoaXMuZHRyZWU7XG5cdHRoaXMudHJlZV9pbmRleCA9IHRoaXMuZHRyZWVfaW5kZXg7XG5cdHRoaXMubW9kZSA9IElDX0RJU1Q7XG4gICAgICBjYXNlIElDX0RJU1Q6ICAgICAgICAgIC8vIGk6IGdldCBkaXN0YW5jZSBuZXh0XG5cdGogPSB0aGlzLm5lZWQ7XG5cblx0d2hpbGUoazwoaikpe1xuXHQgIGlmKG4hPTApcj1aX09LO1xuXHQgIGVsc2V7XG5cblx0ICAgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgICAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgICAgcy53cml0ZT1xO1xuXHQgICAgcmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgIH1cblx0ICBuLS07IGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztcblx0ICBrKz04O1xuXHR9XG5cblx0dGluZGV4PSh0aGlzLnRyZWVfaW5kZXgrKGIgJiBpbmZsYXRlX21hc2tbal0pKSozO1xuXG5cdGI+Pj10aGlzLnRyZWVbdGluZGV4KzFdO1xuXHRrLT10aGlzLnRyZWVbdGluZGV4KzFdO1xuXG5cdGUgPSAodGhpcy50cmVlW3RpbmRleF0pO1xuXHRpZigoZSAmIDE2KSE9MCl7ICAgICAgICAgICAgICAgLy8gZGlzdGFuY2Vcblx0ICB0aGlzLmdldCA9IGUgJiAxNTtcblx0ICB0aGlzLmRpc3QgPSB0aGlzLnRyZWVbdGluZGV4KzJdO1xuXHQgIHRoaXMubW9kZSA9IElDX0RJU1RFWFQ7XG5cdCAgYnJlYWs7XG5cdH1cblx0aWYgKChlICYgNjQpID09IDApeyAgICAgICAgLy8gbmV4dCB0YWJsZVxuXHQgIHRoaXMubmVlZCA9IGU7XG5cdCAgdGhpcy50cmVlX2luZGV4ID0gdGluZGV4LzMgKyB0aGlzLnRyZWVbdGluZGV4KzJdO1xuXHQgIGJyZWFrO1xuXHR9XG5cdHRoaXMubW9kZSA9IElDX0JBRENPREU7ICAgICAgICAvLyBpbnZhbGlkIGNvZGVcblx0ei5tc2cgPSBcImludmFsaWQgZGlzdGFuY2UgY29kZVwiO1xuXHRyID0gWl9EQVRBX0VSUk9SO1xuXG5cdHMuYml0Yj1iO3MuYml0az1rO1xuXHR6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdHMud3JpdGU9cTtcblx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXG4gICAgICBjYXNlIElDX0RJU1RFWFQ6ICAgICAgIC8vIGk6IGdldHRpbmcgZGlzdGFuY2UgZXh0cmFcblx0aiA9IHRoaXMuZ2V0O1xuXG5cdHdoaWxlKGs8KGopKXtcblx0ICBpZihuIT0wKXI9Wl9PSztcblx0ICBlbHNle1xuXG5cdCAgICBzLmJpdGI9YjtzLmJpdGs9aztcblx0ICAgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgIHMud3JpdGU9cTtcblx0ICAgIHJldHVybiBzLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICB9XG5cdCAgbi0tOyBifD0oei5uZXh0X2luW3ArK10mMHhmZik8PGs7XG5cdCAgays9ODtcblx0fVxuXG5cdHRoaXMuZGlzdCArPSAoYiAmIGluZmxhdGVfbWFza1tqXSk7XG5cblx0Yj4+PWo7XG5cdGstPWo7XG5cblx0dGhpcy5tb2RlID0gSUNfQ09QWTtcbiAgICAgIGNhc2UgSUNfQ09QWTogICAgICAgICAgLy8gbzogY29weWluZyBieXRlcyBpbiB3aW5kb3csIHdhaXRpbmcgZm9yIHNwYWNlXG4gICAgICAgIGYgPSBxIC0gdGhpcy5kaXN0O1xuICAgICAgICB3aGlsZShmIDwgMCl7ICAgICAvLyBtb2R1bG8gd2luZG93IHNpemUtXCJ3aGlsZVwiIGluc3RlYWRcbiAgICAgICAgICBmICs9IHMuZW5kOyAgICAgLy8gb2YgXCJpZlwiIGhhbmRsZXMgaW52YWxpZCBkaXN0YW5jZXNcblx0fVxuXHR3aGlsZSAodGhpcy5sZW4hPTApe1xuXG5cdCAgaWYobT09MCl7XG5cdCAgICBpZihxPT1zLmVuZCYmcy5yZWFkIT0wKXtxPTA7bT1xPHMucmVhZD9zLnJlYWQtcS0xOnMuZW5kLXE7fVxuXHQgICAgaWYobT09MCl7XG5cdCAgICAgIHMud3JpdGU9cTsgcj1zLmluZmxhdGVfZmx1c2goeixyKTtcblx0ICAgICAgcT1zLndyaXRlO209cTxzLnJlYWQ/cy5yZWFkLXEtMTpzLmVuZC1xO1xuXG5cdCAgICAgIGlmKHE9PXMuZW5kJiZzLnJlYWQhPTApe3E9MDttPXE8cy5yZWFkP3MucmVhZC1xLTE6cy5lbmQtcTt9XG5cblx0ICAgICAgaWYobT09MCl7XG5cdFx0cy5iaXRiPWI7cy5iaXRrPWs7XG5cdFx0ei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHRcdHMud3JpdGU9cTtcblx0XHRyZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdCAgICAgIH0gIFxuXHQgICAgfVxuXHQgIH1cblxuXHQgIHMud2luZG93W3ErK109cy53aW5kb3dbZisrXTsgbS0tO1xuXG5cdCAgaWYgKGYgPT0gcy5lbmQpXG4gICAgICAgICAgICBmID0gMDtcblx0ICB0aGlzLmxlbi0tO1xuXHR9XG5cdHRoaXMubW9kZSA9IElDX1NUQVJUO1xuXHRicmVhaztcbiAgICAgIGNhc2UgSUNfTElUOiAgICAgICAgICAgLy8gbzogZ290IGxpdGVyYWwsIHdhaXRpbmcgZm9yIG91dHB1dCBzcGFjZVxuXHRpZihtPT0wKXtcblx0ICBpZihxPT1zLmVuZCYmcy5yZWFkIT0wKXtxPTA7bT1xPHMucmVhZD9zLnJlYWQtcS0xOnMuZW5kLXE7fVxuXHQgIGlmKG09PTApe1xuXHQgICAgcy53cml0ZT1xOyByPXMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgICAgcT1zLndyaXRlO209cTxzLnJlYWQ/cy5yZWFkLXEtMTpzLmVuZC1xO1xuXG5cdCAgICBpZihxPT1zLmVuZCYmcy5yZWFkIT0wKXtxPTA7bT1xPHMucmVhZD9zLnJlYWQtcS0xOnMuZW5kLXE7fVxuXHQgICAgaWYobT09MCl7XG5cdCAgICAgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgICAgICB6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgICAgIHMud3JpdGU9cTtcblx0ICAgICAgcmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXHRyPVpfT0s7XG5cblx0cy53aW5kb3dbcSsrXT10aGlzLmxpdDsgbS0tO1xuXG5cdHRoaXMubW9kZSA9IElDX1NUQVJUO1xuXHRicmVhaztcbiAgICAgIGNhc2UgSUNfV0FTSDogICAgICAgICAgIC8vIG86IGdvdCBlb2IsIHBvc3NpYmx5IG1vcmUgb3V0cHV0XG5cdGlmIChrID4gNyl7ICAgICAgICAvLyByZXR1cm4gdW51c2VkIGJ5dGUsIGlmIGFueVxuXHQgIGsgLT0gODtcblx0ICBuKys7XG5cdCAgcC0tOyAgICAgICAgICAgICAvLyBjYW4gYWx3YXlzIHJldHVybiBvbmVcblx0fVxuXG5cdHMud3JpdGU9cTsgcj1zLmluZmxhdGVfZmx1c2goeixyKTtcblx0cT1zLndyaXRlO209cTxzLnJlYWQ/cy5yZWFkLXEtMTpzLmVuZC1xO1xuXG5cdGlmIChzLnJlYWQgIT0gcy53cml0ZSl7XG5cdCAgcy5iaXRiPWI7cy5iaXRrPWs7XG5cdCAgei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHQgIHMud3JpdGU9cTtcblx0ICByZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cdH1cblx0dGhpcy5tb2RlID0gSUNfRU5EO1xuICAgICAgY2FzZSBJQ19FTkQ6XG5cdHIgPSBaX1NUUkVBTV9FTkQ7XG5cdHMuYml0Yj1iO3MuYml0az1rO1xuXHR6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdHMud3JpdGU9cTtcblx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LHIpO1xuXG4gICAgICBjYXNlIElDX0JBRENPREU6ICAgICAgIC8vIHg6IGdvdCBlcnJvclxuXG5cdHIgPSBaX0RBVEFfRVJST1I7XG5cblx0cy5iaXRiPWI7cy5iaXRrPWs7XG5cdHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0cy53cml0ZT1xO1xuXHRyZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHoscik7XG5cbiAgICAgIGRlZmF1bHQ6XG5cdHIgPSBaX1NUUkVBTV9FUlJPUjtcblxuXHRzLmJpdGI9YjtzLmJpdGs9aztcblx0ei5hdmFpbF9pbj1uO3oudG90YWxfaW4rPXAtei5uZXh0X2luX2luZGV4O3oubmV4dF9pbl9pbmRleD1wO1xuXHRzLndyaXRlPXE7XG5cdHJldHVybiBzLmluZmxhdGVfZmx1c2goeixyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuSW5mQ29kZXMucHJvdG90eXBlLmZyZWUgPSBmdW5jdGlvbih6KXtcbiAgICAvLyAgWkZSRUUoeiwgYyk7XG59XG5cbiAgLy8gQ2FsbGVkIHdpdGggbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gd3JpdGUgaW4gd2luZG93IGF0IGxlYXN0IDI1OFxuICAvLyAodGhlIG1heGltdW0gc3RyaW5nIGxlbmd0aCkgYW5kIG51bWJlciBvZiBpbnB1dCBieXRlcyBhdmFpbGFibGVcbiAgLy8gYXQgbGVhc3QgdGVuLiAgVGhlIHRlbiBieXRlcyBhcmUgc2l4IGJ5dGVzIGZvciB0aGUgbG9uZ2VzdCBsZW5ndGgvXG4gIC8vIGRpc3RhbmNlIHBhaXIgcGx1cyBmb3VyIGJ5dGVzIGZvciBvdmVybG9hZGluZyB0aGUgYml0IGJ1ZmZlci5cblxuSW5mQ29kZXMucHJvdG90eXBlLmluZmxhdGVfZmFzdCA9IGZ1bmN0aW9uKGJsLCBiZCwgdGwsIHRsX2luZGV4LCB0ZCwgdGRfaW5kZXgsIHMsIHopIHtcbiAgICB2YXIgdDsgICAgICAgICAgICAgICAgLy8gdGVtcG9yYXJ5IHBvaW50ZXJcbiAgICB2YXIgICB0cDsgICAgICAgICAgICAgLy8gdGVtcG9yYXJ5IHBvaW50ZXIgKGludFtdKVxuICAgIHZhciB0cF9pbmRleDsgICAgICAgICAvLyB0ZW1wb3JhcnkgcG9pbnRlclxuICAgIHZhciBlOyAgICAgICAgICAgICAgICAvLyBleHRyYSBiaXRzIG9yIG9wZXJhdGlvblxuICAgIHZhciBiOyAgICAgICAgICAgICAgICAvLyBiaXQgYnVmZmVyXG4gICAgdmFyIGs7ICAgICAgICAgICAgICAgIC8vIGJpdHMgaW4gYml0IGJ1ZmZlclxuICAgIHZhciBwOyAgICAgICAgICAgICAgICAvLyBpbnB1dCBkYXRhIHBvaW50ZXJcbiAgICB2YXIgbjsgICAgICAgICAgICAgICAgLy8gYnl0ZXMgYXZhaWxhYmxlIHRoZXJlXG4gICAgdmFyIHE7ICAgICAgICAgICAgICAgIC8vIG91dHB1dCB3aW5kb3cgd3JpdGUgcG9pbnRlclxuICAgIHZhciBtOyAgICAgICAgICAgICAgICAvLyBieXRlcyB0byBlbmQgb2Ygd2luZG93IG9yIHJlYWQgcG9pbnRlclxuICAgIHZhciBtbDsgICAgICAgICAgICAgICAvLyBtYXNrIGZvciBsaXRlcmFsL2xlbmd0aCB0cmVlXG4gICAgdmFyIG1kOyAgICAgICAgICAgICAgIC8vIG1hc2sgZm9yIGRpc3RhbmNlIHRyZWVcbiAgICB2YXIgYzsgICAgICAgICAgICAgICAgLy8gYnl0ZXMgdG8gY29weVxuICAgIHZhciBkOyAgICAgICAgICAgICAgICAvLyBkaXN0YW5jZSBiYWNrIHRvIGNvcHkgZnJvbVxuICAgIHZhciByOyAgICAgICAgICAgICAgICAvLyBjb3B5IHNvdXJjZSBwb2ludGVyXG5cbiAgICB2YXIgdHBfaW5kZXhfdF8zOyAgICAgLy8gKHRwX2luZGV4K3QpKjNcblxuICAgIC8vIGxvYWQgaW5wdXQsIG91dHB1dCwgYml0IHZhbHVlc1xuICAgIHA9ei5uZXh0X2luX2luZGV4O249ei5hdmFpbF9pbjtiPXMuYml0YjtrPXMuYml0aztcbiAgICBxPXMud3JpdGU7bT1xPHMucmVhZD9zLnJlYWQtcS0xOnMuZW5kLXE7XG5cbiAgICAvLyBpbml0aWFsaXplIG1hc2tzXG4gICAgbWwgPSBpbmZsYXRlX21hc2tbYmxdO1xuICAgIG1kID0gaW5mbGF0ZV9tYXNrW2JkXTtcblxuICAgIC8vIGRvIHVudGlsIG5vdCBlbm91Z2ggaW5wdXQgb3Igb3V0cHV0IHNwYWNlIGZvciBmYXN0IGxvb3BcbiAgICBkbyB7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3N1bWUgY2FsbGVkIHdpdGggbSA+PSAyNTggJiYgbiA+PSAxMFxuICAgICAgLy8gZ2V0IGxpdGVyYWwvbGVuZ3RoIGNvZGVcbiAgICAgIHdoaWxlKGs8KDIwKSl7ICAgICAgICAgICAgICAvLyBtYXggYml0cyBmb3IgbGl0ZXJhbC9sZW5ndGggY29kZVxuXHRuLS07XG5cdGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztrKz04O1xuICAgICAgfVxuXG4gICAgICB0PSBiJm1sO1xuICAgICAgdHA9dGw7IFxuICAgICAgdHBfaW5kZXg9dGxfaW5kZXg7XG4gICAgICB0cF9pbmRleF90XzM9KHRwX2luZGV4K3QpKjM7XG4gICAgICBpZiAoKGUgPSB0cFt0cF9pbmRleF90XzNdKSA9PSAwKXtcblx0Yj4+PSh0cFt0cF9pbmRleF90XzMrMV0pOyBrLT0odHBbdHBfaW5kZXhfdF8zKzFdKTtcblxuXHRzLndpbmRvd1txKytdID0gdHBbdHBfaW5kZXhfdF8zKzJdO1xuXHRtLS07XG5cdGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgZG8ge1xuXG5cdGI+Pj0odHBbdHBfaW5kZXhfdF8zKzFdKTsgay09KHRwW3RwX2luZGV4X3RfMysxXSk7XG5cblx0aWYoKGUmMTYpIT0wKXtcblx0ICBlICY9IDE1O1xuXHQgIGMgPSB0cFt0cF9pbmRleF90XzMrMl0gKyAoYiAmIGluZmxhdGVfbWFza1tlXSk7XG5cblx0ICBiPj49ZTsgay09ZTtcblxuXHQgIC8vIGRlY29kZSBkaXN0YW5jZSBiYXNlIG9mIGJsb2NrIHRvIGNvcHlcblx0ICB3aGlsZShrPCgxNSkpeyAgICAgICAgICAgLy8gbWF4IGJpdHMgZm9yIGRpc3RhbmNlIGNvZGVcblx0ICAgIG4tLTtcblx0ICAgIGJ8PSh6Lm5leHRfaW5bcCsrXSYweGZmKTw8aztrKz04O1xuXHQgIH1cblxuXHQgIHQ9IGImbWQ7XG5cdCAgdHA9dGQ7XG5cdCAgdHBfaW5kZXg9dGRfaW5kZXg7XG4gICAgICAgICAgdHBfaW5kZXhfdF8zPSh0cF9pbmRleCt0KSozO1xuXHQgIGUgPSB0cFt0cF9pbmRleF90XzNdO1xuXG5cdCAgZG8ge1xuXG5cdCAgICBiPj49KHRwW3RwX2luZGV4X3RfMysxXSk7IGstPSh0cFt0cF9pbmRleF90XzMrMV0pO1xuXG5cdCAgICBpZigoZSYxNikhPTApe1xuXHQgICAgICAvLyBnZXQgZXh0cmEgYml0cyB0byBhZGQgdG8gZGlzdGFuY2UgYmFzZVxuXHQgICAgICBlICY9IDE1O1xuXHQgICAgICB3aGlsZShrPChlKSl7ICAgICAgICAgLy8gZ2V0IGV4dHJhIGJpdHMgKHVwIHRvIDEzKVxuXHRcdG4tLTtcblx0XHRifD0oei5uZXh0X2luW3ArK10mMHhmZik8PGs7ays9ODtcblx0ICAgICAgfVxuXG5cdCAgICAgIGQgPSB0cFt0cF9pbmRleF90XzMrMl0gKyAoYiZpbmZsYXRlX21hc2tbZV0pO1xuXG5cdCAgICAgIGI+Pj0oZSk7IGstPShlKTtcblxuXHQgICAgICAvLyBkbyB0aGUgY29weVxuXHQgICAgICBtIC09IGM7XG5cdCAgICAgIGlmIChxID49IGQpeyAgICAgICAgICAgICAgICAvLyBvZmZzZXQgYmVmb3JlIGRlc3Rcblx0XHQvLyAganVzdCBjb3B5XG5cdFx0cj1xLWQ7XG5cdFx0aWYocS1yPjAgJiYgMj4ocS1yKSl7ICAgICAgICAgICBcblx0XHQgIHMud2luZG93W3ErK109cy53aW5kb3dbcisrXTsgLy8gbWluaW11bSBjb3VudCBpcyB0aHJlZSxcblx0XHQgIHMud2luZG93W3ErK109cy53aW5kb3dbcisrXTsgLy8gc28gdW5yb2xsIGxvb3AgYSBsaXR0bGVcblx0XHQgIGMtPTI7XG5cdFx0fVxuXHRcdGVsc2V7XG5cdFx0ICBzLndpbmRvd1txKytdPXMud2luZG93W3IrK107IC8vIG1pbmltdW0gY291bnQgaXMgdGhyZWUsXG5cdFx0ICBzLndpbmRvd1txKytdPXMud2luZG93W3IrK107IC8vIHNvIHVucm9sbCBsb29wIGEgbGl0dGxlXG5cdFx0ICBjLT0yO1xuXHRcdH1cblx0ICAgICAgfVxuXHQgICAgICBlbHNleyAgICAgICAgICAgICAgICAgIC8vIGVsc2Ugb2Zmc2V0IGFmdGVyIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAgICAgcj1xLWQ7XG4gICAgICAgICAgICAgICAgZG97XG4gICAgICAgICAgICAgICAgICByKz1zLmVuZDsgICAgICAgICAgLy8gZm9yY2UgcG9pbnRlciBpbiB3aW5kb3dcbiAgICAgICAgICAgICAgICB9d2hpbGUocjwwKTsgICAgICAgICAvLyBjb3ZlcnMgaW52YWxpZCBkaXN0YW5jZXNcblx0XHRlPXMuZW5kLXI7XG5cdFx0aWYoYz5lKXsgICAgICAgICAgICAgLy8gaWYgc291cmNlIGNyb3NzZXMsXG5cdFx0ICBjLT1lOyAgICAgICAgICAgICAgLy8gd3JhcHBlZCBjb3B5XG5cdFx0ICBpZihxLXI+MCAmJiBlPihxLXIpKXsgICAgICAgICAgIFxuXHRcdCAgICBkb3tzLndpbmRvd1txKytdID0gcy53aW5kb3dbcisrXTt9XG5cdFx0ICAgIHdoaWxlKC0tZSE9MCk7XG5cdFx0ICB9XG5cdFx0ICBlbHNle1xuXHRcdCAgICBhcnJheUNvcHkocy53aW5kb3csIHIsIHMud2luZG93LCBxLCBlKTtcblx0XHQgICAgcSs9ZTsgcis9ZTsgZT0wO1xuXHRcdCAgfVxuXHRcdCAgciA9IDA7ICAgICAgICAgICAgICAgICAgLy8gY29weSByZXN0IGZyb20gc3RhcnQgb2Ygd2luZG93XG5cdFx0fVxuXG5cdCAgICAgIH1cblxuXHQgICAgICAvLyBjb3B5IGFsbCBvciB3aGF0J3MgbGVmdFxuICAgICAgICAgICAgICBkb3tzLndpbmRvd1txKytdID0gcy53aW5kb3dbcisrXTt9XG5cdFx0d2hpbGUoLS1jIT0wKTtcblx0ICAgICAgYnJlYWs7XG5cdCAgICB9XG5cdCAgICBlbHNlIGlmKChlJjY0KT09MCl7XG5cdCAgICAgIHQrPXRwW3RwX2luZGV4X3RfMysyXTtcblx0ICAgICAgdCs9KGImaW5mbGF0ZV9tYXNrW2VdKTtcblx0ICAgICAgdHBfaW5kZXhfdF8zPSh0cF9pbmRleCt0KSozO1xuXHQgICAgICBlPXRwW3RwX2luZGV4X3RfM107XG5cdCAgICB9XG5cdCAgICBlbHNle1xuXHQgICAgICB6Lm1zZyA9IFwiaW52YWxpZCBkaXN0YW5jZSBjb2RlXCI7XG5cblx0ICAgICAgYz16LmF2YWlsX2luLW47Yz0oaz4+Myk8Yz9rPj4zOmM7bis9YztwLT1jO2stPWM8PDM7XG5cblx0ICAgICAgcy5iaXRiPWI7cy5iaXRrPWs7XG5cdCAgICAgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICAgICAgcy53cml0ZT1xO1xuXG5cdCAgICAgIHJldHVybiBaX0RBVEFfRVJST1I7XG5cdCAgICB9XG5cdCAgfVxuXHQgIHdoaWxlKHRydWUpO1xuXHQgIGJyZWFrO1xuXHR9XG5cblx0aWYoKGUmNjQpPT0wKXtcblx0ICB0Kz10cFt0cF9pbmRleF90XzMrMl07XG5cdCAgdCs9KGImaW5mbGF0ZV9tYXNrW2VdKTtcblx0ICB0cF9pbmRleF90XzM9KHRwX2luZGV4K3QpKjM7XG5cdCAgaWYoKGU9dHBbdHBfaW5kZXhfdF8zXSk9PTApe1xuXG5cdCAgICBiPj49KHRwW3RwX2luZGV4X3RfMysxXSk7IGstPSh0cFt0cF9pbmRleF90XzMrMV0pO1xuXG5cdCAgICBzLndpbmRvd1txKytdPXRwW3RwX2luZGV4X3RfMysyXTtcblx0ICAgIG0tLTtcblx0ICAgIGJyZWFrO1xuXHQgIH1cblx0fVxuXHRlbHNlIGlmKChlJjMyKSE9MCl7XG5cblx0ICBjPXouYXZhaWxfaW4tbjtjPShrPj4zKTxjP2s+PjM6YztuKz1jO3AtPWM7ay09Yzw8MztcbiBcblx0ICBzLmJpdGI9YjtzLmJpdGs9aztcblx0ICB6LmF2YWlsX2luPW47ei50b3RhbF9pbis9cC16Lm5leHRfaW5faW5kZXg7ei5uZXh0X2luX2luZGV4PXA7XG5cdCAgcy53cml0ZT1xO1xuXG5cdCAgcmV0dXJuIFpfU1RSRUFNX0VORDtcblx0fVxuXHRlbHNle1xuXHQgIHoubXNnPVwiaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlXCI7XG5cblx0ICBjPXouYXZhaWxfaW4tbjtjPShrPj4zKTxjP2s+PjM6YztuKz1jO3AtPWM7ay09Yzw8MztcblxuXHQgIHMuYml0Yj1iO3MuYml0az1rO1xuXHQgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcblx0ICBzLndyaXRlPXE7XG5cblx0ICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuXHR9XG4gICAgICB9IFxuICAgICAgd2hpbGUodHJ1ZSk7XG4gICAgfSBcbiAgICB3aGlsZShtPj0yNTggJiYgbj49IDEwKTtcblxuICAgIC8vIG5vdCBlbm91Z2ggaW5wdXQgb3Igb3V0cHV0LS1yZXN0b3JlIHBvaW50ZXJzIGFuZCByZXR1cm5cbiAgICBjPXouYXZhaWxfaW4tbjtjPShrPj4zKTxjP2s+PjM6YztuKz1jO3AtPWM7ay09Yzw8MztcblxuICAgIHMuYml0Yj1iO3MuYml0az1rO1xuICAgIHouYXZhaWxfaW49bjt6LnRvdGFsX2luKz1wLXoubmV4dF9pbl9pbmRleDt6Lm5leHRfaW5faW5kZXg9cDtcbiAgICBzLndyaXRlPXE7XG5cbiAgICByZXR1cm4gWl9PSztcbn1cblxuLy9cbi8vIEluZlRyZWUuamF2YVxuLy9cblxuZnVuY3Rpb24gSW5mVHJlZSgpIHtcbn1cblxuSW5mVHJlZS5wcm90b3R5cGUuaHVmdF9idWlsZCA9IGZ1bmN0aW9uKGIsIGJpbmRleCwgbiwgcywgZCwgZSwgdCwgbSwgaHAsIGhuLCB2KSB7XG5cbiAgICAvLyBHaXZlbiBhIGxpc3Qgb2YgY29kZSBsZW5ndGhzIGFuZCBhIG1heGltdW0gdGFibGUgc2l6ZSwgbWFrZSBhIHNldCBvZlxuICAgIC8vIHRhYmxlcyB0byBkZWNvZGUgdGhhdCBzZXQgb2YgY29kZXMuICBSZXR1cm4gWl9PSyBvbiBzdWNjZXNzLCBaX0JVRl9FUlJPUlxuICAgIC8vIGlmIHRoZSBnaXZlbiBjb2RlIHNldCBpcyBpbmNvbXBsZXRlICh0aGUgdGFibGVzIGFyZSBzdGlsbCBidWlsdCBpbiB0aGlzXG4gICAgLy8gY2FzZSksIFpfREFUQV9FUlJPUiBpZiB0aGUgaW5wdXQgaXMgaW52YWxpZCAoYW4gb3Zlci1zdWJzY3JpYmVkIHNldCBvZlxuICAgIC8vIGxlbmd0aHMpLCBvciBaX01FTV9FUlJPUiBpZiBub3QgZW5vdWdoIG1lbW9yeS5cblxuICAgIHZhciBhOyAgICAgICAgICAgICAgICAgICAgICAgLy8gY291bnRlciBmb3IgY29kZXMgb2YgbGVuZ3RoIGtcbiAgICB2YXIgZjsgICAgICAgICAgICAgICAgICAgICAgIC8vIGkgcmVwZWF0cyBpbiB0YWJsZSBldmVyeSBmIGVudHJpZXNcbiAgICB2YXIgZzsgICAgICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gY29kZSBsZW5ndGhcbiAgICB2YXIgaDsgICAgICAgICAgICAgICAgICAgICAgIC8vIHRhYmxlIGxldmVsXG4gICAgdmFyIGk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBjb3VudGVyLCBjdXJyZW50IGNvZGVcbiAgICB2YXIgajsgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvdW50ZXJcbiAgICB2YXIgazsgICAgICAgICAgICAgICAgICAgICAgIC8vIG51bWJlciBvZiBiaXRzIGluIGN1cnJlbnQgY29kZVxuICAgIHZhciBsOyAgICAgICAgICAgICAgICAgICAgICAgLy8gYml0cyBwZXIgdGFibGUgKHJldHVybmVkIGluIG0pXG4gICAgdmFyIG1hc2s7ICAgICAgICAgICAgICAgICAgICAvLyAoMSA8PCB3KSAtIDEsIHRvIGF2b2lkIGNjIC1PIGJ1ZyBvbiBIUFxuICAgIHZhciBwOyAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9pbnRlciBpbnRvIGNbXSwgYltdLCBvciB2W11cbiAgICB2YXIgcTsgICAgICAgICAgICAgICAgICAgICAgIC8vIHBvaW50cyB0byBjdXJyZW50IHRhYmxlXG4gICAgdmFyIHc7ICAgICAgICAgICAgICAgICAgICAgICAvLyBiaXRzIGJlZm9yZSB0aGlzIHRhYmxlID09IChsICogaClcbiAgICB2YXIgeHA7ICAgICAgICAgICAgICAgICAgICAgIC8vIHBvaW50ZXIgaW50byB4XG4gICAgdmFyIHk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBudW1iZXIgb2YgZHVtbXkgY29kZXMgYWRkZWRcbiAgICB2YXIgejsgICAgICAgICAgICAgICAgICAgICAgIC8vIG51bWJlciBvZiBlbnRyaWVzIGluIGN1cnJlbnQgdGFibGVcblxuICAgIC8vIEdlbmVyYXRlIGNvdW50cyBmb3IgZWFjaCBiaXQgbGVuZ3RoXG5cbiAgICBwID0gMDsgaSA9IG47XG4gICAgZG8ge1xuICAgICAgdGhpcy5jW2JbYmluZGV4K3BdXSsrOyBwKys7IGktLTsgICAvLyBhc3N1bWUgYWxsIGVudHJpZXMgPD0gQk1BWFxuICAgIH13aGlsZShpIT0wKTtcblxuICAgIGlmKHRoaXMuY1swXSA9PSBuKXsgICAgICAgICAgICAgICAgLy8gbnVsbCBpbnB1dC0tYWxsIHplcm8gbGVuZ3RoIGNvZGVzXG4gICAgICB0WzBdID0gLTE7XG4gICAgICBtWzBdID0gMDtcbiAgICAgIHJldHVybiBaX09LO1xuICAgIH1cblxuICAgIC8vIEZpbmQgbWluaW11bSBhbmQgbWF4aW11bSBsZW5ndGgsIGJvdW5kICptIGJ5IHRob3NlXG4gICAgbCA9IG1bMF07XG4gICAgZm9yIChqID0gMTsgaiA8PSBCTUFYOyBqKyspXG4gICAgICBpZih0aGlzLmNbal0hPTApIGJyZWFrO1xuICAgIGsgPSBqOyAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1pbmltdW0gY29kZSBsZW5ndGhcbiAgICBpZihsIDwgail7XG4gICAgICBsID0gajtcbiAgICB9XG4gICAgZm9yIChpID0gQk1BWDsgaSE9MDsgaS0tKXtcbiAgICAgIGlmKHRoaXMuY1tpXSE9MCkgYnJlYWs7XG4gICAgfVxuICAgIGcgPSBpOyAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1heGltdW0gY29kZSBsZW5ndGhcbiAgICBpZihsID4gaSl7XG4gICAgICBsID0gaTtcbiAgICB9XG4gICAgbVswXSA9IGw7XG5cbiAgICAvLyBBZGp1c3QgbGFzdCBsZW5ndGggY291bnQgdG8gZmlsbCBvdXQgY29kZXMsIGlmIG5lZWRlZFxuICAgIGZvciAoeSA9IDEgPDwgajsgaiA8IGk7IGorKywgeSA8PD0gMSl7XG4gICAgICBpZiAoKHkgLT0gdGhpcy5jW2pdKSA8IDApe1xuICAgICAgICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoKHkgLT0gdGhpcy5jW2ldKSA8IDApe1xuICAgICAgcmV0dXJuIFpfREFUQV9FUlJPUjtcbiAgICB9XG4gICAgdGhpcy5jW2ldICs9IHk7XG5cbiAgICAvLyBHZW5lcmF0ZSBzdGFydGluZyBvZmZzZXRzIGludG8gdGhlIHZhbHVlIHRhYmxlIGZvciBlYWNoIGxlbmd0aFxuICAgIHRoaXMueFsxXSA9IGogPSAwO1xuICAgIHAgPSAxOyAgeHAgPSAyO1xuICAgIHdoaWxlICgtLWkhPTApIHsgICAgICAgICAgICAgICAgIC8vIG5vdGUgdGhhdCBpID09IGcgZnJvbSBhYm92ZVxuICAgICAgdGhpcy54W3hwXSA9IChqICs9IHRoaXMuY1twXSk7XG4gICAgICB4cCsrO1xuICAgICAgcCsrO1xuICAgIH1cblxuICAgIC8vIE1ha2UgYSB0YWJsZSBvZiB2YWx1ZXMgaW4gb3JkZXIgb2YgYml0IGxlbmd0aHNcbiAgICBpID0gMDsgcCA9IDA7XG4gICAgZG8ge1xuICAgICAgaWYgKChqID0gYltiaW5kZXgrcF0pICE9IDApe1xuICAgICAgICB0aGlzLnZbdGhpcy54W2pdKytdID0gaTtcbiAgICAgIH1cbiAgICAgIHArKztcbiAgICB9XG4gICAgd2hpbGUgKCsraSA8IG4pO1xuICAgIG4gPSB0aGlzLnhbZ107ICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IG4gdG8gbGVuZ3RoIG9mIHZcblxuICAgIC8vIEdlbmVyYXRlIHRoZSBIdWZmbWFuIGNvZGVzIGFuZCBmb3IgZWFjaCwgbWFrZSB0aGUgdGFibGUgZW50cmllc1xuICAgIHRoaXMueFswXSA9IGkgPSAwOyAgICAgICAgICAgICAgICAgLy8gZmlyc3QgSHVmZm1hbiBjb2RlIGlzIHplcm9cbiAgICBwID0gMDsgICAgICAgICAgICAgICAgICAgICAgICAvLyBncmFiIHZhbHVlcyBpbiBiaXQgb3JkZXJcbiAgICBoID0gLTE7ICAgICAgICAgICAgICAgICAgICAgICAvLyBubyB0YWJsZXMgeWV0LS1sZXZlbCAtMVxuICAgIHcgPSAtbDsgICAgICAgICAgICAgICAgICAgICAgIC8vIGJpdHMgZGVjb2RlZCA9PSAobCAqIGgpXG4gICAgdGhpcy51WzBdID0gMDsgICAgICAgICAgICAgICAgICAgICAvLyBqdXN0IHRvIGtlZXAgY29tcGlsZXJzIGhhcHB5XG4gICAgcSA9IDA7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGl0dG9cbiAgICB6ID0gMDsgICAgICAgICAgICAgICAgICAgICAgICAvLyBkaXR0b1xuXG4gICAgLy8gZ28gdGhyb3VnaCB0aGUgYml0IGxlbmd0aHMgKGsgYWxyZWFkeSBpcyBiaXRzIGluIHNob3J0ZXN0IGNvZGUpXG4gICAgZm9yICg7IGsgPD0gZzsgaysrKXtcbiAgICAgIGEgPSB0aGlzLmNba107XG4gICAgICB3aGlsZSAoYS0tIT0wKXtcblx0Ly8gaGVyZSBpIGlzIHRoZSBIdWZmbWFuIGNvZGUgb2YgbGVuZ3RoIGsgYml0cyBmb3IgdmFsdWUgKnBcblx0Ly8gbWFrZSB0YWJsZXMgdXAgdG8gcmVxdWlyZWQgbGV2ZWxcbiAgICAgICAgd2hpbGUgKGsgPiB3ICsgbCl7XG4gICAgICAgICAgaCsrO1xuICAgICAgICAgIHcgKz0gbDsgICAgICAgICAgICAgICAgIC8vIHByZXZpb3VzIHRhYmxlIGFsd2F5cyBsIGJpdHNcblx0ICAvLyBjb21wdXRlIG1pbmltdW0gc2l6ZSB0YWJsZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gbCBiaXRzXG4gICAgICAgICAgeiA9IGcgLSB3O1xuICAgICAgICAgIHogPSAoeiA+IGwpID8gbCA6IHo7ICAgICAgICAvLyB0YWJsZSBzaXplIHVwcGVyIGxpbWl0XG4gICAgICAgICAgaWYoKGY9MTw8KGo9ay13KSk+YSsxKXsgICAgIC8vIHRyeSBhIGstdyBiaXQgdGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9vIGZldyBjb2RlcyBmb3Igay13IGJpdCB0YWJsZVxuICAgICAgICAgICAgZiAtPSBhICsgMTsgICAgICAgICAgICAgICAvLyBkZWR1Y3QgY29kZXMgZnJvbSBwYXR0ZXJucyBsZWZ0XG4gICAgICAgICAgICB4cCA9IGs7XG4gICAgICAgICAgICBpZihqIDwgeil7XG4gICAgICAgICAgICAgIHdoaWxlICgrK2ogPCB6KXsgICAgICAgIC8vIHRyeSBzbWFsbGVyIHRhYmxlcyB1cCB0byB6IGJpdHNcbiAgICAgICAgICAgICAgICBpZigoZiA8PD0gMSkgPD0gdGhpcy5jWysreHBdKVxuICAgICAgICAgICAgICAgICAgYnJlYWs7ICAgICAgICAgICAgICAvLyBlbm91Z2ggY29kZXMgdG8gdXNlIHVwIGogYml0c1xuICAgICAgICAgICAgICAgIGYgLT0gdGhpcy5jW3hwXTsgICAgICAgICAgIC8vIGVsc2UgZGVkdWN0IGNvZGVzIGZyb20gcGF0dGVybnNcbiAgICAgICAgICAgICAgfVxuXHQgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB6ID0gMSA8PCBqOyAgICAgICAgICAgICAgICAgLy8gdGFibGUgZW50cmllcyBmb3Igai1iaXQgdGFibGVcblxuXHQgIC8vIGFsbG9jYXRlIG5ldyB0YWJsZVxuICAgICAgICAgIGlmICh0aGlzLmhuWzBdICsgeiA+IE1BTlkpeyAgICAgICAvLyAobm90ZTogZG9lc24ndCBtYXR0ZXIgZm9yIGZpeGVkKVxuICAgICAgICAgICAgcmV0dXJuIFpfREFUQV9FUlJPUjsgICAgICAgLy8gb3ZlcmZsb3cgb2YgTUFOWVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnVbaF0gPSBxID0gLypocCsqLyB0aGlzLmhuWzBdOyAgIC8vIERFQlVHXG4gICAgICAgICAgdGhpcy5oblswXSArPSB6O1xuIFxuXHQgIC8vIGNvbm5lY3QgdG8gbGFzdCB0YWJsZSwgaWYgdGhlcmUgaXMgb25lXG5cdCAgaWYoaCE9MCl7XG4gICAgICAgICAgICB0aGlzLnhbaF09aTsgICAgICAgICAgIC8vIHNhdmUgcGF0dGVybiBmb3IgYmFja2luZyB1cFxuICAgICAgICAgICAgdGhpcy5yWzBdPWo7ICAgICAvLyBiaXRzIGluIHRoaXMgdGFibGVcbiAgICAgICAgICAgIHRoaXMuclsxXT1sOyAgICAgLy8gYml0cyB0byBkdW1wIGJlZm9yZSB0aGlzIHRhYmxlXG4gICAgICAgICAgICBqPWk+Pj4odyAtIGwpO1xuICAgICAgICAgICAgdGhpcy5yWzJdID0gKHEgLSB0aGlzLnVbaC0xXSAtIGopOyAgICAgICAgICAgICAgIC8vIG9mZnNldCB0byB0aGlzIHRhYmxlXG4gICAgICAgICAgICBhcnJheUNvcHkodGhpcy5yLCAwLCBocCwgKHRoaXMudVtoLTFdK2opKjMsIDMpOyAvLyBjb25uZWN0IHRvIGxhc3QgdGFibGVcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgIHRbMF0gPSBxOyAgICAgICAgICAgICAgIC8vIGZpcnN0IHRhYmxlIGlzIHJldHVybmVkIHJlc3VsdFxuXHQgIH1cbiAgICAgICAgfVxuXG5cdC8vIHNldCB1cCB0YWJsZSBlbnRyeSBpbiByXG4gICAgICAgIHRoaXMuclsxXSA9IChrIC0gdyk7XG4gICAgICAgIGlmIChwID49IG4pe1xuICAgICAgICAgIHRoaXMuclswXSA9IDEyOCArIDY0OyAgICAgIC8vIG91dCBvZiB2YWx1ZXMtLWludmFsaWQgY29kZVxuXHR9XG4gICAgICAgIGVsc2UgaWYgKHZbcF0gPCBzKXtcbiAgICAgICAgICB0aGlzLnJbMF0gPSAodGhpcy52W3BdIDwgMjU2ID8gMCA6IDMyICsgNjQpOyAgLy8gMjU2IGlzIGVuZC1vZi1ibG9ja1xuICAgICAgICAgIHRoaXMuclsyXSA9IHRoaXMudltwKytdOyAgICAgICAgICAvLyBzaW1wbGUgY29kZSBpcyBqdXN0IHRoZSB2YWx1ZVxuICAgICAgICB9XG4gICAgICAgIGVsc2V7XG4gICAgICAgICAgdGhpcy5yWzBdPShlW3RoaXMudltwXS1zXSsxNis2NCk7IC8vIG5vbi1zaW1wbGUtLWxvb2sgdXAgaW4gbGlzdHNcbiAgICAgICAgICB0aGlzLnJbMl09ZFt0aGlzLnZbcCsrXSAtIHNdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlsbCBjb2RlLWxpa2UgZW50cmllcyB3aXRoIHJcbiAgICAgICAgZj0xPDwoay13KTtcbiAgICAgICAgZm9yIChqPWk+Pj53O2o8ejtqKz1mKXtcbiAgICAgICAgICBhcnJheUNvcHkodGhpcy5yLCAwLCBocCwgKHEraikqMywgMyk7XG5cdH1cblxuXHQvLyBiYWNrd2FyZHMgaW5jcmVtZW50IHRoZSBrLWJpdCBjb2RlIGlcbiAgICAgICAgZm9yIChqID0gMSA8PCAoayAtIDEpOyAoaSAmIGopIT0wOyBqID4+Pj0gMSl7XG4gICAgICAgICAgaSBePSBqO1xuXHR9XG4gICAgICAgIGkgXj0gajtcblxuXHQvLyBiYWNrdXAgb3ZlciBmaW5pc2hlZCB0YWJsZXNcbiAgICAgICAgbWFzayA9ICgxIDw8IHcpIC0gMTsgICAgICAvLyBuZWVkZWQgb24gSFAsIGNjIC1PIGJ1Z1xuICAgICAgICB3aGlsZSAoKGkgJiBtYXNrKSAhPSB0aGlzLnhbaF0pe1xuICAgICAgICAgIGgtLTsgICAgICAgICAgICAgICAgICAgIC8vIGRvbid0IG5lZWQgdG8gdXBkYXRlIHFcbiAgICAgICAgICB3IC09IGw7XG4gICAgICAgICAgbWFzayA9ICgxIDw8IHcpIC0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZXR1cm4gWl9CVUZfRVJST1IgaWYgd2Ugd2VyZSBnaXZlbiBhbiBpbmNvbXBsZXRlIHRhYmxlXG4gICAgcmV0dXJuIHkgIT0gMCAmJiBnICE9IDEgPyBaX0JVRl9FUlJPUiA6IFpfT0s7XG59XG5cbkluZlRyZWUucHJvdG90eXBlLmluZmxhdGVfdHJlZXNfYml0cyA9IGZ1bmN0aW9uKGMsIGJiLCB0YiwgaHAsIHopIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIHRoaXMuaW5pdFdvcmtBcmVhKDE5KTtcbiAgICB0aGlzLmhuWzBdPTA7XG4gICAgcmVzdWx0ID0gdGhpcy5odWZ0X2J1aWxkKGMsIDAsIDE5LCAxOSwgbnVsbCwgbnVsbCwgdGIsIGJiLCBocCwgdGhpcy5obiwgdGhpcy52KTtcblxuICAgIGlmKHJlc3VsdCA9PSBaX0RBVEFfRVJST1Ipe1xuICAgICAgei5tc2cgPSBcIm92ZXJzdWJzY3JpYmVkIGR5bmFtaWMgYml0IGxlbmd0aHMgdHJlZVwiO1xuICAgIH1cbiAgICBlbHNlIGlmKHJlc3VsdCA9PSBaX0JVRl9FUlJPUiB8fCBiYlswXSA9PSAwKXtcbiAgICAgIHoubXNnID0gXCJpbmNvbXBsZXRlIGR5bmFtaWMgYml0IGxlbmd0aHMgdHJlZVwiO1xuICAgICAgcmVzdWx0ID0gWl9EQVRBX0VSUk9SO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5JbmZUcmVlLnByb3RvdHlwZS5pbmZsYXRlX3RyZWVzX2R5bmFtaWMgPSBmdW5jdGlvbihubCwgbmQsIGMsIGJsLCBiZCwgdGwsIHRkLCBocCwgeikge1xuICAgIHZhciByZXN1bHQ7XG5cbiAgICAvLyBidWlsZCBsaXRlcmFsL2xlbmd0aCB0cmVlXG4gICAgdGhpcy5pbml0V29ya0FyZWEoMjg4KTtcbiAgICB0aGlzLmhuWzBdPTA7XG4gICAgcmVzdWx0ID0gdGhpcy5odWZ0X2J1aWxkKGMsIDAsIG5sLCAyNTcsIGNwbGVucywgY3BsZXh0LCB0bCwgYmwsIGhwLCB0aGlzLmhuLCB0aGlzLnYpO1xuICAgIGlmIChyZXN1bHQgIT0gWl9PSyB8fCBibFswXSA9PSAwKXtcbiAgICAgIGlmKHJlc3VsdCA9PSBaX0RBVEFfRVJST1Ipe1xuICAgICAgICB6Lm1zZyA9IFwib3ZlcnN1YnNjcmliZWQgbGl0ZXJhbC9sZW5ndGggdHJlZVwiO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAocmVzdWx0ICE9IFpfTUVNX0VSUk9SKXtcbiAgICAgICAgei5tc2cgPSBcImluY29tcGxldGUgbGl0ZXJhbC9sZW5ndGggdHJlZVwiO1xuICAgICAgICByZXN1bHQgPSBaX0RBVEFfRVJST1I7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIGJ1aWxkIGRpc3RhbmNlIHRyZWVcbiAgICB0aGlzLmluaXRXb3JrQXJlYSgyODgpO1xuICAgIHJlc3VsdCA9IHRoaXMuaHVmdF9idWlsZChjLCBubCwgbmQsIDAsIGNwZGlzdCwgY3BkZXh0LCB0ZCwgYmQsIGhwLCB0aGlzLmhuLCB0aGlzLnYpO1xuXG4gICAgaWYgKHJlc3VsdCAhPSBaX09LIHx8IChiZFswXSA9PSAwICYmIG5sID4gMjU3KSl7XG4gICAgICBpZiAocmVzdWx0ID09IFpfREFUQV9FUlJPUil7XG4gICAgICAgIHoubXNnID0gXCJvdmVyc3Vic2NyaWJlZCBkaXN0YW5jZSB0cmVlXCI7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChyZXN1bHQgPT0gWl9CVUZfRVJST1IpIHtcbiAgICAgICAgei5tc2cgPSBcImluY29tcGxldGUgZGlzdGFuY2UgdHJlZVwiO1xuICAgICAgICByZXN1bHQgPSBaX0RBVEFfRVJST1I7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChyZXN1bHQgIT0gWl9NRU1fRVJST1Ipe1xuICAgICAgICB6Lm1zZyA9IFwiZW1wdHkgZGlzdGFuY2UgdHJlZSB3aXRoIGxlbmd0aHNcIjtcbiAgICAgICAgcmVzdWx0ID0gWl9EQVRBX0VSUk9SO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gWl9PSztcbn1cbi8qXG4gIHN0YXRpYyBpbnQgaW5mbGF0ZV90cmVlc19maXhlZChpbnRbXSBibCwgIC8vbGl0ZXJhbCBkZXNpcmVkL2FjdHVhbCBiaXQgZGVwdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludFtdIGJkLCAgLy9kaXN0YW5jZSBkZXNpcmVkL2FjdHVhbCBiaXQgZGVwdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludFtdW10gdGwsLy9saXRlcmFsL2xlbmd0aCB0cmVlIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50W11bXSB0ZCwvL2Rpc3RhbmNlIHRyZWUgcmVzdWx0IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWlN0cmVhbSB6ICAvL2ZvciBtZW1vcnkgYWxsb2NhdGlvblxuXHRcdFx0XHQgKXtcblxuKi9cblxuZnVuY3Rpb24gaW5mbGF0ZV90cmVlc19maXhlZChibCwgYmQsIHRsLCB0ZCwgeikge1xuICAgIGJsWzBdPWZpeGVkX2JsO1xuICAgIGJkWzBdPWZpeGVkX2JkO1xuICAgIHRsWzBdPWZpeGVkX3RsO1xuICAgIHRkWzBdPWZpeGVkX3RkO1xuICAgIHJldHVybiBaX09LO1xufVxuXG5JbmZUcmVlLnByb3RvdHlwZS5pbml0V29ya0FyZWEgPSBmdW5jdGlvbih2c2l6ZSl7XG4gICAgaWYodGhpcy5obj09bnVsbCl7XG4gICAgICAgIHRoaXMuaG49bmV3IEludDMyQXJyYXkoMSk7XG4gICAgICAgIHRoaXMudj1uZXcgSW50MzJBcnJheSh2c2l6ZSk7XG4gICAgICAgIHRoaXMuYz1uZXcgSW50MzJBcnJheShCTUFYKzEpO1xuICAgICAgICB0aGlzLnI9bmV3IEludDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMudT1uZXcgSW50MzJBcnJheShCTUFYKTtcbiAgICAgICAgdGhpcy54PW5ldyBJbnQzMkFycmF5KEJNQVgrMSk7XG4gICAgfVxuICAgIGlmKHRoaXMudi5sZW5ndGg8dnNpemUpeyBcbiAgICAgICAgdGhpcy52PW5ldyBJbnQzMkFycmF5KHZzaXplKTsgXG4gICAgfVxuICAgIGZvcih2YXIgaT0wOyBpPHZzaXplOyBpKyspe3RoaXMudltpXT0wO31cbiAgICBmb3IodmFyIGk9MDsgaTxCTUFYKzE7IGkrKyl7dGhpcy5jW2ldPTA7fVxuICAgIGZvcih2YXIgaT0wOyBpPDM7IGkrKyl7dGhpcy5yW2ldPTA7fVxuLy8gIGZvcihpbnQgaT0wOyBpPEJNQVg7IGkrKyl7dVtpXT0wO31cbiAgICBhcnJheUNvcHkodGhpcy5jLCAwLCB0aGlzLnUsIDAsIEJNQVgpO1xuLy8gIGZvcihpbnQgaT0wOyBpPEJNQVgrMTsgaSsrKXt4W2ldPTA7fVxuICAgIGFycmF5Q29weSh0aGlzLmMsIDAsIHRoaXMueCwgMCwgQk1BWCsxKTtcbn1cblxudmFyIHRlc3RBcnJheSA9IG5ldyBVaW50OEFycmF5KDEpO1xudmFyIGhhc1N1YmFycmF5ID0gKHR5cGVvZiB0ZXN0QXJyYXkuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicpO1xudmFyIGhhc1NsaWNlID0gZmFsc2U7IC8qICh0eXBlb2YgdGVzdEFycmF5LnNsaWNlID09PSAnZnVuY3Rpb24nKTsgKi8gLy8gQ2hyb21lIHNsaWNlIHBlcmZvcm1hbmNlIGlzIHNvIGRpcmUgdGhhdCB3ZSdyZSBjdXJyZW50bHkgbm90IHVzaW5nIGl0Li4uXG5cbmZ1bmN0aW9uIGFycmF5Q29weShzcmMsIHNyY09mZnNldCwgZGVzdCwgZGVzdE9mZnNldCwgY291bnQpIHtcbiAgICBpZiAoY291bnQgPT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgfSBcbiAgICBpZiAoIXNyYykge1xuICAgICAgICB0aHJvdyBcIlVuZGVmIHNyY1wiO1xuICAgIH0gZWxzZSBpZiAoIWRlc3QpIHtcbiAgICAgICAgdGhyb3cgXCJVbmRlZiBkZXN0XCI7XG4gICAgfVxuXG4gICAgaWYgKHNyY09mZnNldCA9PSAwICYmIGNvdW50ID09IHNyYy5sZW5ndGgpIHtcbiAgICAgICAgYXJyYXlDb3B5X2Zhc3Qoc3JjLCBkZXN0LCBkZXN0T2Zmc2V0KTtcbiAgICB9IGVsc2UgaWYgKGhhc1N1YmFycmF5KSB7XG4gICAgICAgIGFycmF5Q29weV9mYXN0KHNyYy5zdWJhcnJheShzcmNPZmZzZXQsIHNyY09mZnNldCArIGNvdW50KSwgZGVzdCwgZGVzdE9mZnNldCk7IFxuICAgIH0gZWxzZSBpZiAoc3JjLkJZVEVTX1BFUl9FTEVNRU5UID09IDEgJiYgY291bnQgPiAxMDApIHtcbiAgICAgICAgYXJyYXlDb3B5X2Zhc3QobmV3IFVpbnQ4QXJyYXkoc3JjLmJ1ZmZlciwgc3JjLmJ5dGVPZmZzZXQgKyBzcmNPZmZzZXQsIGNvdW50KSwgZGVzdCwgZGVzdE9mZnNldCk7XG4gICAgfSBlbHNlIHsgXG4gICAgICAgIGFycmF5Q29weV9zbG93KHNyYywgc3JjT2Zmc2V0LCBkZXN0LCBkZXN0T2Zmc2V0LCBjb3VudCk7XG4gICAgfVxuXG59XG5cbmZ1bmN0aW9uIGFycmF5Q29weV9zbG93KHNyYywgc3JjT2Zmc2V0LCBkZXN0LCBkZXN0T2Zmc2V0LCBjb3VudCkge1xuXG4gICAgLy8gZGxvZygnX3Nsb3cgY2FsbDogc3JjT2Zmc2V0PScgKyBzcmNPZmZzZXQgKyAnOyBkZXN0T2Zmc2V0PScgKyBkZXN0T2Zmc2V0ICsgJzsgY291bnQ9JyArIGNvdW50KTtcblxuICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyArK2kpIHtcbiAgICAgICAgZGVzdFtkZXN0T2Zmc2V0ICsgaV0gPSBzcmNbc3JjT2Zmc2V0ICsgaV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcnJheUNvcHlfZmFzdChzcmMsIGRlc3QsIGRlc3RPZmZzZXQpIHtcbiAgICBkZXN0LnNldChzcmMsIGRlc3RPZmZzZXQpO1xufVxuXG5cbiAgLy8gbGFyZ2VzdCBwcmltZSBzbWFsbGVyIHRoYW4gNjU1MzZcbnZhciBBRExFUl9CQVNFPTY1NTIxOyBcbiAgLy8gTk1BWCBpcyB0aGUgbGFyZ2VzdCBuIHN1Y2ggdGhhdCAyNTVuKG4rMSkvMiArIChuKzEpKEJBU0UtMSkgPD0gMl4zMi0xXG52YXIgQURMRVJfTk1BWD01NTUyO1xuXG5mdW5jdGlvbiBhZGxlcjMyKGFkbGVyLCAvKiBieXRlW10gKi8gYnVmLCAgaW5kZXgsIGxlbil7XG4gICAgaWYoYnVmID09IG51bGwpeyByZXR1cm4gMTsgfVxuXG4gICAgdmFyIHMxPWFkbGVyJjB4ZmZmZjtcbiAgICB2YXIgczI9KGFkbGVyPj4xNikmMHhmZmZmO1xuICAgIHZhciBrO1xuXG4gICAgd2hpbGUobGVuID4gMCkge1xuICAgICAgaz1sZW48QURMRVJfTk1BWD9sZW46QURMRVJfTk1BWDtcbiAgICAgIGxlbi09aztcbiAgICAgIHdoaWxlKGs+PTE2KXtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICBzMSs9YnVmW2luZGV4KytdJjB4ZmY7IHMyKz1zMTtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICBzMSs9YnVmW2luZGV4KytdJjB4ZmY7IHMyKz1zMTtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICBzMSs9YnVmW2luZGV4KytdJjB4ZmY7IHMyKz1zMTtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICBzMSs9YnVmW2luZGV4KytdJjB4ZmY7IHMyKz1zMTtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICBzMSs9YnVmW2luZGV4KytdJjB4ZmY7IHMyKz1zMTtcbiAgICAgICAgczErPWJ1ZltpbmRleCsrXSYweGZmOyBzMis9czE7XG4gICAgICAgIGstPTE2O1xuICAgICAgfVxuICAgICAgaWYoayE9MCl7XG4gICAgICAgIGRve1xuICAgICAgICAgIHMxKz1idWZbaW5kZXgrK10mMHhmZjsgczIrPXMxO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlKC0tayE9MCk7XG4gICAgICB9XG4gICAgICBzMSU9QURMRVJfQkFTRTtcbiAgICAgIHMyJT1BRExFUl9CQVNFO1xuICAgIH1cbiAgICByZXR1cm4gKHMyPDwxNil8czE7XG59XG5cblxuXG5mdW5jdGlvbiBqc3psaWJfaW5mbGF0ZV9idWZmZXIoYnVmZmVyLCBzdGFydCwgbGVuZ3RoLCBhZnRlclVuY09mZnNldCkge1xuICAgIGlmICghc3RhcnQpIHtcbiAgICAgICAgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICB9IGVsc2UgaWYgKCFsZW5ndGgpIHtcbiAgICAgICAgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCBzdGFydCwgYnVmZmVyLmJ5dGVMZW5ndGggLSBzdGFydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCBzdGFydCwgbGVuZ3RoKTtcbiAgICB9XG5cbiAgICB2YXIgeiA9IG5ldyBaU3RyZWFtKCk7XG4gICAgei5pbmZsYXRlSW5pdChERUZfV0JJVFMsIHRydWUpO1xuICAgIHoubmV4dF9pbiA9IGJ1ZmZlcjtcbiAgICB6Lm5leHRfaW5faW5kZXggPSAwO1xuICAgIHouYXZhaWxfaW4gPSBidWZmZXIubGVuZ3RoO1xuXG4gICAgdmFyIG9CbG9ja0xpc3QgPSBbXTtcbiAgICB2YXIgdG90YWxTaXplID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB2YXIgb2J1ZiA9IG5ldyBVaW50OEFycmF5KDMyMDAwKTtcbiAgICAgICAgei5uZXh0X291dCA9IG9idWY7XG4gICAgICAgIHoubmV4dF9vdXRfaW5kZXggPSAwO1xuICAgICAgICB6LmF2YWlsX291dCA9IG9idWYubGVuZ3RoO1xuICAgICAgICB2YXIgc3RhdHVzID0gei5pbmZsYXRlKFpfTk9fRkxVU0gpO1xuICAgICAgICBpZiAoc3RhdHVzICE9IFpfT0sgJiYgc3RhdHVzICE9IFpfU1RSRUFNX0VORCAmJiBzdGF0dXMgIT0gWl9CVUZfRVJST1IpIHtcbiAgICAgICAgICAgIHRocm93IHoubXNnO1xuICAgICAgICB9XG4gICAgICAgIGlmICh6LmF2YWlsX291dCAhPSAwKSB7XG4gICAgICAgICAgICB2YXIgbmV3b2IgPSBuZXcgVWludDhBcnJheShvYnVmLmxlbmd0aCAtIHouYXZhaWxfb3V0KTtcbiAgICAgICAgICAgIGFycmF5Q29weShvYnVmLCAwLCBuZXdvYiwgMCwgKG9idWYubGVuZ3RoIC0gei5hdmFpbF9vdXQpKTtcbiAgICAgICAgICAgIG9idWYgPSBuZXdvYjtcbiAgICAgICAgfVxuICAgICAgICBvQmxvY2tMaXN0LnB1c2gob2J1Zik7XG4gICAgICAgIHRvdGFsU2l6ZSArPSBvYnVmLmxlbmd0aDtcbiAgICAgICAgaWYgKHN0YXR1cyA9PSBaX1NUUkVBTV9FTkQgfHwgc3RhdHVzID09IFpfQlVGX0VSUk9SKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChhZnRlclVuY09mZnNldCkge1xuICAgICAgICBhZnRlclVuY09mZnNldFswXSA9IChzdGFydCB8fCAwKSArIHoubmV4dF9pbl9pbmRleDtcbiAgICB9XG5cbiAgICBpZiAob0Jsb2NrTGlzdC5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gb0Jsb2NrTGlzdFswXS5idWZmZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG91dCA9IG5ldyBVaW50OEFycmF5KHRvdGFsU2l6ZSk7XG4gICAgICAgIHZhciBjdXJzb3IgPSAwO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9CbG9ja0xpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBiID0gb0Jsb2NrTGlzdFtpXTtcbiAgICAgICAgICAgIGFycmF5Q29weShiLCAwLCBvdXQsIGN1cnNvciwgYi5sZW5ndGgpO1xuICAgICAgICAgICAgY3Vyc29yICs9IGIubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXQuYnVmZmVyO1xuICAgIH1cbn1cblxuaWYgKHR5cGVvZihtb2R1bGUpICE9PSAndW5kZWZpbmVkJykge1xuICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBpbmZsYXRlQnVmZmVyOiBqc3psaWJfaW5mbGF0ZV9idWZmZXIsXG4gICAgYXJyYXlDb3B5OiBhcnJheUNvcHlcbiAgfTtcbn1cbiJdfQ==
