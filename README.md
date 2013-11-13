# Ender Package [![Build Status](https://secure.travis-ci.org/ender-js/ender-package.png)](http://travis-ci.org/ender-js/ender-package)

A component of the [Ender CLI](https://github.com/ender-js/Ender/), providing an interface for working with source packages, including Ender-specific extensions to the package.json format.

## About Ender

For more information check out [http://ender.jit.su](http://ender.jit.su)

## API

### loadPackage(root, callback)
`loadPackage()` will attempt to load the package located at the given root directory. It will try to read the package descriptor (including applying Ender-specific overrides) and then, if successful, return the LocalPackage object through the callback.

-------------------------

### unloadPackage(root)
`unloadPackage()` should be used when a previously-loaded package has changed on disk. The ender-package module caches all package operations that touch the disk, so if the on-disk representation of the package changes, you must call `unloadPackage()` for those changes to be recognized.

-------------------------

### findPackage(id, root, callback)
`findPackage()` is similar to `loadPackage()`, except that instead of taking a package root directory, it is passed a package id, which it will attempt to find using the standard Node search algorithm, walking up the directory tree from the given root directory to see if it can find the package in any parent, or any 'node_modules' directory. If the package id includes a version, only packages which satisfy the version requirement will be returned.

*NOTE: Since this attempts to load parent packages to see if they match the given name, those packages will become cached, and you may need to call `unloadPackage()` if those packages change.*

-------------------------

### walkDependencies(ids, unique, strict, callback)
`walkDependencies()` will find all the package ids passed into it, as well as recursively loading all of their dependencies. The `unique` argument indicates whether duplicate packages with the same name (but perhaps different versions) should be filtered out. If the `strict` argument is true, any dependency that cannot be found will trigger an error. If the `strict` argument is false, missing dependencies will be collected and passed to the callback. If no error occurs (or `strict` is false), the callback will receive a list of LocalPackage objects in depth-first order, as well as a list of missing dependencies.

-------------------------

### buildArchyTree(ids, pretty, callback)
`archyTree()` will take a list of package ids and returns through the callback an Archy tree showing the named packages and their dependencies. The `pretty` argument will add coloring to the output for display on the console.

-------------------------

### LocalPackage.create(root)
`LocalPackage` objects should generally not be created directly, but rather with `loadPackage()` or `findPackage()`. If you use the `create()` function to create a `LocalPackage` object, you are responsible for calling `loadDescriptor` to load the package descriptor. This will allow you to lookup properties of the package like `id`, `name`, `version`, and `description`. The `loadSources()` method will load the package source files into `pkg.sources` with the key as the module name and the value as the contents of the file.

-------------------------

### LocalPackage.loadDescriptor(callback)
`LocalPackage.loadDescriptor()` uses `ender-repository` to locate the package descriptor file for the given package and then return it **modfied for use by Ender**. The callback will signal whether an error has occured, and otherwise, the descriptor can be accessed as `pkg.descriptor`.

Given a standard package descriptor file, the following keys will be replaced if they exist in either the *"ender"* subkey, or the *"overlay"->"ender"* sub-subkey:

  * "name"
  * "main"
  * "bridge"
  * "files"
  * "dependencies"
  * "devDependencies"
  * "bare"

This allows package owners to provide packages that differ when used in Node and in Ender.

For example, given a *package.json*:

```json
{
  "name": "foo",
  "main": "foo.js",
  "ender": {
    "main": "bar.js",
    "bridge": "ender.js"
  }
}
```

You will actually end up with a structure that looks like this, once processed:

```json
{
  "name": "foo",
  "main": "bar.js",
  "bridge": "ender.js"
}
```

The original, unmolested, deserialized descriptor is available on the prototype, e.g.:

```js
var original = Object.getPrototypeOf(pkg.descriptor)
```

-------------------------

### LocalPackage.loadSources(callback)
`LocalPackage.loadSources()` causes all of the package source files to be loaded. The callback will signal whether an error has occured. The source files will be available as `pkg.sources` with the key as the module name and the value as the contents of the file. This method will also set the `pkg.main` and `pkg.bridge` properties with the path to those modules if they were found and loaded.

-------------------------

## Contributing

Contributions are more than welcome! Just fork and submit a GitHub pull request! If you have changes that need to be synchronized across the various Ender CLI repositories then please make that clear in your pull requests.

### Tests

Ender Package Util uses [Buster](http://busterjs.org) for unit testing. You'll get it (and a bazillion unnecessary dependencies) when you `npm install` in your cloned local repository. Simply run `npm test` to run the test suite.

## Licence

*Ender Package Util* is Copyright (c) 2012 [@rvagg](https://github.com/rvagg), [@ded](https://github.com/ded), [@fat](https://github.com/fat) and other contributors. It is licenced under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.