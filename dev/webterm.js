import html from './vendor/nanohtml-v1.2.4.js'
import morph from './vendor/nanomorph-v5.1.3.js'
import minimist from './vendor/minimist-v1.2.0.js'
import {importModule} from './vendor/dynamic-import-polyfill.js'
import {joinPath} from './util.js'
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor

// globals
// =

var commandHist = {
  array   : new Array(),
  insert  : -1,
  present : -1,
  add     : function(element){
    this.array[++this.insert]=element;
    this.present = this.insert;
  },
  prevUp  : function(){
    if(this.present===-1)
      return ''
    else if(this.array[this.present-1] === undefined){
      this.present=0
      return this.array[0]
    }
    else
      return this.array[this.present--]
   
  },
  prevDown : function(){
    if(this.array[this.present+1] === undefined){
      this.present=this.array.length-1
      return ''
    }
    else
      return this.array[++this.present]
  },
  reset    : function(){
    this.present=this.insert
  } 

}


var cwd // current working directory. {url:, host:, pathname:, archive:}
var env // current working environment

// helper elem
const gt = () => {
  var el = html`<span></span>`
  el.innerHTML = '&gt;'
  return el
}

// start
// =

document.addEventListener('keydown', setFocus, {capture: true})
document.addEventListener('keydown', onKeyDown, {capture: true})

window.addEventListener('focus', setFocus)
readCWD()
updatePrompt()
importEnvironment()
appendOutput(html`<div><strong>Welcome to webterm.</strong> Type <code>help</code> if you get lost.</div>`, cwd.pathname)
setFocus()

// output
// =

function appendOutput (output, thenCWD, cmd) {
  if (typeof output === 'undefined') {
    output = 'Ok.'
  } else if (output.toHTML) {
    output = output.toHTML()
  } else if (typeof output !== 'string' && !(output instanceof Element)) {
    output = JSON.stringify(output).replace(/^"|"$/g, '')
  }
  thenCWD = thenCWD || cwd
  document.querySelector('.output').appendChild(html`
    <div class="entry">
      <div class="entry-header">//${shortenHash(thenCWD.host)}${thenCWD.pathname}${gt()} ${cmd || ''}</div>
      <div class="entry-content">${output}</div>
    </div>
  `)
  window.scrollTo(0, document.body.scrollHeight)
}

function appendError (msg, err, thenCWD, cmd) {
  appendOutput(html`
    <div class="error">
      <div class="error-header">${msg}</div>
      <div class="error-stack">${err.toString()}</div>
    </div>
  `, thenCWD, cmd)
}

function clearHistory () {
  document.querySelector('.output').innerHTML = ''
}

// prompt
//

function updatePrompt () {
  morph(document.querySelector('.prompt'), html`
    <div class="prompt">
      //${shortenHash(cwd.host)}${cwd.pathname}${gt()} <input onkeyup=${onPromptKeyUp} />
    </div>
  `)
}

function shortenHash (str = '') {
  return str.replace(/[0-9a-f]{64}/ig, v => `${v.slice(0, 6)}..${v.slice(-2)}`)
}

function setFocus () {
  document.querySelector('.prompt input').focus()
}

function onKeyDown (e) {
  var prompt = document.querySelector('.prompt input')

  if (e.code === 'KeyL' && e.ctrlKey) {
    clearHistory()
  }
  else if(e.code==='ArrowUp')
  {
    //console.log(hist)
    e.preventDefault()
    prompt.value=commandHist.prevUp()
    console.log(commandHist)
  }
  else if(e.code==='ArrowDown')
  {
    e.preventDefault()
    prompt.value=commandHist.prevDown()
        console.log(commandHist)

  }
  else if(e.code === 'Escape')
  {
    prompt.value=''
    commandHist.reset();
    console.log(commandHist)
  }
}



function onKeyDown (e) {
  if (e.code === 'KeyL' && e.ctrlKey) {
    clearHistory()
  }
}

function onPromptKeyUp (e) {
  if (e.code === 'Enter') {
    console.log('reached before')

    console.log('after')
    evalPrompt()
  }
}

function evalPrompt () {
  var prompt = document.querySelector('.prompt input')
  if (!prompt.value.trim()) {
    return
  } 
  commandHist.add(prompt.value)
  console.log(commandHist)
  evalCommand(prompt.value)
  prompt.value = ''
}

function evalCommand (command) {
  evalCommandInternal(command, appendOutput, appendError, env, parseCommand, updatePrompt)  
}

// use the func constructor to relax 'use strict'
// that way we can use `with`
var evalCommandInternal = new AsyncFunction('command', 'appendOutput', 'appendError', 'env', 'parseCommand', 'updatePrompt', `
  try {
    var res
    var oldCWD = Object.assign({}, env.getCWD())
    with (env) {
      res = await eval(parseCommand(command))
    }
    appendOutput(res, oldCWD, command)
  } catch (err) {
    appendError('Command error', err, oldCWD, command)
  }
  updatePrompt()
`)

function parseCommand (str) {
  // parse the command
  var parts = str.split(' ')
  var cmd = parts[0]
  var argsParsed = minimist(parts.slice(1))
  console.log(JSON.stringify(argsParsed))

  // form the js call
  var args = argsParsed._
  delete argsParsed._
  args.unshift(argsParsed) // opts always go first

  console.log(`${cmd}(${args.map(JSON.stringify).join(', ')})`)
  return `${cmd}(${args.map(JSON.stringify).join(', ')})`
}

// environment
// =

async function importEnvironment () {
  document.head.append(html`<link rel="stylesheet" href="/dev/theme-default.css" />`)
  try {
    var module = await importModule('/dev/env-default.js')
    env = Object.assign({}, module)
    for (let k in builtins) {
      Object.defineProperty(env, k, {value: builtins[k], enumerable: false})
    }
    window.env = env
    console.log('Environment', env)
  } catch (err) {
    console.error(err)
    return appendError('Failed to evaluate environment script', err, cwd)
  }
}

// current working location
// =

async function setCWD (location) {
  var locationParsed
  try {
    locationParsed = new URL(location)
    location = `${locationParsed.host}${locationParsed.pathname}`
  } catch (err) {
    location = `${cwd.host}${joinPath(cwd.pathname, location)}`
  }
  locationParsed = new URL('dat://' + location)

  // make sure the destination exists
  let archive = new DatArchive(locationParsed.host)
  let st = await archive.stat(locationParsed.pathname)
  if (!st.isDirectory()) {
    throw new Error('Not a directory')
  }

  window.history.pushState(null, {}, '#' + location)
  readCWD()
}

function readCWD () {
  cwd = parseURL(window.location.hash.slice(1) || window.location.toString())

  console.log('CWD', cwd)
  document.title = `${cwd.host || cwd.url} | Terminal`
}

function parseURL (url) {
  if (!url.startsWith('dat://')) url = 'dat://' + url
  let urlp = new URL(url)
  let host = url.slice(0, url.indexOf('/'))
  let pathname = url.slice(url.indexOf('/'))
  let archive = new DatArchive(urlp.hostname)
  return {url, host: urlp.hostname, pathname: urlp.pathname, archive}
}

// builtins
// =

const builtins = {
  html,
  morph,
  evalCommand,
  getCWD () {
    return cwd
  },
  setCWD
}
