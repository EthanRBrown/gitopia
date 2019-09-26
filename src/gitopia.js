'use strict';

const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const semver = require('semver');

module.exports = function(options) {

  if(typeof options === "string") options = { workdir: options }
  if(!options) options = {}
  if(!options.workdir) options.workdir = process.cwd()
  if(!options.execGit) options.execGit = function(cmd, options2) {
    if(!options2) options2 = {}
    const execOpts = { cwd: options2.workdir || options.workdir, encoding: 'utf8' }
    return new Promise((resolve, reject) =>
      exec(cmd, execOpts, (err, data) => err ? reject(err) : resolve(data)))
  }
  if(!options.execGitSync) options.execGitSync = function(cmd, options2) {
    if(!options2) options2 = {}
    const execOpts = { cwd: options2.workdir || options.workdir, encoding: 'utf8' }
    return execSync(cmd, execOpts)
  }

  function parseLogLine(line) {
    const parts = line.match(/^(\w+)\s*(?:\((.*?)\))?\s*$/)
    const names = parts[2] ? parts[2].split(/\s*,\s*/g) : []
    return {
      hash: parts[1],
      names: names,
      tags: names
        .filter(n =>  /^tag: /.test(n))
        .map(n => n.replace(/^tag: /, '')),
    }
  }

  const gitCmdLibrary = {
    log: 'git log --pretty=format:%H%d',
    status: 'git status --porcelain',
  }
  
  const gitFunctions = {

    commits: {
      cmds: ['log'],
      fn(gitoutput) {
        return gitoutput.log
          .split('\n')
          .map(parseLogLine)
      },
    },

    tagsWithCommit: {
      deps: [ "commits" ],
      fn(gitoutput) {
        return this.commits(gitoutput)
          .reduce((a, c) => {
            for(let t of c.tags) a.push([t, c]);
            return a;
          }, [])
      },
    },

    semverTagsWithCommit: {
      deps: [ "tagsWithCommit" ],
      fn(gitoutput) {
        return this.tagsWithCommit(gitoutput)
          .filter(([tag, c]) => semver.valid(tag))
      },
    },

    commitsByTag: {
      deps: [ "commits" ],
      fn(gitoutput) {
        return (this.commits(gitoutput)
          .reduce((a, c) => {
            a.splice.apply(a, [a.length, 0].concat(c.tags.map(t => {
              return { 
                tag: t,
                hash: c.hash,
                isHEAD: c.names.indexOf('HEAD') >= 0,
              }
            })))
            return a;
          }, [])
          .reduce((a, c) => Object.assign(a, { [c.tag]: c }), {}))
      },
    },

    commitsBySemver: {
      deps: [ "commitsByTag" ],
      fn(gitoutput) {
        return this.commitsByTag(gitoutput)
          byTag.filter(c => semver.valid(c.tag)).sort((a, b) => semver.compare(a.tag, b.tag))
      },
    },

    isDirty: {
      cmds: [ "status" ],
      fn(gitoutput, opts = {}) {
        const re = new RegExp('^[MADRCU' + (opts.strict ? '?' : '') + ']');
        return gitoutput.status
          .split('\n')
          .some(l => re.test(l[0]) || re.test(l[1]))
      },
    },

  }

  const gitExports = { sync: {} }

  const thisObj = {}

  for(let fnName in gitFunctions) {

    if(fnName === 'sync') throw new Error('"sync" is the one invalid tag for a git function!')

    // copy function straight up into thisObj
    thisObj[fnName] = gitFunctions[fnName].fn

    function getCmdKeys(gitFunctions, fnName, cmdKeys) {
      if(!cmdKeys) cmdKeys = new Set()
      const fn = gitFunctions[fnName]
      if(fn.cmds) fn.cmds.forEach(cmd => cmdKeys.add(cmd))
      if(fn.deps) fn.deps.forEach(dep => getCmdKeys(gitFunctions, dep, cmdKeys))
      return [...cmdKeys.values()]
    }

    const cmdKeys = getCmdKeys(gitFunctions, fnName)

    gitExports[fnName] = function(opts = {}) {
      const { gitArgs } = opts
      return Promise.all(
        cmdKeys.map(cmdKey => 
          options.execGit(gitCmdLibrary[cmdKey], gitArgs)
            .then(output => [cmdKey, output])
        )
      ).then(outputs => {
        // convert arrays into dictionary
        const gitoutput = outputs.reduce((a, x) => { a[x[0]] = x[1]; return a; }, {})
        // internally, we can use the .sync functions...because after we've run all the git commands,
        // the async part has been taken care of!
        return gitFunctions[fnName].fn.apply(thisObj, [gitoutput, opts])
      })
    }

    gitExports.sync[fnName] = function(opts = {}) {
      const gitoutput = cmdKeys.map(cmdKey => [cmdKey, options.execGitSync(gitCmdLibrary[cmdKey], opts)])
        // convert arrays into dictionary
        .reduce((a, x) => { a[x[0]] = x[1]; return a; }, {})
      return gitFunctions[fnName].fn.apply(thisObj, [gitoutput, opts])
    }
  }

  return gitExports

}
