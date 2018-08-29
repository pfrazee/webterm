// https://github.com/uupaa/dynamic-import-polyfill

// MIT License

// Copyright (c) 2018 uupaa

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

function toAbsoluteURL(url) {
  const a = document.createElement("a");
  a.setAttribute("href", url);    // <a href="hoge.html">
  return a.cloneNode(false).href; // -> "http://example.com/hoge.html"
}

export function importModule(url) {
  return new Promise((resolve, reject) => {
    const vector = "$importModule$" + Math.random().toString(32).slice(2);
    const script = document.createElement("script");
    const destructor = () => {
      delete window[vector];
      script.onerror = null;
      script.onload = null;
      script.remove();
      URL.revokeObjectURL(script.src);
      script.src = "";
    };
    script.defer = "defer";
    script.type = "module";
    script.onerror = () => {
      reject(new Error(`Failed to import: ${url}`));
      destructor();
    };
    script.onload = () => {
      resolve(window[vector]);
      destructor();
    };
    const absURL = toAbsoluteURL(url);
    const loader = `import * as m from "${absURL}"; window.${vector} = m;`; // export Module
    const blob = new Blob([loader], { type: "text/javascript" });
    script.src = URL.createObjectURL(blob);

    document.head.appendChild(script);
  });
}

export default importModule;
