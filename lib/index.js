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


var archy           = require('archy')
  , async           = require('async')
  , colors          = require('colors')
  , path            = require('path')
  , repository      = require('ender-repository')
  
  , LocalPackage    = require('./local-package')

  , PackageNotFoundError = require('./errors').PackageNotFoundError
  , PackageNotLocal      = require('./errors').PackageNotLocal
  
  , loadPackage = function (root, callback) {
      var pkg = LocalPackage.create(root)
      pkg.loadDescriptor(function (err) {
        if (err) return callback(err)
        callback(null, pkg)
      })
    }
    
  , unloadPackage = function (root) {
      LocalPackage.create(root).unload()
    }

  , findPackage = function (name, root, callback) {
      root = path.resolve(root)
      
      switch (repository.util.getNameType(name)) {
        case 'path':
          loadPackage(path.resolve(name), callback)
          break
          
        case 'package':
          loadPackage(root, function (err, pkg) {
            if (pkg && pkg.originalName == name) return callback(null, pkg)

            loadPackage(repository.util.getChildRoot(name, root), function (err, pkg) {
              if (pkg && pkg.originalName == name)
                return callback(null, pkg)
                
              if (path.dirname(root) == root)
                return callback(new PackageNotFoundError("Package '" + name + "' could not be found."))
                
              findPackage(name, path.dirname(root), callback)
            })
          })
          break
          
        case 'tarball':
        case 'url':
        case 'git':
        case 'github':
          callback(new PackageNotLocalError('Can only find packages by path or name'))
          break
      } 
    }

  , walkDependencies = function (names, unique, strict, callback) {
      var packages = []
        , missing = []
        , seenNames = []
        , seenRoots = []
      
        , processName = function (name, root, callback) {
            findPackage(name, root, function (err, pkg) {
              if (err) {
                if (strict) return callback(err)
            
                missing.push(name)
                return callback()
              }

              processPackage(pkg, callback)
            })
          }
      
        , processPackage = function (pkg, callback) {
            if (seenRoots.indexOf(pkg.root) != -1) return callback()
            seenRoots.push(pkg.root)
    
            async.map(
                pkg.dependencies
              , function (name, callback) { processName(name, pkg.root, callback) }
              , function (err) {
                  if (err) return callback(err)
                  packages.push(pkg)
                  seenNames.push(pkg.originalName)
                  callback()
              }
            )
          }
    
      async.map(
          names
        , function (name, callback) { processName(name, '.', callback) }
        , function (err, nodes) {
            if (err) return callback(err)
      
            if (unique) {
              // Return only the first package if we found multiple instances
              packages = packages.filter(function (p, i) { return seenNames.indexOf(p.originalName) == i })
              missing = missing.filter(function (n, i) { return missing.indexOf(n) == i })
            }
      
            callback(null, packages, missing)
          }
      )
    }

  , buildArchyTree = function (names, pretty, callback) {
      var prettify = function (branch) {
            branch.nodes && branch.nodes.forEach(prettify)
          
            if (branch.version) {
              branch.label =
                  (branch.label + '@' + branch.version)[branch.first ? 'yellow' : 'grey']
                + ' - '[branch.first ? 'white' : 'grey']
                + (branch.description || '')[branch.first ? 'white' : 'grey']
            } else if (!branch.heading) {
              branch.label = (branch.label + ' - ' + 'MISSING').red
            }
          
            return branch
          }
      
        , seenRoots = []
      
        , processName = function (name, root, callback) {
            findPackage(name, root, function (err, dep) {
              if (err) return callback(err)
              processPackage(dep, callback)
            })
          }
        
        , processPackage = function (pkg, callback) {
            var node = { label: pkg.name }
              , first = seenRoots.indexOf(pkg.root) == -1
  
            seenRoots.push(pkg.root)
      
            node.first = first
            node.version = pkg.version
            node.description = pkg.description

            async.map(
                pkg.dependencies
              , function (name, callback) { processName(name, pkg.root, callback) }
              , function (err, nodes) {
                if (err) return callback(err)
                node.nodes = nodes
                callback(null, node)
              }
            )
          }
        
      async.map(
          names
        , function (name, callback) { processName(name, '.', callback) }
        , function (err, nodes) {
            if (err) return callback(err)
          
            var archyTree = {
                    label: 'Active packages:'
                  , heading: true
                  , nodes: nodes
                }
          
            callback(null, archy(pretty ? prettify(archyTree) : archyTree))
          }
      )
    }


module.exports = {
    loadPackage       : loadPackage
  , unloadPackage     : unloadPackage
  , findPackage       : findPackage
  , walkDependencies  : walkDependencies
  , buildArchyTree    : buildArchyTree
  , LocalPackage      : LocalPackage
}