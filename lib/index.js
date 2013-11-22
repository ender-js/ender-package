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
  , semver          = require('semver')

  , LocalPackage    = require('./local-package')

  , PackageNotFoundError = require('./errors').PackageNotFoundError
  , PackageNotLocalError = require('./errors').PackageNotLocalError

  , loadPackage = function (root, callback) {
      var pkg = LocalPackage.create(root)
      pkg.loadDescriptor(function (err) {
        if (err) return callback(err)
        callback(null, pkg)
      })
    }

  , packageMappings = {}

  , unloadPackage = function (root) {
      LocalPackage.create(root).unload()

      for (key in packageMappings)
        if (packageMappings[key] == root)
          delete packageMappings[key]
    }

  , addPackageMapping = function (id, root) {
      packageMappings[id] = root
    }

  , findPackage = function (id, root, callback) {
      var name = repository.util.getName(id)
        , version = repository.util.getVersion(id)
        , nameType = repository.util.getNameType(name)
        , matches = function (pkg) {
            return (pkg &&
                    (nameType == 'path' || pkg.originalName == name) &&
                    semver.satisfies(pkg.version, version))
          }

      root = path.resolve(root)

      // See if we've mapped this package id to a local package
      if (id in packageMappings) {
        name = packageMappings[id]
        nameType = 'path'
      }

      switch (nameType) {
        case 'path':
          loadPackage(name, function (err, pkg) {
            if (matches(pkg)) return callback(null, pkg)
            return callback(new PackageNotFoundError("Package at '" + name + "' does not satisfy version '" + version + "'."))
          })
          break

        case 'package':
          // Don't search above the CWD
          if (/^\.\./.test(path.relative('.', root)))
            return callback(new PackageNotFoundError("Package '" + id + "' could not be found."))

          loadPackage(root, function (err, pkg) {
            if (matches(pkg)) return callback(null, pkg)

            loadPackage(repository.util.getChildRoot(name, root), function (err, pkg) {
              if (matches(pkg)) return callback(null, pkg)

              findPackage(id, path.dirname(root), callback)
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

  , walkDependencies = function (ids, unique, strict, callback) {
      var packages = []
        , missing = []
        , seenNames = []
        , seenRoots = []

        , processId = function (id, root, callback) {
            findPackage(id, root, function (err, pkg) {
              if (err) {
                if (strict) return callback(err)

                missing.push(id)
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
              , function (id, callback) { processId(id, pkg.root, callback) }
              , function (err) {
                  if (err) return callback(err)
                  packages.push(pkg)
                  seenNames.push(pkg.originalName)
                  callback()
              }
            )
          }

      async.map(
          ids
        , function (id, callback) { processId(id, '.', callback) }
        , function (err) {
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

  , buildArchyTree = function (ids, pretty, callback) {
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

        , processId = function (id, root, callback) {
            findPackage(id, root, function (err, dep) {
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
              , function (id, callback) { processId(id, pkg.root, callback) }
              , function (err, nodes) {
                if (err) return callback(err)
                node.nodes = nodes
                callback(null, node)
              }
            )
          }

      async.map(
          ids
        , function (id, callback) { processId(id, '.', callback) }
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
  , addPackageMapping : addPackageMapping
  , findPackage       : findPackage
  , walkDependencies  : walkDependencies
  , buildArchyTree    : buildArchyTree
  , LocalPackage      : LocalPackage
}