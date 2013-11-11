/*!
 * ENDER - The open module JavaScript framework
 *
 * Copyright (c) 2011-2012 @ded, @fat, @rvagg and other contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


var buster          = require('bustermove')
  , assert          = require('referee').assert
  , refute          = require('referee').refute

  , async           = require('async')
  , fs              = require('fs')
  , mkfiletree      = require('mkfiletree')
  , path            = require('path')
  
  , LocalPackage    = require('../lib/local-package')
  , FilesystemError = require('errno').custom.FilesystemError

buster.testCase('LocalPackage', {
    'loadDescriptor': {
        'basic descriptor': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , { 'package.json': JSON.stringify({ foo: 'bar' }) }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                pkg.loadDescriptor(function (err) {
                  refute(err)
                  assert.equals(pkg.descriptor.foo, 'bar')
                  done()
                })
              }
          )
        }
        
      , 'missing descriptor': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {}
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                pkg.loadDescriptor(function (err) {
                  assert(err)
                  assert(err.code == 'ENOENT')
                  done()
                })
              }
          )
        }
    }
    
  , 'loadSources': {
        'default main': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({})
                , 'index.js'     : '// index.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  refute(err)
                  assert.equals(pkg.main, 'index')
                  assert.equals(pkg.sources[pkg.main], '// index.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                  done()
                })
              }
          )
        }

      , 'specified main (no extension)': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ main: 'main' })
                , 'main.js'      : '// main.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.sources[pkg.main], '// main.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                  done()
                })
              }
          )
        }

      , 'specified main (with extension)': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ main: 'main.js' })
                , 'main.js'      : '// main.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.sources[pkg.main], '// main.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                  done()
                })
              }
          )
        }

      , 'specified main (from directory)': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ main: 'main' })
                , 'main'         : { 'index.js' : '// main/index.js contents' }
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.main, 'main/index')
                  assert.equals(pkg.sources[pkg.main], '// main/index.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                  done()
                })
              }
          )
        }

      , 'globbed main': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ main: '*.js' })
                , 'main1.js'         : '// main1.js contents'
                , 'main2.js'         : '// main2.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.sources[pkg.main], '// main1.js contents\n\n// main2.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                  done()
                })
              }
          )
        }

      , 'main, bridge and files': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({
                                       main: "main"
                                     , bridge: "bridge.js"
                                     , files: ['file1.js', 'file2.js']
                                   })
                , 'main.js'      : '// main.js contents'
                , 'bridge.js'    : '// bridge.js contents'
                , 'file1.js'     : '// file1.js contents'
                , 'file2.js'     : '// file2.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.bridge, 'bridge')
                  assert.equals(pkg.sources[pkg.main], '// main.js contents')
                  assert.equals(pkg.sources[pkg.bridge], '// bridge.js contents')
                  assert.equals(pkg.sources['file1'], '// file1.js contents')
                  assert.equals(pkg.sources['file2'], '// file2.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 4)
                  done()
                })
              }
          )
        }

      , 'main, bridge and globs': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({
                                       main: "main"
                                     , bridge: "bridge.js"
                                     , files: ['file*.js']
                                   })
                , 'main.js'      : '// main.js contents'
                , 'bridge.js'    : '// bridge.js contents'
                , 'file1.js'     : '// file1.js contents'
                , 'file2.js'     : '// file2.js contents'
                , 'skip.js'      : '// skip.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.bridge, 'bridge')
                  assert.equals(pkg.sources[pkg.main], '// main.js contents')
                  assert.equals(pkg.sources[pkg.bridge], '// bridge.js contents')
                  assert.equals(pkg.sources['file1'], '// file1.js contents')
                  assert.equals(pkg.sources['file2'], '// file2.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 4)
                  done()
                })
              }
          )
        }

      , 'duplicates and subdirs': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({
                                       main: "main"
                                     , bridge: "bridge.js"
                                     , files: ['*.js', 'skip.js', 'subdir']
                                   })
                , 'main.js'      : '// main.js contents'
                , 'bridge.js'    : '// bridge.js contents'
                , 'file1.js'     : '// file1.js contents'
                , 'file2.js'     : '// file2.js contents'
                , 'subdir'       : { 'file3.js': '// subdir/file3.js contents' }
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.main, 'main')
                  assert.equals(pkg.bridge, 'bridge')
                  assert.equals(pkg.sources[pkg.main], '// main.js contents')
                  assert.equals(pkg.sources[pkg.bridge], '// bridge.js contents')
                  assert.equals(pkg.sources['file1'], '// file1.js contents')
                  assert.equals(pkg.sources['file2'], '// file2.js contents')
                  assert.equals(pkg.sources['subdir/file3'], '// subdir/file3.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 5)
                  done()
                })
              }
          )
        }

      , 'skip non-js files': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ files: ['*'] })
                , 'file1.js'     : '// file1.js contents'
                , 'file2.js'     : '// file2.js contents'
                , 'skip.jsjs'    : '// skip.jsjs contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.sources['file1'], '// file1.js contents')
                  assert.equals(pkg.sources['file2'], '// file2.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 2)
                  done()
                })
              }
          )
        }

      , 'deep nested directory (matched with glob)': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ files: ['sub*1'] })
                , 'subdir1': {
                      'file1.js': '// file1.js contents'
                    , 'subdir2': {
                          'file2.js': '// file2.js contents'
                        , 'file3.js': '// file3.js contents'
                        , 'subdir3': {
                              'file4.js': '// file4.js contents'
                        
                          }
                      }
                  } 
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  if (err) throw(err)
                  refute(err)
                  assert.equals(pkg.sources['subdir1/file1'], '// file1.js contents')
                  assert.equals(pkg.sources['subdir1/subdir2/file2'], '// file2.js contents')
                  assert.equals(pkg.sources['subdir1/subdir2/file3'], '// file3.js contents')
                  assert.equals(pkg.sources['subdir1/subdir2/subdir3/file4'], '// file4.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 4)
                  done()
                })
              }
          )
        }
        
      , 'multiple calls to loadSources': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ files: 'foo.js' })
                , 'foo.js': '// foo.js contents'
                , 'bar.js': '// bar.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                
                pkg.loadDescriptor(function (err) {
                  refute(err)

                  pkg.loadSources(function (err) {
                    refute(err)
                    assert.equals(pkg.sources['foo'], '// foo.js contents')
                    assert.equals(Object.keys(pkg.sources).length, 1)
                  })
                
                  // Change the files attribute and call again (shouldn't change sources)
                  pkg.descriptor.files = 'bar.js'
                  pkg.loadSources(function (err) {
                    refute(err)
                    assert.equals(pkg.sources['foo'], '// foo.js contents')
                    assert.equals(Object.keys(pkg.sources).length, 1)
                    
                    // Once more after completion
                    pkg.loadSources(function (err) {
                      refute(err)
                      assert.equals(pkg.sources['foo'], '// foo.js contents')
                      assert.equals(Object.keys(pkg.sources).length, 1)
                      done()
                    })
                  })
                })
              }
          )
        }

      , 'multiple calls to loadSources (with unload)': function (done) {
          mkfiletree.makeTemp(
              'ender-test-local-package'
            , {
                  'package.json' : JSON.stringify({ files: 'foo.js' })
                , 'foo.js': '// foo.js contents'
                , 'bar.js': '// bar.js contents'
              }
            , function (err, dir) {
                refute(err)
                var pkg = LocalPackage.create(dir)
                async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
                  refute(err)
                  assert.equals(pkg.sources['foo'], '// foo.js contents')
                  assert.equals(Object.keys(pkg.sources).length, 1)
                    
                  // Unload the package
                  pkg.unload()
                  pkg.loadDescriptor(function (err) {
                    refute(err)
                    pkg.descriptor.files = 'bar.js'

                    // Now we should load bar.js
                    pkg.loadSources(function (err) {
                      refute(err)
                      assert.equals(pkg.sources['bar'], '// bar.js contents')
                      assert.equals(Object.keys(pkg.sources).length, 1)
                      done()
                    })
                  })
                })
              }
          )
        }
    }

  , 'test identifier': function (done) {
      mkfiletree.makeTemp(
          'ender-test-local-package'
        , { 'package.json' : JSON.stringify({ name: 'foobar', version: '1.2.3', ender: { name: 'quux' } }) }
        , function (err, dir) {
            refute(err)
            var pkg = LocalPackage.create(dir)
            async.series([ pkg.loadDescriptor.bind(pkg), pkg.loadSources.bind(pkg)], function (err) {
              refute(err)
              assert.equals(pkg.name, 'quux')
              assert.equals(pkg.id, 'foobar@1.2.3')
              pkg.descriptor.__proto__ = { name: 'barfoo' } // original json, see package-descriptor.js
              assert.equals(pkg.name, 'quux')
              assert.equals(pkg.id, 'barfoo@1.2.3')
              done()
            })
          }
      )
    }

  , 'extendOptions': {
        'test nothing to extend': function () {
          var pkg = LocalPackage.create('/whatevs')
            , opts = { foo: 'bar' }

          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar' }) // shoudn't be touched
        }
  
      , 'test externs': function () {
          var pkg = LocalPackage.create('/whatevs')
            , opts = { foo: 'bar' }

          pkg.descriptor = { externs: 'lib/foo.js' }
          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [ '/whatevs/lib/foo.js' ] })
        }

      , 'test externs array over existing externs': function () {
          var pkg  = LocalPackage.create('/whatevs')
            , opts = { foo: 'bar', externs: [ 'existing1.js', 'existing2.js' ] }
  
          pkg.descriptor = { externs: [ 'lib/foo.js', 'BOOM.js' ] }
          pkg.extendOptions(opts)
          assert.equals(opts, { foo: 'bar', externs: [
              'existing1.js'
            , 'existing2.js'
            , path.resolve('/whatevs/lib/foo.js')
            , path.resolve('/whatevs/BOOM.js')
          ] })
        }
    }
})