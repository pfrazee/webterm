
var config = {
  lsAfterCd: true
}

// interactive help
// =

const METHOD_HELP = [
  {name: 'ls', description: 'List files in the directory'},
  {name: 'cd', description: 'Change the current directory'},
  {name: 'pwd', description: 'Fetch the current directory'},
  {name: 'mkdir', description: 'Make a new directory'},
  {name: 'rmdir', description: 'Remove an existing directory'},
  {name: 'mv', description: 'Move a file or folder'},
  {name: 'cp', description: 'Copy a file or folder'},
  {name: 'rm', description: 'Remove a file'},
  {name: 'echo', description: 'Output the arguments'}
]

export function help () {
  return {
    toHTML() {
      var longestMethod = METHOD_HELP.reduce((acc, v) => Math.max(acc, v.name.length), 0)
      return METHOD_HELP.map(method => {
        var nSpaces = longestMethod + 2 - method.name.length
        var methodEl = env.html`<span>${method.name}</span>`
        methodEl.innerHTML += '&nbsp;'.repeat(nSpaces)
        return env.html`<div class="text-default">${methodEl} <span class="text-muted">${method.description || ''}</span></div>`
      })
    }
  }
}

// current working directory methods
// =

export async function ls (opts = {}, location = '') {
  // pick target location
  const cwd = env.getCWD()
  location = toCWDLocation(location)
  // TODO add support for other domains than CWD

  // read
  var listing = await cwd.archive.readdir(location, {stat: true})

  // add link to parent directory
  if (cwd.pathname !== '/') {
    listing.unshift({
      name: '..',
      stat: await cwd.archive.stat(joinPath(cwd.pathname), '..')
    })
  }

  // render
  listing.toHTML = () => listing
    .filter(entry => {
      if (entry.name === '..' || opts.all || opts.a) {
        return true
      }
      return entry.name.startsWith('.') === false
    })
    .sort((a, b) => {
      // dirs on top
      if (a.stat.isDirectory() && !b.stat.isDirectory()) return -1
      if (!a.stat.isDirectory() && b.stat.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    .map(entry => {
      // coloring
      var color = 'default'
      if (entry.name.startsWith('.')) {
        color = 'muted'
      }

      function onclick (e) {
        e.preventDefault()
        e.stopPropagation()
        env.evalCommand(`cd ${entry.name}`)
      }

      // render
      const entryUrl = cwd.archive.url + joinPath(location, entry.name)
      const tag = entry.stat.isDirectory() ? 'strong' : 'span'
      return env.html`
        <div class="text-${color}">
          <${tag}>
            <a
              href=${entryUrl}
              onclick=${entry.stat.isDirectory() ? onclick : undefined}
              target="_blank"
            >${entry.name}</a>
          </${tag}>
        </div>`
    })

  return listing
}

export async function cd (opts = {}, location = '') {
  location = location.toString()
  if (location === '~') {
    location = `dat://${window.location.hostname}`
  }
  if (location.startsWith('//')) {
    location = `dat://${location}`
  } else if (location.startsWith('/')) {
    location = `dat://${env.getCWD().host}${location}`
  }

  await env.setCWD(location)

  if (config.lsAfterCd) {
    return ls()
  }
}

export function pwd () {
  const cwd = env.getCWD()
  return `dat://${cwd.host}${cwd.pathname}`
}

// folder manipulation
// =

export async function mkdir (opts, dst) { 
  if (!dst) throw new Error('dst is required')
  const cwd = env.getCWD()
  dst = toCWDLocation(dst)
  await cwd.archive.mkdir(dst)
}

export async function rmdir (opts, dst) {
  if (!dst) throw new Error('dst is required')
  const cwd = env.getCWD()
  dst = toCWDLocation(dst)
  var opts = {recursive: opts.r || opts.recursive}
  await cwd.archive.rmdir(dst, opts)
}

// file & folder manipulation
// =

export async function mv (opts, src, dst) {
  if (!src) throw new Error('src is required')
  if (!dst) throw new Error('dst is required')
  const cwd = env.getCWD()
  src = toCWDLocation(src)
  dst = toCWDLocation(dst)
  await cwd.archive.rename(src, dst)
}

export async function cp (opts, src, dst) {
  if (!src) throw new Error('src is required')
  if (!dst) throw new Error('dst is required')
  const cwd = env.getCWD()
  src = toCWDLocation(src)
  dst = toCWDLocation(dst)
  await cwd.archive.copy(src, dst)
}

// file manipulation
// =

export async function rm (opts, dst) {
  if (!dst) throw new Error('dst is required')
  const cwd = env.getCWD()
  dst = toCWDLocation(dst)
  await cwd.archive.unlink(dst)  
}

// utilities
// =

export async function echo (opts, ...args) {
  var appendFlag = opts.a || opts.append
  var res = args.join(' ')
  const cwd = env.getCWD()

  if (opts.to) {
    let dst = toCWDLocation(opts.to)
    if (appendFlag) {
      let content = await cwd.archive.readFile(dst, 'utf8')
      res = content + res
    }
    await cwd.archive.writeFile(dst, res)
  } else {
    return res
  }
}

// internal methods
// =

function toCWDLocation (location) {
  const cwd = env.getCWD()
  location = location.toString()
  if (!location.startsWith('/')) {
    location = joinPath(cwd.pathname, location)
  }
  return location
}

function joinPath (left, right) {
  left = (left || '').toString()
  right = (right || '').toString()
  if (left.endsWith('/') && right.startsWith('/')) {
    return left + right.slice(1)
  }
  if (!left.endsWith('/') && !right.startsWith('/')) {
    return left + '/' + right
  }
  return left + right
}
