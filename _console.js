import './style.css'
import axios from 'axios';
import encryption from './encryption.mjs';
import minimist from "minimist";
import * as showdown from 'showdown';

const mdConverter = new showdown.Converter()

const effects = {
  sleep(time) {
    return new Promise(function(resolve, reject) {
      setTimeout(_ => resolve(), time)
    })
  }
} 

const api = {
  fetchDatabase(id, password) {
    const cryptoID = encryption.hashPassword(id, password, "1.0")
    return new Promise(function (resolve, reject) {
      axios.get('/db/'+cryptoID+".dat", {
        responseType: 'arraybuffer',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Accept': 'application/octet-stream'
        }
      }).then(function({data}){
        const rawJson = encryption.decryptAsString(new Uint8Array(data), password)
        resolve(JSON.parse(rawJson));
      }).catch(reject);
    });
  }
}

function newDocumentLink(obj) {
  const aDom = document.createElement("A")
  aDom.href = "/#/" + obj.id
  aDom.innerHTML = obj.name
  return aDom
}

function newDom(tagName, opts = {}) {
  const dom = document.createElement(tagName)
  if (undefined !== opts.if && !opts.if) {
    return null
  }
  if (undefined !== opts.id) {
    dom.id = id
  }
  if (undefined !== opts.attributes) {
    for (const i in opts.attributes) {
      dom.setAttribute(i, opts.attributes[i])
    }
  }
  if (undefined !== opts.classes) {
    for (const v of opts.classes) {
      dom.classList.add(v)
    }
  }
  if (undefined !== opts.innerHTML) {
    dom.innerHTML = opts.innerHTML
  }
  if (undefined !== opts.children) {
    for (const child of opts.children) {
      if (null === child) {
        continue
      }
      dom.appendChild(child)
    }
  }
  return dom
}

function newSystem(dom) {
  const logDom = document.createElement("DEV")
  logDom.classList.add("ui-log")
  dom.appendChild(logDom)
  let lastRecord = undefined
  
  const io = {
    clear() {
      logDom.innerHTML = ""
    },
    read(db, file) {
      const dom = newDom("TABLE", {
        children: [
          newDom("TR", {
            if: !!file.id,
            children: [
              newDom("TD", {innerHTML: "ID"}),
              newDom("TD", {innerHTML: file.id}),
            ],
          }),
          newDom("TR", {
            if: !!file.name,
            children: [
              newDom("TD", {innerHTML: "Name"}),
              newDom("TD", {innerHTML: mdConverter.makeHtml(file.name), if: file.name})
            ],
          }),
          newDom("TR", {
            if: !!file.title,
            children: [
              newDom("TD", {innerHTML: "Title"}),
              newDom("TD", {innerHTML: mdConverter.makeHtml(file.title), if: file.title})
            ],
          }),
          newDom("TR", {
            if: !!file.content,
            children: [
              newDom("TD", {innerHTML: "Content"}),
              newDom("TD", {innerHTML: mdConverter.makeHtml(file.content)})
            ],
          }),
        ],
      })

      for (const v of ["feed","tag","ref","rel"]) {
        if (undefined !== db[v][file.id]) {
          const children = []
          for (const childID of db[v][file.id]) {
            const doc = db.files[childID]
            children.push(newDom("A", {
              attributes: {
                href: "/#/" + doc.id,
              },
              innerHTML: doc.name,
            }))
          }
          const tr = newDom("TR", {
            children: [
              newDom("TD", {innerHTML: v}),
              newDom("TD", {children: children})
            ],
          })
          dom.appendChild(tr)
        }
      }

      if (undefined !== db.score[file.id]) {
        const children = []
        for (const scoreID in db.score[file.id]) {
          const doc = db.files[scoreID]
          children.push(newDom("A", {
            attributes: {
              href: "/#/" + doc.id,
            },
            innerHTML: doc.name + ": " + db.score[file.id][scoreID],
          }))
        }
        const tr = newDom("TR", {
          children: [
            newDom("TD", {innerHTML: "Score"}),
            newDom("TD", {children: children})
          ],
        })
        dom.appendChild(tr)
      }

      this.add(dom)
    },
    prompt(question, type="text", dflt="") {
      const self = this
      return new Promise(function(accept, reject) {
        const container = document.createElement("DIV")
        container.classList.add("ui-prompt")
        if (question) {
          const questionDom = document.createElement("SPAN")
          questionDom.innerHTML = question
          container.appendChild(questionDom)
        }
        
        const inputDom = document.createElement("INPUT")
        inputDom.type = type
        inputDom.value = dflt
        inputDom.onkeydown = function(e) {
          if (e.key === "Enter") {
            accept(inputDom.value)
            inputDom.setAttribute("disabled","disabled")
            inputDom.tabIndex = undefined
            document.removeEventListener("click", cb)
          } 
        }
        const cb = function(e) {
          if (e.target.tagName === "A") {
            const href = e.target.getAttribute('href')
            if (href && href.startsWith('/#/')) {
              e.stopPropagation()
              e.preventDefault()

              const id = href.substring(3)
              inputDom.value = "cat " + id
              inputDom.onkeydown({key: "Enter"})
            }
          }
        }
        document.addEventListener("click", cb)
        container.appendChild(inputDom)

        self.add(container)
        inputDom.setSelectionRange(0, inputDom.value.length)
        inputDom.focus()
      })
    },
    append(html) {
      if (undefined === lastRecord) {
        this.add(html)
      } else {
        lastRecord.classList.add("ui-row")
        if (typeof html == "string") {
          lastRecord.innerHTML = lastRecord.innerHTML + html
        } else {
          lastRecord.appendChild(html)
        }
      }
    },
    add(html) {
      lastRecord = document.createElement("DIV")
      lastRecord.classList.add("ui-row")
      if (typeof html == "string") {
        lastRecord.innerHTML = html
      } else {
        lastRecord.appendChild(html)
      }
      logDom.appendChild(lastRecord)
    }
  }
  return {
    io: io,
    async run(program) {
      await program(this)
    }
  }
}


