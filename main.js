import "./style.css";
import axios from "axios";
import encryption from "./encryption.mjs";
import minimist from "minimist";
import * as showdown from "showdown";
import ForceGraph3D from "3d-force-graph";
import SpriteText from "three-spritetext";

const mdConverter = new showdown.Converter();

const engine = {
  newGraphData(db, step = 1, graphData = {}) {
    if (undefined === graphData.nodes) {
      graphData.nodes = [];
    }

    if (undefined === graphData.links) {
      graphData.links = [];
    }

    if (step === 1) {
      for (const id in db.files) {
        const file = db.files[id];
        if (id == "menu") {
          const node = {
            id: file.id,
            label: file.name,
            fx: 0,
            fy: 0,
            fz: 0,
            db: db,
          };
          if (file.mode == 403) {
            node.color = "#333"
          }
          db.files[file.id].node = node;
          graphData.nodes.push(node);
        } else {
          const node = {
            id: file.id,
            label: file.name,
            db: db,
          };
          if (file.mode == 403) {
            node.color = "#333"
          }
          db.files[file.id].node = node;
          graphData.nodes.push(node);
        }
      }
      for (const startID in db.feed) {
        for (const endID of db.feed[startID]) {
          graphData.links.push({
            source: startID,
            target: endID,
            force: 100,
            color: "#f00",
          });
        }
      }
      for (const startID in db.tag) {
        for (const endID of db.tag[startID]) {
          graphData.links.push({
            source: startID,
            target: endID,
            force: 500,
            //hidden: true,
            hidden: false,
            color: "#500",
          });
        }
      }
      for (const startID in db.rel) {
        for (const endID of db.rel[startID]) {
          graphData.links.push({
            source: startID,
            target: endID,
            force: 100,
            hidden: false,
            color: "#d00",
          });
        }
      }
      for (const startID in db.ref) {
        for (const endID of db.ref[startID]) {
          graphData.links.push({
            source: startID,
            target: endID,
            force: 100,
            hidden: false,
            color: "#d00",
          });
        }
      }
      for (const startID in db.score) {
        for (const startID2 in db.score) {
          if (startID != startID2) {
            graphData.links.push({
              source: startID,
              target: startID2,
              force: 5000,
              hidden: false,
              color: "#500",
            });
          }
        }
      }
    }
    if (step == 2) {
      for (const startID in db.score) {
        const source = db.files[startID];
        for (const endID in db.score[startID]) {
          let score = db.score[startID][endID];
          if (null === score || score < 30) {
            //continue;
            score = 1;
          }
          graphData.links.push({
            source: startID,
            target: endID,
            force: (100 - score) * 2 + 300 + 3000 * Math.random(),
            //hidden: true,
            hidden: false,
            color: "#500",
          });
        }
      }
    }
    return graphData;
  },
  load(db) {
    //console.log('db', db)
    this.GraphDom.classList.add("graph-loading");
    let step = 1;
    const graphData = engine.newGraphData(db, step);
    this.Graph.onEngineStop((v) => {
      if (step > 1) {
        this.GraphDom.classList.remove("graph-loading");
        return;
      }
      step += 1;
      this.Graph.graphData(engine.newGraphData(db, step, graphData));
      // load complete
      window.addEventListener("hashchange", (event) => {
        engine.ui.loadUrl(db, event.newURL);
      });
      engine.ui.loadSearchList(db);
      engine.ui.loadUrl(db, window.location.href);
    });
    this.Graph.graphData(graphData);
  },
  focus(node) {
    const distance = 300;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    const newPos =
      node.x || node.y || node.z
        ? {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio,
          }
        : { x: 0, y: 0, z: distance };
    this.Graph.cameraPosition(newPos, { x: node.x, y: node.y, z: node.z }, 200);
  },
  boot(dom) {
    dom.classList.add("graph-loading");
    const self = this;
    this.GraphDom = dom;
    this.Graph = ForceGraph3D({})(dom)
      .enableNodeDrag(false)
      .backgroundColor("#000")
      .showNavInfo(false)
      .graphData({ nodes: [], links: [] })
      .linkVisibility((link) => !link.hidden)
      .cooldownTicks(50)
      .nodeThreeObject((node) => {
        const sprite = new SpriteText(node.label);
        sprite.material.depthWrite = false;
        sprite.color = node.color || "#fff";
        sprite.textHeight = 8;
        return sprite;
      })
      .onNodeClick((node) => {
        window.location.hash = "/" + node.id;
      });
    if (window.location.hash === "") {
      window.location.hash = "#/menu";
    }
    this.Graph.d3Force("link").distance(function (link) {
      if (undefined === link.force) {
        return 100;
      }
      return link.force;
    });
    window.addEventListener("resize", function (e) {
      self.Graph.width(this.window.innerWidth);
      self.Graph.height(this.window.innerHeight);
    });
  },
  ui: {
    newFileHeader(value) {
      const headerDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-header"],
        innerHTML: value,
      });
      return headerDom;
    },
    newLinkListDom(links, caption = undefined) {
      const listDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list"],
      });
      const headerDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list-header"],
      });
      if (caption !== undefined) {
        const captionDom = engine.ui.newDom("DIV", {
          classes: ["ui-file-button-list-title"],
          innerHTML: caption,
        });
        headerDom.appendChild(captionDom);
      }
      listDom.appendChild(headerDom);

      const searchScroll = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list-body"],
      });
      listDom.appendChild(searchScroll);

      for (const link of links) {
        const btnDom = engine.ui.newUrlButton(link)
        searchScroll.appendChild(btnDom)
      }

      return listDom
    },
    newFileListDom(db, fileIDs, caption = undefined) {
      const listDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list"],
      });

      const headerDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list-header"],
      });
      if (caption !== undefined) {
        const captionDom = engine.ui.newDom("DIV", {
          classes: ["ui-file-button-list-title"],
          innerHTML: caption,
        });
        headerDom.appendChild(captionDom);
      }
      const searchField = engine.ui.newDom("INPUT", {
        classes: ["ui-file-button-list-filter"],
        attributes: {
          type: "text",
          placeholder: "🔎︎",
        },
      });
      headerDom.appendChild(searchField);
      listDom.appendChild(headerDom);

      const searchScroll = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-list-body"],
      });
      listDom.appendChild(searchScroll);

      const index = [];
      if (Array.isArray(fileIDs)) {
        for (const fileID of fileIDs.sort()) {
          const el = engine.ui.newFileButtonDom(db, fileID);
          searchScroll.appendChild(el);
          index.push({
            content:
              el.innerText.toLowerCase() + " " + el.id + " " + el.excerpt,
            el: el,
          });
        }
      } else {
        const buttons = [];
        for (const fileID in fileIDs) {
          const el = engine.ui.newFileButtonDom(db, fileID, fileIDs[fileID]);
          index.push({ content: el.innerText.toLowerCase(), el: el });
          buttons.push({ el: el, cmp1: fileIDs[fileID], cmp2: fileID[0] });
        }

        for (const button of buttons.sort(function compareObj(a, b, f = "cmp1") {
          if (a[f] == null && b[f] != null) {
            return 1;
          }
          if (a[f] != null && b[f] == null) {
            return -1;
          }
          if (a[f] == null && b[f] == null) {
            return f === "cmp1" ? compareObj(b, a, "cmp2") : 0;
          }
          if (a[f] < b[f]) {
            return 1;
          }
          if (a[f] > b[f]) {
            return -1;
          }
          return f === "cmp1" ? compareObj(b, a, "cmp2") : 0;
        })) {
          searchScroll.appendChild(button.el);
        }
      }

      searchField.addEventListener("change", function (e) {
        const value = `${searchField.value}`.toLowerCase();
        for (const item of index) {
          if (!value || item.content.includes(value)) {
            item.el.style.display = "flex";
          } else {
            item.el.style.display = "none";
          }
        }
      });

      return listDom;
    },
    newUrlButton(link) {
      const buttonDom = engine.ui.newDom("A", {
        classes: ["ui-file-button"],
        attributes: {
          target: "_blank",
          href: link.url,
        },
      });
      const buttonContentDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-content"],
      });
      const nameDom = engine.ui.newDom("DIV", { innerHTML: link.name || link });
      buttonContentDom.appendChild(nameDom);

      const excerptDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-excerpt"],
        innerHTML: link.url,
      });
      buttonContentDom.appendChild(excerptDom);

      buttonDom.appendChild(buttonContentDom)
      return buttonDom
    },
    newFileButtonDom(db, fileID, score = undefined) {
      const buttonDom = engine.ui.newDom("A", {
        classes: ["ui-file-button"],
        attributes: {
          id: "file-" + fileID,
          href: "/#/" + fileID,
        },
      });

      const file = db.files[fileID];
      if (undefined === file) {
        return buttonDom;
      }

      if (file.keys !== undefined && file.keys.length > 0) {
        buttonDom.classList.add("ui-locked")
      }
      
      if (undefined !== score) {
        const scoreDom = engine.ui.newDom("DIV", {
          innerHTML: score,
          classes: ["ui-file-button-score-prefix"],
        });
        buttonDom.appendChild(scoreDom);
      }

      const buttonContentDom = engine.ui.newDom("DIV", {
        classes: ["ui-file-button-content"],
      });
      const nameDom = engine.ui.newDom("DIV", { innerHTML: file.name });
      if (undefined !== file.created_at) {
        const dateDom = engine.ui.newDom("SPAN", { innerHTML: file.created_at, classes: ['ui-file-button-created-at'] });
        nameDom.appendChild(dateDom)
      }
      buttonContentDom.appendChild(nameDom);

      if (file.excerpt) {
        const excerptDom = engine.ui.newDom("DIV", {
          classes: ["ui-file-button-excerpt"],
          innerHTML: file.excerpt,
        });
        buttonContentDom.appendChild(excerptDom);
      }
      if (file.tags !== undefined || file.scores !== undefined) {
        const tagDom = engine.ui.newDom("DIV", {
          classes: ["ui-file-button-tags"],
        });
        if (file.tags) {
          for (const tagID of file.tags) {
            const tag = db.files[tagID];
            tagDom.appendChild(
              engine.ui.newDom("SPAN", {
                innerHTML: tag.name,
                classes: ["ui-file-button-tag"],
              })
            );
          }
        }
        if (file.scores) {
          for (const scoreID in file.scores) {
            const score = db.files[scoreID];
            const value = file.scores[scoreID];
            tagDom.appendChild(
              engine.ui.newDom("SPAN", {
                classes: ["ui-file-button-score"],
                children: [
                  engine.ui.newDom("SPAN", {
                    classes: ["ui-file-button-score-value"],
                    innerHTML: value,
                    if: !!value,
                  }),
                  engine.ui.newDom("SPAN", { innerHTML: score.name }),
                ],
              })
            );
          }
        }
        buttonContentDom.appendChild(tagDom);
      }

      buttonDom.appendChild(buttonContentDom);
      return buttonDom;
    },
    newDom(tagName, opts = {}) {
      const dom = document.createElement(tagName);
      if (undefined !== opts.if && !opts.if) {
        return null;
      }
      if (undefined !== opts.id) {
        dom.id = id;
      }
      if (undefined !== opts.attributes) {
        for (const i in opts.attributes) {
          dom.setAttribute(i, opts.attributes[i]);
        }
      }
      if (undefined !== opts.classes) {
        for (const v of opts.classes) {
          dom.classList.add(v);
        }
      }
      if (undefined !== opts.innerHTML) {
        dom.innerHTML = opts.innerHTML;
      }
      if (undefined !== opts.title) {
        dom.title = opts.title;
      }
      if (undefined !== opts.children) {
        for (const child of opts.children) {
          if (null === child) {
            continue;
          }
          dom.appendChild(child);
        }
      }
      return dom;
    },
    loadUrl(db, url) {
      const id = url.split("/#/")[1] || "";
      const file = db.files[id];
      if (file != undefined && file.node != undefined) {
        //console.log(file)
        engine.ui.loadFile(db, file);
        engine.focus(file.node);
      } else {
        engine.ui.unloadFile();
      }
    },
    loadLogin() {
      const dom = document.getElementById("login");
      const loginInput = engine.ui.newDom("INPUT", {
        attributes: {
          type: "text",
          name: "login",
          placeholder: "login [guest]",
        },
      });
      loginInput.addEventListener("change", function (e) {
        loginInput.classList.remove("invalid");
      });
      const passwordInput = engine.ui.newDom("INPUT", {
        attributes: {
          type: "password",
          name: "password",
          placeholder: "password [guest]",
        },
      });
      passwordInput.addEventListener("change", function (e) {
        passwordInput.classList.remove("invalid");
      });
      const formDom = engine.ui.newDom("FORM", {
        children: [
          engine.ui.newDom("DIV", {
            children: [loginInput],
          }),
          engine.ui.newDom("DIV", {
            children: [passwordInput],
          }),
          engine.ui.newDom("DIV", {
            children: [
              engine.ui.newDom("BUTTON", {
                innerHTML: "Enter",
                attributes: { type: "submit" },
              }),
            ],
          }),
        ],
      });
      formDom.addEventListener("submit", async function (e) {
        loginInput.classList.remove("invalid");
        passwordInput.classList.remove("invalid");
        e.preventDefault();
        let login = loginInput.value;
        if (!login) {
          login = "guest";
        }
        let password = passwordInput.value;
        if (!password) {
          password = "guest";
        }
        try {
          const db = await engine.api.fetchDatabase(login, password);
          engine.ui.unloadLogin();
          engine.load(db);
        } catch (e) {
          loginInput.classList.add("invalid");
          passwordInput.classList.add("invalid");
        }
      });
      dom.appendChild(formDom);
    },
    unloadLogin() {
      const dom = document.getElementById("login");
      dom.innerHTML = "";
    },
    loadSearchList(db) {
      const dom = document.getElementById("search-list");
      const fileIDs = Object.keys(db.files);
      const listDom = engine.ui.newFileListDom(db, fileIDs, "Index");
      dom.appendChild(listDom);
    },
    unloadFile() {
      const dom = document.getElementById("reader");
      dom.innerHTML = "";
    },
    loadFile(db, file) {
      const dom = document.getElementById("reader");
      dom.innerHTML = "";

      /*if (file.image) {
        const imageDom = engine.ui.newDom("IMG", {
          attributes: {src: file.image},
          classes: ['ui-file-img'],
        })
        dom.appendChild(imageDom)
      }*/

      const header = engine.ui.newDom("DIV", {
        classes: ["ui-file-header"],
        children: [
          engine.ui.newDom("SPAN", {
            innerHTML: file.title || file.name,
          }),
        ],
      });

      const headerMenuDom = engine.ui.newDom("DIV") 

      const backButton = engine.ui.newDom("A", {
        classes: ["ui-file-close-button"],
        innerHTML: "🔎︎",
        attributes: { href: "/#/" },
      });
      headerMenuDom.appendChild(backButton);
      
      if (file.id != "menu" && undefined !== db.files["menu"]) {
        const menu = engine.ui.newDom("A", {
          classes: ["ui-file-close-button"],
          innerHTML: "☰",
          attributes: { href: "/#/menu" },
        });
        headerMenuDom.appendChild(menu);
      }

      header.appendChild(headerMenuDom)

      dom.appendChild(header);

      if (undefined !== file.content && file.content.length > 0) {
        const body = engine.ui.newDom("DIV", {
          classes: ["ui-file-body"],
          children: [
            engine.ui.newDom("DIV", {
              innerHTML: mdConverter.makeHtml(file.content),
            }),
          ],
        });
        dom.appendChild(body);
      }

      if (403 == file.mode) {
        const body = engine.ui.newDom("DIV", {
          classes: ["ui-file-body"],
          children: [
            engine.ui.newDom("DIV", {
              innerHTML: "🔒 " + file.keys.join(", "),
              classes: ["ui-locked"],
              title: "Content is not available for your account authorization level yet",
            }),
          ],
        });
        dom.appendChild(body);
      }

      /*if (file.background) {
        const imageDom = engine.ui.newDom("IMG", {
          attributes: {src: file.background},
          classes: ['ui-file-img'],
        })
        dom.appendChild(imageDom)
      }*/
      if (undefined !== file.links && file.links.length > 0) {
        const linksList = engine.ui.newLinkListDom(file.links, "Links")
        dom.appendChild(linksList)
      }

      if (undefined !== file.tags && file.tags.length > 0) {
        const tagList = engine.ui.newFileListDom(db, file.tags, "Tags");
        dom.appendChild(tagList);
      }
      if (undefined !== db.tag[file.id] && db.tag[file.id].length > 0) {
        const tagList = engine.ui.newFileListDom(db, db.tag[file.id], "Tagged");
        dom.appendChild(tagList);
      }

      if (undefined !== file.scores && Object.keys(file.scores).length > 0) {
        const tagList = engine.ui.newFileListDom(db, file.scores, "Rated");
        dom.appendChild(tagList);
      }
      if (
        undefined !== db.score[file.id] &&
        Object.keys(db.score[file.id]).length > 0
      ) {
        const tagList = engine.ui.newFileListDom(
          db,
          db.score[file.id],
          "Rating"
        );
        dom.appendChild(tagList);
      }

      if (undefined !== file.feeds && file.feeds.length > 0) {
        const feedList = engine.ui.newFileListDom(db, file.feeds, "Feeds");
        dom.appendChild(feedList);
      }
      if (undefined !== db.feed[file.id] && db.feed[file.id].length > 0) {
        const feedList = engine.ui.newFileListDom(db, db.feed[file.id], "Menu");
        dom.appendChild(feedList);
      }

      if (undefined !== file.rels && file.rels.length > 0) {
        const relList = engine.ui.newFileListDom(db, file.rels, "Relations");
        dom.appendChild(relList);
      }
      if (undefined !== db.rel[file.id] && db.rel[file.id].length > 0) {
        const relList = engine.ui.newFileListDom(
          db,
          db.rel[file.id],
          "Related"
        );
        dom.appendChild(relList);
      }

      if (undefined !== file.refs && file.refs.length > 0) {
        const refList = engine.ui.newFileListDom(db, file.refs, "Referenced");
        dom.appendChild(refList);
      }
      if (undefined !== db.ref[file.id] && db.ref[file.id].length > 0) {
        const refList = engine.ui.newFileListDom(
          db,
          db.ref[file.id],
          "References"
        );
        dom.appendChild(refList);
      }
    },
  },
  api: {
    fetchDatabase(id, password) {
      const cryptoID = encryption.hashPassword(id, password, "1.0");
      return new Promise(function (resolve, reject) {
        axios
          .get("/db/" + cryptoID + ".dat", {
            responseType: "arraybuffer",
            headers: {
              "Content-Type": "application/octet-stream",
              Accept: "application/octet-stream",
            },
          })
          .then(function ({ data }) {
            const rawJson = encryption.decryptAsString(
              new Uint8Array(data),
              password
            );
            const db = JSON.parse(rawJson);

            for (const tagID in db.tag) {
              for (const taggableID of db.tag[tagID]) {
                const file = db.files[taggableID];
                if (file) {
                  if (undefined == file.tags) {
                    file.tags = [];
                  }
                  file.tags.push(tagID);
                }
              }
            }

            for (const tagID in db.score) {
              for (const scorableID in db.score[tagID]) {
                const score = db.score[tagID][scorableID];
                const file = db.files[scorableID];
                if (file) {
                  if (undefined === file.scores) {
                    file.scores = {};
                  }
                  file.scores[tagID] = score;
                }
              }
            }

            for (const refID in db.ref) {
              for (const referencedID of db.ref[refID]) {
                const file = db.files[referencedID];
                if (file) {
                  if (undefined === file.refs) {
                    file.refs = [];
                  }
                  file.refs.push(refID);
                }
              }
            }

            for (const relID in db.rel) {
              for (const relatedID of db.rel[relID]) {
                const file = db.files[relatedID];
                if (file) {
                  if (undefined === file.rels) {
                    file.rels = [];
                  }
                  file.rels.push(relID);
                }
              }
            }

            for (const feedID in db.feed) {
              for (const feededID of db.feed[feedID]) {
                const file = db.files[feededID];
                if (file) {
                  if (undefined === file.feeds) {
                    file.feeds = [];
                  }
                  file.feeds.push(feedID);
                }
              }
            }

            resolve(db);
          })
          .catch(reject);
      });
    },
  },
};

const dom = document.getElementById("app");
engine.boot(dom);
engine.ui.loadLogin();
