import Bacon from 'baconjs'
import _ from 'lodash'
import Promise from 'bluebird'
import fs from 'fs'
import fse from 'fs-extra'

var copy = Promise.promisify(fse.copy)
var rm = Promise.promisify(fse.remove)

import Event from '../../Event'
import glob from '../../plugin/glob'

var FIXTURE_PATH = 'test/fixtures/simple-project'
var TMP_PATH = 'test/tmp/glob'
var FIXTURE_FILES = [
  FIXTURE_PATH + '/file1.js',
  FIXTURE_PATH + '/file2.js'
]

describe('glob plugin', () => {
  it('globs a wildcard', () => {
    return glob({}, FIXTURE_PATH + '/*.js').toPromise(Promise).then(updates => {
      updates.length.should.equal(2)
      _.pluck(updates, 'projectPath').sort().should.eql(FIXTURE_FILES)
      updates.forEach(file => {
        file.type.should.equal('add')
        file.opTreeIndex.should.equal(1)
      })
    })
  })

  it('globs a wildcard using the basePath option', () => {
    var opData = { treeIndex: 4 }
    return glob(opData, { basePath: FIXTURE_PATH }, '*.js')
    .toPromise(Promise)
    .then(updates => {
      opData.nextTreeIndex.should.equal(5)
      updates.length.should.equal(2)
      updates[0].projectPath.should.equal('file1.js')
      updates[1].projectPath.should.equal('file2.js')
    })
  })

  it('globs two wildcards', () => {
    var opData = { treeIndex: 1 }
    return glob(opData, FIXTURE_PATH + '/*1.js', FIXTURE_PATH + '/*2.js')
    .toPromise(Promise)
    .then(updates => {
      opData.nextTreeIndex.should.equal(3)
      updates.length.should.equal(2)
      _.pluck(updates, 'path').sort().should.eql(FIXTURE_FILES)
      updates[0].opTreeIndex.should.equal(1)
      updates[1].opTreeIndex.should.equal(2)
      updates.forEach(file => { file.type.should.equal('add') })
    })
  })

  it('detects changes to two files matching globbed pattern', () => {
    return rm(TMP_PATH).then(() => {
      return copy(FIXTURE_PATH, TMP_PATH)
    })
    .then(() => {
      return new Promise(function(resolve) {
        var nUpdates = 0
        var files = [ TMP_PATH + '/file1.js', TMP_PATH + '/file2.js' ]
        glob({ watch: true, treeIndex: 4 }, TMP_PATH + '/*.js')
        .onValue(updates => {
          if (++nUpdates === 1) {
            updates.length.should.equal(2)
            _.delay(fs.appendFile, 50, files[0], 'var file1line2 = 24;\n')
            _.delay(fs.appendFile, 500, files[1], 'var file2line2 = 25;\n')
          }
          else {
            updates.should.eql([
              new Event({
                type: 'change',
                path: files[nUpdates - 2],
                opTreeIndex: 4,
                createTime: updates[0].createTime
              }),
            ])
            if (nUpdates === 3) {
              resolve()
              return Bacon.noMore
            }
          }
        })
      })
    })
  })

  it('detects new file', () => {
    // TODO: allow this to work at TMP_PATH, could be to do with the chokidar watchers
    //       not being closed between test runs.
    var tmpPath = TMP_PATH + '2'
    return rm(tmpPath).then(() => {
      return copy(FIXTURE_PATH, tmpPath)
    })
    .then(() => {
      var addedFile = tmpPath + '/added-file.js'
      return new Promise(function(resolve) {
        var nUpdates = 0
        var files = [ tmpPath + '/file1.js', tmpPath + '/file2.js' ]
        glob({ watch: true, treeIndex: 4 }, tmpPath + '/*.js')
        .onValue(updates => {
          if (++nUpdates === 1) {
            updates.length.should.equal(2)
            _.delay(fs.writeFile, 300, addedFile, 'var file3line1 = 33;\n')
          }
          else {
            updates.should.eql([
              new Event({
                type: 'add',
                path: addedFile,
                opTreeIndex: 4,
                createTime: updates[0].createTime
              }),
            ])
            resolve()
            return Bacon.noMore
          }
        })
      })
    })
  })

  xit('detects file unlink', () => {
  })

  xit('detects file rename', () => {
  })

  it('only accepts first position in pipeline', () => {
    (() => {
      // the first argument is the stream and must be null for the glob operation,
      // this is a special value passed during the stream construction in src/api.js
      glob({ stream: 'some stream' }, FIXTURE_PATH + '/*.js')
    }).should.throw()
  })
})
