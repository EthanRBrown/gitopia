'use strict';

const tape = require('tape');
const git = require('../dist/git-utils.js');

const fakeGitLog =
`8d6896dd1beff617b9fbe84e3e0374fde9c2d337 (HEAD, master)
21f3c48d451d4beb49b873597fad7326a2eb88e3
fe276dfc7788e0213ca2de0650a2acd8ef2984d8
2c2f334ae83537b86ae7c011bfae0dea056264d4
966c7bf892a9230c36e80825d7cf7f2b6ea2eb83
5b6a6945e1c9ce3543ac6287bd68809a365c3a94 (tag: NOT_SEMVER, tag: v1.0.2-alpha.1)
25d12cabecfe5f4994416d039606707f57f8a1bd (tag: v1.0.2-alpha.0)
dc2b8f8a5dccfbfe8f79ab6bd9ac489a20d8afb4 (tag: v1.0.1)
7b45610608c27138714298177ed7f96c6b9f35ec
71cdea41c110e46fe510ad218692694662eb3294 (tag: v1.0.0)
683f0dbeb9e97ea9cfcdc6a62c8ab3d539bdf642`;

tape('commits', t => {
    t.plan(5);
    git({
        execGit(cmd) {
            return new Promise(resolve => {
                console.log('fake gitExec: ' + cmd);
                resolve(fakeGitLog);
            });
        }
    }).commits().then(function(commits) {
        console.log(commits);
        t.equals(commits.length, 11, 'Incorrect number of commits');
        t.assert(commits[0].names.indexOf('HEAD') >= 0, 'First commit should be HEAD');
        t.equals(commits[3].hash, '2c2f334ae83537b86ae7c011bfae0dea056264d4', 'Expected hash value for commit 4 not found');
        t.assert(commits[6].tags.indexOf('v1.0.2-alpha.0') >= 0, 'Commit 7 did not have semver tag as expected');
        t.assert(commits[5].tags.indexOf('NOT_SEMVER') >= 0, 'Commit 6 did not have non-semver tag as expected');
    });
});

