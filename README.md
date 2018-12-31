# Webterm

The Web Terminal provides power users with a familiar toolset for examining the system. For more background information, [read this blog post](http://pfrazee.github.io/blog/reimagining-the-browser-as-a-network-os).

This is a work in progress.

## Todos

 - Create the program execution sandbox
 - Create the program RPC system
 - Add the user root archive
 - Load the terminal environment from files in the user root
 - Check that the destination exists before doing a CD
 - More builtin commands
 - History scrolling
 - Terminal autocomplete

## Objectives

The "CLI" refers to the command-line interface (the UI and environment).

 - **The CLI SHOULD** support autocomplete, history, theming.
 - **The CLI SHOULD** employ a bashlike syntax which translates predictably to JS function invocations.
 - **The CLI SHOULD** use trusted UIs to confirm changes to the system. Password prompts should not be required.
 - **The CLI SHOULD NOT** allow the execution of untrusted Javascript in its context.

"Commands" refer to the userspace programs which are executed by the CLI.

 - **Commands SHOULD** be executed in an isolated process, and communicate with the browser via IPC.
 - **Commands SHOULD** provide behaviors by interacting with the APIs provided by the browser.
 - **Commands SHOULD** be composable using sub-invocations.
 - **Commands SHOULD NOT** be able to invoke other commands.
 - **Commands SHOULD** render their output to the CLI using HTML.
 - **Commands SHOULD NOT** be able to provide custom JS or CSS for their HTML output.
 - **Commands SHOULD** be easily installable and managed (similar to `npm install -g {command}` but with better management).
 - **Commands SHOULD** be invocable from secure URLs, without prior installation (similar to `wget <url> | bash`).
 - **Commands SHOULD** have a simple JS programming model which auto hydrates the execution environment and abstracts away all IPC.

### Explaining the objectives

WebTerm is designed to be conservative in what it can express or compute. It should only invoke Javascript commands, which then execute against the browser's Web APIs.

**We define elegance as simplicity, not power.**

WebTerm's invocation syntax should be simple and obvious, and limit the number of edge-cases possible. Any "programming" should occur inside of a Javascript command. (The exact definition of "simple" will evolve as we understand the environment better. If conditionals or function definitions arrive in the shell language, then something has gone wrong.)

## Example commands

Here is a minimal hello world example:

```js
// hello-world.js
export default function () {
  return 'Hello, world!'
}
```

Invocation:

```bash
> hello-world
Hello, world!
```

---

**Arguments**

All command modules export a default function which accepts an options object and positional arguments, and returns a JS value or object. Here's an example which echos the arguments:

```js
// echo.js
function main (opts, ...args) {
  return JSON.stringify(opts) + args.join(' ')
}
```

Invocation:

```bash
> echo -abc --hello world this is my echo
{"a": true, "b": true, "c": true, "hello": "world"} this is my echo
```

---

**Subcommands**

All non-default exports on a command module can be accessed as subcommands. This is a help function for the above `echo` example:

```js
// echo.js
export function help () {
  return 'echo <opts> [...args]'
}
```

Invocation:

```bash
> echo help
echo <opts> [...args]
```

**Globals**

A `globals` object provides information about the environment.

```js
// pwd.js
export default function () {
  return globals.cwd
}
```
Invocation:
```bash
> pwd
dat://beakerbrowser.com/docs/
```

---

**Rendering**

The command may specify a `toHTML` function on the response object. This method will be invoked if/when the output is rendered to the cli.

```js
// hello-big-world.js
export default function () {
  return {
    toHTML: () => '<h1>HELLO WORLD!</h1>'
  }
}
```

The output can not include custom CSS. The CLI will provide a set of HTML constructs which it themes, and may even provided limited interactivity for exploring the output.

---

**Sub-invocations**

Commands can be composed by sub-invocations. Sub-invocations are command-invocations which are wrapped in parenthesis: `'(' invocation ')'`. They will be evaluated, and their value will be substituted in-place for their parent's invocation.

```js
// change-case.js
export default function (opts, str) {
  str = str.toString()
  if (opts.u) return str.toUpperCase()
  if (opts.l) return str.toLowerCase()
  return str
}
```
Invocation:
```bash
> change-case -u (hello-world)
HELLO, WORLD!
# this is equivalent to running change-case -u "Hello, world!"
```

This can be used multiple times in an invocation, and nested arbitrarily:

```js
// concat.js
export default function (opts, left, right) {
  return left.toString() + ' ' + right.toString()
}
```
Invocation:
```bash
> concat (hello-world) (hello-world)
Hello, world! Hello, world!

> concat (change-case -u (hello-world)) (change-case -l (hello-world))
HELLO, WORLD! hello, world!

> change-case -u (change-case -l (change-case -u (hello-world)))
HELLO, WORLD!
```

Sub-invocations are evaluated sequentially, to avoid potential races from side-effects (eg multiple sub-invocations using interactivity features).

---

**Async**

Commands may be async.

```js
// wait1s.js
export default async function (opts) {
  await new Promise(resolve => setTimeout(resolve, 1e3))
}
```

---

**Interactivity**

Commands may use the `terminal` API to provide interactivity during their invocation.

```js
// new-profile.js
export default async function () {
  var name = await terminal.prompt('What is your name?')
  var bio = await terminal.prompt('What is your bio?')
  terminal.output(`You are ${name}. Bio: ${bio}`)
  var shouldPublish = await terminal.confirm('Publish?', true)
  if (shouldPublish) {
    await ...
    terminal.output('Published')
  }
}
```