const apps = {
  async boot(app) {
    app.io.add("Starting...")

    await apps.login(app)
    
    app.io.add("Shutting down...")
    app.io.append(" Complete.")
  },
  async login(app) {
    const account = await app.io.prompt("Name:", "text", "guest")
    let password = null
    if (account === "guest") {
      password = "guest"
    } else {
      password = await app.io.prompt("Password:", "password")
    }
    
    app.io.add("Attempting login...")
    try {
      const db = await api.fetchDatabase(account, password)
      console.log(db)
      app.io.append(" Success")

      await apps.os(app, db)
    } catch (e) {
      console.error(e)
      app.io.append(" Failed")
      await apps.login(app)
    }
  },
  async os(app, db, isBoot = true) {
    if (isBoot) {
      app.io.add("Starting WebOS...")
      app.io.add("Welcome, " + db.account.name + "!")
    }

    const cmdi = await app.io.prompt(db.account.id + ">")
    const cmda = [...cmdi.matchAll(/[^\s]+/g)].map(v => v[0])
    const cmd = cmda[0] || ''
    switch (cmd) {
      case "logout": return;
      case "quit": return;
      case "clr":
      case "clear":
        app.io.clear()
        break
      case "login": 
        await apps.login(app)
        break
      case "ls":
        await apps.os_ls(app, db);
        break
      case "cat":
        await apps.os_cat(app, db, cmda[1] || '');
        break;
      break;
      default:
        app.io.add(`Unknown command ${cmd}`) 
        break
    }

    await apps.os(app, db, false)
  },
  async os_ls(app, db) {
    const listDom = document.createElement("DIV")
    listDom.classList.add("ui-menu")
    listDom.classList.add("ui-menu-list")
    for (const fileID in db.files) {
      listDom.appendChild(newDocumentLink(db.files[fileID]))
    }
    app.io.add(listDom)
  },
  async os_cat(app, db, id) {
    const file = db.files[id]
    app.io.read(db, file)
  },
}

newSystem(document.querySelector('#app')).run(apps.boot)