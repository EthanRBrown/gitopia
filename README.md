# Git Utils

`git-utils` is yet another Git wrapper (yes, I thought about calling it `yag` or something similar, but that joke's a little played out, I think).  So why another Git wrapper?  Mainly because I looked at all the existing ones and they didn't do what I need, and I didn't feel that they were well-suited for contribution.  Which is why I'm rolling my own.  My goals are:

* Extremely easy to create new functions.
* Write one (synchronous) function, and the framework will automatically generate sync and (promise-based) async versions.
* Fast, easy unit testing.

## Sync/Async

The full API is available sync and async versions.  The only difference is that the async version returns promises.  To use the sync version:

```js
const git = require('gitopia')().sync

// example usage:
const commits = git.commits()
```

To use the async version:

```js
const git = require('gitopia')()

// example usage:
git.commits(commits => console.log(commits))
```

## Working Directory

By default, gitopia assumes the current working directory is part of the desired repository.  To change this or make the working directory explicit, use the `workdir` option:

```js
const git = require('gitopia')({ workdir: '/path/to/your/repo' ))
```

## API

For simplicity, all examples use sync API.

* Get information about all commits: `commits()`
* Get all tags and their associated commit: `tagsWithCommit()` (array) or `commitsByTag()` (object map)
* Get all valid [semver](https://semver.org/) tags and their associated commit: `semverTagsWithCommit()` (array) or `commitsBySemver()` (object map)
* Determine if working directory or index is dirty: `isDirty()`.  Note that untraced files, by default, do not indicate a dirty working directory.  To change this, use `strict` option: `isDirty({ strict: true })`.


