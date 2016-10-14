'use strict';

const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const commitsCmd = 'git log --pretty=format:%H%d';
const semver = require('semver');

module.exports = function(options) {

    if(typeof options === "string") options = { workdir: options };
    if(!options) options = {};
    if(!options.workdir) options.workdir = process.cwd();
    if(!options.execGit) options.execGit = function(cmd, options2) {
        if(!options2) options2 = {};
        const execOpts = { cwd: options2.workdir || options.workdir, encoding: 'utf8' };
        return new Promise((resolve, reject) =>
            exec(cmd, execOpts, (err, data) => err ? reject(err) : resolve(data)));
    };
    if(!options.execGitSync) options.execGitSync = function(cmd, options2) {
        if(!options2) options2 = {};
        const execOpts = { cwd: options2.workdir || options.workdir, encoding: 'utf8' };
        return execSync(cmd, execOpts);
    };

    function parseLogLine(line) {
      const parts = line.match(/^(\w+)\s*(?:\((.*?)\))?\s*$/);
      const names = parts[2] ? parts[2].split(/\s*,\s*/g) : [];
      return {
        hash: parts[1],
        names: names,
        tags: names
          .filter(n =>  /^tag: /.test(n))
          .map(n => n.replace(/^tag: /, '')),
      };
    }

    const gitCmdLibrary = {
        log: 'git log --pretty=format:%H%d',
        status: 'git status --porcelain',
    };
    
    const gitFunctions = {

        commits: {
            cmds: ['log'],
            fn(gitoutput) {
                return gitoutput.log
                    .split('\n')
                    .map(parseLogLine);
            },
        },

        commitsByTag: {
            deps: [ "commits" ],
            fn() {
                return this.commits()
                    .reduce((a, c) => {
                        a.splice.apply(a, [a.length, 0].concat(c.tags.map(t => {
                            return { 
                                tag: t,
                                hash: c.hash,
                                isHEAD: c.names.indexOf('HEAD') >= 0
                            };
                        })));
                        return a;
                    }, []);
            },
        },

        commitsBySemver: {
            deps: [ "commitsByTag" ],
            fn() {
                return this.commitsByTag(gitoutput)
                    byTag.filter(c => semver.valid(c.tag)).sort((a, b) => semver.compare(a.tag, b.tag));
            },
        },

        isDirty: {
            cmds: {
                status: 'git status --porcelain',
            },
            fn(gitoutput) {
                const re = new RegExp('^[MADRCU' + (options.strict ? '?' : '') + ']');
                return gitoutput.status
                    .split('\n')
                    .some(l => re.test(l[0]) || re.test(l[1]));
            },
        },

    };

    const gitExports = { sync: {} };

    for(let fnName in gitFunctions) {

        function getCmds(gitFunctions, fnName, cmds) {
            const fn = gitFunctions[fnName];
            if(!cmds) cmds = new Set();
            if(fn.cmds) fn.cmds.forEach(cmd => cmds.add(cmd));
            if(fn.deps) fn.deps.forEach(dep => getCmds(gitFunctions, dep, cmds));
            console.log(...cmds.values());
            //return ...cmds.values();
            return cmds.values();
        }

        console.log('>>> processing ' + fnName + '...');
        console.log('>>> getCmds: ' + getCmds(gitFunctions, fnName));
        //getCmds(gitFunctions, fnName).forEach(cmd => console.log('\t' + cmd));
    }

    /*
    git.sync = {};
    for(let p in git) {
        if(p.match(/_cmd$/) || p === 'sync') continue;
        const orig = git[p];
        const cmd = git[p + '_cmd'];
        git[p] = function() {
            const args = Array.prototype.slice.call(arguments);
            return options.execGit(cmd, args[0]).then(data => orig.apply(null, [data].concat(args)));
        };
        git.sync[p] = function() {
            const args = Array.prototype.slice.call(arguments);
            return orig.apply(null, [options.execGitSync(cmd, args[0])].concat(args));
        };
    }

    return git;
    */

};
