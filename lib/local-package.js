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


var async           = require('async')
  , fs              = require('fs')
  , glob            = require('glob')
  , path            = require('path')
  , repository      = require('ender-repository')
  
  , Descriptor      = require('./descriptor')

  , JSONParseError  = require('./errors').JSONParseError
  , FilesystemError = require('./errors').FilesystemError
  
  , unitaryHash = function () { return '_' }

  , LocalPackage = {
        init: function (root) {
          this.root = root

          // Memoize methods that hit the disk
          this.loadDescriptor = async.memoize(this.loadDescriptor.bind(this), unitaryHash)
          this.loadSources = async.memoize(this.loadSources.bind(this), unitaryHash)
          
          return this
        }
        
      , unload: function () {
          delete this.loadDescriptor.memo._
          delete this.loadSources.memo._
          delete this.descriptor
          delete this.sources
        }
                
      , get originalName () {
          return Object.getPrototypeOf(this.descriptor).name
        }

      , get id () {
          return this.originalName + '@' + this.version
        }
    
      , get dependencies () {
          var ids = this.descriptor.dependencies || []
          ids = Array.isArray(ids) ? ids : Object.keys(ids)
          return ids.map(repository.util.getName)
        }

      , extendOptions: function (options) {
          var externs = this.descriptor && this.descriptor.externs
            , root = this.root

          if (externs) {
            if (!Array.isArray(externs)) externs = [ externs ]
            if (!options.externs) options.externs = []
            options.externs = options.externs.concat(externs.map(function (e) {
              return path.join(root, e)
            }))
          }
        }

      , loadDescriptor: function (callback) {
          var descriptorPath = repository.util.getPackageDescriptor(this.root)
          
          fs.readFile(descriptorPath, 'utf-8', function (err, data) {
            if (err) return callback(new FilesystemError(err))
          
            try {
              data = JSON.parse(data)
            } catch (err) {
              return callback(new JSONParseError(err.message + ' [' + descriptorPath + ']', err))
            }
        
            this.descriptor = Descriptor.create(data)
            this.name = this.descriptor.name
            this.version = this.descriptor.version || ''
            this.description = this.descriptor.description || ''
            this.bare = !!this.descriptor.bare

            callback()
          }.bind(this))
        }
    
      , loadSources: function (callback) {
          var loadFile = async.memoize(function (file, callback) {
                file = path.normalize(file)
                fs.readFile(path.join(this.root, file), 'utf-8', function (err, contents) {
                  if (err) return callback(new FilesystemError(err))
                  callback(null, { name: file.replace(/(\.js)?$/, ''), contents: contents })
                })
              }.bind(this))

            , expandGlob = async.memoize(function (file, callback) {
                // use glob.Glob because it's easier to stub for tests
                new glob.Glob(file, { cwd: this.root, root: this.root, nomount: true }, function (err, files) {
                  if (err) return callback(new FilesystemError(err))
                  callback(null, files)
                })
              }.bind(this))
            
            , expandDirectory = async.memoize(function (file, callback) {
                fs.stat(path.join(this.root, file), function (err, stats) {
                  if (err) return callback(new FilesystemError(err))
                  if (!stats.isDirectory()) return callback(null, [ file ])
                  
                  fs.readdir(path.join(this.root, file), function (err, names) {
                    if (err) return callback(new FilesystemError(err))
                    
                    var files = names.map(function (name) { return path.join(file, name) })
                    async.concat(files, expandDirectory, callback)
                  })
                }.bind(this))
              }.bind(this))
              
            , contractDirectory = async.memoize(function (file, callback) {
                fs.stat(path.join(this.root, file), function (err, stats) {
                  if (err) return callback(new FilesystemError(err))
                  if (stats.isDirectory()) return callback(null, [])
                  return callback(null, [ file ])
                }.bind(this))
              }.bind(this))
            
            , loadModule = function (name, callback) {
                var files = this.descriptor[name] || []
                if (typeof files == 'string') files = [ files ]
                if (!Array.isArray(files)) files = files['scripts'] || []

                // default to index as the main module
                if (name == 'main' && !files.length) {
                  files = [ 'index', 'index.js' ]
                } else {
                  // add additional search paths
                  files = files.concat(
                              files.map(function (file) { return file + '.js' })
                            , files.map(function (file) { return path.join(file, 'index.js') })
                          )
                }
              
                async.concat(files, expandGlob, function (err, files) {
                  if (err) return callback(err)

                  async.concat(files, contractDirectory, function (err, files) {
                    if (err) return callback(err)

                    async.map(files, loadFile, function (err, sources) {
                      if (err) return callback(err)

                      if (sources.length > 1) {
                        // If we have an array of files, combine them into one file
                        sources = [{
                            name: name
                          , contents: sources.map(function (s) { return s.contents }).join('\n\n')
                        }]
                      }
                    
                      if (sources.length) {
                        this.sources[sources[0].name] = sources[0].contents
                        this[name] = sources[0].name
                      }
                    
                      callback()
                    }.bind(this))
                  }.bind(this))
                }.bind(this))
              }.bind(this)

            , loadFiles = function (callback) {
                var files = this.descriptor.files || []
                if (typeof files == 'string') files = [ files ]
                if (!Array.isArray(files)) files = files['scripts'] || []

                async.concat(files, expandGlob, function (err, files) {
                  if (err) return callback(err)

                  async.concat(files, expandDirectory, function (err, files) {
                    if (err) return callback(err)
                
                    // Only look at .js files
                    files = files.filter(function (f) { return /\.js$/.test(f) })
                    
                    async.map(files, loadFile, function (err, sources) {
                      if (err) return callback(err)
                      
                      sources.forEach(function (source) { 
                        this.sources[source.name] = source.contents
                      }.bind(this))
                      
                      callback()
                    }.bind(this))
                  }.bind(this))
                }.bind(this))
              }.bind(this)

          this.sources = {}
          async.parallel([
              loadModule.bind(null, 'main')
            , loadModule.bind(null, 'bridge')
            , loadFiles
          ], callback)
        }
      }
      
  , create = function (root, callback) {
      root = path.resolve(root)
      return create.memo[root] || (create.memo[root] = Object.create(LocalPackage).init(root))
    }

create.memo = {}


module.exports = {
    create        : create
}