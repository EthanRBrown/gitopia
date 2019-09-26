'use strict'

const tape = require('tape')

const fakeGitOutputs1 = {
'git log --pretty=format:%H%d':
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
683f0dbeb9e97ea9cfcdc6a62c8ab3d539bdf642`,
'git status --porcelain':
` M src/git-utils.js
 M tests/git-utils.js
?? sample.js`
}

const getGit = (fakeGitOutputs, options = {}) => require('../dist/gitopia')({
  execGit(cmd) {
    return new Promise(resolve => {
      resolve(fakeGitOutputs[cmd])
    })
  },
  execGitSync(cmd) {
    return fakeGitOutputs[cmd]
  },
  ...options,
})

tape('commits', t => {
  const git = getGit(fakeGitOutputs1)
  t.plan(5)
  git.commits().then(commits => {
    t.equals(commits.length, 11, 'Incorrect number of commits')
    t.assert(commits[0].names.indexOf('HEAD') >= 0, 'First commit should be HEAD')
    t.equals(commits[3].hash, '2c2f334ae83537b86ae7c011bfae0dea056264d4', 'Expected hash value for commit 4 not found')
    t.assert(commits[6].tags.indexOf('v1.0.2-alpha.0') >= 0, 'Commit 7 did not have semver tag as expected')
    t.assert(commits[5].tags.indexOf('NOT_SEMVER') >= 0, 'Commit 6 did not have non-semver tag as expected')
  })
})

tape('commitsSync', t => {
  const git = getGit(fakeGitOutputs1)
  t.plan(5)
  const commits = git.sync.commits()
  t.equals(commits.length, 11, 'Incorrect number of commits')
  t.assert(commits[0].names.indexOf('HEAD') >= 0, 'First commit should be HEAD')
  t.equals(commits[3].hash, '2c2f334ae83537b86ae7c011bfae0dea056264d4', 'Expected hash value for commit 4 not found')
  t.assert(commits[6].tags.indexOf('v1.0.2-alpha.0') >= 0, 'Commit 7 did not have semver tag as expected')
  t.assert(commits[5].tags.indexOf('NOT_SEMVER') >= 0, 'Commit 6 did not have non-semver tag as expected')
})

tape('tagsWithCommit', t => {
  const git = getGit(fakeGitOutputs1)
  t.plan(4)
  git.tagsWithCommit().then(tagsWithCommit => {
    t.assert(tagsWithCommit[0][0] === 'NOT_SEMVER', 'First tag is not correct')
    t.assert(tagsWithCommit[1][0] === 'v1.0.2-alpha.1', 'Second tag is not correct')
    t.assert(tagsWithCommit[0][1] === tagsWithCommit[1][1], 'First and second tags should point to the same commit')
    t.assert(tagsWithCommit[4][0] === 'v1.0.0', 'Fifth tag is not correct')
  })
})

tape('semverTagsWithCommit', t => {
  const git = getGit(fakeGitOutputs1)
  t.plan(4)
  git.semverTagsWithCommit().then(twc => {
    t.assert(!twc.some(x => x.tag === 'NOT_SEMVER'), 'Non-semver tag included')
    t.equals(twc[0][0], 'v1.0.2-alpha.1', 'First tag is not correct')
    t.equals(twc[1][0], 'v1.0.2-alpha.0', 'Second tag is not correct')
    t.equals(twc[2][0], 'v1.0.1', 'Third tag is not correct')
  })
})

tape('commitsByTag', t => {
  const git = getGit(fakeGitOutputs1)
  t.plan(1)
  git.commitsByTag().then(commitsByTag => {
    const expected = {
      "NOT_SEMVER": {"tag":"NOT_SEMVER","hash":"5b6a6945e1c9ce3543ac6287bd68809a365c3a94","isHEAD":false},
      "v1.0.2-alpha.1": {"tag":"v1.0.2-alpha.1","hash":"5b6a6945e1c9ce3543ac6287bd68809a365c3a94","isHEAD":false},
      "v1.0.2-alpha.0": {"tag":"v1.0.2-alpha.0","hash":"25d12cabecfe5f4994416d039606707f57f8a1bd","isHEAD":false},
      "v1.0.1": {"tag":"v1.0.1","hash":"dc2b8f8a5dccfbfe8f79ab6bd9ac489a20d8afb4","isHEAD":false},
      "v1.0.0": {"tag":"v1.0.0","hash":"71cdea41c110e46fe510ad218692694662eb3294","isHEAD":false}
    }
    t.deepLooseEqual(commitsByTag, expected)
  })
})

tape('isDirty: new repo', t => {
  const fakeGitOutputs = { 'git status --porcelain': '' }
  const git = getGit(fakeGitOutputs)
  t.plan(1)
  git.isDirty().then(dirty => t.assert(!dirty, 'new repos are not dirty'))
})

tape('isDirty: untracked files', t => {
  const fakeGitOutputs = { 'git status --porcelain': `?? untracked.txt` }
  const git = getGit(fakeGitOutputs)
  t.plan(2)
  git.isDirty().then(dirty => t.assert(!dirty, 'untracked files are not dirty by default'))
  git.isDirty({ strict: true }).then(dirty => t.assert(dirty, 'untracted files are dirty with "strict" option'))
})

tape('isDirty: staged files', t => {
  const fakeGitOutputs = { 'git status --porcelain': `A  staged.txt` }
  const git = getGit(fakeGitOutputs)
  t.plan(1)
  git.isDirty().then(dirty => t.assert(dirty, 'staged files are dirty'))
})
